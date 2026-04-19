process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret_key';

jest.mock('../config/db', () => jest.fn(() => Promise.resolve()));

const request = require('supertest');
const jwt = require('jsonwebtoken');

// Helper: Returns a Promise that ALSO has .select() and .populate() methods.
// This mirrors how Mongoose queries can be chained or awaited directly.
const qResult = (val) => {
  const p = Promise.resolve(val);
  p.select = () => Promise.resolve(val);
  p.populate = () => Promise.resolve(val);
  return p;
};

// ---- Shared test data ----
const mockUserId = '64a000000000000000000001';
const mockEmployerId = '64a000000000000000000002';
const mockAdminId = '64a000000000000000000003';
const mockJobId = '64b000000000000000000001';
const mockAppId = '64c000000000000000000001';

// ---- Mocked models ----
jest.mock('../models/User', () => ({
  findOne: jest.fn(),
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  create: jest.fn(),
  countDocuments: jest.fn(),
  find: jest.fn(),
  deleteOne: jest.fn(),
}));

jest.mock('../models/Job', () => ({
  find: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  countDocuments: jest.fn(),
  deleteOne: jest.fn(),
}));

jest.mock('../models/Application', () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  deleteMany: jest.fn(),
  deleteOne: jest.fn(),
  countDocuments: jest.fn(),
}));

// Load app AFTER mocks are set up
const { app, server } = require('../server');
const User = require('../models/User');
const Job = require('../models/Job');
const Application = require('../models/Application');

const makeToken = (id) => jwt.sign({ id }, 'test_secret_key', { expiresIn: '1h' });

// User objects
const userObj = { _id: mockUserId, name: 'Test User', email: 'user@example.com', role: 'user', isActive: true, matchPassword: jest.fn() };
const employerObj = { _id: mockEmployerId, name: 'Employer', email: 'emp@example.com', role: 'employer', companyName: 'Corp', isActive: true, matchPassword: jest.fn() };
const adminObj = { _id: mockAdminId, name: 'Admin', email: 'admin@example.com', role: 'admin', isActive: true, matchPassword: jest.fn() };

const jobObj = { _id: mockJobId, title: 'SE', description: 'Dev', location: 'Bangalore', jobType: 'full-time', category: 'Technology', companyName: 'Corp', employer: mockEmployerId, isActive: true, views: 0, skills: [], save: jest.fn() };

const appObj = {
  _id: mockAppId,
  job: { _id: mockJobId, title: 'SE', employer: mockEmployerId, companyName: 'Corp', location: 'Bangalore' },
  applicant: userObj,
  status: 'pending',
  save: jest.fn(function () { return Promise.resolve(this); }),
  populate: jest.fn(function () { return Promise.resolve(this); }),
};

const userToken = makeToken(mockUserId);
const employerToken = makeToken(mockEmployerId);
const adminToken = makeToken(mockAdminId);

// Reset mocks between tests
beforeEach(() => {
  jest.clearAllMocks();

  // Default User mocks
  User.findOne.mockImplementation(() => qResult(null));
  User.findById.mockImplementation((id) => {
    const map = { [mockUserId]: userObj, [mockEmployerId]: employerObj, [mockAdminId]: adminObj };
    return qResult(map[id] || null);
  });
  User.create.mockImplementation((data) => Promise.resolve({ ...data, _id: mockUserId, save: jest.fn(), matchPassword: jest.fn() }));
  User.findByIdAndUpdate.mockImplementation((id, updates) => Promise.resolve({ ...userObj, ...updates }));
  User.countDocuments.mockResolvedValue(5);
  User.find.mockImplementation(() => ({ sort: () => ({ skip: () => ({ limit: () => Promise.resolve([userObj, employerObj]) }) }) }));
  User.deleteOne.mockResolvedValue({ deletedCount: 1 });

  // Default Job mocks
  Job.findById.mockImplementation((id) => qResult(id === mockJobId ? jobObj : null));
  Job.create.mockResolvedValue(jobObj);
  Job.findByIdAndUpdate.mockResolvedValue(jobObj);
  Job.countDocuments.mockResolvedValue(1);
  Job.find.mockImplementation(() => ({ populate: () => ({ sort: () => ({ skip: () => ({ limit: () => Promise.resolve([jobObj]) }) }) }) }));
  Job.deleteOne.mockResolvedValue({ deletedCount: 1 });

  // Default Application mocks
  Application.findOne.mockResolvedValue(null);
  Application.create.mockResolvedValue({ ...appObj, populate: jest.fn(function () { return Promise.resolve(this); }) });
  Application.findById.mockResolvedValue({ ...appObj });
  Application.find.mockImplementation(() => ({ populate: () => ({ sort: () => Promise.resolve([appObj]) }) }));
  Application.deleteOne.mockResolvedValue({ deletedCount: 1 });
  Application.deleteMany.mockResolvedValue({});
  Application.countDocuments.mockResolvedValue(3);
});

afterAll(() => { server.close(); });

// ===== TESTS =====

