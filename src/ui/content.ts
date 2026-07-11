// Loads and validates all bundled exercise content.
//
// Uses Vite's glob import to eagerly pull every content/**/*.json file into the
// bundle at build time, then validates each through the shared zod schema so a
// malformed exercise fails loudly rather than corrupting a session.

import { validateExercises } from '../core/schema';
import type { Exercise, Track } from '../core/types';
import { inScope } from '../core/curriculum';

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
      const spiral = /-more\.json$/.test(path);
      for (const ex of validateExercises(mod)) {
        // Stamp source-derived metadata (unit + spiral tier) so the curriculum
        // filter can hide content without it needing to live in the JSON.
        const unit = /\.(u\d\d)\./.exec(ex.id)?.[1];
        out.push({ ...ex, unit, spiral });
      }
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
// Both respect the curriculum scope (inScope): by default only the beginner
// core is visible, unless "Show all content" is on.
export function exercisesForTrack(track: Track): Exercise[] {
  return ALL_EXERCISES.filter((ex) => ex.track === track && !ex.generator && inScope(ex));
}

/** Fluency-drill generator exercises for a track (Kumon-style speed practice). */
export function generatorsForTrack(track: Track): Exercise[] {
  return ALL_EXERCISES.filter((ex) => ex.track === track && !!ex.generator && inScope(ex));
}
