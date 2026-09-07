import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import type { SubmissionCreateInput } from './schemas.js';

type SubmissionUser = { id: string; role: 'ADMIN' | 'TEACHER' | 'STUDENT' };

export class SubmissionExerciseNotFoundError extends Error {
  constructor() {
    super('Exercise not found');
    this.name = 'SubmissionExerciseNotFoundError';
  }
}

export class SubmissionNotFoundError extends Error {
  constructor() {
    super('Submission not found');
    this.name = 'SubmissionNotFoundError';
  }
}

export class SubmissionAccessDeniedError extends Error {
  constructor() {
    super('Submission access denied');
    this.name = 'SubmissionAccessDeniedError';
  }
}

export class SubmissionStudentAccessError extends Error {
  constructor() {
    super('Student submission access denied');
    this.name = 'SubmissionStudentAccessError';
  }
}

const submissionSelect = {
  id: true,
  exerciseId: true,
  studentId: true,
  sourceCode: true,
  language: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.SubmissionSelect;

type SubmissionRecord = Prisma.SubmissionGetPayload<{ select: typeof submissionSelect }>;

function toSubmission(submission: SubmissionRecord) {
  return {
    ...submission,
    createdAt: submission.createdAt.toISOString(),
    updatedAt: submission.updatedAt.toISOString()
  };
}

async function hasCourseAccess(courseId: string, user: SubmissionUser): Promise<boolean> {
  if (user.role === 'ADMIN') return true;

  if (user.role === 'TEACHER') {
    const teachingClass = await prisma.class.findFirst({
      where: { courseId, teacherId: user.id },
      select: { id: true }
    });
    return teachingClass !== null;
  }

  const courseEnrollment = await prisma.enrollment.findFirst({
    where: { studentId: user.id, status: 'ACTIVE', class: { courseId } },
    select: { id: true }
  });

  return courseEnrollment !== null;
}

async function ensureExercise(exerciseId: string) {
  const exercise = await prisma.exercise.findUnique({
    where: { id: exerciseId },
    select: { id: true, courseId: true }
  });

  if (!exercise) throw new SubmissionExerciseNotFoundError();
  return exercise;
}

async function ensureStudentCourseAccess(courseId: string, studentId: string): Promise<void> {
  const enrollment = await prisma.enrollment.findFirst({
    where: { studentId, status: 'ACTIVE', class: { courseId } },
    select: { id: true }
  });

  if (!enrollment) throw new SubmissionStudentAccessError();
}

export async function createSubmission(exerciseId: string, input: SubmissionCreateInput, user: SubmissionUser) {
  if (user.role !== 'STUDENT') throw new SubmissionAccessDeniedError();

  const exercise = await ensureExercise(exerciseId);
  await ensureStudentCourseAccess(exercise.courseId, user.id);

  const submission = await prisma.submission.create({
    data: {
      exerciseId,
      studentId: user.id,
      sourceCode: input.sourceCode,
      language: input.language
    },
    select: submissionSelect
  });

  return toSubmission(submission);
}

export async function listSubmissions(exerciseId: string, user: SubmissionUser) {
  const exercise = await ensureExercise(exerciseId);
  if (!(await hasCourseAccess(exercise.courseId, user))) throw new SubmissionAccessDeniedError();

  const submissions = await prisma.submission.findMany({
    where: { exerciseId, ...(user.role === 'STUDENT' ? { studentId: user.id } : {}) },
    orderBy: { createdAt: 'desc' },
    select: submissionSelect
  });

  return submissions.map(toSubmission);
}

export async function getSubmission(submissionId: string, user: SubmissionUser) {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: {
      ...submissionSelect,
      exercise: { select: { courseId: true } }
    }
  });

  if (!submission) throw new SubmissionNotFoundError();
  if (user.role === 'STUDENT' && submission.studentId !== user.id) throw new SubmissionStudentAccessError();
  if (!(await hasCourseAccess(submission.exercise.courseId, user))) throw new SubmissionAccessDeniedError();

  return toSubmission({
    id: submission.id,
    exerciseId: submission.exerciseId,
    studentId: submission.studentId,
    sourceCode: submission.sourceCode,
    language: submission.language,
    createdAt: submission.createdAt,
    updatedAt: submission.updatedAt
  });
}