describe('Health Check', () => {
  it('GET /api/health returns 200', async () => {
    const res = await request(app).get('/api/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('Auth API', () => {
  it('POST /register - creates a new user', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'New User', email: 'new@example.com', password: 'password123', role: 'user',
    });
    expect(res.statusCode).toBe(201);
    expect(res.body.token).toBeDefined();
  });

  it('POST /register - registers employer', async () => {
    User.create.mockResolvedValueOnce({ ...employerObj, save: jest.fn(), matchPassword: jest.fn() });
    const res = await request(app).post('/api/auth/register').send({
      name: 'Emp', email: 'emp2@example.com', password: 'password123', role: 'employer', companyName: 'Corp',
    });
    expect(res.statusCode).toBe(201);
  });

  it('POST /register - rejects duplicate email', async () => {
    User.findOne.mockImplementationOnce(() => qResult(userObj));
    const res = await request(app).post('/api/auth/register').send({
      name: 'Dup', email: 'user@example.com', password: 'password123',
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /register - validates required fields', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'x@x.com' });
    expect(res.statusCode).toBe(400);
  });

  it('POST /login - succeeds with correct password', async () => {
    userObj.matchPassword.mockResolvedValueOnce(true);
    User.findOne.mockImplementationOnce(() => qResult(userObj));
    const res = await request(app).post('/api/auth/login').send({
      email: 'user@example.com', password: 'password123',
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('POST /login - rejects wrong password', async () => {
    userObj.matchPassword.mockResolvedValueOnce(false);
    User.findOne.mockImplementationOnce(() => qResult(userObj));
    const res = await request(app).post('/api/auth/login').send({
      email: 'user@example.com', password: 'wrong',
    });
    expect(res.statusCode).toBe(401);
  });

  it('POST /login - rejects unknown user', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'nobody@x.com', password: 'pass',
    });
    expect(res.statusCode).toBe(401);
  });

  it('GET /me - returns user with valid token', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${userToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.user.email).toBe('user@example.com');
  });

  it('GET /me - rejects request without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.statusCode).toBe(401);
  });
});

describe('Jobs API', () => {
  it('GET /api/jobs - lists jobs publicly (no auth)', async () => {
    const res = await request(app).get('/api/jobs');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.jobs)).toBe(true);
  });

  it('GET /api/jobs/:id - returns job details', async () => {
    const res = await request(app).get(`/api/jobs/${mockJobId}`);
    expect(res.statusCode).toBe(200);
  });

  it('GET /api/jobs/:id - 404 for unknown job', async () => {
    Job.findById.mockImplementationOnce(() => qResult(null));
    const res = await request(app).get('/api/jobs/000000000000000000000099');
    expect(res.statusCode).toBe(404);
  });

  it('POST /api/jobs - employer creates a job', async () => {
    const res = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${employerToken}`)
      .send({ title: 'DevOps', description: 'Cloud infra', location: 'Pune', jobType: 'full-time', category: 'Technology', companyName: 'Corp' });
    expect(res.statusCode).toBe(201);
  });

  it('POST /api/jobs - user role cannot create job', async () => {
    const res = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ title: 'T', description: 'T', location: 'T', jobType: 'full-time', category: 'T', companyName: 'T' });
    expect(res.statusCode).toBe(403);
  });

  it('GET /api/jobs/my - employer gets own jobs', async () => {
    Job.find.mockImplementationOnce(() => ({ sort: () => Promise.resolve([jobObj]) }));
    const res = await request(app)
      .get('/api/jobs/my')
      .set('Authorization', `Bearer ${employerToken}`);
    expect(res.statusCode).toBe(200);
  });
});

describe('Applications API', () => {
  it('POST /api/applications/:jobId - user applies for a job', async () => {
    const res = await request(app)
      .post(`/api/applications/${mockJobId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ coverLetter: 'I am interested in this role.' });
    expect(res.statusCode).toBe(201);
    expect(res.body.application).toBeDefined();
  });

  it('POST /api/applications/:jobId - blocks duplicate application', async () => {
    Application.findOne.mockResolvedValueOnce(appObj);
    const res = await request(app)
      .post(`/api/applications/${mockJobId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ coverLetter: 'Trying again' });
    expect(res.statusCode).toBe(400);
  });

  it('GET /api/applications/my - user sees their applications', async () => {
    const res = await request(app)
      .get('/api/applications/my')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.applications)).toBe(true);
  });

  it('GET /api/applications/job/:jobId - employer sees job applications', async () => {
    const res = await request(app)
      .get(`/api/applications/job/${mockJobId}`)
      .set('Authorization', `Bearer ${employerToken}`);
    expect(res.statusCode).toBe(200);
  });
});

describe('Role-Based Access Control', () => {
  it('Admin route - denies user role', async () => {
    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.statusCode).toBe(403);
  });

  it('Admin route - denies employer role', async () => {
    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${employerToken}`);
    expect(res.statusCode).toBe(403);
  });

  it('Admin route - allows admin role', async () => {
    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.stats).toBeDefined();
  });

  it('Admin users endpoint - returns users list', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.users).toBeDefined();
  });
});
