import { describe, expect, it } from "vitest";

import {
  getDestinationCandidatesForEnding,
  synthesizeDestination,
  synthesizeFallbackCareerPath,
} from "@/lib/game/destination-synthesis";

describe("synthesizeFallbackCareerPath", () => {
  it("returns a career path based on high academic stats", () => {
    const result = synthesizeFallbackCareerPath({ academic: 9, practical: 5, health: 6, mental: 7, wealth: 4, reputation: 5, charm: 3 });
    expect(result.destinationName).toBeNull();
    expect(result.jobRole).toBeNull();
    expect(result.salaryBand).toBeNull();
    expect(result.careerPath).toContain("전문직");
  });

  it("returns a career path based on high charm and mental", () => {
    const result = synthesizeFallbackCareerPath({ academic: 4, practical: 4, health: 5, mental: 7, wealth: 3, reputation: 4, charm: 9 });
    expect(result.careerPath).toContain("연애");
  });

  it("returns a generic path for average stats", () => {
    const result = synthesizeFallbackCareerPath({ academic: 5, practical: 5, health: 5, mental: 5, wealth: 5, reputation: 5, charm: 5 });
    expect(result.careerPath).toBeTruthy();
    expect(result.destinationName).toBeNull();
  });
});

describe("getDestinationCandidatesForEnding", () => {
  it("returns gate_passed candidates from hidden state", () => {
    const hiddenState = {
      eventFlags: {
        destinationCandidates: [
          { id: "career-company", kind: "company", name: "다람소프트", introducedBy: "career-gate-event", status: "gate_passed" },
          { id: "career-startup", kind: "startup", name: "새싹엔진 캠프", introducedBy: "career-gate-event", status: "gate_failed" },
        ],
      },
    };

    const result = getDestinationCandidatesForEnding(hiddenState);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("career-company");
  });

  it("returns empty array when no gate_passed candidates", () => {
    const hiddenState = {
      eventFlags: {
        destinationCandidates: [
          { id: "career-company", kind: "company", name: "다람소프트", introducedBy: "career-gate-event", status: "gate_failed" },
        ],
      },
    };

    const result = getDestinationCandidatesForEnding(hiddenState);
    expect(result).toHaveLength(0);
  });

  it("returns empty array when no candidates exist", () => {
    const hiddenState = { eventFlags: {} };
    const result = getDestinationCandidatesForEnding(hiddenState);
    expect(result).toEqual([]);
  });
});

describe("synthesizeDestination", () => {
  it("falls back to stat-based path when no candidates passed", () => {
    const result = synthesizeDestination([], { academic: 9, practical: 5, health: 6, mental: 7, wealth: 4, reputation: 5, charm: 3 });
    expect(result.destinationName).toBeNull();
    expect(result.careerPath).toBeTruthy();
  });

  it("returns synthesized destination from passed candidates", () => {
    const candidates = [
      { id: "career-company", kind: "company" as const, name: "다람소프트", introducedBy: "career-gate-event", status: "gate_passed" as const },
    ];

    const result = synthesizeDestination(candidates, { academic: 7, practical: 8, health: 6, mental: 6, wealth: 5, reputation: 7, charm: 5 });
    expect(result.destinationName).toBeTruthy();
    expect(result.careerPath).toBeTruthy();
  });
});
