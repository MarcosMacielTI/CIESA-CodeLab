import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { UserNotFoundError } from '../users/service.js';
import type { CourseCreateInput, CourseUpdateInput, ClassCreateInput, ClassUpdateInput, EnrollmentCreateInput } from './schemas.js';

export class CourseNotFoundError extends Error {
  constructor() {
    super('Course not found');
    this.name = 'CourseNotFoundError';
  }
}

export class ClassNotFoundError extends Error {
  constructor() {
    super('Class not found');
    this.name = 'ClassNotFoundError';
  }
}

export class EnrollmentNotFoundError extends Error {
  constructor() {
    super('Enrollment not found');
    this.name = 'EnrollmentNotFoundError';
  }
}

export class InvalidUserRoleError extends Error {
  constructor() {
    super('User role is invalid for this academic operation');
    this.name = 'InvalidUserRoleError';
  }
}

export class InvalidAcademicRoleError extends Error {
  constructor() {
    super('Academic role is invalid');
    this.name = 'InvalidAcademicRoleError';
  }
}

export class InvalidClassTeacherError extends Error {
  constructor() {
    super('Teacher is invalid for this class');
    this.name = 'InvalidClassTeacherError';
  }
}

export class InvalidEnrollmentStudentError extends Error {
  constructor() {
    super('Student is invalid for this enrollment');
    this.name = 'InvalidEnrollmentStudentError';
  }
}

export class InvalidTeacherClassAccessError extends Error {
  constructor() {
    super('Teacher cannot access another teacher class');
    this.name = 'InvalidTeacherClassAccessError';
  }
}

export class InvalidTeacherCourseAccessError extends Error {
  constructor() {
    super('Teacher cannot access another teacher course');
    this.name = 'InvalidTeacherCourseAccessError';
  }
}

export class InvalidUserAcademicAccessError extends Error {
  constructor() {
    super('Student cannot access this academic resource');
    this.name = 'InvalidUserAcademicAccessError';
  }
}

const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.UserSelect;

const courseSelect = {
  id: true,
  name: true,
  code: true,
  description: true,
  status: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.CourseSelect;

const classSelect = {
  id: true,
  name: true,
  code: true,
  semester: true,
  status: true,
  courseId: true,
  teacherId: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.ClassSelect;

const enrollmentSelect = {
  id: true,
  classId: true,
  studentId: true,
  status: true,
  enrolledAt: true,
  updatedAt: true
} satisfies Prisma.EnrollmentSelect;

function toPublicUser(user: Prisma.UserGetPayload<{ select: typeof publicUserSelect }>) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString()
  };
}

function toCourse(course: Prisma.CourseGetPayload<{ select: typeof courseSelect }>) {
  return {
    id: course.id,
    name: course.name,
    code: course.code,
    description: course.description ?? undefined,
    status: course.status,
    createdAt: course.createdAt.toISOString(),
    updatedAt: course.updatedAt.toISOString()
  };
}

function toClassRecord(record: Prisma.ClassGetPayload<{ select: typeof classSelect }>) {
  return {
    id: record.id,
    name: record.name,
    code: record.code,
    semester: record.semester,
    status: record.status,
    courseId: record.courseId,
    teacherId: record.teacherId,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function toEnrollment(record: Prisma.EnrollmentGetPayload<{ select: typeof enrollmentSelect }>) {
  return {
    id: record.id,
    classId: record.classId,
    studentId: record.studentId,
    status: record.status,
    enrolledAt: record.enrolledAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

export async function listCoursesForUser(user: { id: string; role: 'ADMIN' | 'TEACHER' | 'STUDENT' }) {
  if (user.role === 'ADMIN') {
    const records = await prisma.course.findMany({
      orderBy: { createdAt: 'desc' },
      select: courseSelect
    });
    return records.map(toCourse);
  }

  if (user.role === 'TEACHER') {
    const relations = await prisma.class.findMany({
      where: { teacherId: user.id },
      select: { courseId: true }
    });

    const courseIds = [...new Set(relations.map((item) => item.courseId))];
    const records = await prisma.course.findMany({
      where: { id: { in: courseIds } },
      orderBy: { createdAt: 'desc' },
      select: courseSelect
    });

    return records.map(toCourse);
  }

  const enrollments = await prisma.enrollment.findMany({
    where: { studentId: user.id },
    select: { classId: true }
  });

  const classIds = [...new Set(enrollments.map((item) => item.classId))];
  const classes = await prisma.class.findMany({
    where: { id: { in: classIds } },
    select: { courseId: true }
  });

  const courseIds = [...new Set(classes.map((entry) => entry.courseId))];
  const records = await prisma.course.findMany({
    where: { id: { in: courseIds } },
    orderBy: { createdAt: 'desc' },
    select: courseSelect
  });

  return records.map(toCourse);
}

export async function getCourseForUser(courseId: string, user: { id: string; role: 'ADMIN' | 'TEACHER' | 'STUDENT' }) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: courseSelect
  });

  if (!course) {
    throw new CourseNotFoundError();
  }

  if (user.role === 'ADMIN') {
    return toCourse(course);
  }

  if (user.role === 'TEACHER') {
    const hasAccess = await prisma.class.findFirst({
      where: { teacherId: user.id, courseId: course.id },
      select: { id: true }
    });

    if (!hasAccess) {
      throw new InvalidTeacherCourseAccessError();
    }

    return toCourse(course);
  }

  const hasEnrollment = await prisma.enrollment.findFirst({
    where: { studentId: user.id, class: { courseId: course.id } },
    select: { id: true }
  });

  if (!hasEnrollment) {
    throw new InvalidUserAcademicAccessError();
  }

  return toCourse(course);
}

export async function createCourse(input: CourseCreateInput) {
  try {
    const course = await prisma.course.create({
      data: {
        name: input.name,
        code: input.code,
        description: input.description,
        status: input.status ?? 'ACTIVE'
      },
      select: courseSelect
    });

    return toCourse(course);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw error;
    }

    throw error;
  }
}

