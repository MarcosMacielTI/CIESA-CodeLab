import cors from 'cors';
import express from 'express';

import { academicRouter } from './modules/academic/routes.js';
import { authRouter } from './modules/auth/routes.js';
import { exercisesRouter } from './modules/exercises/routes.js';
import { submissionsRouter } from './modules/submissions/routes.js';
import { usersRouter } from './modules/users/routes.js';
import { errorHandler } from './shared/error-handler.js';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/auth', authRouter);
app.use('/users', usersRouter);
app.use('/', academicRouter);
app.use('/', exercisesRouter);
app.use('/', submissionsRouter);

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'ciesa-api',
    status: 'ready',
    timestamp: new Date().toISOString()
  });
});

app.use(errorHandler);

export default app;