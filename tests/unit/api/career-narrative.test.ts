import { describe, expect, it } from "vitest";

import {
  advanceCareerNarrativeState,
  careerEventKindForCount,
  careerPhaseForEventCount,
  normalizeCareerNarrativeState,
} from "@/lib/game/career-narrative";

describe("career narrative", () => {
  it("moves through five career phases across twenty-four events", () => {
    expect(careerPhaseForEventCount(0)).toBe("EXPLORATION");
    expect(careerPhaseForEventCount(6)).toBe("PREPARATION");
    expect(careerPhaseForEventCount(12)).toBe("EXPERIENCE");
    expect(careerPhaseForEventCount(18)).toBe("APPLICATION");
    expect(careerPhaseForEventCount(24)).toBe("CONVERGENCE");
  });

  it("keeps the intended career gate, linked, and life cadence over an 8-event modulo", () => {
    const kinds = Array.from({ length: 8 }, (_, index) => careerEventKindForCount(index));
    expect(kinds.filter((kind) => kind === "CAREER_GATE")).toHaveLength(3);
    expect(kinds.filter((kind) => kind === "CAREER_LINKED")).toHaveLength(3);
    expect(kinds.filter((kind) => kind === "LIFE")).toHaveLength(2);
  });

  it("distributes event kinds evenly across a 24-event run", () => {
    const kinds = Array.from({ length: 24 }, (_, index) => careerEventKindForCount(index));
    expect(kinds.filter((kind) => kind === "CAREER_GATE")).toHaveLength(9);
    expect(kinds.filter((kind) => kind === "CAREER_LINKED")).toHaveLength(9);
    expect(kinds.filter((kind) => kind === "LIFE")).toHaveLength(6);
  });

  it("assigns correct phase at each 24-event boundary", () => {
    expect(careerPhaseForEventCount(0)).toBe("EXPLORATION");
    expect(careerPhaseForEventCount(5)).toBe("EXPLORATION");
    expect(careerPhaseForEventCount(6)).toBe("PREPARATION");
    expect(careerPhaseForEventCount(11)).toBe("PREPARATION");
    expect(careerPhaseForEventCount(12)).toBe("EXPERIENCE");
    expect(careerPhaseForEventCount(17)).toBe("EXPERIENCE");
    expect(careerPhaseForEventCount(18)).toBe("APPLICATION");
    expect(careerPhaseForEventCount(23)).toBe("APPLICATION");
    expect(careerPhaseForEventCount(24)).toBe("CONVERGENCE");
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

  it("repeated cross-major evidence can override initial major affinity in rank", () => {
    // Major: 방사선학과 → initial top candidates are medical-device, clinical, health-tech (affinity 3)
    // content (의료·디지털 콘텐츠) starts with affinity 0 — a cross-major candidate
    // Repeated DIGITAL_CONTENT evidence is uniquely relevant to content ("온라인 창작", "사용자 이해")
    // and should eventually push content above the initially major-aligned candidates
    const state = normalizeCareerNarrativeState(null, { storySeed: "test-rank-override", major: "방사선학과", coreEventCount: 0 });

    // Record initial ranks
    const initialContentRank = state.candidates.findIndex((c) => c.id === "content");
    const initialMedDevRank = state.candidates.findIndex((c) => c.id === "medical-device");
    // content is not in initial 5 (it's unlocked by DIGITAL_CONTENT evidence)
    expect(initialContentRank).toBe(-1);
    expect(initialMedDevRank).toBe(0);

    // Apply DIGITAL_CONTENT evidence repeatedly — uniquely relevant to content
    let s = state;
    for (let i = 0; i < 6; i++) {
      s = advanceCareerNarrativeState(s, {
        eventTitle: "첫 버튜버 라이브",
        eventTags: ["온라인 창작", "콘텐츠"],
        choiceSummary: "당신은 방송을 이어가며 시청자의 질문을 설명했다.",
        statDelta: { practical: 2, reputation: 1 },
        nextCoreEventCount: 1,
      });
    }

    // content should now be ranked above medical-device
    const finalContentRank = s.candidates.findIndex((c) => c.id === "content");
    const finalMedDevRank = s.candidates.findIndex((c) => c.id === "medical-device");
    expect(finalContentRank).toBeGreaterThanOrEqual(0);
    expect(finalMedDevRank).toBeGreaterThanOrEqual(0);
    expect(finalContentRank).toBeLessThan(finalMedDevRank);
  });
});
