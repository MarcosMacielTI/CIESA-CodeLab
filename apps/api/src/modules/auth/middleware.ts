import type { NextFunction, Request, Response } from 'express';
import type { UserRole } from '@ciesa/contracts';
import { findPublicUserById } from './service.js';
import { verifyAuthToken } from './token.js';

export async function authenticate(request: Request, response: Response, next: NextFunction) {
    const authorization = request.header('authorization');
    const match = authorization?.match(/^Bearer\s+(.+)$/i);

    if (!match) {
        response.status(401).json({
            error: { code: 'UNAUTHENTICATED', message: 'Autenticação necessária.' }
        });
        return;
    }

    try {
        const userId = verifyAuthToken(match[1]);
        const user = await findPublicUserById(userId);

        if (!user) {
            response.status(401).json({
                error: { code: 'UNAUTHENTICATED', message: 'Autenticação necessária.' }
            });
            return;
        }

        request.authenticatedUser = user;
        next();
    } catch {
        response.status(401).json({
            error: { code: 'UNAUTHENTICATED', message: 'Autenticação necessária.' }
        });
    }
}

export function requireRole(...allowedRoles: UserRole[]) {
    return (request: Request, response: Response, next: NextFunction) => {
        if (!request.authenticatedUser) {
            response.status(401).json({
                error: { code: 'UNAUTHENTICATED', message: 'Autenticação necessária.' }
            });
            return;
        }

        if (!allowedRoles.includes(request.authenticatedUser.role)) {
            response.status(403).json({
                error: { code: 'FORBIDDEN', message: 'Você não tem permissão para acessar este recurso.' }
            });
            return;
        }

        next();
    };
}
