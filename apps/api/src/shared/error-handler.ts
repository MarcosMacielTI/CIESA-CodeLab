import type { ErrorRequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { AuthConflictError, InvalidCredentialsError } from '../modules/auth/service.js';
import {
    ClassNotFoundError,
    CourseNotFoundError,
    EnrollmentNotFoundError,
    InvalidAcademicRoleError,
    InvalidClassTeacherError,
    InvalidEnrollmentStudentError,
    InvalidTeacherClassAccessError,
    InvalidTeacherCourseAccessError,
    InvalidUserAcademicAccessError,
    InvalidUserRoleError
} from '../modules/academic/service.js';
import { UserNotFoundError } from '../modules/users/service.js';
import {
    ExerciseAccessDeniedError,
    ExerciseCourseNotFoundError,
    ExerciseNotFoundError
} from '../modules/exercises/service.js';
import {
    SubmissionExerciseNotFoundError,
    SubmissionAccessDeniedError,
    SubmissionNotFoundError,
    SubmissionStudentAccessError
} from '../modules/submissions/service.js';

export const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
    void next;

    if (error instanceof ZodError) {
        res.status(400).json({
            error: {
                code: 'VALIDATION_ERROR',
                message: 'Dados inválidos.',
                details: error.flatten().fieldErrors
            }
        });
        return;
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        res.status(409).json({
            error: {
                code: 'CONFLICT',
                message: 'Recurso já existe.'
            }
        });
        return;
    }

    if (error instanceof AuthConflictError) {
        res.status(409).json({
            error: {
                code: 'CONFLICT',
                message: 'Recurso já existe.'
            }
        });
        return;
    }

    if (error instanceof InvalidCredentialsError) {
        res.status(401).json({
            error: {
                code: 'INVALID_CREDENTIALS',
                message: 'Credenciais inválidas.'
            }
        });
        return;
    }

    if (error instanceof UserNotFoundError) {
        res.status(404).json({
            error: {
                code: 'NOT_FOUND',
                message: 'Usuário não encontrado.'
            }
        });
        return;
    }

    if (error instanceof CourseNotFoundError) {
        res.status(404).json({
            error: {
                code: 'NOT_FOUND',
                message: 'Curso não encontrado.'
            }
        });
        return;
    }

    if (error instanceof ClassNotFoundError) {
        res.status(404).json({
            error: {
                code: 'NOT_FOUND',
                message: 'Turma não encontrada.'
            }
        });
        return;
    }

    if (error instanceof EnrollmentNotFoundError) {
        res.status(404).json({
            error: {
                code: 'NOT_FOUND',
                message: 'Matrícula não encontrada.'
            }
        });
        return;
    }

    if (error instanceof ExerciseNotFoundError || error instanceof ExerciseCourseNotFoundError) {
        res.status(404).json({
            error: {
                code: 'NOT_FOUND',
                message: error instanceof ExerciseNotFoundError ? 'Exercício não encontrado.' : 'Curso não encontrado.'
            }
        });
        return;
    }

    if (error instanceof ExerciseAccessDeniedError) {
        res.status(403).json({
            error: {
                code: 'FORBIDDEN',
                message: 'Você não tem permissão para acessar este recurso.'
            }
        });
        return;
    }

    if (error instanceof SubmissionExerciseNotFoundError || error instanceof SubmissionNotFoundError) {
        res.status(404).json({
            error: {
                code: 'NOT_FOUND',
                message: error instanceof SubmissionExerciseNotFoundError ? 'Exercício não encontrado.' : 'Submission não encontrada.'
            }
        });
        return;
    }

    if (error instanceof SubmissionAccessDeniedError || error instanceof SubmissionStudentAccessError) {
        res.status(403).json({
            error: {
                code: 'FORBIDDEN',
                message: 'Você não tem permissão para acessar este recurso.'
            }
        });
        return;
    }

    if (error instanceof InvalidUserRoleError || error instanceof InvalidAcademicRoleError || error instanceof InvalidClassTeacherError || error instanceof InvalidEnrollmentStudentError) {
        res.status(400).json({
            error: {
                code: 'BAD_REQUEST',
                message: 'Dados inválidos para a operação acadêmica.'
            }
        });
        return;
    }

    if (error instanceof InvalidTeacherClassAccessError || error instanceof InvalidTeacherCourseAccessError || error instanceof InvalidUserAcademicAccessError) {
        res.status(403).json({
            error: {
                code: 'FORBIDDEN',
                message: 'Você não tem permissão para acessar este recurso.'
            }
        });
        return;
    }

    console.error('Unhandled API error', error);
    res.status(500).json({
        error: {
            code: 'INTERNAL_ERROR',
            message: 'Erro interno do servidor.'
        }
    });
};
