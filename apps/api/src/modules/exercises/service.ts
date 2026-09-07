import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import type { ExerciseCreateInput, ExerciseUpdateInput } from './schemas.js';

export class ExerciseNotFoundError extends Error {
  constructor() {
    super('Exercise not found');
    this.name = 'ExerciseNotFoundError';
  }
}

export class ExerciseCourseNotFoundError extends Error {
  constructor() {
    super('Exercise course not found');
    this.name = 'ExerciseCourseNotFoundError';
  }
}

export class ExerciseAccessDeniedError extends Error {
  constructor() {
    super('Exercise access denied');
    this.name = 'ExerciseAccessDeniedError';
  }
}

const exerciseSelect = {
  id: true,
  courseId: true,
  title: true,
  statement: true,
  inputDescription: true,
  outputDescription: true,
  constraints: true,
  difficulty: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.ExerciseSelect;

type AcademicUser = { id: string; role: 'ADMIN' | 'TEACHER' | 'STUDENT' };
type ExerciseRecord = Prisma.ExerciseGetPayload<{ select: typeof exerciseSelect }>;

function toExercise(exercise: ExerciseRecord) {
  return {
    ...exercise,
    createdAt: exercise.createdAt.toISOString(),
    updatedAt: exercise.updatedAt.toISOString()
  };
}

async function hasCourseAccess(courseId: string, user: AcademicUser): Promise<boolean> {
  if (user.role === 'ADMIN') {
    return true;
  }

  if (user.role === 'TEACHER') {
    const teachingClass = await prisma.class.findFirst({
      where: { courseId, teacherId: user.id },
      select: { id: true }
    });
    return teachingClass !== null;
  }

  const enrollment = await prisma.enrollment.findFirst({
    where: { studentId: user.id, status: 'ACTIVE', class: { courseId } },
    select: { id: true }
  });
  return enrollment !== null;
}

async function hasCourseManagementAccess(courseId: string, user: AcademicUser): Promise<boolean> {
  if (user.role === 'ADMIN') {
    return true;
  }

  if (user.role !== 'TEACHER') {
    return false;
  }

  const teachingClass = await prisma.class.findFirst({
    where: { courseId, teacherId: user.id },
    select: { id: true }
  });
  return teachingClass !== null;
}

async function ensureCourseExists(courseId: string): Promise<void> {
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true } });
  if (!course) {
    throw new ExerciseCourseNotFoundError();
  }
}

export async function createExercise(input: ExerciseCreateInput, user: AcademicUser) {
  await ensureCourseExists(input.courseId);

  if (!(await hasCourseManagementAccess(input.courseId, user))) {
    throw new ExerciseAccessDeniedError();
  }

  const exercise = await prisma.exercise.create({
    data: input,
    select: exerciseSelect
  });

  return toExercise(exercise);
}

export async function listExercisesForCourse(courseId: string, user: AcademicUser) {
  await ensureCourseExists(courseId);

  if (!(await hasCourseAccess(courseId, user))) {
    throw new ExerciseAccessDeniedError();
  }

  const exercises = await prisma.exercise.findMany({
    where: { courseId },
    orderBy: { createdAt: 'desc' },
    select: exerciseSelect
  });

  return exercises.map(toExercise);
}

export async function getExercise(exerciseId: string, user: AcademicUser) {
  const exercise = await prisma.exercise.findUnique({ where: { id: exerciseId }, select: exerciseSelect });
  if (!exercise) {
    throw new ExerciseNotFoundError();
  }

  if (!(await hasCourseAccess(exercise.courseId, user))) {
    throw new ExerciseAccessDeniedError();
  }

  return toExercise(exercise);
}

export async function updateExercise(exerciseId: string, input: ExerciseUpdateInput, user: AcademicUser) {
  const existing = await prisma.exercise.findUnique({ where: { id: exerciseId }, select: exerciseSelect });
  if (!existing) {
    throw new ExerciseNotFoundError();
  }

  if (!(await hasCourseManagementAccess(existing.courseId, user))) {
    throw new ExerciseAccessDeniedError();
  }

  const exercise = await prisma.exercise.update({
    where: { id: exerciseId },
    data: input,
    select: exerciseSelect
  });

  return toExercise(exercise);
}

export async function deleteExercise(exerciseId: string, user: AcademicUser): Promise<void> {
  const existing = await prisma.exercise.findUnique({ where: { id: exerciseId }, select: exerciseSelect });
  if (!existing) {
    throw new ExerciseNotFoundError();
  }

  if (!(await hasCourseManagementAccess(existing.courseId, user))) {
    throw new ExerciseAccessDeniedError();
  }

  await prisma.exercise.delete({ where: { id: exerciseId } });
}
