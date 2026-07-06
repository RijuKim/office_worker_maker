import { describe, expect, it } from "vitest";

import {
  applyFlagDeltas,
  applyRelationshipDeltas,
  applyStatDeltas,
  checkForcedEvent,
  clampPublicStat,
  clampTrust,
  validateChoiceIndex,
} from "@/lib/game/game-rules";

describe("clampPublicStat", () => {
  it("clamps values within 0-100", () => {
    expect(clampPublicStat(50)).toBe(50);
    expect(clampPublicStat(-5)).toBe(0);
    expect(clampPublicStat(105)).toBe(100);
    expect(clampPublicStat(0)).toBe(0);
    expect(clampPublicStat(100)).toBe(100);
  });
});

describe("clampTrust", () => {
  it("clamps trust within 0-100", () => {
    expect(clampTrust(50)).toBe(50);
    expect(clampTrust(-10)).toBe(0);
    expect(clampTrust(150)).toBe(100);
  });
});

describe("applyStatDeltas", () => {
  it("applies deltas within bounds", () => {
    const result = applyStatDeltas({ academic: 50, health: 60 }, { academic: 10, health: -5 });
    expect(result.academic).toBe(60);
    expect(result.health).toBe(55);
  });

  it("clamps deltas to max 15 per choice", () => {
    const result = applyStatDeltas({ academic: 50 }, { academic: 99 });
    expect(result.academic).toBe(65);
  });

  it("clamps result to 0-100", () => {
    const result = applyStatDeltas({ academic: 95 }, { academic: 10 });
    expect(result.academic).toBe(100);
  });

  it("preserves unmodified stats", () => {
    const result = applyStatDeltas({ academic: 50, charm: 30, health: 70 }, { academic: 5 });
    expect(result.charm).toBe(30);
    expect(result.health).toBe(70);
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
  it("returns burnout when risk >= 85", () => {
    expect(checkForcedEvent({ burnoutRisk: 90 })).toEqual({ type: "burnout" });
  });

  it("returns null when risk < 85", () => {
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