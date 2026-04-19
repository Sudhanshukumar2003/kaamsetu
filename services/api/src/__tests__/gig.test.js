process.env.NODE_ENV = 'test';
process.env.DB_HOST  = '127.0.0.1';
process.env.DB_NAME  = 'kaamsetu_test';
process.env.DB_USER  = 'postgres';
process.env.DB_PASSWORD = 'postgres';
process.env.JWT_SECRET  = 'test-secret';
process.env.OTP_TEST_MODE = 'true';

const request = require('supertest');
const app  = require('../app');
const { pool } = require('../db/pool');

jest.mock('../services/otp.service', () => ({
  sendOTP:   jest.fn().mockResolvedValue({ expiresAt: new Date(Date.now() + 300000) }),
  verifyOTP: jest.fn().mockResolvedValue({ valid: true }),
}));
jest.mock('../services/notification.service', () => ({
  notifyGigAccepted:     jest.fn().mockResolvedValue(),
  notifyNewGigMatch:     jest.fn().mockResolvedValue(),
  notifyCheckin:         jest.fn().mockResolvedValue(),
  notifyWorkerComplete:  jest.fn().mockResolvedValue(),
  notifyPaymentReleased: jest.fn().mockResolvedValue(),
}));
jest.mock('../services/kyc.service', () => ({
  initiateAadhaarOTP: jest.fn().mockResolvedValue({ requestId: 'mock-req-001' }),
  verifyAadhaarOTP:   jest.fn().mockResolvedValue({
    success: true, name: 'Ramesh Kumar', dob: '1992-06-15', faceMatchScore: 0.96,
  }),
}));
jest.mock('../services/payment.service', () => ({
  createEscrowOrder:      jest.fn().mockResolvedValue({ paymentId: 'p1', razorpayOrderId: 'o1', grossAmount: 75000 }),
  releaseEscrow:          jest.fn().mockResolvedValue({ workerAmount: 67500 }),
  verifyWebhookSignature: jest.fn().mockReturnValue(true),
  calculateAmounts:       jest.fn().mockReturnValue({ platformFee: 7500, workerAmount: 67500 }),
}));

// ─── helpers ─────────────────────────────────────────────────────────
const register = async (phone, role, name) => {
  await request(app).post('/api/auth/send-otp').send({ phone, role });
  const r = await request(app).post('/api/auth/verify-otp')
    .send({ phone, code: '123456', role, fullName: name });
  if (!r.body.data) throw new Error('register failed: ' + JSON.stringify(r.body));
  return { token: r.body.data.token, userId: r.body.data.user.id };
};

const cleanupUsers = async (phones) => {
  try {
    const uids = (await pool.query(
      'SELECT id FROM users WHERE phone = ANY($1::text[])', [phones]
    )).rows.map(r => r.id);
    if (!uids.length) return;

    const wps = (await pool.query('SELECT id FROM worker_profiles WHERE user_id = ANY($1::uuid[])', [uids])).rows.map(r => r.id);
    const hps = (await pool.query('SELECT id FROM hirer_profiles  WHERE user_id = ANY($1::uuid[])', [uids])).rows.map(r => r.id);
    const pids = [...wps, ...hps];

    if (pids.length) {
      const gids = (await pool.query(
        'SELECT id FROM gigs WHERE hirer_id = ANY($1::uuid[]) OR worker_id = ANY($1::uuid[])', [pids]
      )).rows.map(r => r.id);

      if (gids.length) {
        await pool.query('DELETE FROM reviews  WHERE gig_id = ANY($1::uuid[])', [gids]);
        await pool.query('DELETE FROM payments WHERE gig_id = ANY($1::uuid[])', [gids]);
        await pool.query('DELETE FROM disputes WHERE gig_id = ANY($1::uuid[])', [gids]);
        await pool.query('DELETE FROM gigs     WHERE id     = ANY($1::uuid[])', [gids]);
      }
      if (wps.length) await pool.query('DELETE FROM worker_bank_details WHERE worker_id = ANY($1::uuid[])', [wps]);
    }

    await pool.query('DELETE FROM notifications  WHERE user_id = ANY($1::uuid[])', [uids]);
    await pool.query('DELETE FROM worker_profiles WHERE user_id = ANY($1::uuid[])', [uids]);
    await pool.query('DELETE FROM hirer_profiles  WHERE user_id = ANY($1::uuid[])', [uids]);
    await pool.query('DELETE FROM otp_codes       WHERE phone = ANY($1::text[])',   [phones]);
    await pool.query('DELETE FROM users           WHERE id    = ANY($1::uuid[])',   [uids]);
  } catch (e) { console.warn('Cleanup warning:', e.message); }
};

// ─── shared state ────────────────────────────────────────────────────
const HIRER_PHONE  = '8333300001';
const WORKER_PHONE = '8333300002';
let hirerToken, workerToken, gigId;

