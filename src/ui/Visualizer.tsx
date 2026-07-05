// "Visualize my run" hint rung.
//
// Python: traces the learner's own submitted code through the vendored Online
// Python Tutor tracer (runners/pytrace) and renders the resulting trace in a
// sandboxed <iframe srcdoc> using codeviz's offline viewer (ui/renderTrace).
//
// JavaScript: live JS tracing isn't wired up yet, so this shows an honest note
// rather than faking a visualization.

import { useEffect, useState } from 'react';
import type { Track } from '../core/types';
import { tracePython } from '../runners/pytrace';
import { traceToSrcdoc } from './renderTrace';
import { styles, theme } from './styles';

export function Visualizer({
  track,
  code,
  title,
}: {
  track: Track;
  code: string;
  title: string;
}) {
  if (track === 'javascript') {
    return (
      <p style={{ ...styles.tagline, margin: 0 }}>
        Live JS visualization is coming; showing the reference snippet is the
        best we can do for now, so this step is skipped for JavaScript.
      </p>
    );
  }
  return <PythonVisualizer code={code} title={title} />;
}

function PythonVisualizer({ code, title }: { code: string; title: string }) {
  const [srcdoc, setSrcdoc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSrcdoc(null);
    setError(null);
    (async () => {
      try {
        const traceJson = await tracePython(code);
        if (cancelled) return;
        setSrcdoc(traceToSrcdoc(traceJson, title));
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, title]);

  if (error) {
    return (
      <pre style={{ ...styles.code, borderColor: theme.bad }}>{error}</pre>
    );
  }
  if (srcdoc === null) {
    return (
      <p style={{ ...styles.tagline, margin: 0 }}>Tracing your run…</p>
    );
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

export default Visualizer;
