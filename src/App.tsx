import { useCallback, useMemo, useRef, useState } from 'react';
import type { Exercise, RunResult, Track } from './core/types';
import { newCard, review } from './core/srs';
import {
  load,
  save,
  getCard,
  putCard,
  markIntroduced,
  type ProgressState,
} from './core/storage';
import { exercisesForTrack } from './ui/content';
import { pickNext, computeCounts, RUNNERS, type NextPick } from './ui/session';
import { styles, theme } from './ui/styles';
import { CodeEditor } from './ui/Editor';

const TRACK_LABELS: Record<Track, string> = {
  python: 'Python',
  javascript: 'JavaScript / TypeScript',
};

export default function App() {
  // Progress lives in a ref (Maps/Sets mutate in place); `tick` forces renders
  // after we persist a change.
  const progress = useRef<ProgressState>(load());
  const [, setTick] = useState(0);
  const bump = useCallback(() => setTick((n) => n + 1), []);

  const [track, setTrack] = useState<Track | null>(null);
  const [pick, setPick] = useState<NextPick | null>(null);
  const [input, setInput] = useState('');
  const [result, setResult] = useState<RunResult | null>(null);
  const [running, setRunning] = useState(false);

  const exercises = useMemo(
    () => (track ? exercisesForTrack(track) : []),
    [track],
  );

  const persist = useCallback(() => {
    save(progress.current);
    bump();
  }, [bump]);

  const seedInput = (ex: Exercise) =>
    setInput(ex.kind === 'write' ? ex.starter ?? '' : '');

  // Advance to the next exercise, introducing (and creating a card for) a new
  // one when needed.
  const advance = useCallback(
    (exs: Exercise[]) => {
      const now = new Date();
      const next = pickNext(exs, progress.current, now);
      setResult(null);
      setRunning(false);
      if (next) {
        if (next.isNew) {
          markIntroduced(progress.current, next.exercise.id);
          putCard(progress.current, next.exercise.id, newCard(now));
          save(progress.current);
        }
        seedInput(next.exercise);
      }
      setPick(next);
      bump();
    },
    [bump],
  );

  const chooseTrack = (t: Track) => {
    setTrack(t);
    advance(exercisesForTrack(t));
  };

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
    // Grade + reschedule.
    const now = new Date();
    const card = getCard(progress.current, ex.id) ?? newCard(now);
    putCard(
      progress.current,
      ex.id,
      review(card, res.passed ? 'good' : 'again', now),
    );
    persist();
    setResult(res);
    setRunning(false);
  }, [track, pick, input, persist]);

  const counts = useMemo(
    () => (track ? computeCounts(exercises, progress.current, new Date()) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [track, exercises, result, pick],
  );

  return (
    <div style={styles.page}>
      <div style={styles.shell}>
        <h1 style={styles.h1}>warmups</h1>
        <p style={styles.tagline}>
          Local-first spaced-repetition drills for language fluency and
          problem-solving primitives.
        </p>

        {!track && <TrackPicker onPick={chooseTrack} />}

        {track && (
          <>
            <div style={{ ...styles.row, justifyContent: 'space-between', marginBottom: '1rem' }}>
              {counts && <ProgressBar label={TRACK_LABELS[track]} counts={counts} />}
              <button
                style={styles.btnGhost}
                onClick={() => {
                  setTrack(null);
                  setPick(null);
                  setResult(null);
                }}
              >
                Change track
              </button>
            </div>

            {pick ? (
              <ExerciseView
                key={pick.exercise.id}
                pick={pick}
                input={input}
                onInput={setInput}
                running={running}
                result={result}
                onSubmit={submit}
                onNext={() => advance(exercises)}
              />
            ) : (
              <CaughtUp />
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
        JavaScript/TypeScript runs in a Web Worker.
      </p>
    </div>
  );
}

function ProgressBar({
  label,
  counts,
}: {
  label: string;
  counts: { due: number; new: number; learned: number; total: number };
}) {
  return (
    <div style={styles.row}>
      <strong style={{ fontSize: '0.95rem' }}>{label}</strong>
      <span style={styles.pill}>{counts.due} due</span>
      <span style={styles.pill}>{counts.new} new</span>
      <span style={styles.pill}>
        {counts.learned} / {counts.total} learned
      </span>
    </div>
  );
}

function ExerciseView({
  pick,
  input,
  onInput,
  running,
  result,
  onSubmit,
  onNext,
}: {
  pick: NextPick;
  input: string;
  onInput: (s: string) => void;
  running: boolean;
  result: RunResult | null;
  onSubmit: () => void;
  onNext: () => void;
}) {
  const ex = pick.exercise;
  const graded = result !== null;
  return (
    <div style={styles.panel}>
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
        {graded && (
          <button style={styles.btn} onClick={onNext} autoFocus>
            Next →
          </button>
        )}
      </div>

      {result && <ResultView result={result} />}
    </div>
  );
}

function ResultView({ result }: { result: RunResult }) {
  const color = result.passed ? theme.good : theme.bad;
  return (
    <div style={{ marginTop: '1rem' }}>
      <p style={{ ...styles.label, color, margin: '0 0 0.4rem' }}>
        {result.passed ? '✓ Pass — scheduled further out' : '✗ Fail — will repeat soon'}
      </p>
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

function CaughtUp() {
  return (
    <div style={styles.panel}>
      <h2 style={{ fontSize: '1.1rem', margin: '0 0 0.5rem' }}>All caught up 🎉</h2>
      <p style={{ ...styles.tagline, margin: 0 }}>
        Nothing is due right now and there are no new exercises left in this
        track. Come back later — reviews will reappear as they fall due.
      </p>
    </div>
  );
}
