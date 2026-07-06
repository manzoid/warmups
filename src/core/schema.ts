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
  // optional hint-ladder rungs
  cue: z.string().optional(),
  syntax: z.string().optional(),
  // kind === 'predict'
  snippet: z.string().optional(),
  expected: z.string().optional(),
  // kind === 'write'
  starter: z.string().optional(),
  solution: z.string().optional(),
  tests: z.string().optional(),
  cases: z
    .array(
      z
        .object({
          setup: z.string().optional(),
          call: z.string().min(1),
          expect: z.string().optional(),
          check: z.string().optional(),
        })
        .refine((c) => (c.expect === undefined) !== (c.check === undefined), {
          message: 'each case needs exactly one of "expect" or "check"',
        }),
    )
    .min(1)
    .optional(),
  banned: z.array(z.string()).optional(),
  prereqs: z.array(z.string()).optional(),
  // shown only after solving
  note: z.string().optional(),
  mapsTo: z.string().optional(),
  // fluency generator (trusted source producing fresh instances)
  generator: z.string().optional(),
}).superRefine((ex, ctx) => {
  // A fluency `generator` produces snippet/expected (predict) or
  // starter/tests/solution (write) fresh per instance, so those fields are
  // absent on the static exercise — skip the static-field requirements for it.
  if (ex.generator !== undefined) return;
  if (ex.kind === 'predict' && ex.expected === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `predict exercise "${ex.id}" must provide "expected"`,
      path: ['expected'],
    });
  }
  if (ex.kind === 'write' && ex.tests === undefined && ex.cases === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `write exercise "${ex.id}" must provide "tests" or "cases"`,
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
