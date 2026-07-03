# warmups

warmups is an open-source, **local-first** spaced-repetition kata app for getting fast and automatic at Python and JavaScript/TypeScript language fluency and a small set of reverse-engineered problem-solving primitives. It runs entirely in your browser as a static site with no backend and no accounts: Python exercises execute in-browser via [Pyodide](https://pyodide.org/), JavaScript/TypeScript exercises run in a Web Worker, and your progress is scheduled with the [FSRS](https://github.com/open-spaced-repetition/ts-fsrs) spaced-repetition algorithm and persisted to `localStorage` — so you can drill small "predict the value" and "write the code" problems every day until the fundamentals become reflexive.

## Run it

```bash
npm install
npm run dev      # start the Vite dev server (http://localhost:5173)
```

Then open the app, pick a track (Python or JavaScript/TypeScript), and start a session.

- **Predict** exercises show a code snippet; you type the value it evaluates to.
- **Write** exercises give you a seeded editor; your code is run against hidden tests.

Grade yourself by submitting: a pass schedules the card further out, a fail brings it back soon. Progress (due / new / learned) lives only in your browser.

> The first Python submission downloads the Pyodide runtime from a CDN (a few MB), so give it a moment. JavaScript/TypeScript runs immediately in a Web Worker.

## How it works

- **Vite + React + TypeScript**, built as a fully static site (`npm run build` → `dist/`).
- **Exercises are open content** — plain JSON under [`content/`](./content), validated by a shared [zod](https://zod.dev) schema (`src/core/schema.ts`) and loaded via a Vite glob import. Add your own by dropping a JSON file in `content/python/` or `content/javascript/`.
- **Runners** execute learner code in isolation: `src/runners/python.ts` (Pyodide, fresh namespace per run) and `src/runners/javascript.ts` (a per-run Web Worker with a hard timeout; TypeScript stripped by [sucrase](https://github.com/alangpierce/sucrase)).
- **Scheduling** is a thin `ts-fsrs` wrapper (`src/core/srs.ts`) with a two-button *again / good* flow; state is persisted by `src/core/storage.ts`.

## Scripts

```bash
npm run dev        # dev server
npm run build      # production static build → dist/
npm run preview    # preview the production build
npm run typecheck  # tsc --noEmit
npm run test       # vitest (unit tests)
npm run validate   # execute EVERY content exercise and assert it's correct
```

`npm run validate` runs each exercise for real (Python via `python3`, JavaScript via Node): for `write` it runs the reference solution against the tests, and for `predict` it evaluates the snippet and checks the value matches `expected`. It exits nonzero and names any exercise that fails, so seed content stays honest. (Requires `python3` on your PATH for the Python track.)

## Contributing content

Each exercise is one object in a track's JSON array:

- `predict`: provide `snippet` (shown read-only) and `expected` (the canonical value as a string).
- `write`: provide `starter` (seeds the editor), `solution` (reference, used only by `validate`), and `tests` (appended after the learner's code; must throw/assert on failure).

Set `prereqs` to order concepts; new exercises are introduced only after their prerequisites. Run `npm run validate` before opening a PR.
