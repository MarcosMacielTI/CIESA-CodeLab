import { Router, type Request, type Response } from 'express';
import { authenticate, requireRole } from '../auth/middleware.js';
import { updateRoleSchema } from './schemas.js';
import { updateUserRole } from './service.js';

export const usersRouter = Router();

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

usersRouter.get('/admin-area', authenticate, requireRole('ADMIN'), (_request, response) => {
    response.status(200).json({ ok: true });
});

usersRouter.get('/teaching-area', authenticate, requireRole('TEACHER', 'ADMIN'), (_request, response) => {
    response.status(200).json({ ok: true });
});

usersRouter.patch('/:id/role', authenticate, requireRole('ADMIN'), async (request, response, next) => {
    try {
        const id = getIdParam(request, response);
        if (id === null) {
            return;
        }

        const { role } = updateRoleSchema.parse(request.body);
        const user = await updateUserRole(id, role);
        response.status(200).json({ user });
    } catch (error) {
        next(error);
    }
});
