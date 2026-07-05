# Authoring warmups content

This is the spec for writing exercises. Every exercise is authored from
`docs/syllabus-matrix.md` and must pass `npm run validate` (which executes each
exercise for real). Read this whole file before writing any content.

## Where content lives

- One JSON file per unit per track: `content/python/uNN-slug.json` and
  `content/javascript/uNN-slug.json`, where `NN` is the two-digit unit number.
- Each file is a JSON array of exercise objects.
- The app loads every `content/**/*.json`, so file naming is the coarse ordering
  knob. Two-digit unit numbers sort correctly (`u01` … `u11`).

## The exercise object

```jsonc
{
  "id": "py.u01.accumulate.sum",   // globally unique; scheme below
  "track": "python",                // "python" | "javascript"
  "group": "Loops & iteration",     // unit title; shows as a UI pill
  "concept": "sum via accumulator",  // short label; the idiom name lives HERE
  "kind": "predict",                 // "predict" | "write"
  "prompt": "...",                   // terse; see rules
  // predict:
  "snippet": "...",                  // code whose FINAL expression is evaluated
  "expected": "...",                 // rendered value; see rendering rules
  // write:
  "starter": "...",                  // scaffold shown in the editor
  "solution": "...",                 // reference answer; validated for real
  "tests": "...",                    // asserts; decide pass/fail
  "prereqs": ["py.u01.accumulate.sum"]  // same-unit ids only
}
```

### ID scheme

`{track}.u{NN}.{slug}[.{variant}]` — e.g. `py.u01.accumulate.max`,
`js.u04.hashmap.build.put`. Lowercase, dot-separated. Because each unit+track is
authored by one file, ids are unique by construction. Never reference another
unit's ids.

### group

Use the unit's title verbatim (e.g. `Loops & iteration`, `Hash maps`,
`Two pointers`). This is the pill the learner sees.

## Prompt rules (strict)

The prompt states the task and nothing more. It must NOT narrate the mechanism,
name the trick, or hint the answer. The idiom name belongs in `concept`, not the
prompt.

- predict prompt: almost always just `What does this evaluate to?` (or
  `What is the value of \`mid\`?` when the snippet binds a name). Never explain
  what the code does.
- write prompt: state the function name, signature, what it returns, and any
  constraint ("do not use the built-in sort", "use two pointers"). No walkthrough.

Bad (over-coaching):
> "enumerate gives (index, value) pairs; start=1 shifts the counter. What does
> this evaluate to?"

Good:
> "What does this evaluate to?"

## predict — how `expected` is rendered

The validator evaluates the snippet's final expression and compares its rendered
value to `expected`, after normalizing whitespace (runs of spaces/newlines
collapse to one space, ends trimmed). Get the rendering exactly right — this is
the most common failure.

The snippet's last statement MUST be an expression (Python) / the completion
value of the last statement (JS). Assignments alone do not produce a value; end
with the name you want to show.

### Python (`repr` of the value)

| value | expected |
|---|---|
| string | `'abc'` (single quotes) |
| int / float | `42`, `3.5` |
| bool / none | `True`, `False`, `None` |
| list | `[1, 2, 3]` |
| tuple | `(1, 2)` — 1-tuple is `(1,)` |
| dict | `{'a': 1, 'b': 2}` |
| set | `{1, 2, 3}` (order is unstable — prefer `sorted(...)` → a list) |
| list of strings | `['a', 'b']` |

Self-check: `python3 -c "print(repr(<the final expression>))"`.

### JavaScript (custom renderer; NOT `JSON.stringify`)

| value | expected |
|---|---|
| top-level string | `abc` (RAW — no quotes) |
| number / bool | `42`, `true` |
| null / undefined | `null`, `undefined` |
| array | `[1, 2, 3]` |
| array of strings | `["a", "b"]` (nested strings ARE double-quoted) |
| object | `{a: 1, b: 2}` (keys UNQUOTED, `key: value`) |
| object w/ string vals | `{a: "x"}` |
| Map | `Map(2) {1 => 2, 3 => 4}` |
| Set | `Set(3) {1, 2, 3}` |
| bigint | `10n` |

Note the divergences from Python: a top-level string has no quotes, object keys
are unquoted, and Map/Set have their own forms. Nested strings use double
quotes. When a snippet's value is a plain object, prefer small deterministic
key sets so ordering is obvious.

Avoid predicts whose value is order-unstable (raw `Set`/`dict` iteration where
insertion order isn't obvious). If you need a set result, sort it into a list.

## write — solution + tests

The validator runs `solution` then `tests`; pass = nothing thrown / exit 0.

- Python: tests use `assert`, e.g. `assert f([1,2]) == 3, f([1,2])`.
- JavaScript: tests must THROW to fail — `if (got !== want) throw new Error('...')`.
  `console.assert` does NOT throw, so it will not catch anything. For array/object
  comparisons use `JSON.stringify(a) !== JSON.stringify(b)`.
- `starter` is the scaffold the learner starts from: the signature plus a
  `# your code here` / `// your code here` body. It must be syntactically valid
  but need not run.
- Keep TS light in JS solutions; sucrase strips types, but plain JS is fine and
  preferred for readability.

## Capability builds (multi-step, starter-threaded)

Some capabilities (hash map, set, sorting, stack/queue/deque, `my_split`/
`my_join`) are built from raw parts across several exercises. Author each build
step as its own `write` exercise, chained with `prereqs`, using starter-threading:

- Step k's `starter` = the cumulative reference code THROUGH step k-1 (the class
  or functions built so far), with the new method stubbed.
- Step k's `solution` = that starter PLUS the one new method/behavior.
- Step k's `tests` exercise just the new behavior (may call earlier methods).
- Step k `prereqs` step k-1.

This way each step's `solution` passes its own `tests` (validation stays green),
and the learner always resumes from known-good code instead of compounding an
earlier mistake. No engine change — this is purely an authoring convention; the
app already threads `starter` into the editor and honors `prereqs` order.

## Layering: raw first, then the built-in, then sugar

Order within a unit follows the matrix:

1. **Pattern** (language-agnostic): the raw loop/index mechanics that also work
   in C. These come first and get the most repetition.
2. **Capability**: build the thing from raw parts (hash map, set, sort, stack),
   then use it.
3. **Sugar**: the language convenience (`enumerate`, comprehension, `.slice`,
   `sorted(key=)`). A sugar exercise must `prereqs` the raw pattern it shortcuts,
   so it is only introduced after the learner has done the pattern by hand.

Spiral: revisit a pattern from several angles (forward/backward, nested,
offset, until-a-goal) rather than one-and-done. Unit 1 (loops/arrays) is the
largest because array iteration is the majority of interview problems.

## Validation

`npm run validate` executes every exercise (python3 for Python, node+sucrase for
JavaScript) and checks unique ids + resolvable prereqs. Content is not done until
this prints `OK`. Author defensively: run each predict's snippet and each write's
solution+tests before committing them to the file.
