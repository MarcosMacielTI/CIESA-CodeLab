import { z } from 'zod';

const nonEmptyString = (fieldName: string) =>
  z
    .string({ required_error: `${fieldName} é obrigatório.` })
    .trim()
    .min(1, `${fieldName} não pode ficar vazio.`);

export const courseCreateSchema = z
  .object({
    name: nonEmptyString('name').max(200),
    code: nonEmptyString('code').max(80),
    description: z.string().trim().max(2000).optional().transform((value) => value && value.trim() === '' ? undefined : value),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional()
  })
  .strict();

export const courseUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    code: z.string().trim().min(1).max(80).optional(),
    description: z.string().trim().max(2000).optional().transform((value) => value && value.trim() === '' ? undefined : value),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional()
  })
  .strict();

export const classCreateSchema = z
  .object({
    name: nonEmptyString('name').max(200),
    code: nonEmptyString('code').max(80),
    semester: nonEmptyString('semester').max(50),
    courseId: nonEmptyString('courseId').max(120),
    teacherId: nonEmptyString('teacherId').max(120),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional()
  })
  .strict();

export const classUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    code: z.string().trim().min(1).max(80).optional(),
    semester: z.string().trim().min(1).max(50).optional(),
    courseId: z.string().trim().min(1).max(120).optional(),
    teacherId: z.string().trim().min(1).max(120).optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional()
  })
  .strict();

export const enrollmentCreateSchema = z
  .object({
    classId: nonEmptyString('classId').max(120),
    studentId: nonEmptyString('studentId').max(120)
  })
  .strict();

export type CourseCreateInput = z.infer<typeof courseCreateSchema>;
export type CourseUpdateInput = z.infer<typeof courseUpdateSchema>;
export type ClassCreateInput = z.infer<typeof classCreateSchema>;
export type ClassUpdateInput = z.infer<typeof classUpdateSchema>;
export type EnrollmentCreateInput = z.infer<typeof enrollmentCreateSchema>;
