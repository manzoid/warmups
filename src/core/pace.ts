// Fluency pace targets, resolved in three tiers (highest priority first):
//   1. the learner's PERSONAL override (adapted from their own performance),
//   2. the shipped CONFIG (content/pace-targets.json) a time-trainer exports,
//   3. a kind-based FALLBACK so there is always a target.
//
// A time-trainer does several timed runs, picks the one to lock in, and exports
// the locked times (exportPaceConfig) as JSON to paste into
// src/data/pace-targets.json. Individual learners keep the option to override
// with their own pace.

import config from '../data/pace-targets.json';

const CONFIG = config as Record<string, number>;
const KIND_DEFAULT = { predict: 10000, write: 60000 } as const;

// A learner's personal target = median(their clean solve times) × this modifier.
export const PERSONAL_MODIFIER = 1.1;

const PERSONAL_PREFIX = 'warmups.pace.';
const TRAINER_PREFIX = 'warmups.trainerPace.';

export function kindDefaultMs(kind: 'predict' | 'write'): number {
  return kind === 'write' ? KIND_DEFAULT.write : KIND_DEFAULT.predict;
}

export function configPaceMs(id: string): number | null {
  const v = CONFIG[id];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function lsGet(key: string): number | null {
  try {
    const v = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
    const n = v == null ? NaN : Number(v);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}
function lsSet(key: string, ms: number): void {
  try {
    window.localStorage.setItem(key, String(Math.round(ms)));
  } catch {
    // best-effort
  }
}

export function readPersonalPace(id: string): number | null {
  return lsGet(PERSONAL_PREFIX + id);
}
export function savePersonalPace(id: string, ms: number): void {
  lsSet(PERSONAL_PREFIX + id, ms);
}

/** A trainer-locked pace (the exportable benchmark for a pattern). */
export function saveTrainerPace(id: string, ms: number): void {
  lsSet(TRAINER_PREFIX + id, ms);
}

/** Resolved drill target: personal override > shipped config > kind default. */
export function resolvedTargetMs(id: string, kind: 'predict' | 'write'): number {
  return readPersonalPace(id) ?? configPaceMs(id) ?? kindDefaultMs(kind);
}

/** True once a real (non-fallback) target exists for this pattern. */
export function hasConfiguredTarget(id: string): boolean {
  return readPersonalPace(id) != null || configPaceMs(id) != null;
}

/**
 * The portable pace config to export: the shipped config with every
 * trainer-locked pace merged over it. Paste the result into
 * content/pace-targets.json to make it the default for all learners.
 */
export function exportPaceConfig(): Record<string, number> {
  const out: Record<string, number> = { ...CONFIG };
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(TRAINER_PREFIX)) {
        const id = key.slice(TRAINER_PREFIX.length);
        const n = Number(window.localStorage.getItem(key));
        if (Number.isFinite(n)) out[id] = Math.round(n);
      }
    }
  } catch {
    // best-effort
  }
  return out;
}

export function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
