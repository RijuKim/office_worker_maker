import { describe, expect, it } from "vitest";

import { applyStatDeltas, normalizeStatDeltas } from "@/lib/game/game-rules";

describe("AI event source provenance", () => {
  it("normalizeStatDeltas caps health loss to -1 per choice", () => {
    const result = normalizeStatDeltas({ health: -5, mental: 0 });
    expect(result.health).toBe(-1);
  });

  it("normalizeStatDeltas caps mental loss to -1 per choice", () => {
    const result = normalizeStatDeltas({ health: 0, mental: -8 });
    expect(result.mental).toBe(-1);
  });

  it("normalizeStatDeltas preserves non-health/mental deltas", () => {
    const result = normalizeStatDeltas({ academic: 6, practical: -3, health: -1, mental: -1 });
    expect(result.academic).toBe(6);
    expect(result.practical).toBe(-3);
  });

  it("applyStatDeltas with cumulative guard prevents five-consecutive-minus-one health regression", () => {
    let stats: Record<string, number> = { health: 6, mental: 6, academic: 5, practical: 5 };
    for (let i = 0; i < 5; i++) {
      stats = applyStatDeltas(stats, { health: -1, mental: 0 }, { coreEventCount: i });
    }
    expect(stats.health).toBeGreaterThanOrEqual(2);
    expect(stats.health).toBeLessThanOrEqual(6);
  });

  it("applyStatDeltas with cumulative guard prevents five-consecutive-minus-one mental regression", () => {
    let stats: Record<string, number> = { health: 6, mental: 6, academic: 5, practical: 5 };
    for (let i = 0; i < 5; i++) {
      stats = applyStatDeltas(stats, { mental: -1, health: 0 }, { coreEventCount: i });
    }
    expect(stats.mental).toBeGreaterThanOrEqual(2);
    expect(stats.mental).toBeLessThanOrEqual(6);
  });

  it("applyStatDeltas without cumulative guard allows health to drop to 1 after guard window", () => {
    let stats: Record<string, number> = { health: 6, mental: 6, academic: 5, practical: 5 };
    for (let i = 0; i < 5; i++) {
      stats = applyStatDeltas(stats, { health: -1, mental: 0 }, { coreEventCount: 9 + i });
    }
    expect(stats.health).toBe(1);
  });

  it("applyStatDeltas without cumulative guard allows mental to drop to 1 after guard window", () => {
    let stats: Record<string, number> = { health: 6, mental: 6, academic: 5, practical: 5 };
    for (let i = 0; i < 5; i++) {
      stats = applyStatDeltas(stats, { mental: -1, health: 0 }, { coreEventCount: 9 + i });
    }
    expect(stats.mental).toBe(1);
  });

  it("health analogue: consecutive health hits are also guarded", () => {
    let stats: Record<string, number> = { health: 6, mental: 6, academic: 5, practical: 5 };
    for (let i = 0; i < 5; i++) {
      stats = applyStatDeltas(stats, { health: -1, mental: -1 }, { coreEventCount: i });
    }
    expect(stats.health).toBeGreaterThanOrEqual(2);
    expect(stats.mental).toBeGreaterThanOrEqual(2);
  });

  it("cumulative guard does not affect wealth (unbounded stat)", () => {
    let stats: Record<string, number> = { health: 6, mental: 6, wealth: 100 };
    for (let i = 0; i < 5; i++) {
      stats = applyStatDeltas(stats, { wealth: -30 }, { coreEventCount: i });
    }
    expect(stats.wealth).toBe(-50);
  });
});
