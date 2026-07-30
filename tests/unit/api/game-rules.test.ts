import { describe, expect, it } from "vitest";

import {
  applyCumulativeBalanceGuard,
  applyFlagDeltas,
  applyRelationshipDeltas,
  applyStatDeltas,
  checkForcedEvent,
  clampPublicStat,
  clampTrust,
  CUMULATIVE_GUARD_EVENT_LIMIT,
  CUMULATIVE_GUARD_FLOOR,
  normalizeStatDeltas,
  validateChoiceIndex,
} from "@/lib/game/game-rules";

describe("clampPublicStat", () => {
  it("clamps values within 1-10", () => {
    expect(clampPublicStat(5)).toBe(5);
    expect(clampPublicStat(-5)).toBe(1);
    expect(clampPublicStat(15)).toBe(10);
    expect(clampPublicStat(1)).toBe(1);
    expect(clampPublicStat(10)).toBe(10);
  });
});

describe("clampTrust", () => {
  it("clamps trust within -100-100", () => {
    expect(clampTrust(50)).toBe(50);
    expect(clampTrust(-10)).toBe(-10);
    expect(clampTrust(-150)).toBe(-100);
    expect(clampTrust(150)).toBe(100);
  });
});

describe("applyStatDeltas", () => {
  it("applies deltas directly on the 1-10 scale", () => {
    const result = applyStatDeltas({ academic: 5, health: 6 }, { academic: 2, health: -1 });
    expect(result.academic).toBe(7);
    expect(result.health).toBe(5);
  });

  it("clamps deltas to max effect", () => {
    const result = applyStatDeltas({ academic: 5 }, { academic: 99 });
    expect(result.academic).toBe(8);
  });

  it("clamps result to 1-10", () => {
    const result = applyStatDeltas({ academic: 9 }, { academic: 10 });
    expect(result.academic).toBe(10);
  });

  it("preserves unmodified stats", () => {
    const result = applyStatDeltas({ academic: 5, charm: 3, health: 7 }, { academic: 5 });
    expect(result.charm).toBe(3);
    expect(result.health).toBe(7);
  });

  it("limits health and mental loss to one point per choice", () => {
    const result = applyStatDeltas({ health: 8, mental: 8 }, { health: -5, mental: -5 });
    expect(result.health).toBe(7);
    expect(result.mental).toBe(7);
  });
});

describe("normalizeStatDeltas", () => {
  it("caps health and mental loss while preserving other deltas", () => {
    expect(normalizeStatDeltas({ health: -5, mental: -4, academic: 2 })).toEqual({
      health: -1,
      mental: -1,
      academic: 2,
    });
  });
});

describe("applyRelationshipDeltas", () => {
  it("applies trust changes to matching relationships", () => {
    const rels = [
      { name: "지민 선배", trust: 46 },
      { name: "민하", trust: 52 },
    ];
    const result = applyRelationshipDeltas(rels, [{ name: "지민 선배", trust: 4 }]);
    expect(result.find((r) => r.name === "지민 선배")?.trust).toBe(50);
    expect(result.find((r) => r.name === "민하")?.trust).toBe(52);
  });
});

describe("applyFlagDeltas", () => {
  it("merges flags", () => {
    const result = applyFlagDeltas({ firstEventIssued: true }, { internshipCuriosity: true });
    expect(result).toEqual({ firstEventIssued: true, internshipCuriosity: true });
  });
});

describe("checkForcedEvent", () => {
  it("returns burnout when risk >= 80", () => {
    expect(checkForcedEvent({ burnoutRisk: 90 })).toEqual({ type: "burnout" });
  });

  it("returns null when risk < 80", () => {
    expect(checkForcedEvent({ burnoutRisk: 50 })).toBeNull();
  });
});

describe("validateChoiceIndex", () => {
  it("accepts valid indices", () => {
    expect(validateChoiceIndex([1, 2, 3], 0)).toBe(true);
    expect(validateChoiceIndex([1, 2, 3], 2)).toBe(true);
  });

  it("rejects invalid indices", () => {
    expect(validateChoiceIndex([1, 2, 3], -1)).toBe(false);
    expect(validateChoiceIndex([1, 2, 3], 3)).toBe(false);
    expect(validateChoiceIndex([1, 2, 3], "x" as unknown as number)).toBe(false);
  });
});

describe("applyCumulativeBalanceGuard", () => {
  it("does not modify stats above the floor", () => {
    const result = applyCumulativeBalanceGuard(
      { health: 6, mental: 5, academic: 7 },
      { coreEventCount: 3 },
    );
    expect(result.health).toBe(6);
    expect(result.mental).toBe(5);
    expect(result.academic).toBe(7);
  });

  it("prevents health from dropping below floor during early events", () => {
    const result = applyCumulativeBalanceGuard(
      { health: 1, mental: 5 },
      { coreEventCount: 3 },
    );
    expect(result.health).toBe(CUMULATIVE_GUARD_FLOOR);
    expect(result.mental).toBe(5);
  });

  it("prevents mental from dropping below floor during early events", () => {
    const result = applyCumulativeBalanceGuard(
      { health: 5, mental: 1 },
      { coreEventCount: 5 },
    );
    expect(result.health).toBe(5);
    expect(result.mental).toBe(CUMULATIVE_GUARD_FLOOR);
  });

  it("allows health/mental to drop below floor after guard window", () => {
    const result = applyCumulativeBalanceGuard(
      { health: 1, mental: 1 },
      { coreEventCount: CUMULATIVE_GUARD_EVENT_LIMIT + 1 },
    );
    expect(result.health).toBe(1);
    expect(result.mental).toBe(1);
  });

  it("prevents the five-consecutive-minus-one regression", () => {
    // Simulate 5 consecutive choices each applying -1 to mental
    let stats: Record<string, number> = { health: 6, mental: 6, academic: 5 };
    for (let i = 0; i < 5; i++) {
      stats = applyStatDeltas(stats, { mental: -1 }, { coreEventCount: i });
    }
    // After 5 consecutive -1 mental hits, mental should be at floor, not 1
    expect(stats.mental).toBe(CUMULATIVE_GUARD_FLOOR);
    expect(stats.mental).toBeGreaterThan(1);
  });

  it("preserves meaningful risk by allowing floor-level stats to trigger collapse warnings", () => {
    // At floor=2, a single -1 hit brings it to 1 which triggers collapseWarning
    const result = applyCumulativeBalanceGuard(
      { health: 2, mental: 5 },
      { coreEventCount: 3 },
    );
    expect(result.health).toBe(2);
    // A subsequent -1 delta would bring it to 1, triggering healthCollapseWarning
  });

  it("does not guard when coreEventCount is undefined", () => {
    const result = applyCumulativeBalanceGuard({ health: 1, mental: 1 });
    expect(result.health).toBe(1);
    expect(result.mental).toBe(1);
  });

  it("preserves other stats unchanged", () => {
    const result = applyCumulativeBalanceGuard(
      { health: 1, mental: 1, academic: 10, practical: 8, wealth: 100 },
      { coreEventCount: 2 },
    );
    expect(result.academic).toBe(10);
    expect(result.practical).toBe(8);
    expect(result.wealth).toBe(100);
  });
});
