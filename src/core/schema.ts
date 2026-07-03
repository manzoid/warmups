import { z } from 'zod';
import type { Exercise } from './types';

export const TrackSchema = z.enum(['python', 'javascript']);
export const ExerciseKindSchema = z.enum(['predict', 'write']);

export const ExerciseSchema = z.object({
  id: z.string().min(1),
  track: TrackSchema,
  group: z.string().min(1),
  concept: z.string().min(1),
  kind: ExerciseKindSchema,
  prompt: z.string().min(1),
  // kind === 'predict'
  snippet: z.string().optional(),
  expected: z.string().optional(),
  // kind === 'write'
  starter: z.string().optional(),
  solution: z.string().optional(),
  tests: z.string().optional(),
  prereqs: z.array(z.string()).optional(),
}).superRefine((ex, ctx) => {
  if (ex.kind === 'predict' && ex.expected === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `predict exercise "${ex.id}" must provide "expected"`,
      path: ['expected'],
    });
  }
  if (ex.kind === 'write' && ex.tests === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `write exercise "${ex.id}" must provide "tests"`,
      path: ['tests'],
    });
  }
});

export const ExercisesSchema = z.array(ExerciseSchema);

/**
 * Parse + validate a JSON value (typically the parsed contents of a
 * content/**\/*.json file) into a typed Exercise[]. Throws a ZodError on
 * invalid input.
 */
export function validateExercises(json: unknown): Exercise[] {
  return ExercisesSchema.parse(json);
}
