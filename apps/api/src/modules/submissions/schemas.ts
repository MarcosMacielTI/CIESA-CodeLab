import { z } from 'zod';

export const submissionLanguageSchema = z.enum(['JAVA', 'PYTHON']);

export const submissionCreateSchema = z
  .object({
    sourceCode: z.string().min(1, 'sourceCode não pode ficar vazio.').max(1_000_000),
    language: submissionLanguageSchema
  })
  .strict();

export type SubmissionCreateInput = z.infer<typeof submissionCreateSchema>;
