// Feature-flag subsystem.
//
// Flags are defined ONCE, here, with a default and a description. Their value is
// resolved with a clear precedence:
//
//   managed override  >  build-time env  >  code default
//
// - code default: the `default` in FLAG_DEFS below.
// - build-time env: VITE_FLAG_<KEY>=true|false (e.g. VITE_FLAG_TRAINER=true).
// - managed override: a persisted per-flag override, set through the in-app
//   Settings panel or a `?flags=` URL param — NOT by poking storage keys by
//   hand. All overrides live under a single namespaced key.
//
// Resolved once at load into FLAGS; the Settings panel writes an override and
// reloads so the new value takes effect.

export type FlagKey = 'interview' | 'trainer' | 'fullContent' | 'fluency' | 'srsLearn';

export interface FlagDef {
  key: FlagKey;
  label: string;
  description: string;
  default: boolean;
}

export const FLAG_DEFS: readonly FlagDef[] = [
  {
    key: 'interview',
    label: 'Interview problems',
    description:
      'Surface the programming-interview features: Learn "skip to problems", the Fluency "interview reps" group, the "browse interview problems" roster, and post-solve LC tags.',
    default: false,
  },
  {
    key: 'trainer',
    label: 'Time-trainer tools',
    description:
      'Enable the Fluency pace tools: "set the pace yourself" run-and-lock, "copy pace config" export, "re-pace", and dirty/unpaced badges.',
    default: false,
  },
  {
    key: 'fullContent',
    label: 'Show all content',
    description:
      'Off by default, the app shows only the beginner core (Python units 1-5, no spiral-review "-more" sets) — about three weeks of work. Turn this on to unlock every unit, both tracks, and all spiral review.',
    default: false,
  },
  {
    key: 'fluency',
    label: 'Fluency drills',
    description:
      'Show the Fluency tab: timed speed drills on generated instances of a pattern. (The tab also appears when the time-trainer tools are on.)',
    default: false,
  },
  {
    key: 'srsLearn',
    label: 'Learn via SRS',
    description:
      'Show the "Learn (SRS)" tab: the guided spaced-repetition sequence through the curriculum. Off, the app opens on Practice.',
    default: false,
  },
];

const OVERRIDES_KEY = 'warmups.flags';

type Overrides = Partial<Record<FlagKey, boolean>>;

function readOverrides(): Overrides {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(OVERRIDES_KEY) : null;
    return raw ? (JSON.parse(raw) as Overrides) : {};
  } catch {
    return {};
  }
}

function writeOverrides(o: Overrides): void {
  try {
    window.localStorage.setItem(OVERRIDES_KEY, JSON.stringify(o));
  } catch {
    // best-effort
  }
}

function isFlagKey(s: string): s is FlagKey {
  return FLAG_DEFS.some((d) => d.key === s);
}

// Build-time default: VITE_FLAG_INTERVIEW / VITE_FLAG_TRAINER = 'true' | 'false'.
function envDefault(key: FlagKey): boolean | undefined {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
    const v = env?.['VITE_FLAG_' + key.toUpperCase()];
    if (v === 'true') return true;
    if (v === 'false') return false;
  } catch {
    // ignore
  }
  return undefined;
}

// `?flags=trainer,interview` turns those on; a leading '-' turns off
// (`?flags=-trainer`). Persisted as an override so it sticks after the param is
// gone, matching how a settings toggle behaves.
function applyUrlFlags(overrides: Overrides): Overrides {
  try {
    const spec = new URLSearchParams(window.location.search).get('flags');
    if (!spec) return overrides;
    const next: Overrides = { ...overrides };
    let changed = false;
    for (const rawTok of spec.split(',')) {
      const tok = rawTok.trim();
      if (!tok) continue;
      const off = tok.startsWith('-');
      const key = off ? tok.slice(1) : tok;
      if (isFlagKey(key)) {
        next[key] = !off;
        changed = true;
      }
    }
    if (changed) writeOverrides(next);
    return next;
  } catch {
    return overrides;
  }
}

function resolveFlags(): Record<FlagKey, boolean> {
  const overrides = applyUrlFlags(readOverrides());
  const out = {} as Record<FlagKey, boolean>;
  for (const def of FLAG_DEFS) {
    out[def.key] = overrides[def.key] ?? envDefault(def.key) ?? def.default;
  }
  return out;
}

/** Resolved flag values for this session (fixed at load; toggling reloads). */
export const FLAGS: Record<FlagKey, boolean> = resolveFlags();

export function isEnabled(key: FlagKey): boolean {
  return FLAGS[key];
}

/** Set a managed override (persisted). The caller reloads to apply it. */
export function setFlagOverride(key: FlagKey, value: boolean): void {
  const o = readOverrides();
  o[key] = value;
  writeOverrides(o);
}

/** Drop all managed overrides (revert to env/code defaults). */
export function clearFlagOverrides(): void {
  writeOverrides({});
}

// Convenience aliases for the current flags (keeps call sites readable).
export const INTERVIEW_FEATURES = FLAGS.interview;
export const TRAINER_MODE = FLAGS.trainer;
export const FULL_CONTENT = FLAGS.fullContent;
// The Fluency tab is learner-facing sugar, but a trainer needs it to pace.
export const FLUENCY_TAB = FLAGS.fluency || FLAGS.trainer;
export const LEARN_SRS = FLAGS.srsLearn;
