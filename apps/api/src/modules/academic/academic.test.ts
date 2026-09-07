import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import app from '../../app.js';
import { prisma } from '../../lib/prisma.js';

const password = 'valid-password-123';
const emails = {
  admin: `admin-${randomUUID()}@example.com`,
  teacher: `teacher-${randomUUID()}@example.com`,
  student: `student-${randomUUID()}@example.com`,
  secondStudent: `student-two-${randomUUID()}@example.com`
};

const tokens: Record<keyof typeof emails, string> = {
  admin: '',
  teacher: '',
  student: '',
  secondStudent: ''
};

async function registerUser(email: string, name: string) {
  const response = await request(app).post('/auth/register').send({ name, email, password });
  return response.body;
}

describe('academic phase 4 API', () => {
  beforeAll(async () => {
    const adminLogin = await registerUser(emails.admin, 'Admin User');
    const teacherLogin = await registerUser(emails.teacher, 'Teacher User');
    const studentLogin = await registerUser(emails.student, 'Student User');
    const secondStudentLogin = await registerUser(emails.secondStudent, 'Second Student');

    tokens.admin = adminLogin.token;
    tokens.teacher = teacherLogin.token;
    tokens.student = studentLogin.token;
    tokens.secondStudent = secondStudentLogin.token;

    const admin = await prisma.user.findUnique({ where: { email: emails.admin } });
    const teacher = await prisma.user.findUnique({ where: { email: emails.teacher } });
    const student = await prisma.user.findUnique({ where: { email: emails.student } });
    const secondStudent = await prisma.user.findUnique({ where: { email: emails.secondStudent } });

    if (!admin || !teacher || !student || !secondStudent) {
      throw new Error('Academic test users were not created');
    }

    await prisma.user.update({ where: { id: teacher.id }, data: { role: 'TEACHER' } });
    await prisma.user.update({ where: { id: admin.id }, data: { role: 'ADMIN' } });
    await prisma.user.update({ where: { id: student.id }, data: { role: 'STUDENT' } });
    await prisma.user.update({ where: { id: secondStudent.id }, data: { role: 'STUDENT' } });
  });

  afterAll(async () => {
    await prisma.enrollment.deleteMany({
      where: {
        student: { email: { in: Object.values(emails) } }
      }
    });
    await prisma.class.deleteMany({
      where: {
        teacher: { email: { in: Object.values(emails) } }
      }
    });
    await prisma.course.deleteMany({
      where: { code: { startsWith: 'ACADEMIC' } }
    });
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.$disconnect();
  });

  it('allows ADMIN to create a course and rejects non-admins', async () => {
    const adminResponse = await request(app)
      .post('/courses')
      .set('Authorization', `Bearer ${tokens.admin}`)
      .send({
        name: 'Ciência da Computação',
        code: 'ACADEMIC-CC-1',
        description: 'Curso inicial'
      });

    const teacherResponse = await request(app)
      .post('/courses')
      .set('Authorization', `Bearer ${tokens.teacher}`)
      .send({
        name: 'Curso proibido',
        code: 'ACADEMIC-CC-2',
        description: 'Não deve existir'
      });

    const studentResponse = await request(app)
      .post('/courses')
      .set('Authorization', `Bearer ${tokens.student}`)
      .send({
        name: 'Curso proibido',
        code: 'ACADEMIC-CC-3',
        description: 'Não deve existir'
      });

    expect(adminResponse.status).toBe(201);
    expect(teacherResponse.status).toBe(403);
    expect(studentResponse.status).toBe(403);
  });

  it('rejects duplicate course codes and updates a course by admin', async () => {
    const duplicate = await request(app)
      .post('/courses')
      .set('Authorization', `Bearer ${tokens.admin}`)
      .send({
        name: 'Ciência da Computação',
        code: 'ACADEMIC-CC-1',
        description: 'duplicado'
      });

    const course = await prisma.course.findUnique({ where: { code: 'ACADEMIC-CC-1' } });

    const updateResponse = await request(app)
      .patch(`/courses/${course?.id}`)
      .set('Authorization', `Bearer ${tokens.admin}`)
      .send({
        name: 'Ciência da Computação Update',
        status: 'ACTIVE'
      });

    expect(duplicate.status).toBe(409);
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.name).toBe('Ciência da Computação Update');
  });

  it('creates a class only for admin and validates teacher and course references', async () => {
    const course = await prisma.course.findUnique({ where: { code: 'ACADEMIC-CC-1' } });
    const teacher = await prisma.user.findUnique({ where: { email: emails.teacher } });

    const adminResponse = await request(app)
      .post('/classes')
      .set('Authorization', `Bearer ${tokens.admin}`)
      .send({
        name: 'CC 2026.2 A',
        code: 'ACADEMIC-CLASS-1',
        semester: '2026.2',
        courseId: course?.id,
        teacherId: teacher?.id
      });

    const teacherResponse = await request(app)
      .post('/classes')
      .set('Authorization', `Bearer ${tokens.teacher}`)
      .send({
        name: 'CC 2026.2 B',
        code: 'ACADEMIC-CLASS-2',
        semester: '2026.2',
        courseId: course?.id,
        teacherId: teacher?.id
      });

    const invalidTeacher = await request(app)
      .post('/classes')
      .set('Authorization', `Bearer ${tokens.admin}`)
      .send({
        name: 'Class with invalid teacher',
        code: 'ACADEMIC-CLASS-INVALID',
        semester: '2026.2',
        courseId: course?.id,
        teacherId: 'invalid-id'
      });

    expect(adminResponse.status).toBe(201);
    expect(teacherResponse.status).toBe(403);
    expect(invalidTeacher.status).toBe(404);
  });

  it('prevents duplicate class codes within the same course and allows same code in other courses', async () => {
    const course = await prisma.course.findUnique({ where: { code: 'ACADEMIC-CC-1' } });
    const teacher = await prisma.user.findUnique({ where: { email: emails.teacher } });

    const otherCourse = await prisma.course.create({
      data: {
        name: 'Engenharia de Software',
        code: 'ACADEMIC-ES-2',
        description: 'Segundo curso de teste'
      }
    });

    const duplicate = await request(app)
      .post('/classes')
      .set('Authorization', `Bearer ${tokens.admin}`)
      .send({
        name: 'CC 2026.2 A duplicate',
        code: 'ACADEMIC-CLASS-1',
        semester: '2026.2',
        courseId: course?.id,
        teacherId: teacher?.id
      });

    const sameCodeDifferentCourse = await request(app)
      .post('/classes')
      .set('Authorization', `Bearer ${tokens.admin}`)
      .send({
        name: 'Es 2026.2 A',
        code: 'ACADEMIC-CLASS-1',
        semester: '2026.2',
        courseId: otherCourse.id,
        teacherId: teacher?.id
      });

    expect(duplicate.status).toBe(409);
    expect(sameCodeDifferentCourse.status).toBe(201);
  });

  it('supports teacher and student access to their own classes and enrollment data', async () => {
    const course = await prisma.course.findUnique({ where: { code: 'ACADEMIC-CC-1' } });
    const teacher = await prisma.user.findUnique({ where: { email: emails.teacher } });
    const student = await prisma.user.findUnique({ where: { email: emails.student } });
    const secondStudent = await prisma.user.findUnique({ where: { email: emails.secondStudent } });

    const classRecord = await prisma.class.findFirst({ where: { courseId: course?.id, teacherId: teacher?.id } });

    const adminEnrollment = await request(app)
      .post('/enrollments')
      .set('Authorization', `Bearer ${tokens.admin}`)
      .send({ classId: classRecord?.id, studentId: student?.id });

    const secondEnrollment = await request(app)
      .post('/enrollments')
      .set('Authorization', `Bearer ${tokens.admin}`)
      .send({ classId: classRecord?.id, studentId: secondStudent?.id });

    const teacherList = await request(app)
      .get('/classes')
      .set('Authorization', `Bearer ${tokens.teacher}`);

    const studentList = await request(app)
      .get('/classes')
      .set('Authorization', `Bearer ${tokens.student}`);

    const teacherEnrollments = await request(app)
      .get('/enrollments')
      .set('Authorization', `Bearer ${tokens.teacher}`);

    const studentEnrollments = await request(app)
      .get('/enrollments')
      .set('Authorization', `Bearer ${tokens.student}`);

    expect(adminEnrollment.status).toBe(201);
    expect(secondEnrollment.status).toBe(201);
    expect(teacherList.status).toBe(200);
    expect(studentList.status).toBe(200);
    expect(teacherEnrollments.status).toBe(200);
    expect(studentEnrollments.status).toBe(200);
  });

  it('rejects duplicate enrollment and protects other users data', async () => {
    const course = await prisma.course.findUnique({ where: { code: 'ACADEMIC-CC-1' } });
    const teacher = await prisma.user.findUnique({ where: { email: emails.teacher } });
    const student = await prisma.user.findUnique({ where: { email: emails.student } });
    const classRecord = await prisma.class.findFirst({ where: { courseId: course?.id, teacherId: teacher?.id } });

    const duplicate = await request(app)
      .post('/enrollments')
      .set('Authorization', `Bearer ${tokens.admin}`)
      .send({ classId: classRecord?.id, studentId: student?.id });

    const otherStudentEnrollment = await request(app)
      .get('/enrollments')
      .set('Authorization', `Bearer ${tokens.student}`);

    const forbiddenEnrollment = await request(app)
      .get(`/enrollments/${otherStudentEnrollment.body[0]?.id}`)
      .set('Authorization', `Bearer ${tokens.secondStudent}`);

    expect(duplicate.status).toBe(409);
    expect(forbiddenEnrollment.status).toBe(403);
  });

  it('returns proper authorization errors for unauthenticated and missing resources', async () => {
    const missingCourse = await request(app)
      .get('/courses/invalid-course-id')
      .set('Authorization', `Bearer ${tokens.admin}`);
    const unauthenticated = await request(app).get('/courses');

    expect(missingCourse.status).toBe(404);
    expect(unauthenticated.status).toBe(401);
  });
});
