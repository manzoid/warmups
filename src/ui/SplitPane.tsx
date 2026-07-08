import {
  useCallback,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';

const MIN_RATIO = 0.2;
const MAX_RATIO = 0.8;
const KEY_STEP = 0.03; // Arrow-key nudge, as a fraction of the total width.

type SplitPaneProps = {
  left: ReactNode;
  right: ReactNode;
  /** localStorage key the chosen ratio persists under (e.g. 'warmups.split.exercise'). */
  storageKey: string;
  /** Minimum width (px) each pane keeps; the divider can't push past it. */
  minPx?: number;
  /** Left-pane fraction used when nothing is stored yet. */
  defaultRatio?: number;
};

function clampRatio(r: number): number {
  return Math.min(MAX_RATIO, Math.max(MIN_RATIO, r));
}

function readRatio(key: string, fallback: number): number {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw == null) return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? clampRatio(n) : fallback;
  } catch {
    return fallback;
  }
}

function writeRatio(key: string, ratio: number): void {
  try {
    window.localStorage.setItem(key, String(ratio));
  } catch {
    // best-effort persistence (private mode / disabled storage)
  }
}

/**
 * A dependency-free two-pane horizontal splitter with a draggable divider.
 *
 * The divider runs on pointer events, so mouse, pen, and touch all drag it, and
 * the ratio is clamped so neither pane collapses below `minPx` (nor past the
 * 0.2–0.8 band). The ratio persists to localStorage under `storageKey`, written
 * only on pointer-up / key-nudge — the exercise view remounts this per problem,
 * so state alone would reset the split every time; localStorage is what carries
 * the learner's chosen width across problems and reloads.
 */
export function SplitPane({
  left,
  right,
  storageKey,
  minPx = 360,
  defaultRatio = 0.5,
}: SplitPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [ratio, setRatio] = useState<number>(() => readRatio(storageKey, defaultRatio));

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    document.body.style.userSelect = 'none';
  }, []);

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!dragging.current) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) return; // not laid out yet — ignore
      const raw = (e.clientX - rect.left) / rect.width;
      // Keep both panes at least `minPx`, then clamp to the [0.2, 0.8] band.
      const minR = minPx / rect.width;
      const maxR = 1 - minPx / rect.width;
      setRatio(clampRatio(Math.min(maxR, Math.max(minR, raw))));
    },
    [minPx],
  );

  const onPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!dragging.current) return;
      dragging.current = false;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // pointer may already be released
      }
      document.body.style.userSelect = '';
      writeRatio(storageKey, ratio);
    },
    [ratio, storageKey],
  );

  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      setRatio((r) => {
        const next = clampRatio(r + (e.key === 'ArrowLeft' ? -KEY_STEP : KEY_STEP));
        writeRatio(storageKey, next);
        return next;
      });
    },
    [storageKey],
  );

  return (
    <div ref={containerRef} style={{ display: 'flex', alignItems: 'stretch' }}>
      <div style={{ flexBasis: `${ratio * 100}%`, minWidth: 0, overflow: 'auto' }}>{left}</div>
      <div
        className="split-handle"
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={Math.round(ratio * 100)}
        aria-valuemin={Math.round(MIN_RATIO * 100)}
        aria-valuemax={Math.round(MAX_RATIO * 100)}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onKeyDown={onKeyDown}
        style={{
          flex: '0 0 22px',
          alignSelf: 'stretch',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'stretch',
          touchAction: 'none',
          // This div is a wide, transparent grab area; the visible 6px bar and its
          // idle + hover/focus color live in index.css (.split-handle::before) so
          // :hover / :focus-visible can win — an inline style can't be overridden.
        }}
      />
      <div style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>{right}</div>
    </div>
  );
}

export default SplitPane;
