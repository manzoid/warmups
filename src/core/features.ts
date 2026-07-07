// Feature flags. Default OFF.
//
// `INTERVIEW_FEATURES` gates every surface that presents programming-interview
// problems as such: Learn's "Skip to problems" fast lane, the Fluency
// "interview reps" pattern group, and Practice's "Browse interview problems"
// roster. With the flag off (the default), those are hidden; the underlying
// exercises still exist in the normal curriculum, they're just not surfaced as
// an interview track.
//
// Enable it either at build time (VITE_INTERVIEW_FEATURES=true) or at runtime
// for quick testing without a rebuild (localStorage 'warmups.features.interview'
// = '1', then reload).
function interviewEnabled(): boolean {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
    if (env && env.VITE_INTERVIEW_FEATURES === 'true') return true;
  } catch {
    // ignore
  }
  try {
    if (
      typeof window !== 'undefined' &&
      window.localStorage.getItem('warmups.features.interview') === '1'
    ) {
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

export const INTERVIEW_FEATURES = interviewEnabled();

// `TRAINER_MODE` gates the time-trainer tools in Fluency: the "Set the pace
// yourself" run-and-lock flow, its "Copy pace config" export, and "Re-pace".
// Off by default, so a regular learner never touches the shipped pace config;
// their only pace control is the personal "Tune target to my pace" override.
// Enable via VITE_TRAINER_MODE=true or localStorage 'warmups.trainer' = '1'.
function trainerEnabled(): boolean {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
    if (env && env.VITE_TRAINER_MODE === 'true') return true;
  } catch {
    // ignore
  }
  try {
    if (
      typeof window !== 'undefined' &&
      window.localStorage.getItem('warmups.trainer') === '1'
    ) {
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

export const TRAINER_MODE = trainerEnabled();
