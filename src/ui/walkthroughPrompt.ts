// Build a Socratic tutoring prompt for the "Get a walkthrough" hint rung.
//
// The output is meant to be copied and pasted into the learner's own AI coding
// agent. It is a handoff, not something warmups sends anywhere: it embeds the
// exercise, the learner's current attempt, and rules that keep the tutor from
// just handing over the answer.

import type { Exercise } from '../core/types';

/**
 * Compose the tutoring prompt. `userAttempt` is whatever is currently in the
 * editor / answer box (may be empty). We deliberately do NOT include the
 * canonical answer (ex.expected / ex.solution) so a pasted prompt can't leak it.
 *
 * For WRITE exercises we DO include ex.tests and ex.starter: these are the
 * contract (the exact spec and edge cases the code must satisfy) and the
 * required signature, not the answer, so they can't leak the solution. Without
 * them the tutor guesses at edge cases the prose leaves implicit. The author's
 * cue/syntax hints are passed as private, tutor-only material to keep the
 * minimal hint aligned with the intended teaching path.
 */
export function buildWalkthroughPrompt(ex: Exercise, userAttempt: string): string {
  const attempt = userAttempt.trim();
  const isPredict = ex.kind === 'predict';

  const snippetBlock = ex.snippet
    ? `\nCode snippet the learner is reasoning about:\n\`\`\`${ex.track}\n${ex.snippet}\n\`\`\`\n`
    : '';

  // WRITE-only context: the exact contract. Tests and starter are the spec, not
  // the canonical solution, so they are safe to include and do real work by
  // pinning down edge cases the prose leaves implicit.
  const starterBlock = !isPredict && ex.starter
    ? `\nStarter scaffold the learner is completing (respect this signature and these names):\n\`\`\`${ex.track}\n${ex.starter}\n\`\`\`\n`
    : '';
  const testsBlock = !isPredict && ex.tests
    ? `\nRequirements / examples the solution must satisfy (the spec, not the answer — do not just echo these back):\n\`\`\`${ex.track}\n${ex.tests}\n\`\`\`\n`
    : '';

  // Author-written hint-ladder rungs, for the tutor's private use only. These
  // are nudges, never the answer, so they are safe to pass; they keep the
  // "single minimal hint" grounded in the exercise design instead of improvised.
  const privateHints = [ex.cue, ex.syntax].filter((h): h is string => Boolean(h));
  const hintBlock = privateHints.length
    ? `\nPrivate hint material, for you only (do NOT quote verbatim; use it to pitch your minimal hint at the right level):\n${privateHints.map((h) => `- ${h}`).join('\n')}\n`
    : '';

  const attemptLabel = isPredict
    ? "The learner's predicted value (what they think the snippet evaluates to):"
    : "The learner's current code attempt:";
  const attemptBlock = attempt
    ? isPredict
      ? attempt
      : `\`\`\`${ex.track}\n${attempt}\n\`\`\``
    : '(the learner has not written anything yet)';

  const rules: string[] = [
    `Rules:`,
    `- Be Socratic: ask questions, do not lecture.`,
    `- FIRST, privately work out the correct answer yourself, step by step, and hold`,
    `  it silently. The canonical answer is deliberately omitted from this prompt so`,
    `  it can't leak, so you must derive it. Never print it, or any intermediate`,
    `  value or line of code that would give it away. Use it only to judge the`,
    `  learner and aim your hint.`,
    `- Do NOT reveal or write the answer, in whole or in part. Never write a line of`,
    `  the target code, even after repeated failure; keep hints at the conceptual /`,
    `  structural level.`,
    `- When the answer is a single short value or line, do not confirm, deny, or name`,
    `  it. Instead have the learner trace the rule (or a specific example) that`,
    `  produces it, one step at a time.`,
  ];
  if (!isPredict && ex.tests) {
    rules.push(
      `- The attempt may be wrong. Trace it against the requirements above, find the`,
      `  first case it fails, and aim your question at that case.`,
    );
  }
  rules.push(
    `- Diagnose before hinting: decide which ONE thing is missing, then target it:`,
    `    - syntax: they know the idea but not how to express it in ${ex.track};`,
    `    - schema: they don't have the mental model / pattern for this kind of problem;`,
    `    - sub-skill: a smaller prerequisite skill is shaky;`,
    `    - recognition: they don't yet see that this problem is that kind of problem.`,
    `- Ask one probing question to tell those apart before hinting.`,
    `- Give the single minimal hint that unblocks the next step, then wait for their reply.`,
  );

  return [
    `You are a Socratic programming tutor. Help the learner solve the exercise`,
    `below WITHOUT revealing the answer.`,
    ``,
    `Track: ${ex.track}`,
    `Concept group: ${ex.group}`,
    `Concept: ${ex.concept}`,
    `Exercise type: ${isPredict ? 'predict the value' : 'write the code'}`,
    ``,
    `Prompt:`,
    ex.prompt,
    snippetBlock,
    starterBlock,
    testsBlock,
    hintBlock,
    attemptLabel,
    attemptBlock,
    ``,
    ...rules,
  ].join('\n');
}

export default buildWalkthroughPrompt;
