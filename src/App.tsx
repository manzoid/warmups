import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Exercise, RunResult, Track } from './core/types';
import {
  load,
  save,
  saveRemote,
  loadRemote,
  recordAttempt,
  bumpLastAttemptRung,
  lastAttempt,
  bestTimeMs,
  hasAttempted,
  resetProgress,
  savePaceConfig,
  type ProgressState,
} from './core/storage';
import { exercisesForTrack, generatorsForTrack } from './ui/content';
import { pickNextLearn, learnCounts, RUNNERS, type NextPick } from './ui/session';
import { INTERVIEW_FEATURES, TRAINER_MODE, FLAGS, FLAG_DEFS, setFlagOverride } from './core/flags';
import {
  resolvedTargetMs,
  readPersonalPace,
  savePersonalPace,
  saveTrainerPace,
  exportPaceConfig,
  patternHash,
  configStatus,
  configPaceMs,
  median,
  PERSONAL_MODIFIER,
  type PaceStatus,
} from './core/pace';
import { styles, theme } from './ui/styles';
import { CodeEditor } from './ui/Editor';
import { Visualizer } from './ui/Visualizer';
import { buildWalkthroughPrompt } from './ui/walkthroughPrompt';

const TRACK_LABELS: Record<Track, string> = {
  python: 'Python',
  javascript: 'JavaScript',
};

type View = 'learn' | 'practice' | 'fluency' | 'history';

