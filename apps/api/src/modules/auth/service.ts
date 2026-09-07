import type { PublicUser } from '@ciesa/contracts';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { comparePassword, hashPassword } from './password.js';
import { createAuthToken } from './token.js';
import type { LoginInput, RegisterInput } from './schemas.js';

export class AuthConflictError extends Error {
    constructor() {
        super('User already exists');
        this.name = 'AuthConflictError';
    }
}

export class InvalidCredentialsError extends Error {
    constructor() {
        super('Invalid credentials');
        this.name = 'InvalidCredentialsError';
    }
}

const publicUserSelect = {
    id: true,
    name: true,
    email: true,
    role: true,
    createdAt: true,
    updatedAt: true
} satisfies Prisma.UserSelect;

type UserWithPublicFields = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;

function toPublicUser(user: UserWithPublicFields): PublicUser {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString()
    };
}

export async function registerUser(input: RegisterInput) {
    const email = input.email.toLowerCase();
    const passwordHash = await hashPassword(input.password);

    try {
        const user = await prisma.user.create({
            data: { name: input.name, email, passwordHash },
            select: { ...publicUserSelect }
        });

        return { user: toPublicUser(user), token: createAuthToken(user.id) };
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            throw new AuthConflictError();
        }

        throw error;
    }
}

export async function loginUser(input: LoginInput) {
    const email = input.email.toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !(await comparePassword(input.password, user.passwordHash))) {
        throw new InvalidCredentialsError();
    }

    return {
        user: toPublicUser({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
        }),
        token: createAuthToken(user.id)
    };
}

export async function findPublicUserById(id: string): Promise<PublicUser | null> {
    const user = await prisma.user.findUnique({ where: { id }, select: publicUserSelect });
    return user ? toPublicUser(user) : null;
}