export async function updateCourse(courseId: string, input: CourseUpdateInput) {
  try {
    const course = await prisma.course.update({
      where: { id: courseId },
      data: input,
      select: courseSelect
    });

    return toCourse(course);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      throw new CourseNotFoundError();
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw error;
    }

    throw error;
  }
}

export async function listClassesForUser(user: { id: string; role: 'ADMIN' | 'TEACHER' | 'STUDENT' }) {
  if (user.role === 'ADMIN') {
    const records = await prisma.class.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        ...classSelect,
        course: { select: { id: true, name: true, code: true } },
        teacher: { select: { ...publicUserSelect } }
      }
    });

    return records.map((record) => ({
      ...toClassRecord(record),
      course: { id: record.course.id, name: record.course.name, code: record.course.code },
      teacher: toPublicUser(record.teacher)
    }));
  }

  if (user.role === 'TEACHER') {
    const records = await prisma.class.findMany({
      where: { teacherId: user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        ...classSelect,
        course: { select: { id: true, name: true, code: true } },
        teacher: { select: { ...publicUserSelect } }
      }
    });

    return records.map((record) => ({
      ...toClassRecord(record),
      course: { id: record.course.id, name: record.course.name, code: record.course.code },
      teacher: toPublicUser(record.teacher)
    }));
  }

  const records = await prisma.class.findMany({
    where: { enrollments: { some: { studentId: user.id, status: 'ACTIVE' } } },
    orderBy: { createdAt: 'desc' },
    select: {
      ...classSelect,
      course: { select: { id: true, name: true, code: true } },
      teacher: { select: { ...publicUserSelect } }
    }
  });

  return records.map((record) => ({
    ...toClassRecord(record),
    course: { id: record.course.id, name: record.course.name, code: record.course.code },
    teacher: toPublicUser(record.teacher)
  }));
}

export async function getClassForUser(classId: string, user: { id: string; role: 'ADMIN' | 'TEACHER' | 'STUDENT' }) {
  const record = await prisma.class.findUnique({
    where: { id: classId },
    select: {
      ...classSelect,
      course: { select: { id: true, name: true, code: true } },
      teacher: { select: { ...publicUserSelect } }
    }
  });

  if (!record) {
    throw new ClassNotFoundError();
  }

  if (user.role === 'ADMIN') {
    return {
      ...toClassRecord(record),
      course: { id: record.course.id, name: record.course.name, code: record.course.code },
      teacher: toPublicUser(record.teacher)
    };
  }

  if (user.role === 'TEACHER') {
    if (record.teacherId !== user.id) {
      throw new InvalidTeacherClassAccessError();
    }

    return {
      ...toClassRecord(record),
      course: { id: record.course.id, name: record.course.name, code: record.course.code },
      teacher: toPublicUser(record.teacher)
    };
  }

  const isStudentInClass = await prisma.enrollment.findFirst({
    where: { classId: record.id, studentId: user.id, status: 'ACTIVE' },
    select: { id: true }
  });

  if (!isStudentInClass) {
    throw new InvalidUserAcademicAccessError();
  }

  return {
    ...toClassRecord(record),
    course: { id: record.course.id, name: record.course.name, code: record.course.code },
    teacher: toPublicUser(record.teacher)
  };
}

