// Curriculum scope: which content is VISIBLE by default.
//
// The full library is ~490 exercises per track across 27 unit files — too much
// for a beginner, who just sees a mountain. By default we show a curated core: a
// coherent three-weeks-at-two-hours arc. Everything else stays in the codebase,
// hidden, and comes back instantly with the "Show all content" flag (Settings or
// ?flags=fullContent). Nothing is deleted.
//
// The core: Python only, units u01-u05 (loops, indexing/slicing, strings, hash
// maps, sets), base files only — no "-more" spiral-review sets. ~170 exercises.

import type { Exercise, Track } from './types';
import { FULL_CONTENT } from './flags';

const CORE_TRACK: Track = 'python';
const CORE_UNITS = new Set(['u01', 'u02', 'u03', 'u04', 'u05']);

/** Is this exercise part of the curated beginner core? */
function inCore(ex: Exercise): boolean {
  if (ex.track !== CORE_TRACK) return false;
  if (ex.spiral) return false; // hide "-more" spiral-review sets
  // Fluency generators (no unit) are foundational idioms — keep them, just
  // track-scoped. Static exercises must fall inside a core unit.
  if (ex.generator) return true;
  return ex.unit != null && CORE_UNITS.has(ex.unit);
}

/**
 * Filter a list to what should currently be visible. With "Show all content"
 * on, everything passes through; otherwise only the beginner core.
 */
export function inScope(ex: Exercise): boolean {
  return FULL_CONTENT || inCore(ex);
}

/** Tracks that have any in-scope content (drives the track picker). */
export function availableTracks(all: Exercise[]): Track[] {
  const seen = new Set<Track>();
  for (const ex of all) if (inScope(ex)) seen.add(ex.track);
  return (['python', 'javascript'] as Track[]).filter((t) => seen.has(t));
}
