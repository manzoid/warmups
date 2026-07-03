import { describe, it, expect } from 'vitest';
import { newCard, review, due } from './srs';

const NOW = new Date('2026-07-03T12:00:00.000Z');

describe('srs scheduler', () => {
  it('a new card is due now', () => {
    const card = newCard(NOW);
    expect(due(card, NOW)).toBe(true);
  });

  it("grading 'again' keeps the card due soon", () => {
    const card = review(newCard(NOW), 'again', NOW);
    // Not due at the exact instant of review...
    expect(due(card, NOW)).toBe(false);
    // ...but due again within a short window (well under a day).
    const soon = new Date(NOW.getTime() + 24 * 60 * 60 * 1000);
    expect(due(card, soon)).toBe(true);
  });

  it("grading 'good' pushes the due date into the future", () => {
    const card = review(newCard(NOW), 'good', NOW);
    expect(card.due.getTime()).toBeGreaterThan(NOW.getTime());
    expect(due(card, NOW)).toBe(false);
  });

  it("'good' schedules further out than 'again'", () => {
    const again = review(newCard(NOW), 'again', NOW);
    const good = review(newCard(NOW), 'good', NOW);
    expect(good.due.getTime()).toBeGreaterThan(again.due.getTime());
  });

  it('due() reflects the passage of time past the due date', () => {
    const card = review(newCard(NOW), 'good', NOW);
    const afterDue = new Date(card.due.getTime() + 1000);
    expect(due(card, afterDue)).toBe(true);
  });
});
