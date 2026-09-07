import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';

import app from '../../app.js';
import { prisma } from '../../lib/prisma.js';

const password = 'valid-password-123';
const email = `auth-${randomUUID()}@example.com`;

describe('authentication API', () => {
    afterAll(async () => {
        await prisma.user.deleteMany({ where: { email } });
        await prisma.$disconnect();
    });

    it('registers a user with a hashed password and token', async () => {
        const response = await request(app).post('/auth/register').send({
            name: 'Marcos',
            email: email.toUpperCase(),
            password
        });

        expect(response.status).toBe(201);
        expect(response.body.token).toEqual(expect.any(String));
        expect(response.body.user.email).toBe(email);
        expect(response.body.user.role).toBe('STUDENT');
        expect(response.body.user.passwordHash).toBeUndefined();

        const user = await prisma.user.findUnique({ where: { email } });
        expect(user).not.toBeNull();
        expect(user?.passwordHash).not.toBe(password);
        expect(await bcrypt.compare(password, user?.passwordHash ?? '')).toBe(true);
    });

    it('rejects a duplicate email without exposing database details', async () => {
        const response = await request(app).post('/auth/register').send({
            name: 'Another User',
            email,
            password
        });

        expect(response.status).toBe(409);
        expect(response.body.error).toEqual({
            code: 'CONFLICT',
            message: 'Recurso já existe.'
        });
    });

    it('rejects invalid registration data', async () => {
        const response = await request(app).post('/auth/register').send({
            name: '',
            email: 'invalid-email',
            password: 'short'
        });

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('logs in with normalized email and returns a token', async () => {
        const response = await request(app).post('/auth/login').send({
            email: email.toUpperCase(),
            password
        });

        expect(response.status).toBe(200);
        expect(response.body.token).toEqual(expect.any(String));
        expect(response.body.user.email).toBe(email);
        expect(response.body.user.role).toBe('STUDENT');
        expect(response.body.user.passwordHash).toBeUndefined();
    });

    it('uses the same generic error for wrong password and unknown user', async () => {
        const wrongPassword = await request(app).post('/auth/login').send({ email, password: 'wrong-password' });
        const unknownUser = await request(app).post('/auth/login').send({
            email: 'unknown@example.com',
            password
        });

        expect(wrongPassword.status).toBe(401);
        expect(unknownUser.status).toBe(401);
        expect(wrongPassword.body).toEqual(unknownUser.body);
    });

    it('returns the authenticated public user from /auth/me', async () => {
        const login = await request(app).post('/auth/login').send({ email, password });
        const response = await request(app)
            .get('/auth/me')
            .set('Authorization', `Bearer ${login.body.token}`);

        expect(response.status).toBe(200);
        expect(response.body.user.email).toBe(email);
        expect(response.body.user.passwordHash).toBeUndefined();
    });

    it('rejects missing, invalid, expired, and unknown-user tokens', async () => {
        const missing = await request(app).get('/auth/me');
        const invalid = await request(app).get('/auth/me').set('Authorization', 'Bearer invalid-token');
        const expiredToken = jwt.sign({}, process.env.JWT_SECRET ?? '', {
            subject: 'expired-user',
            expiresIn: -1,
            issuer: 'ciesa-codelab-api'
        });
        const unknownToken = jwt.sign({}, process.env.JWT_SECRET ?? '', {
            subject: 'unknown-user',
            expiresIn: '15m',
            issuer: 'ciesa-codelab-api'
        });
        const expired = await request(app).get('/auth/me').set('Authorization', `Bearer ${expiredToken}`);
        const unknown = await request(app).get('/auth/me').set('Authorization', `Bearer ${unknownToken}`);

        expect(missing.status).toBe(401);
        expect(invalid.status).toBe(401);
        expect(expired.status).toBe(401);
        expect(unknown.status).toBe(401);
    });
});
