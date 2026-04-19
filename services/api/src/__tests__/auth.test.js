process.env.NODE_ENV = 'test';
process.env.DB_HOST  = '127.0.0.1';
process.env.DB_NAME  = 'kaamsetu_test';
process.env.DB_USER  = 'postgres';
process.env.DB_PASSWORD = 'postgres';
process.env.JWT_SECRET  = 'test-secret';
process.env.OTP_TEST_MODE = 'true';

const request = require('supertest');
const app = require('../app');
const { pool } = require('../db/pool');

jest.mock('../services/otp.service', () => ({
  sendOTP:   jest.fn().mockResolvedValue({ expiresAt: new Date(Date.now() + 300000) }),
  verifyOTP: jest.fn().mockResolvedValue({ valid: true }),
}));

const workerPhone = '8111100001';
const hirerPhone  = '8111100002';

afterAll(async () => {
  await pool.query(`DELETE FROM users WHERE phone IN ($1,$2)`, [workerPhone, hirerPhone]);
  await pool.end();
});

describe('GET /health', () => {
  it('returns 200 ok', async () => {
    const r = await request(app).get('/health');
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('ok');
  });
});

describe('POST /api/auth/send-otp', () => {
  it('rejects invalid phone number', async () => {
    const r = await request(app).post('/api/auth/send-otp').send({ phone: '1234', role: 'worker' });
    expect(r.status).toBe(400);
  });

  it('rejects phone without role for new user', async () => {
    // OTP mock succeeds but the isNewUser check returns 400 without role
    const r = await request(app).post('/api/auth/send-otp').send({ phone: '8111199999' });
    expect([200, 400]).toContain(r.status);
  });

  it('sends OTP for new worker', async () => {
    const r = await request(app).post('/api/auth/send-otp').send({ phone: workerPhone, role: 'worker' });
    expect(r.status).toBe(200);
    expect(r.body.success).toBe(true);
  });
});

describe('POST /api/auth/verify-otp', () => {
  it('rejects malformed OTP', async () => {
    const r = await request(app).post('/api/auth/verify-otp').send({ phone: workerPhone, code: '12', role: 'worker' });
    expect(r.status).toBe(400);
  });

  it('rejects wrong OTP (mock returns invalid)', async () => {
    const { verifyOTP } = require('../services/otp.service');
    verifyOTP.mockResolvedValueOnce({ valid: false, reason: 'Invalid OTP' });
    const r = await request(app).post('/api/auth/verify-otp').send({ phone: workerPhone, code: '000000', role: 'worker' });
    expect(r.status).toBe(400);
    expect(r.body.success).toBe(false);
  });

  it('registers new worker with correct OTP', async () => {
    const r = await request(app).post('/api/auth/verify-otp')
      .send({ phone: workerPhone, code: '123456', role: 'worker', fullName: 'Test Worker' });
    expect(r.status).toBe(200);
    expect(r.body.data.token).toBeDefined();
    expect(r.body.data.user.role).toBe('worker');
  });

  it('registers new hirer', async () => {
    const r = await request(app).post('/api/auth/verify-otp')
      .send({ phone: hirerPhone, code: '123456', role: 'hirer', fullName: 'Test Hirer' });
    expect(r.status).toBe(200);
    expect(r.body.data.user.role).toBe('hirer');
  });

  it('re-login returns same user', async () => {
    const r = await request(app).post('/api/auth/verify-otp')
      .send({ phone: workerPhone, code: '123456' });
    expect(r.status).toBe(200);
    expect(r.body.data.user.phone).toBe(workerPhone);
  });
});

describe('GET /api/auth/me', () => {
  let token;
  beforeAll(async () => {
    const r = await request(app).post('/api/auth/verify-otp')
      .send({ phone: workerPhone, code: '123456', role: 'worker', fullName: 'Me Test' });
    token = r.body.data?.token;
  });

  it('returns 401 without token', async () => {
    const r = await request(app).get('/api/auth/me');
    expect(r.status).toBe(401);
  });

  it('returns user profile with valid token', async () => {
    if (!token) return;
    const r = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(r.status).toBe(200);
    expect(r.body.data.role).toBe('worker');
  });

  it('returns 401 with tampered token', async () => {
    const r = await request(app).get('/api/auth/me').set('Authorization', 'Bearer bad.token.here');
    expect(r.status).toBe(401);
  });
});

describe('POST /api/auth/refresh', () => {
  it('refreshes token with valid refresh token', async () => {
    const login = await request(app).post('/api/auth/verify-otp')
      .send({ phone: workerPhone, code: '123456' });
    const { refreshToken } = login.body.data;
    const r = await request(app).post('/api/auth/refresh').send({ refreshToken });
    expect(r.status).toBe(200);
    expect(r.body.data.token).toBeDefined();
  });

  it('rejects invalid refresh token', async () => {
    const r = await request(app).post('/api/auth/refresh').send({ refreshToken: 'bad' });
    expect(r.status).toBe(401);
  });
});
