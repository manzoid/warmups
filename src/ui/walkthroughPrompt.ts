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
 */
export function buildWalkthroughPrompt(ex: Exercise, userAttempt: string): string {
  const attempt = userAttempt.trim();
  const snippetBlock = ex.snippet
    ? `\nCode snippet the learner is reasoning about:\n\`\`\`${ex.track}\n${ex.snippet}\n\`\`\`\n`
    : '';
  const attemptBlock = attempt
    ? `\`\`\`${ex.track}\n${attempt}\n\`\`\``
    : '(the learner has not written anything yet)';

  return [
    `You are a Socratic programming tutor. Help the learner solve the exercise`,
    `below WITHOUT revealing the answer.`,
    ``,
    `Track: ${ex.track}`,
    `Concept group: ${ex.group}`,
    `Concept: ${ex.concept}`,
    `Exercise type: ${ex.kind === 'predict' ? 'predict the value' : 'write the code'}`,
    ``,
    `Prompt:`,
    ex.prompt,
    snippetBlock,
    `The learner's current attempt:`,
    attemptBlock,
    ``,
    `Rules:`,
    `- Be Socratic: ask questions, do not lecture.`,
    `- Do NOT reveal or write the answer, in whole or in part.`,
    `- Give the single minimal hint that unblocks the next step, nothing more.`,
    `- Make the learner generate the next step themselves; wait for their reply.`,
    `- First figure out which one thing is missing, then target it:`,
    `    - syntax: they know the idea but not how to express it in ${ex.track};`,
    `    - schema: they don't have the mental model / pattern for this kind of problem;`,
    `    - sub-skill: a smaller prerequisite skill is shaky;`,
    `    - recognition: they don't yet see that this problem is that kind of problem.`,
    `- Ask one probing question to tell those apart before hinting.`,
  ].join('\n');
}

export default buildWalkthroughPrompt;
