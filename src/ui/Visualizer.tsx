// "Visualize my run" hint rung.
//
// Traces the code through a locally-running codeviz (`codeviz api`) and shows the
// resulting step-through in a sandboxed <iframe>. Works for both tracks, since
// codeviz has real Python and JavaScript tracers. If codeviz isn't running, this
// shows how to start it rather than failing silently. Grading never needs it.

import { useEffect, useState } from 'react';
import type { Track } from '../core/types';
import { traceViaCodeviz, CodevizUnavailable, CODEVIZ_API_BASE } from './codevizApi';
import { styles, theme } from './styles';

type State = 'loading' | 'ok' | 'down' | 'error';

export function Visualizer({
  track,
  code,
  title,
}: {
  track: Track;
  code: string;
  title: string;
}) {
  const [srcdoc, setSrcdoc] = useState<string>('');
  const [state, setState] = useState<State>('loading');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    setSrcdoc('');
    setError('');
    (async () => {
      try {
        const html = await traceViaCodeviz(code, track);
        if (cancelled) return;
        setSrcdoc(html);
        setState('ok');
      } catch (err) {
        if (cancelled) return;
        if (err instanceof CodevizUnavailable) {
          setState('down');
        } else {
          setError(err instanceof Error ? err.message : String(err));
          setState('error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, track]);

  if (state === 'loading') {
    return <p style={{ ...styles.tagline, margin: 0 }}>Tracing your run…</p>;
  }
  if (state === 'down') {
    return <CodevizDown />;
  }
  if (state === 'error') {
    return <pre style={{ ...styles.code, borderColor: theme.bad }}>{error}</pre>;
  }
  return (
    <iframe
      title={title}
      srcDoc={srcdoc}
      sandbox="allow-scripts"
      style={{
        width: '100%',
        height: 460,
        border: `1px solid ${theme.border}`,
        borderRadius: 8,
        background: '#fff',
      }}
    />
  );
}

function CodevizDown() {
  return (
    <div style={{ ...styles.code, borderColor: theme.border }}>
      <p style={{ margin: '0 0 6px' }}>Visualization needs codeviz running locally.</p>
      <p style={{ margin: '0 0 6px', color: theme.muted }}>Install once, then start it:</p>
      <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
        uv tool install git+https://github.com/manzoid/codeviz{'\n'}codeviz api
      </pre>
      <p style={{ margin: '8px 0 0', color: theme.muted, fontSize: '0.85rem' }}>
        Listening on {CODEVIZ_API_BASE}. Running and grading exercises works
        without it; only this visualization needs it.
      </p>
    </div>
  );
}

export default Visualizer;
