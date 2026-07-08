import type { Track } from '../core/types';
import { styles, theme } from './styles';

const TRACK_LABELS: Record<Track, string> = {
  python: 'Python',
  javascript: 'JavaScript',
};

type View = 'learn' | 'practice' | 'fluency' | 'history';

/**
 * The full-bleed top navigation bar.
 *
 * Unlike the centered content shell, this spans the whole viewport so the app
 * reads like a tool rather than one narrow column. It carries the brand mark,
 * the per-track view tabs, the progress pill, and the Training / Settings /
 * Change-track controls — everything that used to live in the old page header
 * and the per-view Nav. Before a track is chosen (or while the training
 * dashboard is open) the tab cluster is hidden via `tabsVisible`, collapsing the
 * bar to just the brand plus the always-available Training / Settings buttons.
 */
export function TopBar({
  track,
  view,
  counts,
  hasFluency,
  tabsVisible,
  trainerMode,
  showTraining,
  onView,
  onChangeTrack,
  onToggleSettings,
  onToggleTraining,
}: {
  track: Track | null;
  view: View;
  counts: { done: number; total: number } | null;
  hasFluency: boolean;
  tabsVisible: boolean;
  trainerMode: boolean;
  showTraining: boolean;
  onView: (v: View) => void;
  onChangeTrack: () => void;
  onToggleSettings: () => void;
  onToggleTraining: () => void;
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
    <header
      style={{
        background: theme.panel,
        borderBottom: `1px solid ${theme.border}`,
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}
    >
      <div
        style={{
          maxWidth: 1500,
          margin: '0 auto',
          padding: '0.6rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ ...styles.row, gap: 10 }}>
          <span style={styles.h1}>warmups</span>
          {tabsVisible && track && (
            <>
              <span style={{ ...styles.pill, marginLeft: 2 }}>{TRACK_LABELS[track]}</span>
              {tab('learn', 'Learn')}
              {tab('practice', 'Practice')}
              {hasFluency && tab('fluency', 'Fluency')}
              {tab('history', 'History')}
            </>
          )}
        </div>
        <div style={{ ...styles.row, gap: 8 }}>
          {tabsVisible && counts && (
            <span style={styles.pill}>
              {counts.done} / {counts.total} passed
            </span>
          )}
          {tabsVisible && (
            <button style={styles.btnGhost} onClick={onChangeTrack}>
              Change track
            </button>
          )}
          {trainerMode && (
            <button
              style={{
                ...styles.btnGhost,
                padding: '2px 8px',
                fontSize: '0.8rem',
                ...(showTraining ? { borderColor: theme.accent, color: theme.accent } : {}),
              }}
              onClick={onToggleTraining}
              title="Time-trainer dashboard: pace coverage across all patterns"
            >
              Training
            </button>
          )}
          <button
            style={{ ...styles.btnGhost, padding: '2px 8px', fontSize: '0.8rem' }}
            onClick={onToggleSettings}
            title="Feature flags and settings"
          >
            ⚙ Settings
          </button>
        </div>
      </div>
    </header>
  );
}

export default TopBar;
