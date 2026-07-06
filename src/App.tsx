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
  hasAttempted,
  resetProgress,
  type ProgressState,
} from './core/storage';
import { exercisesForTrack } from './ui/content';
import { pickNextLearn, learnCounts, RUNNERS, type NextPick } from './ui/session';
import { styles, theme } from './ui/styles';
import { CodeEditor } from './ui/Editor';
import { Visualizer } from './ui/Visualizer';
import { buildWalkthroughPrompt } from './ui/walkthroughPrompt';

const TRACK_LABELS: Record<Track, string> = {
  python: 'Python',
  javascript: 'JavaScript',
};

type View = 'learn' | 'practice' | 'history';

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
  const [pick, setPick] = useState<NextPick | null>(null);
  const [input, setInput] = useState('');
  const [result, setResult] = useState<RunResult | null>(null);
  const [running, setRunning] = useState(false);
  // Deepest hint-ladder rung reached for the current exercise (0 = unaided,
  // 1 cue, 2 syntax, 3 visualize, 4 walkthrough, 5 reveal). Recorded per attempt.
  const [maxRung, setMaxRung] = useState(0);

  // Practice queue: an explicit set the learner chose to drill (from a group or
  // a history filter). Null = no active practice set (show the picker).
  const [queue, setQueue] = useState<Exercise[] | null>(null);
  const [qIndex, setQIndex] = useState(0);
  const [queueLabel, setQueueLabel] = useState('');

  const exercises = useMemo(
    () => (track ? exercisesForTrack(track) : []),
    [track],
  );

  const startExercise = useCallback((ex: Exercise, isNew: boolean) => {
    setResult(null);
    setRunning(false);
    setMaxRung(0);
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
    const next = pickNextLearn(exercisesForTrack(t), progress.current);
    if (next) startExercise(next.exercise, next.isNew);
    else setPick(null);
  };

  const switchView = (v: View) => {
    setView(v);
    if (v === 'learn') advanceLearn();
    else {
      // practice shows its picker until a set is chosen; history is a list.
      setQueue(null);
      setPick(null);
      setResult(null);
    }
  };

  // Record one graded attempt to the append-only log (no SRS scheduling).
  const grade = useCallback(
    (exId: string, passed: boolean, rung: number) => {
      recordAttempt(progress.current, {
        id: exId,
        at: Date.now(),
        passed,
        rung,
      });
      persist();
      bump();
    },
    [persist, bump],
  );

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
    grade(ex.id, res.passed, maxRung);
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
        <h1 style={styles.h1}>warmups</h1>
        <p style={styles.tagline}>
          Local-first coding drills for language fluency and problem-solving
          primitives — you choose what to practice.
        </p>

        {!track && <TrackPicker onPick={chooseTrack} />}

        {track && counts && (
          <>
            <Nav
              track={track}
              view={view}
              counts={counts}
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
                  onSkip={() => skip([pick.exercise.id])}
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
              (queue == null ? (
                <PracticePicker exercises={exercises} onStart={startPractice} />
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
  onView,
  onChangeTrack,
}: {
  track: Track;
  view: View;
  counts: { done: number; total: number };
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
}: {
  exercises: Exercise[];
  onStart: (exs: Exercise[], label: string) => void;
}) {
  const groups = useMemo(() => {
    const m = new Map<string, number>();
    for (const ex of exercises) m.set(ex.group, (m.get(ex.group) ?? 0) + 1);
    return [...m.entries()];
  }, [exercises]);
  return (
    <div style={styles.panel}>
      <p style={styles.label}>Practice — pick a set and just drill (no scheduling)</p>
      <div style={{ ...styles.row, flexWrap: 'wrap', gap: 8, marginBottom: '0.6rem' }}>
        <button style={styles.btn} onClick={() => onStart(exercises, 'Everything')}>
          Everything ({exercises.length})
        </button>
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
  onSkip,
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
  onSkip?: () => void;
  onSkipUnit?: () => void;
  subtitle?: string;
  onExit?: () => void;
}) {
  const ex = pick.exercise;
  const graded = result !== null;
  return (
    <div style={styles.panel}>
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
              ? "Match how Python prints it (strings in quotes, e.g. 'abc'). Spacing and dict/set order are ignored."
              : 'Match how JS prints it (a top-level string can be bare; objects like {a: 1}, Maps like Map(2) {"a" => 1}). Spacing is ignored.'}
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
        {!graded && onSkipUnit && (
          <button style={styles.btnGhost} onClick={onSkipUnit} title="Skip the rest of this group">
            Skip “{ex.group}”
          </button>
        )}
        {graded && (
          <button style={styles.btn} onClick={onNext} autoFocus>
            Next →
          </button>
        )}
      </div>

      {result && <ResultView result={result} maxRung={maxRung} />}

      {graded && (ex.note || ex.mapsTo) && (
        <div style={{ marginTop: '0.85rem' }}>
          {ex.mapsTo && (
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

      {graded && <HintLadder ex={ex} input={input} onUse={onUseHint} />}
    </div>
  );
}

// Hint-ladder rung levels, ascending in help. Cue/syntax (1-2) are light nudges;
// visualize/walkthrough/reveal (3-5) are heavier. The rung reached is recorded
// on the attempt (see docs/scaffolding.md).
const RUNG = { cue: 1, syntax: 2, visualize: 3, walkthrough: 4, reveal: 5 } as const;

function HintLadder({
  ex,
  input,
  onUse,
}: {
  ex: Exercise;
  input: string;
  onUse: (rung: number) => void;
}) {
  const answer = ex.kind === 'predict' ? ex.expected : ex.solution;

  // A single progressive reveal (NeetCode-style: Hint 1, Hint 2, …, then the
  // heavier aids, then the answer) instead of a row of parallel buttons. Only
  // steps that apply to this exercise are included; each reveal escalates the
  // recorded rung.
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
    s.push({ key: 'visualize', rung: RUNG.visualize, title: 'See it run', action: 'Visualize your run' });
    s.push({ key: 'walkthrough', rung: RUNG.walkthrough, title: 'Talk it through', action: 'Get a walkthrough' });
    if (answer && answer.length > 0) {
      s.push({
        key: 'reveal',
        rung: RUNG.reveal,
        title: ex.kind === 'predict' ? 'Expected value' : 'Reference solution',
        action: 'Show the answer',
      });
    }
    return s;
  }, [ex, answer]);

  const [revealed, setRevealed] = useState(0);
  const next = steps[revealed];

  const revealNext = () => {
    if (!next) return;
    onUse(next.rung);
    setRevealed((r) => r + 1);
  };

  return (
    <div style={{ marginTop: '1.25rem', borderTop: `1px solid ${theme.border}`, paddingTop: '1rem' }}>
      <p style={{ ...styles.label, margin: 0 }}>Stuck? Reveal help one step at a time.</p>

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
              code={ex.kind === 'write' ? input : ex.snippet ?? input}
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

function ResultView({ result, maxRung }: { result: RunResult; maxRung: number }) {
  let color: string;
  let label: string;
  if (!result.passed) {
    color = theme.bad;
    label = '✗ Fail';
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
