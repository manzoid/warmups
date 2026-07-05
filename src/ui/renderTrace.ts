// Render an OPT-format trace (JSON string, as produced by runners/pytrace.ts)
// into a self-contained HTML document string, by injecting it into codeviz's
// offline viewer template. The result is suitable for an <iframe srcdoc>.

// codeviz's self-contained offline renderer (inline CSS + JS, no network).
// It carries `__TRACE_JSON__` and `__TITLE__` markers we fill by replacement.
import viewerTemplate from '../vendor/codeviz/viewer_template.html?raw';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Embed `traceJson` into the codeviz viewer template, mirroring codeviz's
 * render.py: the trace JSON has `</` escaped to `<\/` so a string literal in
 * the trace can never terminate the inline `<script>`, and the title is
 * HTML-escaped before going into the <title> element.
 *
 * Uses function replacers so `$`-sequences in the injected content are treated
 * literally (String.replace with a string replacement would interpret `$&`,
 * `$1`, etc.).
 */
export function traceToSrcdoc(traceJson: string, title: string): string {
  const safeJson = traceJson.replace(/<\//g, '<\\/');
  const safeTitle = escapeHtml(title);
  return viewerTemplate
    .replace('__TRACE_JSON__', () => safeJson)
    .replace('__TITLE__', () => safeTitle);
}

export default traceToSrcdoc;
