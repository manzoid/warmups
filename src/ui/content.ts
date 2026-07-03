// Loads and validates all bundled exercise content.
//
// Uses Vite's glob import to eagerly pull every content/**/*.json file into the
// bundle at build time, then validates each through the shared zod schema so a
// malformed exercise fails loudly rather than corrupting a session.

import { validateExercises } from '../core/schema';
import type { Exercise, Track } from '../core/types';

const modules = import.meta.glob('../../content/**/*.json', {
  eager: true,
  import: 'default',
});

function loadAll(): Exercise[] {
  const out: Exercise[] = [];
  for (const [path, mod] of Object.entries(modules)) {
    try {
      out.push(...validateExercises(mod));
    } catch (err) {
      // Surface which file broke; skip it rather than crashing the whole app.
      console.error(`Invalid content in ${path}:`, err);
    }
  }
  return out;
}

export const ALL_EXERCISES: Exercise[] = loadAll();

export function exercisesForTrack(track: Track): Exercise[] {
  return ALL_EXERCISES.filter((ex) => ex.track === track);
}
