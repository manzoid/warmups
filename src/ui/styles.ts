// Shared inline-style tokens. Kept tiny and dependency-free (no CSS framework);
// the MVP favours a clean monospace-forward look.

import type { CSSProperties } from 'react';

export const theme = {
  bg: '#0f1117',
  panel: '#171a23',
  panelAlt: '#1e222d',
  border: '#2a2f3a',
  text: '#e6e9ef',
  muted: '#8b93a7',
  accent: '#7aa2f7',
  good: '#7ee787',
  bad: '#ff7b72',
  mono: "'SFMono-Regular', ui-monospace, 'JetBrains Mono', Menlo, Consolas, monospace",
  sans: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
};

export const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: theme.bg,
    color: theme.text,
    fontFamily: theme.sans,
    fontSize: '1rem',
    padding: 0,
  },
  // Centered content column for the list/picker views. The full-bleed TopBar and
  // the per-view wrapper own the outer padding, so this is just width + gutter.
  shell: { maxWidth: 1100, margin: '0 auto', padding: '0 1.25rem' },
  // Wider column for the two-pane exercise view, so a split of problem | answer
  // has real room without letting the reading measure run away on huge monitors.
  shellWide: { maxWidth: 1500, margin: '0 auto', padding: '0 1.25rem' },
  // The brand mark in the TopBar (moved here from the old page <h1>).
  h1: { fontSize: '1.1rem', fontWeight: 700, margin: 0, letterSpacing: '-0.02em' },
  tagline: { color: theme.muted, margin: '0 0 1.5rem', fontSize: '0.9rem', lineHeight: 1.5 },
  // Section heading inside panels (consolidates the scattered 1.1/1.15rem h2s).
  h2: { fontSize: '1.2rem', margin: '0 0 0.5rem' },
  // Small muted helper text (consolidates the scattered 0.78/0.8/0.82rem notes).
  note: { color: theme.muted, fontSize: '0.8rem', margin: 0, lineHeight: 1.5 },
  panel: {
    background: theme.panel,
    border: `1px solid ${theme.border}`,
    borderRadius: 12,
    padding: '1.5rem',
  },
  row: { display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' },
  btn: {
    background: theme.accent,
    color: '#0b0e14',
    border: 'none',
    borderRadius: 8,
    padding: '0.6rem 1.1rem',
    fontSize: '0.95rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  btnGhost: {
    background: 'transparent',
    color: theme.text,
    border: `1px solid ${theme.border}`,
    borderRadius: 8,
    padding: '0.55rem 1rem',
    fontSize: '0.95rem',
    cursor: 'pointer',
  },
  editor: {
    width: '100%',
    boxSizing: 'border-box',
    background: theme.panelAlt,
    color: theme.text,
    border: `1px solid ${theme.border}`,
    borderRadius: 8,
    padding: '0.75rem',
    fontFamily: theme.mono,
    fontSize: '0.95rem',
    lineHeight: 1.6,
    resize: 'vertical',
  },
  code: {
    display: 'block',
    whiteSpace: 'pre-wrap',
    background: theme.panelAlt,
    border: `1px solid ${theme.border}`,
    borderRadius: 8,
    padding: '0.75rem',
    fontFamily: theme.mono,
    fontSize: '0.9rem',
    lineHeight: 1.6,
    margin: 0,
  },
  label: {
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: theme.muted,
    margin: '0 0 0.4rem',
  },
  pill: {
    fontSize: '0.75rem',
    padding: '0.15rem 0.5rem',
    borderRadius: 999,
    border: `1px solid ${theme.border}`,
    color: theme.muted,
  },
};
