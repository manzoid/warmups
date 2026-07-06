# warmups

warmups is an open-source, **local-first** coding-kata app for getting fast and automatic at Python and JavaScript language fluency and a small set of reverse-engineered problem-solving primitives. It runs in your browser (no accounts, no cloud): Python exercises execute in-browser via [Pyodide](https://pyodide.org/), JavaScript in a Web Worker. You move through the sequence in **Learn**, drill any set in **Practice**, and use a filterable **History** to redo what you missed — you drive review, not an algorithm. Your attempt history is kept in a local SQLite database via a tiny companion data server, with a `localStorage` fallback. (TypeScript syntax is accepted in the JavaScript track, but types are not taught or checked yet.)

## Run it

```bash
npm install
npm run dev      # Vite dev server + local data server + codeviz (if installed)
```

`npm run dev` starts three things: the Vite dev server, the local **data server** that persists your history to SQLite, and (if `codeviz` is on your PATH) the codeviz trace API for the "Visualize my run" hint. Anything already running is reused; if `codeviz` isn't installed it prints the one-time install line and carries on. Use `npm run dev:vite` for Vite alone, or `npm run server` for just the data server.

Then open the app, pick a track (Python or JavaScript), and start a session.

- **Predict** exercises show a code snippet; you type the value it evaluates to.
- **Write** exercises give you a seeded editor; your code is run against hidden tests.

Submit to grade (pass / fail). **Learn** walks you forward through the sequence; **Practice** drills any set you pick; **History** is a filterable log (failed / used-a-hint / clean) with "Practice these" so you decide what to redo.

> The first Python submission downloads the Pyodide runtime from a CDN (a few MB), so give it a moment. JavaScript runs immediately in a Web Worker.

## Visualize a run (optional)

When you're stuck, the "Visualize my run" hint steps through your own code (frames, heap, arrows) using [codeviz](https://github.com/manzoid/codeviz). Running and grading exercises never need it — only this one feature does. Install codeviz once:

```bash
uv tool install git+https://github.com/manzoid/codeviz   # once
```

After that, `npm run dev` starts the codeviz API for you (it detects `codeviz` on your PATH and launches `codeviz api` on http://127.0.0.1:8930 alongside Vite; if you already have one running, it reuses it). A browser tab can't install or launch anything itself, so the dev launcher (`scripts/dev.mjs`) is what bridges that gap — it never installs software on its own, it just runs codeviz if it's there. You can also start it by hand with `codeviz api`.

warmups calls that local API and shows the step-through inline; it works for both Python and JavaScript. If codeviz isn't running, the hint just tells you how to start it. (Run warmups over http, i.e. `npm run dev`/`preview`; a page served over https may block calls to the local http API.)

## How it works

- **Vite + React + TypeScript**, built as a fully static site (`npm run build` → `dist/`).
- **Exercises are open content** — plain JSON under [`content/`](./content), validated by a shared [zod](https://zod.dev) schema (`src/core/schema.ts`) and loaded via a Vite glob import. Add your own by dropping a JSON file in `content/python/` or `content/javascript/`.
- **Runners** execute learner code in isolation: `src/runners/python.ts` (Pyodide, fresh namespace per run) and `src/runners/javascript.ts` (a per-run Web Worker with a hard timeout; TypeScript stripped by [sucrase](https://github.com/alangpierce/sucrase)).
- **Selection** is sequence-driven (`src/ui/session.ts`): Learn marches through the content in order off an append-only **attempt log**; there's no scheduling algorithm in the driver's seat (FSRS is kept in `src/core/srs.ts` but demoted). You control review via Practice and History.
- **Persistence** (`src/core/storage.ts`): each attempt `{id, when, pass/fail, hint rung}` is written to the local **data server** (`server/index.mjs`, SQLite via Node's built-in `node:sqlite`, stored at `~/.warmups/warmups.db`) with a `localStorage` cache/fallback. On start the app hydrates from the server and unions in anything only in the cache, so nothing is lost if you drilled while it was down. History survives browser, port, and site-data changes because it lives in a file, not origin-scoped storage.

## Scripts

```bash
npm run dev        # Vite + data server + codeviz api (if installed)
npm run dev:vite   # Vite alone
npm run server     # the local history data server alone (SQLite)
npm run build      # production static build → dist/
npm run preview    # preview the production build
npm run typecheck  # tsc --noEmit
npm run test       # dep-free node tests for the scaffolding helpers
npm run validate   # execute EVERY content exercise and assert it's correct
```

`npm run validate` runs each exercise for real (Python via `python3`, JavaScript via Node): for `write` it runs the reference solution against the tests, and for `predict` it evaluates the snippet and checks the value matches `expected`. It exits nonzero and names any exercise that fails, so seed content stays honest. (Requires `python3` on your PATH for the Python track.)

## Contributing content

Each exercise is one object in a track's JSON array:

- `predict`: provide `snippet` (shown read-only) and `expected` (the canonical value as a string).
- `write`: provide `starter` (seeds the editor), `solution` (reference, used only by `validate`), and `tests` (appended after the learner's code; must throw/assert on failure).

Set `prereqs` to order concepts; new exercises are introduced only after their prerequisites. Run `npm run validate` before opening a PR.
