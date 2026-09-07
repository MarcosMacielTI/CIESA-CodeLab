import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import app from '../../app.js';
import { prisma } from '../../lib/prisma.js';

const password = 'valid-password-123';
const emails = {
  admin: `submission-admin-${randomUUID()}@example.com`,
  teacher: `submission-teacher-${randomUUID()}@example.com`,
  outsiderTeacher: `submission-outsider-teacher-${randomUUID()}@example.com`,
  student: `submission-student-${randomUUID()}@example.com`,
  otherStudent: `submission-other-student-${randomUUID()}@example.com`,
  outsiderStudent: `submission-outsider-student-${randomUUID()}@example.com`
};

const tokens = { admin: '', teacher: '', outsiderTeacher: '', student: '', otherStudent: '', outsiderStudent: '' };
let exerciseId = '';
let studentId = '';
let otherStudentId = '';
let courseId = '';
let otherCourseId = '';
let ownSubmissionId = '';
let otherSubmissionId = '';

async function register(email: string, name: string) {
  const response = await request(app).post('/auth/register').send({ name, email, password });
  return response.body.token as string;
}

describe('submissions API', () => {
  beforeAll(async () => {
    tokens.admin = await register(emails.admin, 'Submission Admin');
    tokens.teacher = await register(emails.teacher, 'Submission Teacher');
    tokens.outsiderTeacher = await register(emails.outsiderTeacher, 'Outsider Teacher');
    tokens.student = await register(emails.student, 'Submission Student');
    tokens.otherStudent = await register(emails.otherStudent, 'Other Student');
    tokens.outsiderStudent = await register(emails.outsiderStudent, 'Outsider Student');

    const users = await prisma.user.findMany({
      where: { email: { in: Object.values(emails) } },
      select: { id: true, email: true }
    });
    const idOf = (email: string) => users.find((user) => user.email === email)?.id;
    const requiredId = (email: string) => {
      const id = idOf(email);
      if (!id) throw new Error(`Missing test user ${email}`);
      return id;
    };

    studentId = requiredId(emails.student);
    otherStudentId = requiredId(emails.otherStudent);
    await prisma.user.update({ where: { id: requiredId(emails.admin) }, data: { role: 'ADMIN' } });
    await prisma.user.update({ where: { id: requiredId(emails.teacher) }, data: { role: 'TEACHER' } });
    await prisma.user.update({ where: { id: requiredId(emails.outsiderTeacher) }, data: { role: 'TEACHER' } });

    const course = await prisma.course.create({ data: { name: 'Submission Course', code: `SUB-${randomUUID()}` } });
    const otherCourse = await prisma.course.create({ data: { name: 'Other Course', code: `SUB-OTHER-${randomUUID()}` } });
    courseId = course.id;
    otherCourseId = otherCourse.id;

    const classRecord = await prisma.class.create({
      data: {
        name: 'Submission Class',
        code: `SUB-CLASS-${randomUUID()}`,
        semester: '2026.2',
        courseId: course.id,
        teacherId: requiredId(emails.teacher)
      }
    });
    await prisma.class.create({
      data: {
        name: 'Other Class',
        code: `SUB-OTHER-CLASS-${randomUUID()}`,
        semester: '2026.2',
        courseId: otherCourse.id,
        teacherId: requiredId(emails.outsiderTeacher)
      }
    });

    await prisma.enrollment.createMany({
      data: [
        { classId: classRecord.id, studentId },
        { classId: classRecord.id, studentId: otherStudentId }
      ]
    });

    const exercise = await prisma.exercise.create({
      data: { courseId: course.id, title: 'Submission Exercise', statement: 'Write code', difficulty: 'EASY' }
    });
    exerciseId = exercise.id;
  }, 30_000);

  afterAll(async () => {
    await prisma.submission.deleteMany({ where: { exerciseId } });
    await prisma.enrollment.deleteMany({ where: { studentId: { in: [studentId, otherStudentId] } } });
    await prisma.class.deleteMany({ where: { courseId: { in: [courseId, otherCourseId] } } });
    await prisma.course.deleteMany({ where: { id: { in: [courseId, otherCourseId] } } });
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.$disconnect();
  });

  it('requires authentication for create and read', async () => {
    const createResponse = await request(app).post(`/exercises/${exerciseId}/submissions`).send({ sourceCode: 'x', language: 'PYTHON' });
    const listResponse = await request(app).get(`/exercises/${exerciseId}/submissions`);

    expect(createResponse.status).toBe(401);
    expect(listResponse.status).toBe(401);
  });

  it('rejects ADMIN and TEACHER creation, and validates input', async () => {
    const adminResponse = await request(app).post(`/exercises/${exerciseId}/submissions`).set('Authorization', `Bearer ${tokens.admin}`).send({ sourceCode: 'x', language: 'PYTHON' });
    const teacherResponse = await request(app).post(`/exercises/${exerciseId}/submissions`).set('Authorization', `Bearer ${tokens.teacher}`).send({ sourceCode: 'x', language: 'PYTHON' });
    const emptyResponse = await request(app).post(`/exercises/${exerciseId}/submissions`).set('Authorization', `Bearer ${tokens.student}`).send({ sourceCode: '', language: 'PYTHON' });
    const languageResponse = await request(app).post(`/exercises/${exerciseId}/submissions`).set('Authorization', `Bearer ${tokens.student}`).send({ sourceCode: 'x', language: 'RUST' });

    expect(adminResponse.status).toBe(403);
    expect(teacherResponse.status).toBe(403);
    expect(emptyResponse.status).toBe(400);
    expect(languageResponse.status).toBe(400);
  });

  it('allows only an enrolled student to create multiple submissions', async () => {
    const first = await request(app).post(`/exercises/${exerciseId}/submissions`).set('Authorization', `Bearer ${tokens.student}`).send({ sourceCode: 'print(1)', language: 'PYTHON' });
    const second = await request(app).post(`/exercises/${exerciseId}/submissions`).set('Authorization', `Bearer ${tokens.student}`).send({ sourceCode: 'print(2)', language: 'PYTHON' });
    const outsider = await request(app).post(`/exercises/${exerciseId}/submissions`).set('Authorization', `Bearer ${tokens.outsiderStudent}`).send({ sourceCode: 'print(3)', language: 'PYTHON' });

    ownSubmissionId = first.body.id;
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(outsider.status).toBe(403);
    expect(first.body.studentId).toBe(studentId);
    expect(first.body).not.toHaveProperty('verdict');
    expect(first.body).not.toHaveProperty('stdout');
  });

  it('returns 404 for an unknown exercise', async () => {
    const response = await request(app).post('/exercises/missing-exercise/submissions').set('Authorization', `Bearer ${tokens.student}`).send({ sourceCode: 'x', language: 'JAVA' });
    expect(response.status).toBe(404);
  });

  it('restricts student history to the authenticated student', async () => {
    const otherSubmission = await prisma.submission.create({ data: { exerciseId, studentId: otherStudentId, sourceCode: 'other', language: 'JAVA' } });
    otherSubmissionId = otherSubmission.id;

    const list = await request(app).get(`/exercises/${exerciseId}/submissions`).set('Authorization', `Bearer ${tokens.student}`);
    const own = await request(app).get(`/submissions/${ownSubmissionId}`).set('Authorization', `Bearer ${tokens.student}`);
    const other = await request(app).get(`/submissions/${otherSubmissionId}`).set('Authorization', `Bearer ${tokens.student}`);

    expect(list.status).toBe(200);
    expect(list.body.every((submission: { studentId: string }) => submission.studentId === studentId)).toBe(true);
    expect(own.status).toBe(200);
    expect(other.status).toBe(403);
  });

  it('allows teachers of the course and ADMIN to read submissions only within their access', async () => {
    const teacherList = await request(app).get(`/exercises/${exerciseId}/submissions`).set('Authorization', `Bearer ${tokens.teacher}`);
    const outsiderList = await request(app).get(`/exercises/${exerciseId}/submissions`).set('Authorization', `Bearer ${tokens.outsiderTeacher}`);
    const adminList = await request(app).get(`/exercises/${exerciseId}/submissions`).set('Authorization', `Bearer ${tokens.admin}`);
    const teacherGet = await request(app).get(`/submissions/${otherSubmissionId}`).set('Authorization', `Bearer ${tokens.teacher}`);
    const missing = await request(app).get('/submissions/missing-submission').set('Authorization', `Bearer ${tokens.admin}`);

    expect(teacherList.status).toBe(200);
    expect(outsiderList.status).toBe(403);
    expect(adminList.status).toBe(200);
    expect(teacherGet.status).toBe(200);
    expect(missing.status).toBe(404);
  });
});
