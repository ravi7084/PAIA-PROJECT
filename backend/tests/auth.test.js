/**
 * ╔══════════════════════════════════════════════╗
 * ║   PAIA — Auth Tests                          ║
 * ║   Jest + Supertest — 17 test cases           ║
 * ╚══════════════════════════════════════════════╝
 */

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/user.model');

// ─────────────────────────────────────────────────
//  SETUP & TEARDOWN
// ─────────────────────────────────────────────────

const testUser = {
    name: 'Test User',
    email: 'test@paia.dev',
    password: 'Test1234',
    confirmPassword: 'Test1234',
};

let accessToken = '';
let refreshToken = '';

beforeAll(async() => {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/paia_test');
    await User.deleteMany({ email: testUser.email });
});

afterAll(async() => {
    await User.deleteMany({ email: testUser.email });
    await mongoose.connection.close();
});

// ─────────────────────────────────────────────────
//  REGISTER
// ─────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
    it('should register a new user', async() => {
        const res = await request(app).post('/api/auth/register').send(testUser);
        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.user.email).toBe(testUser.email);
        expect(res.body.data.accessToken).toBeDefined();
        accessToken = res.body.data.accessToken;
        refreshToken = res.body.data.refreshToken;
    });

    it('should reject duplicate email', async() => {
        const res = await request(app).post('/api/auth/register').send(testUser);
        expect(res.status).toBe(409);
        expect(res.body.success).toBe(false);
    });

    it('should reject weak password', async() => {
        const res = await request(app).post('/api/auth/register').send({
            ...testUser,
            email: 'weak@paia.dev',
            password: '123',
            confirmPassword: '123',
        });
        expect(res.status).toBe(422);
    });

    it('should reject missing name', async() => {
        const res = await request(app).post('/api/auth/register').send({
            email: 'no@paia.dev',
            password: 'Test1234',
            confirmPassword: 'Test1234',
        });
        expect(res.status).toBe(422);
    });

    it('should reject mismatched passwords', async() => {
        const res = await request(app).post('/api/auth/register').send({
            name: 'Test',
            email: 'mismatch@paia.dev',
            password: 'Test1234',
            confirmPassword: 'Test5678',
        });
        expect(res.status).toBe(422);
    });
});

// ─────────────────────────────────────────────────
//  LOGIN
// ─────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
    it('should login with correct credentials', async() => {
        const res = await request(app).post('/api/auth/login').send({
            email: testUser.email,
            password: testUser.password,
        });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.accessToken).toBeDefined();
        accessToken = res.body.data.accessToken;
    });

    it('should reject wrong password', async() => {
        const res = await request(app).post('/api/auth/login').send({
            email: testUser.email,
            password: 'WrongPass1',
        });
        expect(res.status).toBe(401);
    });

    it('should reject non-existent email', async() => {
        const res = await request(app).post('/api/auth/login').send({
            email: 'ghost@paia.dev',
            password: 'Test1234',
        });
        expect(res.status).toBe(401);
    });
});

// ─────────────────────────────────────────────────
//  PROTECTED ROUTES
// ─────────────────────────────────────────────────

describe('GET /api/auth/me', () => {
    it('should return current user with valid token', async() => {
        const res = await request(app)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${accessToken}`);
        expect(res.status).toBe(200);
        expect(res.body.data.user.email).toBe(testUser.email);
    });

    it('should reject request without token', async() => {
        const res = await request(app).get('/api/auth/me');
        expect(res.status).toBe(401);
    });

    it('should reject invalid token', async() => {
        const res = await request(app)
            .get('/api/auth/me')
            .set('Authorization', 'Bearer invalidtoken123');
        expect(res.status).toBe(401);
    });
});

// ─────────────────────────────────────────────────
//  LOGOUT
// ─────────────────────────────────────────────────

describe('POST /api/auth/logout', () => {
    it('should logout successfully', async() => {
        const res = await request(app)
            .post('/api/auth/logout')
            .set('Authorization', `Bearer ${accessToken}`);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });
});

// ─────────────────────────────────────────────────
//  FORGOT PASSWORD
// ─────────────────────────────────────────────────

describe('POST /api/auth/forgot-password', () => {
    it('should respond success even for unknown email (security)', async() => {
        const res = await request(app)
            .post('/api/auth/forgot-password')
            .send({ email: 'ghost@paia.dev' });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('should respond success for known email', async() => {
        const res = await request(app)
            .post('/api/auth/forgot-password')
            .send({ email: testUser.email });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('should reject invalid email format', async() => {
        const res = await request(app)
            .post('/api/auth/forgot-password')
            .send({ email: 'not-an-email' });
        expect(res.status).toBe(422);
    });
});

// ─────────────────────────────────────────────────
//  PROFILE
// ─────────────────────────────────────────────────

describe('GET /api/user/profile', () => {
    it('should get user profile with fresh login', async() => {
        const loginRes = await request(app).post('/api/auth/login').send({
            email: testUser.email,
            password: testUser.password,
        });
        const token = loginRes.body.data.accessToken;

        const res = await request(app)
            .get('/api/user/profile')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.data.user.name).toBe(testUser.name);
    });
});

// ─────────────────────────────────────────────────
//  DASHBOARD STATS
// ─────────────────────────────────────────────────

describe('GET /api/user/dashboard-stats', () => {
    it('should return dashboard stats', async() => {
        const loginRes = await request(app).post('/api/auth/login').send({
            email: testUser.email,
            password: testUser.password,
        });
        const token = loginRes.body.data.accessToken;

        const res = await request(app)
            .get('/api/user/dashboard-stats')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.data.stats).toBeDefined();
        expect(res.body.data.stats.totalScans).toBe(0);
    });
});