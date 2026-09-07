import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import app from '../../app.js';
import { prisma } from '../../lib/prisma.js';

const password = 'valid-password-123';
const users = {
    student: { name: 'Student', email: `student-${randomUUID()}@example.com` },
    teacher: { name: 'Teacher', email: `teacher-${randomUUID()}@example.com` },
    admin: { name: 'Admin', email: `admin-${randomUUID()}@example.com` }
};

const tokens: Record<keyof typeof users, string> = {
    student: '',
    teacher: '',
    admin: ''
};

async function registerUser(user: (typeof users)[keyof typeof users]) {
    const response = await request(app).post('/auth/register').send({ ...user, password });
    return response.body;
}

describe('users and RBAC', () => {
    beforeAll(async () => {
        const registered = await Promise.all(Object.values(users).map(registerUser));
        const records = await prisma.user.findMany({
            where: { email: { in: Object.values(users).map((user) => user.email) } }
        });

        const student = records.find((user) => user.email === users.student.email);
        const teacher = records.find((user) => user.email === users.teacher.email);
        const admin = records.find((user) => user.email === users.admin.email);

        if (!student || !teacher || !admin) {
            throw new Error('RBAC test users were not created');
        }

        await prisma.user.update({ where: { id: teacher.id }, data: { role: 'TEACHER' } });
        await prisma.user.update({ where: { id: admin.id }, data: { role: 'ADMIN' } });

        tokens.student = registered[0].token;
        tokens.teacher = registered[1].token;
        tokens.admin = registered[2].token;
    });

    afterAll(async () => {
        await prisma.user.deleteMany({ where: { email: { in: Object.values(users).map((user) => user.email) } } });
        await prisma.$disconnect();
    });

    it('returns the persisted role from /auth/me', async () => {
        const response = await request(app).get('/auth/me').set('Authorization', `Bearer ${tokens.student}`);

        expect(response.status).toBe(200);
        expect(response.body.user.role).toBe('STUDENT');
        expect(response.body.user.passwordHash).toBeUndefined();
    });

    it('rejects unauthenticated role changes', async () => {
        const response = await request(app).patch('/users/unknown/role').send({ role: 'TEACHER' });

        expect(response.status).toBe(401);
    });

    it('enforces ADMIN and multi-role authorization', async () => {
        const adminAreaForStudent = await request(app)
            .get('/users/admin-area')
            .set('Authorization', `Bearer ${tokens.student}`);
        const adminAreaForTeacher = await request(app)
            .get('/users/admin-area')
            .set('Authorization', `Bearer ${tokens.teacher}`);
        const adminAreaForAdmin = await request(app)
            .get('/users/admin-area')
            .set('Authorization', `Bearer ${tokens.admin}`);
        const teachingAreaForStudent = await request(app)
            .get('/users/teaching-area')
            .set('Authorization', `Bearer ${tokens.student}`);
        const teachingAreaForTeacher = await request(app)
            .get('/users/teaching-area')
            .set('Authorization', `Bearer ${tokens.teacher}`);
        const teachingAreaForAdmin = await request(app)
            .get('/users/teaching-area')
            .set('Authorization', `Bearer ${tokens.admin}`);

        expect(adminAreaForStudent.status).toBe(403);
        expect(adminAreaForTeacher.status).toBe(403);
        expect(adminAreaForAdmin.status).toBe(200);
        expect(teachingAreaForStudent.status).toBe(403);
        expect(teachingAreaForTeacher.status).toBe(200);
        expect(teachingAreaForAdmin.status).toBe(200);
    });

    it('allows only ADMIN to change roles', async () => {
        const studentAttempt = await request(app)
            .patch('/users/unknown/role')
            .set('Authorization', `Bearer ${tokens.student}`)
            .send({ role: 'TEACHER' });
        const teacherAttempt = await request(app)
            .patch('/users/unknown/role')
            .set('Authorization', `Bearer ${tokens.teacher}`)
            .send({ role: 'ADMIN' });

        expect(studentAttempt.status).toBe(403);
        expect(teacherAttempt.status).toBe(403);
    });

    it('allows ADMIN to change a role and rejects self-promotion by lower roles', async () => {
        const target = await prisma.user.findUnique({ where: { email: users.student.email } });
        const response = await request(app)
            .patch(`/users/${target?.id}/role`)
            .set('Authorization', `Bearer ${tokens.admin}`)
            .send({ role: 'TEACHER' });
        const selfPromotion = await request(app)
            .patch(`/users/${target?.id}/role`)
            .set('Authorization', `Bearer ${tokens.student}`)
            .send({ role: 'ADMIN' });

        expect(response.status).toBe(200);
        expect(response.body.user.role).toBe('TEACHER');
        expect(response.body.user.passwordHash).toBeUndefined();
        expect(selfPromotion.status).toBe(403);
    });

    it('validates role and reports missing users', async () => {
        const invalidRole = await request(app)
            .patch('/users/unknown/role')
            .set('Authorization', `Bearer ${tokens.admin}`)
            .send({ role: 'ROOT' });
        const missingUser = await request(app)
            .patch('/users/unknown/role')
            .set('Authorization', `Bearer ${tokens.admin}`)
            .send({ role: 'STUDENT' });

        expect(invalidRole.status).toBe(400);
        expect(missingUser.status).toBe(404);
    });

});
