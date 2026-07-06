#!/usr/bin/env node
// warmups dev launcher.
//
// Starts the Vite dev server and, if codeviz is available, the codeviz trace API
// beside it so the "Visualize my run" hint works out of the box. Running and
// grading exercises never need codeviz; if it's missing we print the one-time
// install line and carry on (only the visualize hint is affected).
//
//   npm run dev        -> this launcher (Vite + codeviz if present)
//   npm run dev:vite   -> Vite alone
//
// A browser tab cannot install or launch codeviz itself, so this Node launcher
// (which runs on your machine) is what bridges the gap. It never installs
// software on its own — if codeviz isn't found it just tells you how.

import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const PORT = 8930;
const HEALTH = `http://127.0.0.1:${PORT}/health`;

function log(msg) {
  process.stdout.write(`[warmups] ${msg}\n`);
}

/** Is a codeviz api already listening (started by hand or a prior run)? */
export async function codevizUp() {
  try {
    const res = await fetch(HEALTH, { signal: AbortSignal.timeout(600) });
    return res.ok;
  } catch {
    return false;
  }
}

/** Is the `codeviz` CLI installed and on PATH? */
export function haveCodeviz() {
  return new Promise((resolve) => {
    const p = spawn('codeviz', ['--help'], { stdio: 'ignore' });
    p.on('error', () => resolve(false));
    p.on('exit', (code) => resolve(code === 0));
  });
}

async function main() {
  const children = [];
  let shuttingDown = false;
  const shutdown = (code) => {
    if (shuttingDown) return;
    shuttingDown = true;
    for (const c of children) {
      try {
        c.kill('SIGTERM');
      } catch {
        /* already gone */
      }
    }
    process.exit(code ?? 0);
  };
  process.on('SIGINT', () => shutdown(0));
  process.on('SIGTERM', () => shutdown(0));

  // Decide what to do about codeviz (the visualize hint), then always start Vite.
  if (await codevizUp()) {
    log(`codeviz already running on http://127.0.0.1:${PORT} — reusing it.`);
  } else if (await haveCodeviz()) {
    log(`starting codeviz api on http://127.0.0.1:${PORT} …`);
    const cv = spawn('codeviz', ['api', '--port', String(PORT)], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const relay = (buf) =>
      String(buf)
        .split('\n')
        .filter((l) => l.trim())
        .forEach((l) => process.stdout.write(`[codeviz] ${l}\n`));
    cv.stdout.on('data', relay);
    cv.stderr.on('data', relay);
    cv.on('error', (e) => log(`codeviz failed to start: ${e.message}`));
    children.push(cv);
  } else {
    log('codeviz not found — the "Visualize my run" hint will be disabled.');
    log('  Running and grading exercises works without it. To enable it:');
    log('    uv tool install git+https://github.com/manzoid/codeviz   # once');
    log('  then re-run `npm run dev` (or start `codeviz api` yourself).');
  }

  // Vite is the thing you actually wait on; when it exits, tear everything down.
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const vite = spawn(npm, ['run', 'dev:vite'], { stdio: 'inherit' });
  vite.on('error', (e) => {
    log(`vite failed to start: ${e.message}`);
    shutdown(1);
  });
  vite.on('exit', (code) => shutdown(code ?? 0));
  children.push(vite);
}

// Only run when invoked directly (so the helpers can be imported for testing
// without starting any servers). process.argv[1] is undefined under `node -e`.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
