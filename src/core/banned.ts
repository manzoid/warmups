// Enforcement for "do not use X" katas. The whole value of a raw-mechanics kata
// is that you write the loop by hand; an honor-system ban lets the shortcut-
// leaning learner (exactly who we target) pass by using the very builtin the
// kata forbids. So the runners refuse a submission that contains a banned token.
//
// A simple substring scan is intentional: patterns are things like "sum(",
// "sorted(", ".sort(", "[::-1]", ".reduce", ".reverse(". It can over-match
// inside a string/comment, but for these katas that's an acceptable, rare edge
// and the message tells the learner exactly what to remove.

/** The first banned pattern present in `code`, or null. */
export function firstBanned(code: string, banned?: string[]): string | null {
  if (!banned || banned.length === 0) return null;
  for (const b of banned) if (b && code.includes(b)) return b;
  return null;
}

/** A learner-facing message for a banned-token hit. */
export function bannedMessage(pattern: string): string {
  return `This kata asks you to do it by hand — remove \`${pattern}\` and write the logic yourself.`;
}