export async function createClass(input: ClassCreateInput) {
  const course = await prisma.course.findUnique({ where: { id: input.courseId } });
  if (!course) {
    throw new CourseNotFoundError();
  }

  const teacher = await prisma.user.findUnique({ where: { id: input.teacherId } });
  if (!teacher) {
    throw new UserNotFoundError();
  }

  if (teacher.role !== 'TEACHER') {
    throw new InvalidClassTeacherError();
  }

  const created = await prisma.class.create({
    data: {
      name: input.name,
      code: input.code,
      semester: input.semester,
      courseId: input.courseId,
      teacherId: input.teacherId,
      status: input.status ?? 'ACTIVE'
    },
    select: {
      ...classSelect,
      course: { select: { id: true, name: true, code: true } },
      teacher: { select: { ...publicUserSelect } }
    }
  });

  return {
    ...toClassRecord(created),
    course: { id: created.course.id, name: created.course.name, code: created.course.code },
    teacher: toPublicUser(created.teacher)
  };
}

export async function updateClass(classId: string, input: ClassUpdateInput) {
  const current = await prisma.class.findUnique({ where: { id: classId } });
  if (!current) {
    throw new ClassNotFoundError();
  }

  if (input.courseId) {
    const course = await prisma.course.findUnique({ where: { id: input.courseId } });
    if (!course) {
      throw new CourseNotFoundError();
    }
  }

  if (input.teacherId) {
    const teacher = await prisma.user.findUnique({ where: { id: input.teacherId } });
    if (!teacher) {
      throw new UserNotFoundError();
    }

    if (teacher.role !== 'TEACHER') {
      throw new InvalidClassTeacherError();
    }
  }

  try {
    const updated = await prisma.class.update({
      where: { id: classId },
      data: { ...input },
      select: {
        ...classSelect,
        course: { select: { id: true, name: true, code: true } },
        teacher: { select: { ...publicUserSelect } }
      }
    });

    return {
      ...toClassRecord(updated),
      course: { id: updated.course.id, name: updated.course.name, code: updated.course.code },
      teacher: toPublicUser(updated.teacher)
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      throw new ClassNotFoundError();
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw error;
    }

    throw error;
  }
}

export async function listEnrollmentsForUser(user: { id: string; role: 'ADMIN' | 'TEACHER' | 'STUDENT' }) {
  if (user.role === 'ADMIN') {
    const records = await prisma.enrollment.findMany({
      orderBy: { enrolledAt: 'desc' },
      select: {
        ...enrollmentSelect,
        class: {
          select: {
            ...classSelect,
            course: { select: { id: true, name: true, code: true } },
            teacher: { select: { ...publicUserSelect } }
          }
        },
        student: { select: { ...publicUserSelect } }
      }
    });

    return records.map((record) => ({
      ...toEnrollment(record),
      class: {
        ...toClassRecord(record.class),
        course: { id: record.class.course.id, name: record.class.course.name, code: record.class.course.code },
        teacher: toPublicUser(record.class.teacher)
      },
      student: toPublicUser(record.student)
    }));
  }

  if (user.role === 'TEACHER') {
    const records = await prisma.enrollment.findMany({
      where: { class: { teacherId: user.id } },
      orderBy: { enrolledAt: 'desc' },
      select: {
        ...enrollmentSelect,
        class: {
          select: {
            ...classSelect,
            course: { select: { id: true, name: true, code: true } },
            teacher: { select: { ...publicUserSelect } }
          }
        },
        student: { select: { ...publicUserSelect } }
      }
    });

    return records.map((record) => ({
      ...toEnrollment(record),
      class: {
        ...toClassRecord(record.class),
        course: { id: record.class.course.id, name: record.class.course.name, code: record.class.course.code },
        teacher: toPublicUser(record.class.teacher)
      },
      student: toPublicUser(record.student)
    }));
  }

  const records = await prisma.enrollment.findMany({
    where: { studentId: user.id },
    orderBy: { enrolledAt: 'desc' },
    select: {
      ...enrollmentSelect,
      class: {
        select: {
          ...classSelect,
          course: { select: { id: true, name: true, code: true } },
          teacher: { select: { ...publicUserSelect } }
        }
      },
      student: { select: { ...publicUserSelect } }
    }
  });

  return records.map((record) => ({
    ...toEnrollment(record),
    class: {
      ...toClassRecord(record.class),
      course: { id: record.class.course.id, name: record.class.course.name, code: record.class.course.code },
      teacher: toPublicUser(record.class.teacher)
    },
    student: toPublicUser(record.student)
  }));
}

