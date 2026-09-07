import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import app from '../../app.js';
import { prisma } from '../../lib/prisma.js';

const password = 'valid-password-123';
const emails = {
  admin: `exercise-admin-${randomUUID()}@example.com`,
  teacher: `exercise-teacher-${randomUUID()}@example.com`,
  outsiderTeacher: `exercise-outsider-${randomUUID()}@example.com`,
  student: `exercise-student-${randomUUID()}@example.com`,
  outsiderStudent: `exercise-outsider-student-${randomUUID()}@example.com`
};

const tokens = { admin: '', teacher: '', outsiderTeacher: '', student: '', outsiderStudent: '' };
let courseId = '';
let otherCourseId = '';
let exerciseId = '';

async function register(email: string, name: string) {
  const response = await request(app).post('/auth/register').send({ name, email, password });
  return response.body.token as string;
}

describe('exercises API', () => {
  beforeAll(async () => {
    tokens.admin = await register(emails.admin, 'Exercise Admin');
    tokens.teacher = await register(emails.teacher, 'Exercise Teacher');
    tokens.outsiderTeacher = await register(emails.outsiderTeacher, 'Outsider Teacher');
    tokens.student = await register(emails.student, 'Exercise Student');
    tokens.outsiderStudent = await register(emails.outsiderStudent, 'Outsider Student');

    const users = await prisma.user.findMany({
      where: { email: { in: Object.values(emails) } },
      select: { id: true, email: true }
    });
    const userId = (email: string) => users.find((user) => user.email === email)?.id;
    const requiredUserId = (email: string) => {
      const id = userId(email);
      if (!id) throw new Error(`Test user not found: ${email}`);
      return id;
    };

    await prisma.user.update({ where: { id: requiredUserId(emails.admin) }, data: { role: 'ADMIN' } });
    await prisma.user.update({ where: { id: requiredUserId(emails.teacher) }, data: { role: 'TEACHER' } });
    await prisma.user.update({ where: { id: requiredUserId(emails.outsiderTeacher) }, data: { role: 'TEACHER' } });

    const course = await prisma.course.create({
      data: {
        name: 'Exercise Course',
        code: `EX-${randomUUID()}`
      }
    });
    courseId = course.id;

    const otherCourse = await prisma.course.create({ data: { name: 'Other Course', code: `OTHER-${randomUUID()}` } });
    otherCourseId = otherCourse.id;

    await prisma.class.create({
      data: {
        name: 'Exercise Class',
        code: `EX-CLASS-${randomUUID()}`,
        semester: '2026.2',
        courseId,
        teacherId: requiredUserId(emails.teacher)
      }
    });
    await prisma.class.create({
      data: {
        name: 'Outsider Class',
        code: `EX-OUT-${randomUUID()}`,
        semester: '2026.2',
        courseId: otherCourseId,
        teacherId: requiredUserId(emails.outsiderTeacher)
      }
    });

    const teachingClass = await prisma.class.findFirst({ where: { courseId, teacherId: userId(emails.teacher) } });
    if (!teachingClass) throw new Error('Teaching test class was not created');
    await prisma.enrollment.create({
      data: { classId: teachingClass.id, studentId: requiredUserId(emails.student) }
    });
  });

  afterAll(async () => {
    await prisma.exercise.deleteMany({ where: { courseId } });
    await prisma.enrollment.deleteMany({ where: { student: { email: { in: Object.values(emails) } } } });
    await prisma.class.deleteMany({ where: { courseId: { in: [courseId, otherCourseId] } } });
    await prisma.course.deleteMany({ where: { id: { in: [courseId, otherCourseId] } } });
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.$disconnect();
  });

  it('requires authentication and validates required fields', async () => {
    const unauthenticated = await request(app).post('/exercises').send({});
    const invalid = await request(app)
      .post('/exercises')
      .set('Authorization', `Bearer ${tokens.admin}`)
      .send({ courseId, title: '', statement: 'statement', difficulty: 'INVALID' });

    expect(unauthenticated.status).toBe(401);
    expect(invalid.status).toBe(400);
  });

  it('returns 404 for an unknown course', async () => {
    const response = await request(app)
      .post('/exercises')
      .set('Authorization', `Bearer ${tokens.admin}`)
      .send({ courseId: 'missing-course', title: 'Title', statement: 'Statement' });

    expect(response.status).toBe(404);
  });

  it('allows ADMIN and an authorized TEACHER to create exercises', async () => {
    const adminResponse = await request(app)
      .post('/exercises')
      .set('Authorization', `Bearer ${tokens.admin}`)
      .send({ courseId, title: 'Admin Exercise', statement: 'Solve it', difficulty: 'EASY' });
    const teacherResponse = await request(app)
      .post('/exercises')
      .set('Authorization', `Bearer ${tokens.teacher}`)
      .send({ courseId, title: 'Teacher Exercise', statement: 'Solve it', difficulty: 'MEDIUM' });

    expect(adminResponse.status).toBe(201);
    expect(teacherResponse.status).toBe(201);
    expect(adminResponse.body.passwordHash).toBeUndefined();
    exerciseId = adminResponse.body.id;
  });

  it('rejects STUDENT and unrelated TEACHER writes', async () => {
    const studentResponse = await request(app)
      .post('/exercises')
      .set('Authorization', `Bearer ${tokens.student}`)
      .send({ courseId, title: 'Student Exercise', statement: 'Forbidden' });
    const outsiderResponse = await request(app)
      .post('/exercises')
      .set('Authorization', `Bearer ${tokens.outsiderTeacher}`)
      .send({ courseId, title: 'Outsider Exercise', statement: 'Forbidden' });

    expect(studentResponse.status).toBe(403);
    expect(outsiderResponse.status).toBe(403);
  });

  it('allows ADMIN, enrolled STUDENT, and authorized TEACHER to read exercises', async () => {
    const adminResponse = await request(app).get(`/exercises/${exerciseId}`).set('Authorization', `Bearer ${tokens.admin}`);
    const teacherResponse = await request(app).get(`/exercises/${exerciseId}`).set('Authorization', `Bearer ${tokens.teacher}`);
    const studentResponse = await request(app).get(`/exercises/${exerciseId}`).set('Authorization', `Bearer ${tokens.student}`);
    const outsiderResponse = await request(app).get(`/exercises/${exerciseId}`).set('Authorization', `Bearer ${tokens.outsiderStudent}`);

    expect(adminResponse.status).toBe(200);
    expect(teacherResponse.status).toBe(200);
    expect(studentResponse.status).toBe(200);
    expect(outsiderResponse.status).toBe(403);
  });

  it('lists only exercises accessible through the course relationship', async () => {
    const studentList = await request(app)
      .get(`/courses/${courseId}/exercises`)
      .set('Authorization', `Bearer ${tokens.student}`);
    const outsiderList = await request(app)
      .get(`/courses/${courseId}/exercises`)
      .set('Authorization', `Bearer ${tokens.outsiderStudent}`);

    expect(studentList.status).toBe(200);
    expect(studentList.body.length).toBeGreaterThanOrEqual(1);
    expect(outsiderList.status).toBe(403);
  });

  it('allows authorized update and blocks unauthorized update', async () => {
    const teacherResponse = await request(app)
      .patch(`/exercises/${exerciseId}`)
      .set('Authorization', `Bearer ${tokens.teacher}`)
      .send({ title: 'Updated by teacher' });
    const outsiderResponse = await request(app)
      .patch(`/exercises/${exerciseId}`)
      .set('Authorization', `Bearer ${tokens.outsiderTeacher}`)
      .send({ title: 'Unauthorized update' });
    const studentResponse = await request(app)
      .patch(`/exercises/${exerciseId}`)
      .set('Authorization', `Bearer ${tokens.student}`)
      .send({ title: 'Student update' });

    expect(teacherResponse.status).toBe(200);
    expect(outsiderResponse.status).toBe(403);
    expect(studentResponse.status).toBe(403);
  });

  it('allows ADMIN to delete and returns 404 for a missing exercise', async () => {
    const missingResponse = await request(app)
      .get('/exercises/missing-exercise')
      .set('Authorization', `Bearer ${tokens.admin}`);
    const deleteResponse = await request(app)
      .delete(`/exercises/${exerciseId}`)
      .set('Authorization', `Bearer ${tokens.admin}`);

    expect(missingResponse.status).toBe(404);
    expect(deleteResponse.status).toBe(204);
  });
});
