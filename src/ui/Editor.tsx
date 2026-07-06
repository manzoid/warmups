import { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { python } from '@codemirror/lang-python';
import { javascript } from '@codemirror/lang-javascript';
import { indentUnit } from '@codemirror/language';
import { keymap } from '@codemirror/view';
import { indentWithTab } from '@codemirror/commands';
import { Prec } from '@codemirror/state';
import type { Track } from '../core/types';

/**
 * A real code editor for `write` exercises: syntax highlighting, auto-indent on
 * newline, and Tab / Shift-Tab to indent / dedent (4 spaces). Cmd/Ctrl+Enter
 * submits so you can run without reaching for the mouse.
 */
export function CodeEditor({
  value,
  onChange,
  language,
  onSubmit,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  language: Track;
  onSubmit?: () => void;
  autoFocus?: boolean;
}) {
  const extensions = useMemo(() => {
    const lang = language === 'python' ? python() : javascript({ typescript: true });
    const ext = [
      lang,
      indentUnit.of('    '), // 4 spaces
      keymap.of([indentWithTab]), // Tab indents, Shift-Tab dedents
    ];
    if (onSubmit) {
      ext.push(
        Prec.highest(
          keymap.of([
            {
              key: 'Mod-Enter',
              run: () => {
                onSubmit();
                return true;
              },
            },
          ]),
        ),
      );
    }
    return ext;
  }, [language, onSubmit]);

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={extensions}
      theme="dark"
      autoFocus={autoFocus}
      basicSetup={{
        lineNumbers: true,
        foldGutter: false,
        highlightActiveLine: true,
        tabSize: 4,
        // No editor assistance: no autocomplete popup, no completion keymap,
        // no auto-closing brackets. Just a plain typing surface.
        autocompletion: false,
        completionKeymap: false,
        closeBrackets: false,
      }}
      minHeight="200px"
      style={{ fontSize: '0.9rem', borderRadius: 6, overflow: 'hidden', border: '1px solid #333' }}
    />
  );
}