export async function getEnrollmentForUser(enrollmentId: string, user: { id: string; role: 'ADMIN' | 'TEACHER' | 'STUDENT' }) {
  const record = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      ...enrollmentSelect,
      class: {
        select: {
          ...classSelect,
          course: { select: { id: true, name: true, code: true } },
          teacher: { select: { ...publicUserSelect } }
        }
      },
      student: { select: { ...publicUserSelect } }
    }
  });

  if (!record) {
    throw new EnrollmentNotFoundError();
  }

  if (user.role === 'ADMIN') {
    return {
      ...toEnrollment(record),
      class: {
        ...toClassRecord(record.class),
        course: { id: record.class.course.id, name: record.class.course.name, code: record.class.course.code },
        teacher: toPublicUser(record.class.teacher)
      },
      student: toPublicUser(record.student)
    };
  }

  if (user.role === 'TEACHER') {
    if (record.class.teacherId !== user.id) {
      throw new InvalidTeacherClassAccessError();
    }

    return {
      ...toEnrollment(record),
      class: {
        ...toClassRecord(record.class),
        course: { id: record.class.course.id, name: record.class.course.name, code: record.class.course.code },
        teacher: toPublicUser(record.class.teacher)
      },
      student: toPublicUser(record.student)
    };
  }

  if (record.studentId !== user.id) {
    throw new InvalidUserAcademicAccessError();
  }

  return {
    ...toEnrollment(record),
    class: {
      ...toClassRecord(record.class),
      course: { id: record.class.course.id, name: record.class.course.name, code: record.class.course.code },
      teacher: toPublicUser(record.class.teacher)
    },
    student: toPublicUser(record.student)
  };
}

export async function createEnrollment(input: EnrollmentCreateInput) {
  const classRecord = await prisma.class.findUnique({
    where: { id: input.classId },
    select: { ...classSelect, status: true }
  });

  if (!classRecord) {
    throw new ClassNotFoundError();
  }

  if (classRecord.status !== 'ACTIVE') {
    throw new InvalidAcademicRoleError();
  }

  const student = await prisma.user.findUnique({ where: { id: input.studentId }, select: { ...publicUserSelect } });
  if (!student) {
    throw new UserNotFoundError();
  }

  if (student.role !== 'STUDENT') {
    throw new InvalidEnrollmentStudentError();
  }

  try {
    const enrollment = await prisma.enrollment.create({
      data: {
        classId: input.classId,
        studentId: input.studentId,
        status: 'ACTIVE'
      },
      select: {
        ...enrollmentSelect,
        class: {
          select: {
            ...classSelect,
            course: { select: { id: true, name: true, code: true } },
            teacher: { select: { ...publicUserSelect } }
          }
        },
        student: { select: { ...publicUserSelect } }
      }
    });

    return {
      ...toEnrollment(enrollment),
      class: {
        ...toClassRecord(enrollment.class),
        course: { id: enrollment.class.course.id, name: enrollment.class.course.name, code: enrollment.class.course.code },
        teacher: toPublicUser(enrollment.class.teacher)
      },
      student: toPublicUser(enrollment.student)
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw error;
    }

    throw error;
  }
}

export async function removeEnrollment(enrollmentId: string) {
  const existing = await prisma.enrollment.findUnique({ where: { id: enrollmentId } });
  if (!existing) {
    throw new EnrollmentNotFoundError();
  }

  const enrollment = await prisma.enrollment.update({
    where: { id: enrollmentId },
    data: { status: 'INACTIVE' },
    select: {
      ...enrollmentSelect,
      class: {
        select: {
          ...classSelect,
          course: { select: { id: true, name: true, code: true } },
          teacher: { select: { ...publicUserSelect } }
        }
      },
      student: { select: { ...publicUserSelect } }
    }
  });

  return {
    ...toEnrollment(enrollment),
    class: {
      ...toClassRecord(enrollment.class),
      course: { id: enrollment.class.course.id, name: enrollment.class.course.name, code: enrollment.class.course.code },
      teacher: toPublicUser(enrollment.class.teacher)
    },
    student: toPublicUser(enrollment.student)
  };
}
