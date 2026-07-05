import { useCallback, useMemo, useRef, useState } from 'react';
import type { Exercise, RunResult, Track } from './core/types';
import { newCard, review, gradeFor, type Card } from './core/srs';
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
import { Visualizer } from './ui/Visualizer';
import { buildWalkthroughPrompt } from './ui/walkthroughPrompt';

const TRACK_LABELS: Record<Track, string> = {
  python: 'Python',
  javascript: 'JavaScript',
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
  // The deepest hint-ladder rung the learner reached for the current exercise
  // (0 = attempt-only, 1 = cue, 2 = syntax, 3 = visualize, 4 = walkthrough,
  // 5 = reveal). Feeds the fine-grained grade in grade()/submit().
  const [maxRung, setMaxRung] = useState(0);
  // The card as it stood when the current exercise was picked. Grading always
  // derives from this base so re-grading (e.g. after a deeper hint changes the
  // rung) replaces the schedule instead of compounding it.
  const baseCard = useRef<Card | null>(null);

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
      setMaxRung(0);
      if (next) {
        if (next.isNew) {
          markIntroduced(progress.current, next.exercise.id);
          putCard(progress.current, next.exercise.id, newCard(now));
          save(progress.current);
        }
        baseCard.current = getCard(progress.current, next.exercise.id) ?? newCard(now);
        seedInput(next.exercise);
      } else {
        baseCard.current = null;
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

  // Schedule the current card from its base state. The grade is derived from
  // how far the learner descended the hint ladder: attempt-only pass → 'good',
  // cue/syntax → 'hard', anything deeper (or a fail) → 'again' (a lapse).
  const grade = useCallback(
    (exId: string, passed: boolean, deepestRung: number) => {
      const now = new Date();
      const base = baseCard.current ?? getCard(progress.current, exId) ?? newCard(now);
      const rating = gradeFor({ passed, deepestRung });
      putCard(progress.current, exId, review(base, rating, now));
      persist();
    },
    [persist],
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

  // Opening a hint rung records it as the deepest reached and (if already
  // graded) re-schedules from the base card at the new depth. Only a rung
  // deeper than the current max changes anything; shallower rungs no-op.
  const useHint = useCallback(
    (rung: number) => {
      if (!pick) return;
      const next = Math.max(maxRung, rung);
      if (next === maxRung) return;
      setMaxRung(next);
      if (result) grade(pick.exercise.id, result.passed, next);
    },
    [maxRung, pick, result, grade],
  );

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
                maxRung={maxRung}
                onUseHint={useHint}
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
        JavaScript runs in a Web Worker.
      </p>
      <p style={{ ...styles.tagline, margin: '0.4rem 0 0', fontSize: '0.8rem' }}>
        TypeScript syntax is accepted, but types are not taught or checked yet.
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
  maxRung,
  onUseHint,
  onSubmit,
  onNext,
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

      {result && <ResultView result={result} maxRung={maxRung} />}

      {graded && (
        <HintLadder ex={ex} input={input} maxRung={maxRung} onUse={onUseHint} />
      )}
    </div>
  );
}

// Hint-ladder rung levels, ascending in help and scheduling cost. Cue/syntax
// (1-2) are light nudges graded 'hard'; visualize/walkthrough/reveal (3-5)
// count as a lapse. See docs/scaffolding.md.
const RUNG = { cue: 1, syntax: 2, visualize: 3, walkthrough: 4, reveal: 5 } as const;

function HintLadder({
  ex,
  input,
  maxRung,
  onUse,
}: {
  ex: Exercise;
  input: string;
  maxRung: number;
  onUse: (rung: number) => void;
}) {
  const [open, setOpen] = useState({
    cue: false,
    syntax: false,
    visualize: false,
    walkthrough: false,
    reveal: false,
  });
  const toggle = (key: keyof typeof open, rung: number) => {
    const willOpen = !open[key];
    if (willOpen) onUse(rung);
    setOpen((o) => ({ ...o, [key]: willOpen }));
  };

  const answer =
    ex.kind === 'predict' ? ex.expected : ex.solution;

  return (
    <div style={{ marginTop: '1.25rem', borderTop: `1px solid ${theme.border}`, paddingTop: '1rem' }}>
      <div style={{ ...styles.row, justifyContent: 'space-between' }}>
        <p style={{ ...styles.label, margin: 0 }}>Need a hand?</p>
        {maxRung >= RUNG.visualize ? (
          <span style={{ ...styles.pill, color: theme.bad, borderColor: theme.bad }}>
            assisted — counts as a lapse
          </span>
        ) : maxRung >= RUNG.cue ? (
          <span style={{ ...styles.pill, color: theme.accent, borderColor: theme.accent }}>
            hinted — repeats sooner
          </span>
        ) : null}
      </div>
      <div style={{ ...styles.row, marginTop: '0.6rem' }}>
        {ex.cue && (
          <button style={styles.btnGhost} onClick={() => toggle('cue', RUNG.cue)}>
            {open.cue ? 'Hide cue' : 'Cue'}
          </button>
        )}
        {ex.syntax && (
          <button style={styles.btnGhost} onClick={() => toggle('syntax', RUNG.syntax)}>
            {open.syntax ? 'Hide syntax' : 'Syntax'}
          </button>
        )}
        <button style={styles.btnGhost} onClick={() => toggle('visualize', RUNG.visualize)}>
          {open.visualize ? 'Hide visualization' : 'Visualize my run'}
        </button>
        <button style={styles.btnGhost} onClick={() => toggle('walkthrough', RUNG.walkthrough)}>
          {open.walkthrough ? 'Hide walkthrough' : 'Get a walkthrough'}
        </button>
        <button style={styles.btnGhost} onClick={() => toggle('reveal', RUNG.reveal)}>
          {open.reveal ? 'Hide answer' : 'Reveal answer'}
        </button>
      </div>

      {open.cue && ex.cue && (
        <div style={{ marginTop: '1rem' }}>
          <p style={styles.label}>Cue</p>
          <p style={{ ...styles.tagline, margin: 0, color: theme.text }}>{ex.cue}</p>
        </div>
      )}

      {open.syntax && ex.syntax && (
        <div style={{ marginTop: '1rem' }}>
          <p style={styles.label}>Syntax</p>
          <pre style={styles.code}>{ex.syntax}</pre>
        </div>
      )}

      {open.visualize && (
        <div style={{ marginTop: '1rem' }}>
          {/* Predict: trace the snippet the learner mis-traced. Write: their own code. */}
          <Visualizer
            track={ex.track}
            code={ex.kind === 'write' ? input : ex.snippet ?? input}
            title={ex.concept}
          />
        </div>
      )}

      {open.reveal && (
        <div style={{ marginTop: '1rem' }}>
          <p style={styles.label}>{ex.kind === 'predict' ? 'Expected value' : 'Reference solution'}</p>
          {answer && answer.length > 0 ? (
            <pre style={styles.code}>{answer}</pre>
          ) : (
            <p style={{ ...styles.tagline, margin: 0 }}>No reference answer is available for this exercise.</p>
          )}
        </div>
      )}

      {open.walkthrough && (
        <div style={{ marginTop: '1rem' }}>
          <WalkthroughBox prompt={buildWalkthroughPrompt(ex, input)} />
        </div>
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
  // Mirror gradeFor: unassisted pass → good, cue/syntax pass → hard,
  // deeper pass or any fail → again (a lapse).
  let color: string;
  let label: string;
  if (!result.passed) {
    color = theme.bad;
    label = '✗ Fail — will repeat soon';
  } else if (maxRung >= 3) {
    color = theme.bad;
    label = '✓ Pass, but assisted — will repeat soon';
  } else if (maxRung >= 1) {
    color = theme.accent;
    label = '✓ Pass with a hint — repeats sooner';
  } else {
    color = theme.good;
    label = '✓ Pass — scheduled further out';
  }
  return (
    <div style={{ marginTop: '1rem' }}>
      <p style={{ ...styles.label, color, margin: '0 0 0.4rem' }}>
        {label}
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