beforeAll(async () => {
  await cleanupUsers([HIRER_PHONE, WORKER_PHONE]);

  const h = await register(HIRER_PHONE,  'hirer',  'Society Manager');
  const w = await register(WORKER_PHONE, 'worker', 'Ramesh Electrician');
  hirerToken  = h.token;
  workerToken = w.token;

  // Setup worker: trade + location
  await request(app).put('/api/workers/me')
    .set('Authorization', 'Bearer ' + workerToken)
    .send({ tradeSlug: 'electrician', skillLevel: 'intermediate', city: 'Hyderabad', lat: 17.38, lng: 78.47 });

  // KYC flow
  await request(app).post('/api/workers/me/kyc/initiate')
    .set('Authorization', 'Bearer ' + workerToken)
    .send({ aadhaarNumber: '234567890123' });

  await request(app).post('/api/workers/me/kyc/verify')
    .set('Authorization', 'Bearer ' + workerToken)
    .send({ requestId: 'mock-req-001', otp: '123456', selfieBase64: 'data:image/jpeg;base64,/9j/fakedata' });

  // Set available
  await request(app).post('/api/workers/me/availability')
    .set('Authorization', 'Bearer ' + workerToken)
    .send({ isAvailable: true });
});

afterAll(async () => {
  await cleanupUsers([HIRER_PHONE, WORKER_PHONE, '8333300099']);
  await pool.end();
});

