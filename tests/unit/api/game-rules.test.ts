import { describe, expect, it } from "vitest";

import {
  applyFlagDeltas,
  applyRelationshipDeltas,
  applyStatDeltas,
  checkForcedEvent,
  clampPublicStat,
  clampTrust,
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

  it("limits health loss to one point per choice", () => {
    const result = applyStatDeltas({ health: 8, mental: 8 }, { health: -5, mental: -5 });
    expect(result.health).toBe(7);
    expect(result.mental).toBe(5);
  });
});

describe("normalizeStatDeltas", () => {
  it("caps health loss while preserving other deltas", () => {
    expect(normalizeStatDeltas({ health: -5, mental: -4, academic: 2 })).toEqual({
      health: -1,
      mental: -4,
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
