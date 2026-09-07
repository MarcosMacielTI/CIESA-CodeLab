import { Router, type Request, type Response } from 'express';
import { authenticate } from '../auth/middleware.js';
import { submissionCreateSchema } from './schemas.js';
import { createSubmission, getSubmission, listSubmissions } from './service.js';

export const submissionsRouter = Router();

function getParam(request: Request, response: Response, name: string): string | null {
  const value = request.params[name];
  if (typeof value !== 'string' || value.trim() === '') {
    response.status(400).json({ error: { code: 'INVALID_PARAMETER', message: `Parâmetro ${name} inválido.` } });
    return null;
  }
  return value;
}

function getUser(request: Request, response: Response) {
  if (!request.authenticatedUser) {
    response.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Autenticação necessária.' } });
    return null;
  }
  return request.authenticatedUser;
}

submissionsRouter.post('/exercises/:exerciseId/submissions', authenticate, async (request, response, next) => {
  try {
    const user = getUser(request, response);
    if (!user) return;
    const exerciseId = getParam(request, response, 'exerciseId');
    if (!exerciseId) return;

    const submission = await createSubmission(exerciseId, submissionCreateSchema.parse(request.body), user);
    response.status(201).json(submission);
  } catch (error) {
    next(error);
  }
});

submissionsRouter.get('/exercises/:exerciseId/submissions', authenticate, async (request, response, next) => {
  try {
    const user = getUser(request, response);
    if (!user) return;
    const exerciseId = getParam(request, response, 'exerciseId');
    if (!exerciseId) return;

    const submissions = await listSubmissions(exerciseId, user);
    response.status(200).json(submissions);
  } catch (error) {
    next(error);
  }
});

submissionsRouter.get('/submissions/:id', authenticate, async (request, response, next) => {
  try {
    const user = getUser(request, response);
    if (!user) return;
    const id = getParam(request, response, 'id');
    if (!id) return;

    const submission = await getSubmission(id, user);
    response.status(200).json(submission);
  } catch (error) {
    next(error);
  }
});