export default function App() {
  // Progress lives in a ref (arrays/maps mutate in place); `tick` forces a
  // render after we persist a change.
  const progress = useRef<ProgressState>(load());
  const [, setTick] = useState(0);
  const bump = useCallback(() => setTick((n) => n + 1), []);

  // Persist to both the localStorage cache and the durable local data server.
  const persist = useCallback(() => {
    save(progress.current);
    void saveRemote(progress.current);
  }, []);

  // On start, hydrate from the data server (SQLite) if it's running: take its
  // attempt log as truth, but UNION in anything only in the local cache (so an
  // attempt made while the server was down isn't lost). If the server is up but
  // empty, seed it from the cache.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { state: remote, up } = await loadRemote();
      if (cancelled) return;
      if (remote) {
        const seen = new Set(remote.attempts.map((a) => `${a.id}@${a.at}`));
        for (const a of progress.current.attempts) {
          if (!seen.has(`${a.id}@${a.at}`)) remote.attempts.push(a);
        }
        remote.attempts.sort((x, y) => x.at - y.at);
        progress.current = remote;
        save(progress.current);
        void saveRemote(progress.current);
      } else if (up) {
        void saveRemote(progress.current);
      }
      bump();
    })();
    return () => {
      cancelled = true;
    };
  }, [bump]);

  const [track, setTrack] = useState<Track | null>(null);
  const [view, setView] = useState<View>('learn');
  const [showSettings, setShowSettings] = useState(false);
  const [showTraining, setShowTraining] = useState(false);
  // When the training dashboard launches a pattern for pacing, force setpace.
  const [fluencyStart, setFluencyStart] = useState<'setpace' | undefined>(undefined);
  const [pick, setPick] = useState<NextPick | null>(null);
  const [input, setInput] = useState('');
  const [result, setResult] = useState<RunResult | null>(null);
  const [running, setRunning] = useState(false);
  // Deepest hint-ladder rung reached for the current exercise (0 = unaided,
  // 1 cue, 2 syntax, 3 visualize, 4 walkthrough, 5 reveal). Recorded per attempt.
  const [maxRung, setMaxRung] = useState(0);
  // Timing: when the current exercise appeared, and the ms of the latest clean
  // solve (for the "solved in Xs · best Ys" fluency readout).
  const startedAt = useRef<number>(0);
  const [solveMs, setSolveMs] = useState<number | null>(null);

  // Practice queue: an explicit set the learner chose to drill (from a group or
  // a history filter). Null = no active practice set (show the picker).
  const [queue, setQueue] = useState<Exercise[] | null>(null);
  // When true, the Practice view shows the browsable interview-problems roster
  // instead of the picker (so opening "Interview problems" isn't a blind drill).
  const [problemBrowse, setProblemBrowse] = useState(false);
  const [qIndex, setQIndex] = useState(0);
  const [queueLabel, setQueueLabel] = useState('');

  const exercises = useMemo(
    () => (track ? exercisesForTrack(track) : []),
    [track],
  );
  const generators = useMemo(
    () => (track ? generatorsForTrack(track) : []),
    [track],
  );
  // The fluency pattern currently being drilled (null = show the picker).
  const [fluencyEx, setFluencyEx] = useState<Exercise | null>(null);

  // "Experienced" preference (persisted, separate from progress): when on, the
  // fast-lane callout keeps appearing at the start of each new unit, not just on
  // the very first screen ever — so a returning learner doesn't re-meet the
  // remedial openers of every unit with no visible exit.
  const [experienced, setExperienced] = useState<boolean>(() => {
    try {
      return typeof window !== 'undefined' && window.localStorage.getItem('warmups.experienced') === '1';
    } catch {
      return false;
    }
  });
  const toggleExperienced = useCallback(() => {
    setExperienced((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem('warmups.experienced', next ? '1' : '0');
      } catch {
        // best-effort
      }
      return next;
    });
  }, []);

  // The first exercise (in content order) of each group — the "unit openers"
  // where an experienced learner most wants the fast lane offered again.
  const unitOpenerIds = useMemo(() => {
    const seen = new Set<string>();
    const openers = new Set<string>();
    for (const ex of exercises) {
      if (!seen.has(ex.group)) {
        seen.add(ex.group);
        openers.add(ex.id);
      }
    }
    return openers;
  }, [exercises]);

  const startExercise = useCallback((ex: Exercise, isNew: boolean) => {
    setResult(null);
    setRunning(false);
    setMaxRung(0);
    setSolveMs(null);
    startedAt.current = Date.now();
    setInput(ex.kind === 'write' ? ex.starter ?? '' : '');
    setPick({ exercise: ex, isNew });
  }, []);

  const advanceLearn = useCallback(() => {
    const next = pickNextLearn(exercises, progress.current);
    if (next) startExercise(next.exercise, next.isNew);
    else {
      setPick(null);
      setResult(null);
      setMaxRung(0);
    }
    bump();
  }, [exercises, startExercise, bump]);

  // Test out: mark exercises seen-but-not-passed and advance past them (for
  // learners who already know this material). Skipped items don't count as
  // passed, and stay redoable from History/Practice.
  const skip = useCallback(
    (ids: string[]) => {
      const now = Date.now();
      for (const id of ids) {
        if (!hasAttempted(progress.current, id)) {
          recordAttempt(progress.current, { id, at: now, passed: false, rung: 0, skipped: true });
        }
      }
      persist();
      advanceLearn();
    },
    [persist, advanceLearn],
  );

  // Fast-forward: skip past not-yet-attempted trivia to the next LC-tagged
  // (interview-grade) exercise. Lets experienced learners jump to the meat.
  const skipToProblems = useCallback(() => {
    const ids: string[] = [];
    let started = false;
    for (const ex of exercises) {
      if (hasAttempted(progress.current, ex.id)) continue;
      if (started && ex.mapsTo) break; // land on the next tagged problem
      ids.push(ex.id);
      started = true;
    }
    if (ids.length) skip(ids);
  }, [exercises, skip]);

  // Skip past the opening predict/trivia cluster to the next hands-on write.
  // "Skip to first write" is a one-time onboarding shortcut; once used, we stop
  // offering it (persisted, so it stays gone across sessions).
  const [usedSkipFirstWrite, setUsedSkipFirstWrite] = useState<boolean>(() => {
    try {
      return (
        typeof window !== 'undefined' &&
        window.localStorage.getItem('warmups.usedSkipFirstWrite') === '1'
      );
    } catch {
      return false;
    }
  });

  const skipToFirstWrite = useCallback(() => {
    const ids: string[] = [];
    let started = false;
    for (const ex of exercises) {
      if (hasAttempted(progress.current, ex.id)) continue;
      if (started && ex.kind === 'write') break; // land on the next write
      ids.push(ex.id);
      started = true;
    }
    setUsedSkipFirstWrite(true);
    try {
      window.localStorage.setItem('warmups.usedSkipFirstWrite', '1');
    } catch {
      // best-effort
    }
    if (ids.length) skip(ids);
  }, [exercises, skip]);

  const advancePractice = useCallback(() => {
    if (!queue) return;
    const ni = qIndex + 1;
    if (ni < queue.length) {
      setQIndex(ni);
      startExercise(queue[ni], false);
    } else {
      setPick(null);
      setResult(null);
      setMaxRung(0);
    }
    bump();
  }, [queue, qIndex, startExercise, bump]);

  const startPractice = useCallback(
    (exs: Exercise[], label: string) => {
      setView('practice');
      setProblemBrowse(false);
      setQueue(exs);
      setQIndex(0);
      setQueueLabel(label);
      if (exs.length) startExercise(exs[0], false);
      else setPick(null);
      bump();
    },
    [startExercise, bump],
  );

  const chooseTrack = (t: Track) => {
    setTrack(t);
    setView('learn');
    setQueue(null);
    setFluencyEx(null);
    const next = pickNextLearn(exercisesForTrack(t), progress.current);
    if (next) startExercise(next.exercise, next.isNew);
    else setPick(null);
  };

  // From the training dashboard: jump to a specific pattern's pacing flow.
  const pacePattern = (target: Exercise) => {
    setTrack(target.track);
    setView('fluency');
    setQueue(null);
    setProblemBrowse(false);
    setPick(null);
    setFluencyStart('setpace');
    setFluencyEx(target);
    setShowTraining(false);
  };

  const switchView = (v: View) => {
    setView(v);
    if (v === 'learn') advanceLearn();
    else {
      // practice/fluency show a picker until a set is chosen; history is a list.
      setQueue(null);
      setPick(null);
      setResult(null);
      setFluencyEx(null);
      setProblemBrowse(false);
    }
  };

  // Record one cleared fluency pattern to the log (passed, unaided, best time).
  const recordFluencyClear = useCallback(
    (exId: string, bestMs: number) => {
      recordAttempt(progress.current, {
        id: exId,
        at: Date.now(),
        passed: true,
        rung: 0,
        ms: bestMs,
      });
      persist();
      bump();
    },
    [persist, bump],
  );

  // "I've got this": the learner self-declares mastery of a pattern. Recorded
  // (distinctly, via selfDeclared) so we can tune their drills later, then we
  // exit back to the pattern picker.
  const recordGotThis = useCallback(
    (exId: string) => {
      recordAttempt(progress.current, {
        id: exId,
        at: Date.now(),
        passed: true,
        rung: 0,
        selfDeclared: true,
      });
      persist();
      setFluencyEx(null);
      bump();
    },
    [persist, bump],
  );

  // Record one graded attempt to the append-only log (no SRS scheduling).
  const grade = useCallback(
    (exId: string, passed: boolean, rung: number, ms?: number) => {
      recordAttempt(progress.current, {
        id: exId,
        at: Date.now(),
        passed,
        rung,
        ms,
      });
      persist();
      bump();
    },
    [persist, bump],
  );

  // In-place retry after a miss: clear the result so the learner can edit and
  // resubmit without advancing (the missed attempt is already logged).
  const retry = useCallback(() => {
    setResult(null);
    setRunning(false);
    startedAt.current = Date.now();
  }, []);

  const submit = useCallback(async () => {
    if (!track || !pick) return;
    const ex = pick.exercise;
    setRunning(true);
    let res: RunResult;
    try {
      res = await RUNNERS[track].run(input, ex);
    } catch (err) {
      res = { passed: false, error: err instanceof Error ? err.message : String(err) };
    }
    const ms = Date.now() - startedAt.current;
    grade(ex.id, res.passed, maxRung, ms);
    setSolveMs(res.passed && maxRung === 0 ? ms : null);
    setResult(res);
    setRunning(false);
  }, [track, pick, input, maxRung, grade]);

  // Opening a hint rung records it as the deepest reached. If the exercise was
  // already graded, raise the rung on that recorded attempt (one attempt per
  // sitting, but the rung reflects the most help taken).
  const useHint = useCallback(
    (rung: number) => {
      if (!pick) return;
      const next = Math.max(maxRung, rung);
      if (next === maxRung) return;
      setMaxRung(next);
      if (result) {
        bumpLastAttemptRung(progress.current, pick.exercise.id, next);
        persist();
        bump();
      }
    },
    [maxRung, pick, result, persist, bump],
  );

  const resetHistory = useCallback(() => {
    resetProgress(progress.current);
    persist();
    setQueue(null);
    setView('learn');
    const next = pickNextLearn(exercises, progress.current);
    if (next) startExercise(next.exercise, next.isNew);
    else setPick(null);
    bump();
  }, [exercises, startExercise, persist, bump]);

  const counts = track ? learnCounts(exercises, progress.current) : null;

  return (
    <div style={styles.page}>
      <div style={styles.shell}>
        <div style={{ ...styles.row, justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <h1 style={styles.h1}>warmups</h1>
          <div style={{ ...styles.row, gap: 8 }}>
            {TRAINER_MODE && (
              <button
                style={{
                  ...styles.btnGhost,
                  padding: '2px 8px',
                  fontSize: '0.8rem',
                  ...(showTraining ? { borderColor: theme.accent, color: theme.accent } : {}),
                }}
                onClick={() => setShowTraining((s) => !s)}
                title="Time-trainer dashboard: pace coverage across all patterns"
              >
                Training
              </button>
            )}
            <button
              style={{ ...styles.btnGhost, padding: '2px 8px', fontSize: '0.8rem' }}
              onClick={() => setShowSettings((s) => !s)}
              title="Feature flags and settings"
            >
              ⚙ Settings
            </button>
          </div>
        </div>
        <p style={styles.tagline}>
          Local-first coding drills for language fluency and problem-solving
          primitives — you choose what to practice.
        </p>

        {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}

        {TRAINER_MODE && showTraining && (
          <TrainingDashboard onPace={pacePattern} onClose={() => setShowTraining(false)} />
        )}

        {!(TRAINER_MODE && showTraining) && !track && <TrackPicker onPick={chooseTrack} />}

        {!(TRAINER_MODE && showTraining) && track && counts && (
          <>
            <Nav
              track={track}
              view={view}
              counts={counts}
              hasFluency={generators.length > 0}
              onView={switchView}
              onChangeTrack={() => {
                setTrack(null);
                setPick(null);
                setQueue(null);
              }}
            />

            {view === 'learn' &&
              (pick ? (
                <ExerciseView
                  key={pick.exercise.id}
                  pick={pick}
                  input={input}
                  onInput={setInput}
                  running={running}
                  result={result}
                  maxRung={maxRung}
                  onUseHint={useHint}
                  onSubmit={submit}
                  onNext={advanceLearn}
                  onRetry={retry}
                  timing={
                    solveMs != null
                      ? { ms: solveMs, bestMs: bestTimeMs(progress.current, pick.exercise.id) }
                      : undefined
                  }
                  firstScreen={
                    progress.current.attempts.length === 0 ||
                    (experienced && unitOpenerIds.has(pick.exercise.id))
                  }
                  experienced={experienced}
                  onToggleExperienced={toggleExperienced}
                  onSkip={() => skip([pick.exercise.id])}
                  onSkipToFirstWrite={usedSkipFirstWrite ? undefined : skipToFirstWrite}
                  onSkipToProblems={INTERVIEW_FEATURES ? skipToProblems : undefined}
                  onSkipUnit={() =>
                    skip(
                      exercises
                        .filter((e) => e.group === pick.exercise.group)
                        .map((e) => e.id),
                    )
                  }
                />
              ) : (
                <AllPassed />
              ))}

            {view === 'practice' &&
              (problemBrowse ? (
                <InterviewBrowser
                  exercises={exercises}
                  onStart={startPractice}
                  onBack={() => setProblemBrowse(false)}
                />
              ) : queue == null ? (
                <PracticePicker
                  exercises={exercises}
                  onStart={startPractice}
                  onBrowseProblems={() => setProblemBrowse(true)}
                />
              ) : pick ? (
                <ExerciseView
                  key={pick.exercise.id}
                  pick={pick}
                  input={input}
                  onInput={setInput}
                  running={running}
                  result={result}
                  maxRung={maxRung}
                  onUseHint={useHint}
                  onSubmit={submit}
                  onNext={advancePractice}
                  onRetry={retry}
                  timing={
                    solveMs != null
                      ? { ms: solveMs, bestMs: bestTimeMs(progress.current, pick.exercise.id) }
                      : undefined
                  }
                  subtitle={`Practice · ${queueLabel} · ${qIndex + 1} / ${queue.length}`}
                  onExit={() => {
                    setQueue(null);
                    setPick(null);
                  }}
                />
              ) : (
                <PracticeDone
                  label={queueLabel}
                  onAgain={() => startPractice(queue, queueLabel)}
                  onPick={() => {
                    setQueue(null);
                    setPick(null);
                  }}
                />
              ))}

            {view === 'fluency' &&
              (fluencyEx == null ? (
                <FluencyPicker
                  generators={generators}
                  onPick={(g) => {
                    setFluencyStart(undefined);
                    setFluencyEx(g);
                  }}
                />
              ) : (
                <FluencyDrill
                  key={fluencyEx.id}
                  track={track}
                  ex={fluencyEx}
                  best={bestTimeMs(progress.current, fluencyEx.id)}
                  initialPhase={fluencyStart}
                  onCleared={(ms) => recordFluencyClear(fluencyEx.id, ms)}
                  onGotThis={() => recordGotThis(fluencyEx.id)}
                  onExit={() => setFluencyEx(null)}
                />
              ))}

            {view === 'history' && (
              <HistoryView
                exercises={exercises}
                state={progress.current}
                onPractice={startPractice}
                onReset={resetHistory}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Feature-flag management. Reads the central registry (FLAG_DEFS) and the
// resolved values (FLAGS); toggling writes a managed override and reloads so the
// change takes effect. No poking storage keys by hand.
function SettingsPanel({ onClose }: { onClose: () => void }) {
  return (
    <div style={styles.panel}>
      <div style={{ ...styles.row, justifyContent: 'space-between', marginBottom: '0.4rem' }}>
        <p style={{ ...styles.label, margin: 0 }}>Feature flags</p>
        <button style={styles.btnGhost} onClick={onClose}>
          Close
        </button>
      </div>
      <p style={{ ...styles.tagline, margin: '0 0 0.8rem', fontSize: '0.8rem', color: theme.muted }}>
        Toggling applies on reload. You can also set them at build time
        (VITE_FLAG_TRAINER=true) or via a URL param (?flags=trainer,interview).
      </p>
      {FLAG_DEFS.map((def) => (
        <label
          key={def.key}
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'flex-start',
            padding: '8px 0',
            borderTop: `1px solid ${theme.border}`,
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={FLAGS[def.key]}
            onChange={(e) => {
              setFlagOverride(def.key, e.target.checked);
              window.location.reload();
            }}
            style={{ marginTop: 3 }}
          />
          <span>
            <strong>{def.label}</strong>
            <span style={{ ...styles.tagline, display: 'block', margin: '2px 0 0', fontSize: '0.8rem', color: theme.muted }}>
              {def.description}
            </span>
          </span>
        </label>
      ))}
    </div>
  );
}

function TrackPicker({ onPick }: { onPick: (t: Track) => void }) {
  return (
    <div style={styles.panel}>
      <p style={styles.label}>Pick a track</p>
      <div style={styles.row}>
        {(Object.keys(TRACK_LABELS) as Track[]).map((t) => (
          <button key={t} style={styles.btn} onClick={() => onPick(t)}>
            {TRACK_LABELS[t]}
          </button>
        ))}
      </div>
      <p style={{ ...styles.tagline, margin: '1rem 0 0' }}>
        Python runs in-browser via Pyodide (first run downloads the runtime).
        JavaScript runs in a Web Worker.
      </p>
      <p style={{ ...styles.tagline, margin: '0.4rem 0 0', fontSize: '0.8rem' }}>
        TypeScript syntax is accepted, but types are not taught or checked yet.
      </p>
    </div>
  );
}

function Nav({
  track,
  view,
  counts,
  hasFluency,
  onView,
  onChangeTrack,
}: {
  track: Track;
  view: View;
  counts: { done: number; total: number };
  hasFluency: boolean;
  onView: (v: View) => void;
  onChangeTrack: () => void;
}) {
  const tab = (v: View, label: string) => (
    <button
      style={{
        ...styles.btnGhost,
        ...(view === v ? { borderColor: theme.accent, color: theme.accent } : {}),
      }}
      onClick={() => onView(v)}
    >
      {label}
    </button>
  );
  return (
    <div style={{ ...styles.row, justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: 8 }}>
      <div style={styles.row}>
        <strong style={{ fontSize: '0.95rem' }}>{TRACK_LABELS[track]}</strong>
        {tab('learn', 'Learn')}
        {tab('practice', 'Practice')}
        {hasFluency && tab('fluency', 'Fluency')}
        {tab('history', 'History')}
      </div>
      <div style={styles.row}>
        <span style={styles.pill}>
          {counts.done} / {counts.total} passed
        </span>
        <button style={styles.btnGhost} onClick={onChangeTrack}>
          Change track
        </button>
      </div>
    </div>
  );
}

function PracticePicker({
  exercises,
  onStart,
  onBrowseProblems,
}: {
  exercises: Exercise[];
  onStart: (exs: Exercise[], label: string) => void;
  onBrowseProblems: () => void;
}) {
  const groups = useMemo(() => {
    const m = new Map<string, number>();
    for (const ex of exercises) m.set(ex.group, (m.get(ex.group) ?? 0) + 1);
    return [...m.entries()];
  }, [exercises]);
  const problems = useMemo(() => exercises.filter((e) => e.mapsTo), [exercises]);
  return (
    <div style={styles.panel}>
      <p style={styles.label}>Practice — pick a set and just drill (no scheduling)</p>
      <div style={{ ...styles.row, flexWrap: 'wrap', gap: 8, marginBottom: '0.6rem' }}>
        <button style={styles.btn} onClick={() => onStart(exercises, 'Everything')}>
          Everything ({exercises.length})
        </button>
        {INTERVIEW_FEATURES && problems.length > 0 && (
          <button
            style={styles.btn}
            onClick={onBrowseProblems}
            title="Browse the LeetCode/NeetCode-tagged problems and pick one"
          >
            Browse interview problems ({problems.length})
          </button>
        )}
      </div>
      <div style={{ ...styles.row, flexWrap: 'wrap', gap: 8 }}>
        {groups.map(([g, n]) => (
          <button
            key={g}
            style={styles.btnGhost}
            onClick={() => onStart(exercises.filter((e) => e.group === g), g)}
          >
            {g} ({n})
          </button>
        ))}
      </div>
    </div>
  );
}

// A browsable roster of the interview-tagged problems, so opening "interview
// problems" shows the real problems to pick from rather than dropping the
// learner into a blind 100-long linear drill starting at the most trivial item.
function InterviewBrowser({
  exercises,
  onStart,
  onBack,
}: {
  exercises: Exercise[];
  onStart: (exs: Exercise[], label: string) => void;
  onBack: () => void;
}) {
  const { marquee, patterns, all } = useMemo(() => {
    const tagged = exercises.filter((e) => e.mapsTo);
    // Group by the LC problem so a problem with both a predict and a write shows
    // as one row (drilling it runs all its variants).
    type Group = { lc: number; name: string; isPattern: boolean; exs: Exercise[] };
    const byKey = new Map<string, Group>();
    for (const ex of tagged) {
      const raw = ex.mapsTo as string;
      const isPattern = /^pattern behind/i.test(raw);
      const lcMatch = raw.match(/LC\s+(\d+)/i);
      const lc = lcMatch ? Number(lcMatch[1]) : Number.POSITIVE_INFINITY;
      // Name: the part after the "· " separator, else the whole label.
      const dot = raw.indexOf('·');
      const name = (dot >= 0 ? raw.slice(dot + 1) : raw).trim();
      const key = `${isPattern ? 'p' : 'm'}:${lc}:${name}`;
      if (!byKey.has(key)) byKey.set(key, { lc, name, isPattern, exs: [] });
      byKey.get(key)!.exs.push(ex);
    }
    const groups = [...byKey.values()].sort((a, b) => a.lc - b.lc);
    return {
      marquee: groups.filter((g) => !g.isPattern),
      patterns: groups.filter((g) => g.isPattern),
      all: tagged,
    };
  }, [exercises]);

  const kindsLabel = (exs: Exercise[]) => {
    const kinds = [...new Set(exs.map((e) => e.kind))];
    return kinds.join(' + ');
  };

  const row = (g: { lc: number; name: string; exs: Exercise[] }) => (
    <div
      key={`${g.lc}:${g.name}`}
      style={{
        ...styles.row,
        justifyContent: 'space-between',
        padding: '7px 0',
        borderBottom: `1px solid ${theme.border}`,
        gap: 8,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <span style={{ ...styles.pill, marginRight: 8, color: theme.accent, borderColor: theme.accent }}>
          LC {Number.isFinite(g.lc) ? g.lc : '—'}
        </span>
        <span>{g.name}</span>
        <span style={{ ...styles.pill, marginLeft: 8 }}>{kindsLabel(g.exs)}</span>
      </div>
      <button style={styles.btnGhost} onClick={() => onStart(g.exs, `LC ${g.lc} · ${g.name}`)}>
        Drill{g.exs.length > 1 ? ` (${g.exs.length})` : ''}
      </button>
    </div>
  );

  return (
    <div style={styles.panel}>
      <div style={{ ...styles.row, justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <p style={{ ...styles.label, margin: 0 }}>
          Interview problems — {marquee.length} named + {patterns.length} warm-up patterns
        </p>
        <div style={{ ...styles.row, gap: 8 }}>
          <button style={styles.btn} onClick={() => onStart(all, 'Interview problems')}>
            Drill all in order ({all.length})
          </button>
          <button style={styles.btnGhost} onClick={onBack}>
            ← Sets
          </button>
        </div>
      </div>

      <p style={{ ...styles.label, margin: '1rem 0 0.2rem' }}>Named LeetCode problems</p>
      <div>{marquee.map(row)}</div>

      {patterns.length > 0 && (
        <>
          <p style={{ ...styles.label, margin: '1.2rem 0 0.2rem' }}>
            Warm-up patterns (the mechanic behind a problem)
          </p>
          <div>{patterns.map(row)}</div>
        </>
      )}
    </div>
  );
}

function PracticeDone({
  label,
  onAgain,
  onPick,
}: {
  label: string;
  onAgain: () => void;
  onPick: () => void;
}) {
  return (
    <div style={styles.panel}>
      <h2 style={{ fontSize: '1.1rem', margin: '0 0 0.5rem' }}>
        Practiced all of “{label}” 🎉
      </h2>
      <div style={styles.row}>
        <button style={styles.btn} onClick={onAgain}>
          Again
        </button>
        <button style={styles.btnGhost} onClick={onPick}>
          Pick another set
        </button>
      </div>
    </div>
  );
}

// --- Fluency mode (Kumon-style speed drilling) ------------------------------
// Three phases per pattern: STUDY (familiarize with the problem + the reference
// solution, no timer), then SET YOUR PACE (solve one fresh instance timed — that
// real solve time becomes your target), then DRILL (fresh instances; clear by
// matching your own pace 3 in a row). The pace is a genuine human solve, not a
// guess, and it's saved per pattern. "Speed up" tightens it; a miss steps you
// back one, it doesn't wipe your run.

type FluPhase = 'study' | 'setpace' | 'drill';
const FLU_GOAL = 3; // correct-and-fast reps to clear a pattern
const FLU_SPEEDUP = 0.85; // "speed up" round tightens the target by 15%

// Trainer-only badge: which patterns need a (re)paced target. 'missing' = never
// paced; 'dirty' = the problem changed since it was paced. 'fresh' shows nothing.
function PaceStatusPill({ status }: { status: PaceStatus }) {
  if (status === 'fresh') return null;
  const color = status === 'dirty' ? theme.bad : theme.accent;
  return (
    <span style={{ ...styles.pill, marginLeft: 6, color, borderColor: color }}>
      {status === 'dirty' ? 'dirty' : 'unpaced'}
    </span>
  );
}

// Time-trainer dashboard: a cross-track bird's-eye of pace coverage — which
// patterns are paced (fresh), dirty (edited since paced), or unpaced — with a
// jump-to-pace action and the config export in one place.
function TrainingDashboard({
  onPace,
  onClose,
}: {
  onPace: (ex: Exercise) => void;
  onClose: () => void;
}) {
  const [saveMsg, setSaveMsg] = useState('');
  const secs = (ms: number | null) => (ms == null ? '—' : `${(ms / 1000).toFixed(1)}s`);
  const rank: Record<PaceStatus, number> = { missing: 0, dirty: 1, fresh: 2 };

  const rows = useMemo(() => {
    const gens = [...generatorsForTrack('python'), ...generatorsForTrack('javascript')];
    return gens
      .map((ex) => {
        const h = patternHash(ex);
        return {
          ex,
          status: configStatus(ex),
          config: configPaceMs(ex.id, h),
          personal: readPersonalPace(ex.id, h),
        };
      })
      .sort((a, b) =>
        rank[a.status] !== rank[b.status]
          ? rank[a.status] - rank[b.status]
          : a.ex.track < b.ex.track
            ? -1
            : a.ex.track > b.ex.track
              ? 1
              : a.ex.id < b.ex.id
                ? -1
                : 1,
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tally = (t?: Track) => {
    const r = t ? rows.filter((x) => x.ex.track === t) : rows;
    return {
      total: r.length,
      fresh: r.filter((x) => x.status === 'fresh').length,
      dirty: r.filter((x) => x.status === 'dirty').length,
      missing: r.filter((x) => x.status === 'missing').length,
    };
  };
  // Write the config straight to src/data/pace-targets.json via the local data
  // server. If it isn't running, fall back to copying the JSON.
  const saveConfig = async () => {
    const cfg = exportPaceConfig();
    setSaveMsg('Saving…');
    const wrote = await savePaceConfig(cfg);
    if (wrote) {
      setSaveMsg('✓ Saved to src/data/pace-targets.json — commit it');
    } else {
      try {
        await navigator.clipboard.writeText(JSON.stringify(cfg, null, 2));
        setSaveMsg('Data server not running — copied JSON to paste instead');
      } catch {
        setSaveMsg('Data server not running (start it with npm run dev)');
      }
    }
    setTimeout(() => setSaveMsg(''), 4000);
  };

  const summaryLine = (label: string, t?: Track) => {
    const s = tally(t);
    return (
      <span style={{ ...styles.pill }}>
        {label}: {s.fresh} paced · {s.dirty} dirty · {s.missing} unpaced ({s.total})
      </span>
    );
  };

  return (
    <div style={styles.panel}>
      <div style={{ ...styles.row, justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <p style={{ ...styles.label, margin: 0 }}>Training dashboard — pace coverage</p>
        <div style={{ ...styles.row, gap: 8, alignItems: 'center' }}>
          {saveMsg && (
            <span style={{ ...styles.tagline, margin: 0, fontSize: '0.8rem', color: theme.muted }}>{saveMsg}</span>
          )}
          <button style={styles.btn} onClick={saveConfig} title="Write the pace config straight to src/data/pace-targets.json via the local data server">
            Save pace config
          </button>
          <button style={styles.btnGhost} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
      <div style={{ ...styles.row, flexWrap: 'wrap', gap: 8, marginTop: '0.6rem' }}>
        {summaryLine('All')}
        {summaryLine('Python', 'python')}
        {summaryLine('JavaScript', 'javascript')}
      </div>

      <div style={{ marginTop: '0.9rem' }}>
        {rows.map(({ ex, status, config, personal }) => (
          <div
            key={ex.id}
            style={{
              ...styles.row,
              justifyContent: 'space-between',
              padding: '6px 0',
              borderBottom: `1px solid ${theme.border}`,
              gap: 8,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <span
                style={{
                  ...styles.pill,
                  marginRight: 8,
                  color: status === 'fresh' ? theme.good : status === 'dirty' ? theme.bad : theme.accent,
                  borderColor: status === 'fresh' ? theme.good : status === 'dirty' ? theme.bad : theme.accent,
                }}
              >
                {status === 'fresh' ? 'paced' : status === 'dirty' ? 'dirty' : 'unpaced'}
              </span>
              <span>{ex.concept}</span>
              <span style={{ ...styles.pill, marginLeft: 8 }}>{ex.track === 'python' ? 'py' : 'js'}</span>
              <span style={{ ...styles.pill, marginLeft: 4 }}>{ex.kind}</span>
            </div>
            <div style={{ ...styles.row, gap: 8 }}>
              <span style={{ ...styles.tagline, margin: 0, fontSize: '0.8rem', color: theme.muted }}>
                cfg {secs(config)}
                {personal != null ? ` · you ${secs(personal)}` : ''}
              </span>
              <button style={styles.btnGhost} onClick={() => onPace(ex)}>
                {status === 'fresh' ? 'Re-pace →' : 'Pace →'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FluencyPicker({
  generators,
  onPick,
}: {
  generators: Exercise[];
  onPick: (ex: Exercise) => void;
}) {
  return (
    <div style={styles.panel}>
      <p style={styles.label}>Fluency — pick a pattern and drill it fast</p>
      <p style={{ ...styles.tagline, margin: '0 0 0.8rem' }}>
        Fresh random numbers every rep (Kumon-style). Do a few to set your pace,
        then clear the pattern with a streak of correct-and-fast answers. Speed is
        the goal: you want these automatic.
      </p>
      {(() => {
        // Group by the generator's `group` so language IDIOMS are their own
        // findable lane, not buried among the basic arithmetic drills. Idiom
        // groups (labelled "... idioms") sort first — that's what experienced
        // learners come for.
        const byGroup = new Map<string, Exercise[]>();
        for (const ex of generators) {
          // The "interview reps" group is an interview-problem surface; hide it
          // unless the interview feature flag is on.
          if (!INTERVIEW_FEATURES && /interview/i.test(ex.group)) continue;
          const g = ex.group;
          if (!byGroup.has(g)) byGroup.set(g, []);
          byGroup.get(g)!.push(ex);
        }
        const groups = [...byGroup.entries()].sort(([a], [b]) => {
          const ai = /idiom/i.test(a) ? 0 : 1;
          const bi = /idiom/i.test(b) ? 0 : 1;
          return ai !== bi ? ai - bi : a < b ? -1 : 1;
        });
        return groups.map(([g, exs]) => (
          <div key={g} style={{ marginBottom: '0.9rem' }}>
            <p style={{ ...styles.label, margin: '0 0 0.4rem' }}>{g}</p>
            <div style={{ ...styles.row, flexWrap: 'wrap', gap: 8 }}>
              {exs.map((ex) => (
                <button
                  key={ex.id}
                  style={styles.btnGhost}
                  onClick={() => onPick(ex)}
                  title={
                    ex.kind === 'write'
                      ? 'A write drill: you implement the function each time'
                      : 'A predict drill: you type the value each time'
                  }
                >
                  {ex.concept}
                  {ex.kind === 'write' && (
                    <span style={{ ...styles.pill, marginLeft: 6, color: theme.accent, borderColor: theme.accent }}>
                      write
                    </span>
                  )}
                  {TRAINER_MODE && <PaceStatusPill status={configStatus(ex)} />}
                </button>
              ))}
            </div>
          </div>
        ));
      })()}
      <p style={{ ...styles.tagline, margin: '0.4rem 0 0', fontSize: '0.8rem', color: theme.muted }}>
        Fluency is for getting fast at a mechanic you already know. Learn it first
        in Learn, then come here to make it automatic.
      </p>
    </div>
  );
}

function FluencyDrill({
  track,
  ex,
  best,
  initialPhase,
  onCleared,
  onGotThis,
  onExit,
}: {
  track: Track;
  ex: Exercise;
  best: number | null;
  initialPhase?: FluPhase;
  onCleared: (bestMs: number) => void;
  onGotThis: () => void;
  onExit: () => void;
}) {
  const [inst, setInst] = useState<Exercise | null>(null);
  const [loading, setLoading] = useState(true);
  const [genError, setGenError] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [result, setResult] = useState<RunResult | null>(null);
  const [running, setRunning] = useState(false);

  const [times, setTimes] = useState<number[]>([]); // correct-rep times this session
  const [streak, setStreak] = useState(0);
  const [reps, setReps] = useState(0); // correct reps this session
  // Content fingerprint of this pattern; every pace read/write is keyed to it,
  // so editing the problem auto-invalidates a stale timing.
  const hash = patternHash(ex);
  // Drill target (ms): personal override > shipped config > kind default. A
  // pattern with a real (hash-matching) target skips study straight to drilling.
  const [targetMs, setTargetMs] = useState<number>(() => resolvedTargetMs(ex.id, ex.kind, hash));
  // Study first; skip straight to drilling only once you've drilled this exact
  // pattern before (a personal pace whose hash still matches). Editing the
  // problem invalidates that, so you re-study.
  const [phase, setPhase] = useState<FluPhase>(
    () => initialPhase ?? (readPersonalPace(ex.id, hash) != null ? 'drill' : 'study'),
  );
  const [runs, setRuns] = useState<number[]>([]); // "set the pace": candidate solve times
  const [paceSaveMsg, setPaceSaveMsg] = useState('');
  const [cleared, setCleared] = useState(false);
  const [lastMs, setLastMs] = useState<number | null>(null);
  const [lastFast, setLastFast] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  // Post-miss aids (only shown after a wrong answer, never during a live rep).
  const [showViz, setShowViz] = useState(false);
  const [showSol, setShowSol] = useState(false);

  const startedAt = useRef(0);
  const advTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);

  const genNext = useCallback(async () => {
    if (advTimer.current) clearTimeout(advTimer.current);
    setLoading(true);
    setResult(null);
    setInput('');
    setShowViz(false);
    setShowSol(false);
    try {
      const runner = RUNNERS[track];
      const gi = runner.generate ? await runner.generate(ex) : {};
      if (!alive.current) return;
      const trial = { ...ex, ...gi } as Exercise;
      setInst(trial);
      setInput(trial.kind === 'write' ? trial.starter ?? '' : '');
      startedAt.current = Date.now();
      setElapsed(0);
      setGenError(null);
    } catch (err) {
      if (!alive.current) return;
      setGenError(err instanceof Error ? err.message : String(err));
      setInst(null);
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [track, ex]);

  // Kick off the first instance; tear down timers on unmount.
  useEffect(() => {
    alive.current = true;
    void genNext();
    return () => {
      alive.current = false;
      if (advTimer.current) clearTimeout(advTimer.current);
    };
  }, [genNext]);

  // Live stopwatch while an unsolved instance is on screen.
  useEffect(() => {
    if (!inst || result || cleared || loading) return;
    const t = setInterval(() => setElapsed(Date.now() - startedAt.current), 100);
    return () => clearInterval(t);
  }, [inst, result, cleared, loading]);

  const scheduleAdvance = () => {
    if (advTimer.current) clearTimeout(advTimer.current);
    advTimer.current = setTimeout(() => void genNext(), 850);
  };

  const submit = async () => {
    if (!inst || result || running) return;
    const ms = Date.now() - startedAt.current;
    setRunning(true);
    let res: RunResult;
    try {
      res = await RUNNERS[track].run(input, inst);
    } catch (err) {
      res = { passed: false, error: err instanceof Error ? err.message : String(err) };
    }
    if (!alive.current) return;
    setRunning(false);
    setResult(res);
    setLastMs(ms);

    // "Set the pace" phase: each correct solve is recorded as a candidate run.
    // You choose which run to lock in as the target (below); a miss is ignored.
    if (phase === 'setpace') {
      if (res.passed) setRuns((r) => [...r, ms]);
      return;
    }

    if (!res.passed) {
      setLastFast(false);
      // A miss steps the streak back by one, it does NOT wipe your whole run.
      setStreak((s) => Math.max(0, s - 1));
      return;
    }

    const newTimes = [...times, ms];
    setTimes(newTimes);
    setReps((r) => r + 1);

    const fast = ms <= targetMs;
    setLastFast(fast);

    let willClear = false;
    // A correct-but-slow rep HOLDS the streak (it doesn't advance, but it isn't
    // punished either) — being right should never feel like failing.
    if (fast) {
      const s = streak + 1;
      setStreak(s);
      if (s >= FLU_GOAL) {
        willClear = true;
        setCleared(true);
        onCleared(Math.min(...newTimes));
      }
    }
    if (!willClear) scheduleAdvance(); // keep the flow moving on a correct rep
  };

  const secs = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

  // Lock a chosen run in as the target: it becomes your personal pace AND a
  // trainer-locked benchmark (exportable to the shipped config), then drill.
  const lockPace = (ms: number) => {
    savePersonalPace(ex.id, ms, hash);
    if (TRAINER_MODE) saveTrainerPace(ex.id, ms, hash); // only trainers feed the shipped config
    setTargetMs(ms);
    setStreak(0);
    setTimes([]);
    setResult(null);
    setPhase('drill');
    void genNext();
  };
  const saveConfig = async () => {
    const cfg = exportPaceConfig();
    setPaceSaveMsg('Saving…');
    const wrote = await savePaceConfig(cfg);
    if (wrote) {
      setPaceSaveMsg('✓ Saved to pace-targets.json');
    } else {
      try {
        await navigator.clipboard.writeText(JSON.stringify(cfg, null, 2));
        setPaceSaveMsg('Server off — copied JSON instead');
      } catch {
        setPaceSaveMsg('Server off (npm run dev)');
      }
    }
    setTimeout(() => setPaceSaveMsg(''), 4000);
  };

  // --- cleared card ---------------------------------------------------------
  if (cleared) {
    // Everything here derives from YOUR times, not the (possibly placeholder)
    // target you happened to clear. "Your pace" = median (robust to one slow
    // solve) + a little slack, shown as one number. "Push tighter" is a stretch
    // relative to that pace, not the old target.
    const bestMs = times.length ? Math.min(...times) : 0;
    const med = times.length ? median(times) : targetMs;
    const paceMs = Math.round(med * PERSONAL_MODIFIER);
    const pushMs = Math.round(paceMs * FLU_SPEEDUP);
    const setPace = (ms: number) => {
      savePersonalPace(ex.id, ms, hash);
      setTargetMs(ms);
      setStreak(0);
      setCleared(false);
      void genNext();
    };
    return (
      <div style={styles.panel}>
        <h2 style={{ fontSize: '1.15rem', margin: '0 0 0.4rem', color: theme.good }}>
          Cleared “{ex.concept}” 🎉
        </h2>
        <p style={{ ...styles.tagline, margin: '0 0 0.3rem' }}>
          {FLU_GOAL} in a row · {reps} solved · best {secs(bestMs)}.
        </p>
        <p style={{ ...styles.tagline, margin: '0 0 0.9rem', color: theme.muted, fontSize: '0.85rem' }}>
          Your pace here is about {secs(paceMs)} (your typical solve, {secs(med)}, plus a little slack).
        </p>
        <div style={{ ...styles.row, flexWrap: 'wrap', gap: 8 }}>
          <button style={styles.btn} onClick={() => setPace(paceMs)}>
            Set that as my target ({secs(paceMs)}) →
          </button>
          <button
            style={styles.btnGhost}
            onClick={() => setPace(pushMs)}
            title="A tighter stretch than your pace, to keep getting faster."
          >
            Push tighter ({secs(pushMs)}) →
          </button>
          <button style={styles.btnGhost} onClick={onExit}>
            Pick another pattern
          </button>
        </div>
      </div>
    );
  }

  const header = (
    <div style={{ ...styles.row, justifyContent: 'space-between', marginBottom: '0.5rem' }}>
      <span style={{ ...styles.tagline, margin: 0, fontSize: '0.8rem' }}>
        Fluency · {ex.concept}
        {INTERVIEW_FEATURES && ex.mapsTo && (
          <span style={{ ...styles.pill, marginLeft: 8, color: theme.accent, borderColor: theme.accent }}>
            {ex.mapsTo}
          </span>
        )}
      </span>
      <button style={styles.btnGhost} onClick={onExit}>
        ← Patterns
      </button>
    </div>
  );

  // --- study phase: familiarize with the problem + the reference answer -------
  if (phase === 'study') {
    const studyCode = inst
      ? inst.kind === 'write'
        ? inst.solution ?? ''
        : inst.snippet ?? ''
      : '';
    return (
      <div style={styles.panel}>
        {header}
        <span style={styles.pill}>Study first</span>
        <p style={{ margin: '0.6rem 0 1rem', color: theme.text }}>{ex.prompt}</p>
        {loading || !inst ? (
          <p style={{ ...styles.tagline, margin: 0 }}>Loading an example…</p>
        ) : (
          <>
            {inst.kind === 'predict' && inst.snippet && (
              <>
                <p style={styles.label}>Example</p>
                <pre style={{ ...styles.code, marginBottom: '0.6rem' }}>{inst.snippet}</pre>
                <p style={{ ...styles.tagline, margin: '0 0 0.8rem' }}>
                  Value: <code>{inst.expected}</code>
                </p>
              </>
            )}
            {inst.kind === 'write' && inst.solution && (
              <>
                <p style={styles.label}>Reference solution</p>
                <pre style={{ ...styles.code, marginBottom: '0.6rem' }}>{inst.solution}</pre>
              </>
            )}
            {inst.note && (
              <p style={{ ...styles.tagline, margin: '0 0 0.8rem', color: theme.muted }}>{inst.note}</p>
            )}
            <div style={{ ...styles.row, flexWrap: 'wrap', gap: 8 }}>
              <button
                style={styles.btn}
                onClick={() => {
                  setPhase('drill');
                  void genNext();
                }}
              >
                Start drilling (target {secs(targetMs)}) →
              </button>
              {TRAINER_MODE && (
                <button
                  style={styles.btnGhost}
                  onClick={() => {
                    setRuns([]);
                    setPhase('setpace');
                    void genNext();
                  }}
                  title="Do a few timed runs and pick the one to lock in as the target. Exportable as the default for everyone."
                >
                  Set the pace yourself →
                </button>
              )}
              <button style={styles.btnGhost} onClick={() => setShowViz((v) => !v)}>
                {showViz ? 'Hide run' : 'See it run'}
              </button>
              <button style={styles.btnGhost} onClick={onGotThis} title="Skip this pattern; we record that you rated it mastered.">
                I've got this →
              </button>
            </div>
            {showViz && (
              <div style={{ marginTop: '0.6rem' }}>
                <Visualizer track={track} code={vizCode(inst, studyCode, undefined)} title={inst.concept} />
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  const graded = result !== null;
  const dots = '●'.repeat(streak) + '○'.repeat(Math.max(0, FLU_GOAL - streak));

  return (
    <div style={styles.panel}>
      {header}

      {/* HUD: pace target, streak, live/last time */}
      <div style={{ ...styles.row, flexWrap: 'wrap', gap: 8, marginBottom: '0.75rem' }}>
        {phase === 'setpace' ? (
          <span style={styles.pill}>Set the pace — do timed runs, lock one in</span>
        ) : (
          <>
            <span style={styles.pill}>Target ≤ {secs(targetMs)}</span>
            <span
              style={{ ...styles.pill, color: theme.accent, borderColor: theme.accent }}
              title={`${streak} of ${FLU_GOAL} correct-and-fast in a row`}
            >
              {dots} {streak}/{FLU_GOAL}
            </span>
          </>
        )}
        <span style={styles.pill}>
          ⏱ {graded && lastMs != null ? secs(lastMs) : secs(elapsed)}
        </span>
        {best != null && <span style={styles.pill}>best {secs(best)}</span>}
        {phase === 'drill' && TRAINER_MODE && (
          <button
            style={{ ...styles.btnGhost, padding: '2px 8px', fontSize: '0.75rem' }}
            title="Re-set your pace: do timed runs and lock one in again"
            onClick={() => {
              setStreak(0);
              setTimes([]);
              setRuns([]);
              setResult(null);
              setPhase('setpace');
              void genNext();
            }}
          >
            Re-pace
          </button>
        )}
      </div>

      <p style={{ margin: '0 0 1rem', color: theme.text }}>{ex.prompt}</p>

      {loading ? (
        <p style={{ ...styles.tagline, margin: 0 }}>Generating a fresh one…</p>
      ) : genError ? (
        <pre style={{ ...styles.code, borderColor: theme.bad }}>{genError}</pre>
      ) : inst ? (
        <>
          {inst.kind === 'predict' && inst.snippet && (
            <>
              <pre style={{ ...styles.code, marginBottom: '1rem' }}>{inst.snippet}</pre>
              <input
                style={{ ...styles.editor, fontFamily: theme.mono }}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="value it evaluates to"
                spellCheck={false}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  if (graded) void genNext();
                  else void submit();
                }}
              />
            </>
          )}
          {inst.kind === 'write' && (
            <CodeEditor
              language={track}
              value={input}
              onChange={setInput}
              onSubmit={!graded ? () => void submit() : undefined}
              autoFocus
            />
          )}

          <div style={{ ...styles.row, marginTop: '1rem', flexWrap: 'wrap', gap: 8 }}>
            {!graded && (
              <button style={styles.btn} onClick={() => void submit()} disabled={running}>
                {running ? 'Checking…' : 'Check'}
              </button>
            )}
            {graded && (
              <button style={styles.btn} onClick={() => void genNext()} autoFocus>
                {phase === 'setpace' ? 'Another run →' : 'Next →'}
              </button>
            )}
            <button
              style={styles.btnGhost}
              onClick={() => setShowViz((v) => !v)}
              title="Trace it in codeviz. The clock keeps running, so it costs you time."
            >
              {showViz ? 'Hide run' : 'See it run'}
            </button>
            {!graded && onGotThis && (
              <button
                style={styles.btnGhost}
                onClick={onGotThis}
                title="Already automatic for you. We record that so we can tune your drills."
              >
                I've got this →
              </button>
            )}
          </div>

          {showViz && (
            <div style={{ marginTop: '0.6rem' }}>
              <Visualizer
                track={track}
                code={vizCode(inst, input, result?.failingCase)}
                title={inst.concept}
              />
            </div>
          )}

          {graded && result && (
            <div style={{ marginTop: '0.9rem' }}>
              {result.passed ? (
                <p
                  style={{
                    ...styles.label,
                    margin: 0,
                    color: phase === 'setpace' || lastFast ? theme.good : theme.accent,
                  }}
                >
                  {phase === 'setpace'
                    ? `✓ Run recorded: ${lastMs != null ? secs(lastMs) : ''}. Lock one in below, or do another.`
                    : lastFast
                      ? `✓ Fast! ${lastMs != null ? secs(lastMs) : ''} · streak ${streak}/${FLU_GOAL}`
                      : `✓ Correct, just over ${secs(targetMs)} — streak holds at ${streak}/${FLU_GOAL}, speed up to advance`}
                </p>
              ) : (
                <>
                  <p style={{ ...styles.label, margin: '0 0 0.4rem', color: theme.bad }}>
                    ✗ Not quite
                  </p>
                  {result.error && (
                    <pre style={{ ...styles.code, borderColor: theme.bad }}>{result.error}</pre>
                  )}
                  {inst.kind === 'predict' && inst.expected && (
                    <p style={{ ...styles.tagline, margin: '0.3rem 0 0' }}>
                      Answer: <code>{inst.expected}</code>
                    </p>
                  )}
                  {inst.kind === 'write' && inst.solution && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <button style={styles.btnGhost} onClick={() => setShowSol((s) => !s)}>
                        {showSol ? 'Hide solution' : 'Show solution'}
                      </button>
                      {showSol && (
                        <pre style={{ ...styles.code, marginTop: '0.6rem' }}>{inst.solution}</pre>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {phase === 'setpace' && runs.length > 0 && (
            <div style={{ marginTop: '0.9rem', borderTop: `1px solid ${theme.border}`, paddingTop: '0.75rem' }}>
              <p style={{ ...styles.label, margin: '0 0 0.4rem' }}>Your runs — pick one to lock in</p>
              {runs.map((r, i) => (
                <div
                  key={i}
                  style={{ ...styles.row, justifyContent: 'space-between', padding: '4px 0', gap: 8 }}
                >
                  <span>
                    Run {i + 1}: <code>{secs(r)}</code>
                  </span>
                  <button style={styles.btnGhost} onClick={() => lockPace(r)}>
                    Lock this in →
                  </button>
                </div>
              ))}
              <div style={{ ...styles.row, gap: 8, marginTop: '0.5rem', flexWrap: 'wrap' }}>
                {runs.length > 1 && (
                  <button style={styles.btn} onClick={() => lockPace(Math.round(median(runs)))}>
                    Lock median ({secs(Math.round(median(runs)))}) →
                  </button>
                )}
                <button
                  style={styles.btnGhost}
                  onClick={saveConfig}
                  title="Write the pace config straight to src/data/pace-targets.json via the local data server"
                >
                  Save pace config
                </button>
                {paceSaveMsg && (
                  <span style={{ ...styles.tagline, margin: 0, fontSize: '0.8rem', color: theme.muted }}>
                    {paceSaveMsg}
                  </span>
                )}
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

type Filter = 'all' | 'failed' | 'hinted' | 'clean';

function filterLabel(f: Filter): string {
  return f === 'all'
    ? 'All'
    : f === 'failed'
      ? 'Failed'
      : f === 'hinted'
        ? 'Used a hint'
        : 'Clean pass';
}

function rungLabel(rung: number): string {
  return rung >= 5
    ? 'revealed'
    : rung >= 4
      ? 'walkthrough'
      : rung >= 3
        ? 'visualized'
        : rung >= 2
          ? 'syntax'
          : 'cue';
}

function HistoryView({
  exercises,
  state,
  onPractice,
  onReset,
}: {
  exercises: Exercise[];
  state: ProgressState;
  onPractice: (exs: Exercise[], label: string) => void;
  onReset: () => void;
}) {
  const [filter, setFilter] = useState<Filter>('all');

  const rows = useMemo(() => {
    const out: { ex: Exercise; passed: boolean; rung: number; at: number; skipped: boolean }[] = [];
    for (const ex of exercises) {
      const la = lastAttempt(state, ex.id);
      if (!la) continue;
      out.push({ ex, passed: la.passed, rung: la.rung, at: la.at, skipped: !!la.skipped });
    }
    out.sort((a, b) => b.at - a.at);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercises, state]);

  const match = (r: { passed: boolean; rung: number; skipped: boolean }) =>
    filter === 'all'
      ? true
      : filter === 'failed'
        ? !r.passed && !r.skipped
        : filter === 'hinted'
          ? r.rung >= 1
          : r.passed && r.rung === 0;

  const shown = rows.filter(match);
  const filteredExercises = shown.map((r) => r.ex);

  return (
    <div style={styles.panel}>
      <div style={{ ...styles.row, justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <p style={{ ...styles.label, margin: 0 }}>
          History — {rows.length} attempted
        </p>
        <div style={{ ...styles.row, gap: 8 }}>
          <button
            style={styles.btn}
            disabled={filteredExercises.length === 0}
            onClick={() => onPractice(filteredExercises, `${filterLabel(filter)} (${filteredExercises.length})`)}
          >
            Practice these ({filteredExercises.length})
          </button>
          <button
            style={{ ...styles.btnGhost, color: theme.bad, borderColor: theme.bad }}
            disabled={rows.length === 0}
            onClick={() => {
              if (
                window.confirm(
                  'Reset all history? This clears every recorded attempt and cannot be undone.',
                )
              )
                onReset();
            }}
          >
            Reset history
          </button>
        </div>
      </div>

      <div style={{ ...styles.row, marginTop: '0.6rem', flexWrap: 'wrap', gap: 8 }}>
        {(['all', 'failed', 'hinted', 'clean'] as Filter[]).map((f) => (
          <button
            key={f}
            style={{
              ...styles.btnGhost,
              ...(filter === f ? { borderColor: theme.accent, color: theme.accent } : {}),
            }}
            onClick={() => setFilter(f)}
          >
            {filterLabel(f)}
          </button>
        ))}
      </div>

      <div style={{ marginTop: '0.8rem' }}>
        {shown.length === 0 ? (
          <p style={{ ...styles.tagline, margin: 0 }}>
            {rows.length === 0
              ? 'Nothing here yet — attempts show up as you do exercises.'
              : 'No exercises match this filter.'}
          </p>
        ) : (
          shown.map(({ ex, passed, rung, skipped }) => (
            <div
              key={ex.id}
              style={{
                ...styles.row,
                justifyContent: 'space-between',
                padding: '6px 0',
                borderBottom: `1px solid ${theme.border}`,
                gap: 8,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <span
                  style={{
                    color: skipped ? theme.muted : passed ? theme.good : theme.bad,
                    marginRight: 8,
                  }}
                  title={skipped ? 'skipped' : passed ? 'passed' : 'failed'}
                >
                  {skipped ? '⤼' : passed ? '✓' : '✗'}
                </span>
                <span>{ex.concept}</span>
                <span style={{ ...styles.pill, marginLeft: 8 }}>{ex.group}</span>
              </div>
              <div style={styles.row}>
                {rung >= 1 && (
                  <span style={{ ...styles.pill, color: theme.accent, borderColor: theme.accent }}>
                    {rungLabel(rung)}
                  </span>
                )}
                <button style={styles.btnGhost} onClick={() => onPractice([ex], ex.concept)}>
                  Redo
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ExerciseView({
  pick,
  input,
  onInput,
  running,
  result,
  maxRung,
  onUseHint,
  onSubmit,
  onNext,
  onRetry,
  timing,
  firstScreen,
  experienced,
  onToggleExperienced,
  onSkip,
  onSkipToFirstWrite,
  onSkipToProblems,
  onSkipUnit,
  subtitle,
  onExit,
}: {
  pick: NextPick;
  input: string;
  onInput: (s: string) => void;
  running: boolean;
  result: RunResult | null;
  maxRung: number;
  onUseHint: (rung: number) => void;
  onSubmit: () => void;
  onNext: () => void;
  onRetry?: () => void;
  timing?: { ms: number; bestMs: number | null };
  firstScreen?: boolean;
  experienced?: boolean;
  onToggleExperienced?: () => void;
  onSkip?: () => void;
  onSkipToFirstWrite?: () => void;
  onSkipToProblems?: () => void;
  onSkipUnit?: () => void;
  subtitle?: string;
  onExit?: () => void;
}) {
  const ex = pick.exercise;
  const graded = result !== null;
  return (
    <div style={styles.panel}>
      {firstScreen && !graded && (onSkipToFirstWrite || onSkipToProblems) && (
        <div
          style={{
            border: `1px solid ${theme.accent}`,
            borderRadius: 8,
            padding: '0.7rem 0.85rem',
            marginBottom: '1rem',
            background: 'rgba(120,170,255,0.06)',
          }}
        >
          <p style={{ ...styles.label, margin: '0 0 0.15rem', color: theme.accent }}>
            Already comfortable with the basics?
          </p>
          <p style={{ ...styles.tagline, margin: '0 0 0.55rem', fontSize: '0.82rem' }}>
            These open on warm-up atoms. Jump straight ahead any time — skipped
            items stay redoable from History.
          </p>
          <div style={{ ...styles.row, flexWrap: 'wrap', gap: 8 }}>
            {onSkipToFirstWrite && (
              <button style={styles.btn} onClick={onSkipToFirstWrite}>
                Skip to first write →
              </button>
            )}
            {onSkipToProblems && (
              <button style={styles.btn} onClick={onSkipToProblems}>
                Skip ahead to the problems →
              </button>
            )}
          </div>
          {onToggleExperienced && (
            <label
              style={{ ...styles.tagline, display: 'flex', alignItems: 'center', gap: 6, margin: '0.6rem 0 0', fontSize: '0.78rem', cursor: 'pointer' }}
            >
              <input type="checkbox" checked={!!experienced} onChange={onToggleExperienced} />
              I'm experienced — keep offering this at the start of each unit
            </label>
          )}
        </div>
      )}
      {(subtitle || onExit) && (
        <div style={{ ...styles.row, justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <span style={{ ...styles.tagline, margin: 0, fontSize: '0.8rem' }}>{subtitle}</span>
          {onExit && (
            <button style={styles.btnGhost} onClick={onExit}>
              ← Sets
            </button>
          )}
        </div>
      )}
      <div style={{ ...styles.row, marginBottom: '0.5rem' }}>
        <span style={styles.pill}>{ex.group}</span>
        <span style={styles.pill}>{ex.kind}</span>
        {pick.isNew && (
          <span style={{ ...styles.pill, color: theme.accent, borderColor: theme.accent }}>
            new
          </span>
        )}
      </div>
      <h2 style={{ fontSize: '1.1rem', margin: '0 0 0.5rem' }}>{ex.concept}</h2>
      <p style={{ margin: '0 0 1rem', color: theme.text }}>{ex.prompt}</p>

      {ex.kind === 'predict' && ex.snippet && (
        <>
          <p style={styles.label}>Snippet</p>
          <pre style={{ ...styles.code, marginBottom: '1rem' }}>{ex.snippet}</pre>
          <p style={styles.label}>Predict the value</p>
          <input
            style={{ ...styles.editor, fontFamily: theme.mono }}
            value={input}
            onChange={(e) => onInput(e.target.value)}
            placeholder="type the value it evaluates to"
            spellCheck={false}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !graded) onSubmit();
            }}
          />
          <p style={{ ...styles.tagline, margin: '0.35rem 0 0', fontSize: '0.78rem', color: theme.muted }}>
            {ex.track === 'python'
              ? "Type a Python expression for the value (strings in quotes, e.g. 'abc'). Spacing and dict/set order don't matter."
              : "Type a JS expression for the value (strings in quotes, e.g. 'abc'; objects like {a: 1}; Maps/Sets like new Map([['a', 1]])). Spacing and Map/Set order don't matter."}
          </p>
        </>
      )}

      {ex.kind === 'write' && (
        <>
          <p style={styles.label}>Your code</p>
          <CodeEditor
            language={ex.track}
            value={input}
            onChange={onInput}
            onSubmit={!graded ? onSubmit : undefined}
            autoFocus
          />
        </>
      )}

      <div style={{ ...styles.row, marginTop: '1rem' }}>
        {!graded && (
          <button style={styles.btn} onClick={onSubmit} disabled={running}>
            {running ? 'Running…' : 'Submit'}
          </button>
        )}
        {!graded && onSkip && (
          <button style={styles.btnGhost} onClick={onSkip} title="I know this — skip it">
            Skip
          </button>
        )}
        {!graded && !firstScreen && onSkipToFirstWrite && (
          <button
            style={styles.btnGhost}
            onClick={onSkipToFirstWrite}
            title="Skip the opening predicts and go straight to the next hands-on write"
          >
            Skip to first write →
          </button>
        )}
        {!graded && !firstScreen && onSkipToProblems && (
          <button
            style={styles.btnGhost}
            onClick={onSkipToProblems}
            title="Fast-forward past the trivia to the next interview-tagged problem"
          >
            Skip to problems →
          </button>
        )}
        {!graded && !firstScreen && onSkipUnit && (
          <button style={styles.btnGhost} onClick={onSkipUnit} title="Skip the rest of this group">
            Skip “{ex.group}”
          </button>
        )}
        {graded && result && !result.passed && onRetry && (
          <button style={styles.btn} onClick={onRetry} autoFocus>
            Try again
          </button>
        )}
        {graded && (
          <button
            style={result && !result.passed && onRetry ? styles.btnGhost : styles.btn}
            onClick={onNext}
            autoFocus={!(result && !result.passed && onRetry)}
          >
            Next →
          </button>
        )}
      </div>

      {result && <ResultView result={result} maxRung={maxRung} timing={timing} />}

      {graded && (ex.note || (INTERVIEW_FEATURES && ex.mapsTo)) && (
        <div style={{ marginTop: '0.85rem' }}>
          {INTERVIEW_FEATURES && ex.mapsTo && (
            <span style={{ ...styles.pill, color: theme.accent, borderColor: theme.accent }}>
              {ex.mapsTo}
            </span>
          )}
          {ex.note && (
            <p style={{ ...styles.tagline, margin: '0.5rem 0 0', color: theme.muted }}>
              {ex.note}
            </p>
          )}
        </div>
      )}

      <HintLadder
        ex={ex}
        input={input}
        graded={graded}
        failingCase={result?.failingCase}
        onUse={onUseHint}
      />
    </div>
  );
}

// Hint-ladder rung levels, ascending in help. Cue/syntax (1-2) are light nudges;
// visualize/walkthrough/reveal (3-5) are heavier. The rung reached is recorded
// on the attempt (see docs/scaffolding.md).
const RUNG = { cue: 1, syntax: 2, visualize: 3, walkthrough: 4, reveal: 5 } as const;

// Build the code to hand to the visualizer. For a `predict`, that's the snippet.
// For a `write`, the learner's code is just a function DEFINITION — tracing it
// alone shows nothing execute (no call, no frames, no objects). Drive it with
// the exercise's own tests, which call the function with real inputs (including
// the failing case), so codeviz steps through an actual run and the bug is
// visible where it happens.
// A predict snippet's value is its trailing EXPRESSION, which codeviz evaluates
// and discards — so a bare snippet like `-7 % 3` traces to nothing (no vars, no
// output). Wrap that trailing expression in print()/console.log() so codeviz
// actually SHOWS the value the learner is predicting. Multi-statement snippets
// still show their variables AND now print the final answer.
function vizPredictCode(snippet: string, track: Track): string {
  const lines = snippet.split('\n');
  let i = lines.length - 1;
  while (i >= 0 && lines[i].trim() === '') i--;
  if (i < 0) return snippet;
  const last = lines[i];
  const t = last.trim();
  const looksLikeStatement =
    /^\s/.test(last) || // indented (inside a block)
    t.endsWith(':') ||
    t.endsWith(',') ||
    /^(for|if|elif|else|while|def|class|return|import|from|with|try|except|finally|raise|assert|print|console\.|const |let |var |del |global |nonlocal |pass|break|continue)\b/.test(t) ||
    /^[A-Za-z_$][\w$.[\]'" ]*\s(?:=|\+=|-=|\*=|\/=|%=|\|\|=|\?\?=)\s/.test(t); // assignment
  if (looksLikeStatement) return snippet;
  lines[i] = track === 'python' ? `print(${t})` : `console.log(${t})`;
  return lines.join('\n');
}

function vizCode(
  ex: Exercise,
  input: string,
  failingCase?: RunResult['failingCase'],
): string {
  if (ex.kind !== 'write') {
    const snip = ex.snippet ?? input;
    return ex.kind === 'predict' ? vizPredictCode(snip, ex.track) : snip;
  }
  const sep =
    ex.track === 'python'
      ? '\n\n# --- driving your code with a test case ---\n'
      : '\n\n// --- driving your code with a test case ---\n';
  // Prefer the specific case that just failed, so the trace lands exactly on the
  // run that broke. Else drive with the first structured case. Else fall back to
  // the legacy tests block.
  const driveCase = failingCase ?? ex.cases?.[0];
  if (driveCase) {
    const setup = driveCase.setup ? `${driveCase.setup}\n` : '';
    return `${input}${sep}${setup}${driveCase.call}`;
  }
  const driver = ex.tests?.trim();
  return driver ? `${input}${sep}${driver}` : input;
}

function HintLadder({
  ex,
  input,
  graded,
  failingCase,
  onUse,
}: {
  ex: Exercise;
  input: string;
  graded: boolean;
  failingCase?: RunResult['failingCase'];
  onUse: (rung: number) => void;
}) {
  const answer = ex.kind === 'predict' ? ex.expected : ex.solution;

  // A single progressive reveal (NeetCode-style: Hint 1, Hint 2, …, then the
  // heavier aids, then the answer) instead of a row of parallel buttons. The
  // light cue/syntax rungs are available BEFORE submitting (so an anxious
  // learner can peek a nudge without having to guess-fail first); the heavier
  // visualize/walkthrough/reveal rungs unlock only after a submit. Each reveal
  // escalates the recorded rung.
  const steps = useMemo(() => {
    let n = 0;
    const s: {
      key: 'cue' | 'syntax' | 'visualize' | 'walkthrough' | 'reveal';
      rung: number;
      title: string;
      action: string;
    }[] = [];
    if (ex.cue) {
      n += 1;
      s.push({ key: 'cue', rung: RUNG.cue, title: `Hint ${n}`, action: `Show hint ${n}` });
    }
    if (ex.syntax) {
      n += 1;
      s.push({ key: 'syntax', rung: RUNG.syntax, title: `Hint ${n}`, action: `Show hint ${n}` });
    }
    // "See it run" is available BEFORE submitting on a WRITE exercise (it traces
    // your own in-progress code and spoils nothing). On a PREDICT it waits until
    // graded, since running the snippet would reveal the value you're predicting.
    if (graded || ex.kind === 'write') {
      s.push({ key: 'visualize', rung: RUNG.visualize, title: 'See it run', action: 'Visualize your run' });
    }
    if (graded) {
      s.push({ key: 'walkthrough', rung: RUNG.walkthrough, title: 'Talk it through', action: 'Get a walkthrough' });
      if (answer && answer.length > 0) {
        s.push({
          key: 'reveal',
          rung: RUNG.reveal,
          title: ex.kind === 'predict' ? 'Expected value' : 'Reference solution',
          action: 'Show the answer',
        });
      }
    }
    return s;
  }, [ex, answer, graded]);

  const [revealed, setRevealed] = useState(0);
  const next = steps[revealed];

  // Nothing to offer yet (no cue/syntax and not graded) — render nothing.
  if (steps.length === 0) return null;

  const revealNext = () => {
    if (!next) return;
    onUse(next.rung);
    setRevealed((r) => r + 1);
  };

  return (
    <div style={{ marginTop: '1.25rem', borderTop: `1px solid ${theme.border}`, paddingTop: '1rem' }}>
      <p style={{ ...styles.label, margin: 0 }}>
        {graded ? 'Stuck? Reveal help one step at a time.' : 'Want a nudge before you answer?'}
      </p>

      {steps.slice(0, revealed).map((step) => (
        <div key={step.key} style={{ marginTop: '0.85rem' }}>
          <p style={{ ...styles.label, marginBottom: 4 }}>{step.title}</p>
          {step.key === 'cue' && (
            <p style={{ ...styles.tagline, margin: 0, color: theme.text }}>{ex.cue}</p>
          )}
          {step.key === 'syntax' && <pre style={styles.code}>{ex.syntax}</pre>}
          {step.key === 'visualize' && (
            <Visualizer
              track={ex.track}
              code={vizCode(ex, input, failingCase)}
              title={ex.concept}
            />
          )}
          {step.key === 'walkthrough' && (
            <WalkthroughBox prompt={buildWalkthroughPrompt(ex, input)} />
          )}
          {step.key === 'reveal' && <pre style={styles.code}>{answer}</pre>}
        </div>
      ))}

      {next && (
        <button style={{ ...styles.btnGhost, marginTop: '0.85rem' }} onClick={revealNext}>
          {revealed === 0 ? next.action : `Still stuck? ${next.action}`}
        </button>
      )}
    </div>
  );
}

function WalkthroughBox({ prompt }: { prompt: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };
  return (
    <>
      <div style={{ ...styles.row, justifyContent: 'space-between', marginBottom: '0.4rem' }}>
        <p style={{ ...styles.label, margin: 0 }}>Paste into your AI coding agent</p>
        <button style={styles.btnGhost} onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <textarea
        readOnly
        value={prompt}
        spellCheck={false}
        style={{ ...styles.editor, fontFamily: theme.mono, minHeight: 220 }}
      />
    </>
  );
}

function ResultView({
  result,
  maxRung,
  timing,
}: {
  result: RunResult;
  maxRung: number;
  timing?: { ms: number; bestMs: number | null };
}) {
  let color: string;
  let label: string;
  if (!result.passed) {
    color = theme.bad;
    label = '✗ Not quite';
  } else if (maxRung >= 3) {
    color = theme.bad;
    label = '✓ Pass (with help)';
  } else if (maxRung >= 1) {
    color = theme.accent;
    label = '✓ Pass (with a hint)';
  } else {
    color = theme.good;
    label = '✓ Pass';
  }
  return (
    <div style={{ marginTop: '1rem' }}>
      <p style={{ ...styles.label, color, margin: '0 0 0.4rem' }}>{label}</p>
      {timing && result.passed && (
        <p style={{ ...styles.tagline, margin: '0 0 0.4rem', fontSize: '0.8rem', color: theme.muted }}>
          ⏱ solved in {(timing.ms / 1000).toFixed(1)}s
          {timing.bestMs != null && timing.bestMs < timing.ms
            ? ` · best ${(timing.bestMs / 1000).toFixed(1)}s`
            : ''}
        </p>
      )}
      {result.error && (
        <pre style={{ ...styles.code, borderColor: theme.bad }}>{result.error}</pre>
      )}
      {result.actual !== undefined && result.actual !== '' && (
        <>
          <p style={styles.label}>Output</p>
          <pre style={styles.code}>{result.actual}</pre>
        </>
      )}
    </div>
  );
}

function AllPassed() {
  return (
    <div style={styles.panel}>
      <h2 style={{ fontSize: '1.1rem', margin: '0 0 0.5rem' }}>
        You've been through everything here 🎉
      </h2>
      <p style={{ ...styles.tagline, margin: 0 }}>
        Switch to <strong>Practice</strong> to keep drilling any set, or{' '}
        <strong>History</strong> to redo the ones you failed or needed a hint on.
      </p>
    </div>
  );
}
