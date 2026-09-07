import { Router } from 'express';
import { authenticate } from './middleware.js';
import { loginSchema, registerSchema } from './schemas.js';
import { loginUser, registerUser } from './service.js';

export const authRouter = Router();

authRouter.post('/register', async (request, response, next) => {
    try {
        const input = registerSchema.parse(request.body);
        const result = await registerUser(input);
        response.status(201).json(result);
    } catch (error) {
        next(error);
    }
});

authRouter.post('/login', async (request, response, next) => {
    try {
        const input = loginSchema.parse(request.body);
        const result = await loginUser(input);
        response.status(200).json(result);
    } catch (error) {
        next(error);
    }
});

authRouter.get('/me', authenticate, (request, response) => {
    response.status(200).json({ user: request.authenticatedUser });
});
