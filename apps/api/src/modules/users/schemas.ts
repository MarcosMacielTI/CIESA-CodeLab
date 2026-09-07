import { z } from 'zod';

export const updateRoleSchema = z.object({
    role: z.enum(['STUDENT', 'TEACHER', 'ADMIN'])
});

export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
