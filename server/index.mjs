#!/usr/bin/env node
// warmups local data server.
//
// Persists the attempt log to a SQLite database on disk (via Node's built-in
// node:sqlite — no dependency), so history survives browser / port / origin
// changes, is queryable with any sqlite tool, and is a single file you can back
// up. Binds to 127.0.0.1 only.
//
//   GET  /health    -> { ok, service, data }
//   GET  /progress  -> { version, cards, introduced, attempts:[...] }
//   PUT  /progress   <- the whole state; attempts are replaced (in a transaction)
//
// Run with the flag: `node --experimental-sqlite server/index.mjs`.
// DB file: ~/.warmups/warmups.db (override with WARMUPS_DB); port 8931
// (override with WARMUPS_PORT). The `attempts` table is:
//   attempts(rowid, id TEXT, at INTEGER, passed INTEGER, rung INTEGER)

import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// The shipped pace config lives in the repo (this server runs from it), so a
// trainer can save timings straight to the committed file instead of pasting.
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PACE_CONFIG_PATH = join(REPO_ROOT, 'src', 'data', 'pace-targets.json');

const PORT = Number(process.env.WARMUPS_PORT) || 8931;
const DB_PATH =
  process.env.WARMUPS_DB || join(homedir(), '.warmups', 'warmups.db');
const SCHEMA_VERSION = 1;

mkdirSync(dirname(DB_PATH), { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec(`
  CREATE TABLE IF NOT EXISTS attempts (
    rowid  INTEGER PRIMARY KEY,
    id     TEXT    NOT NULL,
    at     INTEGER NOT NULL,
    passed INTEGER NOT NULL,
    rung   INTEGER NOT NULL
  );
`);

const selectAll = db.prepare('SELECT id, at, passed, rung FROM attempts ORDER BY at, rowid');
const insertOne = db.prepare('INSERT INTO attempts (id, at, passed, rung) VALUES (?, ?, ?, ?)');
const deleteAll = db.prepare('DELETE FROM attempts');

// Fluency pace timings (durable, origin-independent — replaces localStorage).
// scope is 'personal' (a learner's own pace) or 'trainer' (an exportable
// benchmark). hash pins the timing to the pattern content it was measured on.
db.exec(`
  CREATE TABLE IF NOT EXISTS paces (
    scope TEXT NOT NULL,
    id    TEXT NOT NULL,
    ms    INTEGER NOT NULL,
    hash  TEXT NOT NULL,
    PRIMARY KEY (scope, id)
  );
`);
const selectPaces = db.prepare('SELECT scope, id, ms, hash FROM paces');
const upsertPace = db.prepare(
  'INSERT INTO paces (scope, id, ms, hash) VALUES (?, ?, ?, ?) ' +
    'ON CONFLICT(scope, id) DO UPDATE SET ms = excluded.ms, hash = excluded.hash',
);

function readPaces() {
  const out = { personal: {}, trainer: {} };
  for (const r of selectPaces.all()) {
    const bucket = r.scope === 'trainer' ? out.trainer : out.personal;
    bucket[r.id] = { ms: r.ms, hash: r.hash };
  }
  return out;
}

// Small durable UI preferences (e.g. "experienced" mode) — server-backed so they
// persist and don't depend on a per-origin localStorage.
db.exec(`
  CREATE TABLE IF NOT EXISTS prefs (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);
const selectPrefs = db.prepare('SELECT key, value FROM prefs');
const upsertPref = db.prepare(
  'INSERT INTO prefs (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
);

function readPrefs() {
  const out = {};
  for (const r of selectPrefs.all()) out[r.key] = r.value;
  return out;
}

function readProgress() {
  const attempts = selectAll.all().map((r) => ({
    id: r.id,
    at: r.at,
    passed: !!r.passed,
    rung: r.rung,
  }));
  // cards/introduced are legacy (SRS demoted) — kept in the shape for the client.
  return { version: SCHEMA_VERSION, cards: {}, introduced: [], attempts };
}

function replaceAttempts(attempts) {
  db.exec('BEGIN');
  try {
    deleteAll.run();
    for (const a of attempts) {
      insertOne.run(String(a.id), Number(a.at), a.passed ? 1 : 0, Number(a.rung ?? 0));
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}

const server = createServer(async (req, res) => {
  cors(res);
  const url = req.url || '';
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  try {
    if (req.method === 'GET' && url.startsWith('/health')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, service: 'warmups', data: DB_PATH }));
      return;
    }
    if (req.method === 'GET' && url.startsWith('/progress')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(readProgress()));
      return;
    }
    if (req.method === 'PUT' && url.startsWith('/progress')) {
      const parsed = JSON.parse(await readBody(req));
      const attempts = Array.isArray(parsed?.attempts) ? parsed.attempts : [];
      replaceAttempts(attempts);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, count: attempts.length }));
      return;
    }
    // Fluency paces (personal + trainer benchmarks).
    if (req.method === 'GET' && url.startsWith('/pace') && !url.startsWith('/pace-config')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(readPaces()));
      return;
    }
    if (req.method === 'PUT' && url.startsWith('/pace') && !url.startsWith('/pace-config')) {
      const p = JSON.parse(await readBody(req));
      const scope = p && p.scope === 'trainer' ? 'trainer' : 'personal';
      if (!p || typeof p.id !== 'string' || typeof p.ms !== 'number' || typeof p.hash !== 'string') {
        throw new Error('expected { scope, id, ms, hash }');
      }
      upsertPace.run(scope, p.id, Math.round(p.ms), p.hash);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    // Durable UI preferences.
    if (req.method === 'GET' && url.startsWith('/prefs')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(readPrefs()));
      return;
    }
    if (req.method === 'PUT' && url.startsWith('/prefs')) {
      const p = JSON.parse(await readBody(req));
      if (!p || typeof p.key !== 'string' || typeof p.value !== 'string') {
        throw new Error('expected { key, value }');
      }
      upsertPref.run(p.key, p.value);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    // Trainer: write the pace config straight to the committed source file.
    if (req.method === 'PUT' && url.startsWith('/pace-config')) {
      const parsed = JSON.parse(await readBody(req));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('expected a JSON object of { id: { ms, hash } }');
      }
      if (!existsSync(dirname(PACE_CONFIG_PATH))) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'src/data not found (run the server from the repo)' }));
        return;
      }
      writeFileSync(PACE_CONFIG_PATH, JSON.stringify(parsed, null, 2) + '\n');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, path: PACE_CONFIG_PATH, count: Object.keys(parsed).length }));
      return;
    }
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: String((e && e.message) || e) }));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`warmups data server on http://127.0.0.1:${PORT}  (sqlite: ${DB_PATH})`);
});
