import type { PublicUser, UserRole } from '@ciesa/contracts';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

export class UserNotFoundError extends Error {
    constructor() {
        super('User not found');
        this.name = 'UserNotFoundError';
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

type PublicUserRecord = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;

function toPublicUser(user: PublicUserRecord): PublicUser {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role as UserRole,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString()
    };
}

export async function updateUserRole(userId: string, role: UserRole): Promise<PublicUser> {
    try {
        const user = await prisma.user.update({
            where: { id: userId },
            data: { role },
            select: publicUserSelect
        });

        return toPublicUser(user);
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
            throw new UserNotFoundError();
        }

        throw error;
    }
}
