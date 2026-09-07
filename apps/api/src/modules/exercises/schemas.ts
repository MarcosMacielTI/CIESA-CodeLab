import { z } from 'zod';

const requiredText = (field: string) =>
  z.string({ required_error: `${field} é obrigatório.` }).trim().min(1, `${field} não pode ficar vazio.`);

export const exerciseCreateSchema = z
  .object({
    courseId: requiredText('courseId'),
    title: requiredText('title').max(200),
    statement: requiredText('statement'),
    inputDescription: z.string().trim().optional(),
    outputDescription: z.string().trim().optional(),
    constraints: z.string().trim().optional(),
    difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).default('MEDIUM')
  })
  .strict();

export const exerciseUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    statement: z.string().trim().min(1).optional(),
    inputDescription: z.string().trim().optional(),
    outputDescription: z.string().trim().optional(),
    constraints: z.string().trim().optional(),
    difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional()
  })
  .strict();

export type ExerciseCreateInput = z.infer<typeof exerciseCreateSchema>;
export type ExerciseUpdateInput = z.infer<typeof exerciseUpdateSchema>;
