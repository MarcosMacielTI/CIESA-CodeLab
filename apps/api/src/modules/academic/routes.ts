import { Router, type Request, type Response } from 'express';
import { authenticate, requireRole } from '../auth/middleware.js';
import { courseCreateSchema, courseUpdateSchema, classCreateSchema, classUpdateSchema, enrollmentCreateSchema } from './schemas.js';
import {
  createClass,
  createCourse,
  createEnrollment,
  getClassForUser,
  getCourseForUser,
  getEnrollmentForUser,
  listClassesForUser,
  listCoursesForUser,
  listEnrollmentsForUser,
  removeEnrollment,
  updateClass,
  updateCourse
} from './service.js';

export const academicRouter = Router();

function getIdParam(request: Request, response: Response): string | null {
  const { id } = request.params;

  if (typeof id !== 'string') {
    response.status(400).json({
      error: { code: 'INVALID_PARAMETER', message: 'Parâmetro id inválido.' }
    });
    return null;
  }

  return id;
}

academicRouter.post('/courses', authenticate, requireRole('ADMIN'), async (request, response, next) => {
  try {
    const input = courseCreateSchema.parse(request.body);
    const course = await createCourse(input);
    response.status(201).json(course);
  } catch (error) {
    next(error);
  }
});

academicRouter.get('/courses', authenticate, async (request, response, next) => {
  try {
    const user = request.authenticatedUser;
    if (!user) {
      response.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Autenticação necessária.' } });
      return;
    }

    const courses = await listCoursesForUser(user);
    response.status(200).json(courses);
  } catch (error) {
    next(error);
  }
});

academicRouter.get('/courses/:id', authenticate, async (request, response, next) => {
  try {
    const user = request.authenticatedUser;
    if (!user) {
      response.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Autenticação necessária.' } });
      return;
    }

    const id = getIdParam(request, response);
    if (id === null) {
      return;
    }

    const course = await getCourseForUser(id, user);
    response.status(200).json(course);
  } catch (error) {
    next(error);
  }
});

academicRouter.patch('/courses/:id', authenticate, requireRole('ADMIN'), async (request, response, next) => {
  try {
    const id = getIdParam(request, response);
    if (id === null) {
      return;
    }

    const input = courseUpdateSchema.parse(request.body);
    const course = await updateCourse(id, input);
    response.status(200).json(course);
  } catch (error) {
    next(error);
  }
});

academicRouter.post('/classes', authenticate, requireRole('ADMIN'), async (request, response, next) => {
  try {
    const input = classCreateSchema.parse(request.body);
    const classRecord = await createClass(input);
    response.status(201).json(classRecord);
  } catch (error) {
    next(error);
  }
});

academicRouter.get('/classes', authenticate, async (request, response, next) => {
  try {
    const user = request.authenticatedUser;
    if (!user) {
      response.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Autenticação necessária.' } });
      return;
    }

    const classes = await listClassesForUser(user);
    response.status(200).json(classes);
  } catch (error) {
    next(error);
  }
});

academicRouter.get('/classes/:id', authenticate, async (request, response, next) => {
  try {
    const user = request.authenticatedUser;
    if (!user) {
      response.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Autenticação necessária.' } });
      return;
    }

    const id = getIdParam(request, response);
    if (id === null) {
      return;
    }

    const classRecord = await getClassForUser(id, user);
    response.status(200).json(classRecord);
  } catch (error) {
    next(error);
  }
});

academicRouter.patch('/classes/:id', authenticate, requireRole('ADMIN'), async (request, response, next) => {
  try {
    const id = getIdParam(request, response);
    if (id === null) {
      return;
    }

    const input = classUpdateSchema.parse(request.body);
    const classRecord = await updateClass(id, input);
    response.status(200).json(classRecord);
  } catch (error) {
    next(error);
  }
});

academicRouter.post('/enrollments', authenticate, requireRole('ADMIN'), async (request, response, next) => {
  try {
    const input = enrollmentCreateSchema.parse(request.body);
    const enrollment = await createEnrollment(input);
    response.status(201).json(enrollment);
  } catch (error) {
    next(error);
  }
});

academicRouter.get('/enrollments', authenticate, async (request, response, next) => {
  try {
    const user = request.authenticatedUser;
    if (!user) {
      response.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Autenticação necessária.' } });
      return;
    }

    const enrollments = await listEnrollmentsForUser(user);
    response.status(200).json(enrollments);
  } catch (error) {
    next(error);
  }
});

academicRouter.get('/enrollments/:id', authenticate, async (request, response, next) => {
  try {
    const user = request.authenticatedUser;
    if (!user) {
      response.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Autenticação necessária.' } });
      return;
    }

    const id = getIdParam(request, response);
    if (id === null) {
      return;
    }

    const enrollment = await getEnrollmentForUser(id, user);
    response.status(200).json(enrollment);
  } catch (error) {
    next(error);
  }
});

academicRouter.delete('/enrollments/:id', authenticate, requireRole('ADMIN'), async (request, response, next) => {
  try {
    const id = getIdParam(request, response);
    if (id === null) {
      return;
    }

    const enrollment = await removeEnrollment(id);
    response.status(200).json(enrollment);
  } catch (error) {
    next(error);
  }
});
