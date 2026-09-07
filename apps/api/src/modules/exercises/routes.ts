import { Router, type Request, type Response } from 'express';
import { authenticate } from '../auth/middleware.js';
import { exerciseCreateSchema, exerciseUpdateSchema } from './schemas.js';
import {
  createExercise,
  deleteExercise,
  ExerciseAccessDeniedError,
  getExercise,
  listExercisesForCourse,
  updateExercise
} from './service.js';

export const exercisesRouter = Router();

function getParam(request: Request, response: Response, name: string): string | null {
  const value = request.params[name];
  if (typeof value !== 'string' || value.trim() === '') {
    response.status(400).json({
      error: { code: 'INVALID_PARAMETER', message: `Parâmetro ${name} inválido.` }
    });
    return null;
  }

  return value;
}

function getAuthenticatedUser(request: Request, response: Response) {
  if (!request.authenticatedUser) {
    response.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Autenticação necessária.' } });
    return null;
  }

  return request.authenticatedUser;
}

exercisesRouter.post('/exercises', authenticate, async (request, response, next) => {
  try {
    const user = getAuthenticatedUser(request, response);
    if (!user) return;

    const exercise = await createExercise(exerciseCreateSchema.parse(request.body), user);
    response.status(201).json(exercise);
  } catch (error) {
    next(error);
  }
});

exercisesRouter.get('/courses/:courseId/exercises', authenticate, async (request, response, next) => {
  try {
    const user = getAuthenticatedUser(request, response);
    if (!user) return;

    const courseId = getParam(request, response, 'courseId');
    if (!courseId) return;

    const exercises = await listExercisesForCourse(courseId, user);
    response.status(200).json(exercises);
  } catch (error) {
    next(error);
  }
});

exercisesRouter.get('/exercises/:id', authenticate, async (request, response, next) => {
  try {
    const user = getAuthenticatedUser(request, response);
    if (!user) return;

    const id = getParam(request, response, 'id');
    if (!id) return;

    const exercise = await getExercise(id, user);
    response.status(200).json(exercise);
  } catch (error) {
    next(error);
  }
});

exercisesRouter.patch('/exercises/:id', authenticate, async (request, response, next) => {
  try {
    const user = getAuthenticatedUser(request, response);
    if (!user) return;

    const id = getParam(request, response, 'id');
    if (!id) return;

    const exercise = await updateExercise(id, exerciseUpdateSchema.parse(request.body), user);
    response.status(200).json(exercise);
  } catch (error) {
    next(error);
  }
});

exercisesRouter.delete('/exercises/:id', authenticate, async (request, response, next) => {
  try {
    const user = getAuthenticatedUser(request, response);
    if (!user) return;

    const id = getParam(request, response, 'id');
    if (!id) return;

    await deleteExercise(id, user);
    response.status(204).send();
  } catch (error) {
    next(error);
  }
});

export function isExerciseAccessDeniedError(error: unknown): error is ExerciseAccessDeniedError {
  return error instanceof ExerciseAccessDeniedError;
}
