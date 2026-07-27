import { describe, expect, it } from "vitest";

import {
  advanceCareerNarrativeState,
  careerEventKindForCount,
  careerPhaseForEventCount,
  normalizeCareerNarrativeState,
} from "@/lib/game/career-narrative";

describe("career narrative", () => {
  it("moves through five career phases across forty events", () => {
    expect(careerPhaseForEventCount(0)).toBe("EXPLORATION");
    expect(careerPhaseForEventCount(8)).toBe("PREPARATION");
    expect(careerPhaseForEventCount(16)).toBe("EXPERIENCE");
    expect(careerPhaseForEventCount(24)).toBe("APPLICATION");
    expect(careerPhaseForEventCount(32)).toBe("CONVERGENCE");
  });

  it("keeps the intended career gate, linked, and life cadence", () => {
    const kinds = Array.from({ length: 8 }, (_, index) => careerEventKindForCount(index));
    expect(kinds.filter((kind) => kind === "CAREER_GATE")).toHaveLength(3);
    expect(kinds.filter((kind) => kind === "CAREER_LINKED")).toHaveLength(3);
    expect(kinds.filter((kind) => kind === "LIFE")).toHaveLength(2);
  });

  it("creates a stable organization and career pool per character", () => {
    const first = normalizeCareerNarrativeState(null, { storySeed: "run-a", major: "방사선학과", coreEventCount: 0 });
    const same = normalizeCareerNarrativeState(null, { storySeed: "run-a", major: "방사선학과", coreEventCount: 0 });
    expect(first.organizations).toEqual(same.organizations);
    expect(first.organizations).toHaveLength(8);
    expect(first.candidates).toHaveLength(5);
    expect(first.candidates.some((candidate) => candidate.id === "clinical")).toBe(true);
  });

  it("turns leisure choices into reusable career evidence", () => {
    const state = normalizeCareerNarrativeState(null, { storySeed: "run-b", major: "방사선학과", coreEventCount: 10 });
    const next = advanceCareerNarrativeState(state, {
      eventTitle: "첫 버튜버 라이브",
      eventTags: ["온라인 창작", "콘텐츠"],
      choiceSummary: "당신은 방송을 이어가며 시청자의 질문을 설명했다.",
      statDelta: { practical: 2, reputation: 1 },
      nextCoreEventCount: 11,
    });
    expect(next.evidence.some((evidence) => evidence.type === "DIGITAL_CONTENT")).toBe(true);
    expect(next.candidates.some((candidate) => candidate.id === "content" && candidate.evidence.length > 0)).toBe(true);
  });
});
