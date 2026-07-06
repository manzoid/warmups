// Enforcement for "do not use X" katas. The whole value of a raw-mechanics kata
// is that you write the loop by hand; an honor-system ban lets the shortcut-
// leaning learner (exactly who we target) pass by using the very builtin the
// kata forbids. So the runners refuse a submission that contains a banned token.
//
// Patterns are things like "sum(", "sorted(", ".sort(", "[::-1]", ".reverse(".
// A token that starts with an identifier char is matched at a WORD BOUNDARY so
// it hits the builtin call but NOT the learner's own name: banning "sum(" must
// reject `return sum(a)` yet allow `def my_sum(a)`, and "int(" must not trip on
// "print(". Tokens that start with a symbol (".reverse(", "[::-1]", " sum(")
// already carry their own left edge, so they're matched literally.

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The first banned pattern present in `code`, or null. */
export function firstBanned(code: string, banned?: string[]): string | null {
  if (!banned || banned.length === 0) return null;
  for (const b of banned) {
    if (!b) continue;
    const startsWord = /[A-Za-z0-9_]/.test(b[0]);
    const re = startsWord
      ? new RegExp('(?<![A-Za-z0-9_.])' + escapeRe(b))
      : new RegExp(escapeRe(b));
    if (re.test(code)) return b;
  }
  return null;
}

/** A learner-facing message for a banned-token hit. */
export function bannedMessage(pattern: string): string {
  return `This kata asks you to do it by hand — remove \`${pattern}\` and write the logic yourself.`;
}

/**
 * A clear failure message for a structured test case: which call failed, what
 * it should return, and what it actually returned. Replaces the opaque bare
 * `AssertionError: [1, 0]` with the input in view.
 */
export function failingCaseMessage(
  call: string,
  expected?: string,
  actual?: string,
): string {
  const lines = [`Failed on:  ${call}`];
  if (expected !== undefined && expected !== null) lines.push(`expected:   ${expected}`);
  if (actual !== undefined) lines.push(`got:        ${actual}`);
  return lines.join('\n');
}
