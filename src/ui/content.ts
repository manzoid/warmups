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
  // Glob keys sort lexically, which puts "uNN-slug-more.json" BEFORE
  // "uNN-slug.json" (0x2D '-' < 0x2E '.'), so spiral variants would queue-jump
  // ahead of the base exercises of the same unit. Sort so each unit's base file
  // loads before its `-more` file.
  const entries = Object.entries(modules).sort(([a], [b]) => {
    const baseKey = (p: string) => p.replace(/-more(\.json)$/, '$1');
    const ka = baseKey(a);
    const kb = baseKey(b);
    if (ka !== kb) return ka < kb ? -1 : 1;
    return (a.includes('-more') ? 1 : 0) - (b.includes('-more') ? 1 : 0);
  });
  for (const [path, mod] of entries) {
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

// The Learn / Practice / History sequence is the static curriculum only —
// fluency generators (which have no fixed instance) live in their own mode.
export function exercisesForTrack(track: Track): Exercise[] {
  return ALL_EXERCISES.filter((ex) => ex.track === track && !ex.generator);
}

/** Fluency-drill generator exercises for a track (Kumon-style speed practice). */
export function generatorsForTrack(track: Track): Exercise[] {
  return ALL_EXERCISES.filter((ex) => ex.track === track && !!ex.generator);
}