// ═══════════════════════════════════════════════════════════════════════
describe('GET /api/trades', () => {
  it('lists all active trades', async () => {
    const r = await request(app).get('/api/trades');
    expect(r.status).toBe(200);
    expect(r.body.data.length).toBeGreaterThanOrEqual(10);
    expect(r.body.data.find(t => t.slug === 'electrician')).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════════
describe('Worker profile', () => {
  it('GET /api/workers/me returns verified profile', async () => {
    const r = await request(app).get('/api/workers/me')
      .set('Authorization', 'Bearer ' + workerToken);
    expect(r.status).toBe(200);
    expect(r.body.data.kyc_status).toBe('verified');
    expect(r.body.data.trade_slug).toBe('electrician');
  });

  it('hirer cannot access worker route', async () => {
    const r = await request(app).get('/api/workers/me')
      .set('Authorization', 'Bearer ' + hirerToken);
    expect(r.status).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════════════════
describe('POST /api/gigs — create', () => {
  it('hirer creates a gig successfully', async () => {
    const r = await request(app).post('/api/gigs')
      .set('Authorization', 'Bearer ' + hirerToken)
      .send({
        tradeSlug: 'electrician',
        title: 'Fix all wiring in society clubhouse',
        requiredSkillLevel: 'intermediate',
        address: '12 Jubilee Hills', city: 'Hyderabad',
        lat: 17.38, lng: 78.47,
        startDate: '2025-12-20',
        estimatedHours: 6,
        budgetMin: 60000, budgetMax: 90000,
      });
    expect(r.status).toBe(201);
    expect(r.body.data.status).toBe('open');
    gigId = r.body.data.id;
  });

  it('worker cannot create a gig', async () => {
    const r = await request(app).post('/api/gigs')
      .set('Authorization', 'Bearer ' + workerToken)
      .send({ tradeSlug: 'electrician', title: 'x', address: 'y', city: 'Hyderabad', lat: 17.38, lng: 78.47, startDate: '2025-12-20', budgetMin: 60000, budgetMax: 90000 });
    expect(r.status).toBe(403);
  });

  it('rejects missing required fields', async () => {
    const r = await request(app).post('/api/gigs')
      .set('Authorization', 'Bearer ' + hirerToken)
      .send({ tradeSlug: 'electrician', city: 'Hyderabad' });
    expect(r.status).toBe(400);
  });

  it('rejects budgetMax < budgetMin', async () => {
    const r = await request(app).post('/api/gigs')
      .set('Authorization', 'Bearer ' + hirerToken)
      .send({ tradeSlug: 'electrician', title: 'Test', address: 'x', city: 'Hyderabad', lat: 17.38, lng: 78.47, startDate: '2025-12-20', budgetMin: 90000, budgetMax: 50000 });
    expect(r.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════════════
describe('GET /api/gigs', () => {
  it('hirer sees their own gigs', async () => {
    const r = await request(app).get('/api/gigs')
      .set('Authorization', 'Bearer ' + hirerToken);
    expect(r.status).toBe(200);
    expect(r.body.data.length).toBeGreaterThan(0);
  });

  it('GET /api/gigs/:id returns gig details', async () => {
    if (!gigId) return;
    const r = await request(app).get('/api/gigs/' + gigId)
      .set('Authorization', 'Bearer ' + hirerToken);
    expect(r.status).toBe(200);
    expect(r.body.data.title).toContain('society clubhouse');
  });

  it('returns 400 for invalid UUID', async () => {
    const r = await request(app).get('/api/gigs/not-a-uuid')
      .set('Authorization', 'Bearer ' + hirerToken);
    expect(r.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════════════
describe('GET /api/gigs/matches', () => {
  it('verified worker sees nearby matches', async () => {
    const r = await request(app).get('/api/gigs/matches')
      .set('Authorization', 'Bearer ' + workerToken);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.data)).toBe(true);
  });

  it('unverified worker is blocked', async () => {
    await cleanupUsers(['8333300099']);
    const { token: t } = await register('8333300099', 'worker', 'No KYC Worker');
    const r = await request(app).get('/api/gigs/matches')
      .set('Authorization', 'Bearer ' + t);
    expect(r.status).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════════════════
describe('Gig lifecycle — accept → checkin → complete → confirm → review', () => {
  it('worker accepts gig with amount in range', async () => {
    if (!gigId) return;
    const r = await request(app).post('/api/gigs/' + gigId + '/accept')
      .set('Authorization', 'Bearer ' + workerToken)
      .send({ agreedAmount: 75000 });
    expect(r.status).toBe(200);
    expect(r.body.data.agreedAmount).toBe(75000);
  });

  it('double-accept returns 409 conflict', async () => {
    if (!gigId) return;
    const r = await request(app).post('/api/gigs/' + gigId + '/accept')
      .set('Authorization', 'Bearer ' + workerToken)
      .send({ agreedAmount: 75000 });
    expect(r.status).toBe(409);
  });

  it('worker checks in at job site', async () => {
    if (!gigId) return;
    const r = await request(app).post('/api/gigs/' + gigId + '/checkin')
      .set('Authorization', 'Bearer ' + workerToken)
      .send({ lat: 17.3801, lng: 78.4701 });
    expect(r.status).toBe(200);
    expect(r.body.data.checkedIn).toBe(true);
  });

  it('worker marks job complete', async () => {
    if (!gigId) return;
    const r = await request(app).post('/api/gigs/' + gigId + '/complete')
      .set('Authorization', 'Bearer ' + workerToken);
    expect(r.status).toBe(200);
  });

  it('hirer confirms completion and payment releases', async () => {
    if (!gigId) return;
    // Seed escrow_held payment
    await pool.query(
      'INSERT INTO payments (gig_id, hirer_id, worker_id, gross_amount, platform_fee, worker_amount, status) ' +
      "SELECT g.id, g.hirer_id, g.worker_id, 75000, 7500, 67500, 'escrow_held'::payment_status FROM gigs g WHERE g.id = $1 " +
      'ON CONFLICT (gig_id) DO UPDATE SET status = ' + "'escrow_held'::payment_status",
      [gigId]
    );
    const r = await request(app).post('/api/gigs/' + gigId + '/confirm')
      .set('Authorization', 'Bearer ' + hirerToken);
    expect(r.status).toBe(200);
  });

  it('hirer reviews worker after completion', async () => {
    if (!gigId) return;
    const r = await request(app).post('/api/reviews')
      .set('Authorization', 'Bearer ' + hirerToken)
      .send({ gigId, rating: 5, comment: 'Excellent wiring work!', quality: 5, punctuality: 5 });
    expect(r.status).toBe(201);
  });

  it('prevents duplicate review from same user', async () => {
    if (!gigId) return;
    const r = await request(app).post('/api/reviews')
      .set('Authorization', 'Bearer ' + hirerToken)
      .send({ gigId, rating: 3, comment: 'Second attempt' });
    expect(r.status).toBe(409);
  });

  it('worker reviews hirer', async () => {
    if (!gigId) return;
    const r = await request(app).post('/api/reviews')
      .set('Authorization', 'Bearer ' + workerToken)
      .send({ gigId, rating: 4, comment: 'Good hirer, paid promptly.' });
    expect(r.status).toBe(201);
  });
});

// ═══════════════════════════════════════════════════════════════════════
describe('POST /api/gigs/:id/dispute', () => {
  it('raises a dispute on an in-progress gig', async () => {
    // Create a fresh gig to dispute
    const gig = (await request(app).post('/api/gigs')
      .set('Authorization', 'Bearer ' + hirerToken)
      .send({
        tradeSlug: 'plumber', title: 'Fix leaking pipe', address: 'x', city: 'Hyderabad',
        lat: 17.38, lng: 78.47, startDate: '2025-12-22', budgetMin: 30000, budgetMax: 50000,
      })).body.data;

    // Accept + checkin to get to in_progress
    await request(app).post('/api/gigs/' + gig.id + '/accept')
      .set('Authorization', 'Bearer ' + workerToken).send({ agreedAmount: 40000 });
    await request(app).post('/api/gigs/' + gig.id + '/checkin')
      .set('Authorization', 'Bearer ' + workerToken).send({ lat: 17.38, lng: 78.47 });

    const r = await request(app).post('/api/gigs/' + gig.id + '/dispute')
      .set('Authorization', 'Bearer ' + hirerToken)
      .send({ reason: 'Poor quality work', description: 'Worker did not complete the job as described in the agreement.' });
    expect(r.status).toBe(201);
    expect(r.body.data.disputeId).toBeDefined();
  });
});
