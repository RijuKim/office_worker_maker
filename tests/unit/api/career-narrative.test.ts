import { describe, expect, it } from "vitest";

import {
  advanceCareerNarrativeState,
  careerEventKindForCount,
  careerPhaseForEventCount,
  normalizeCareerNarrativeState,
  ORGANIZATIONS,
  summarizeCareerNarrativeForPrompt,
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

  it("gives education majors education careers and organizations instead of a medical roster", () => {
    const state = normalizeCareerNarrativeState(null, { storySeed: "education-run", major: "교육학과", coreEventCount: 0 });
    expect(state.organizations).toHaveLength(8);
    expect(state.organizations.every((organization) => organization.majorFamilies?.includes("education"))).toBe(true);
    expect(state.organizations.some((organization) => organization.id === "celltrium")).toBe(false);
    expect(state.candidates.slice(0, 4).filter((candidate) =>
      ["teacher", "education-admin", "edtech", "counseling"].includes(candidate.id),
    ).length).toBeGreaterThanOrEqual(3);
  });

  it("repairs a legacy education career pool on the next normalization", () => {
    const legacy = normalizeCareerNarrativeState(null, { storySeed: "legacy-source", major: "방사선학과", coreEventCount: 7 });
    const repaired = normalizeCareerNarrativeState(legacy, { storySeed: "legacy-source", major: "교육학과", coreEventCount: 7 });
    expect(repaired.organizations.every((organization) => organization.majorFamilies?.includes("education"))).toBe(true);
    expect(repaired.candidates.filter((candidate) => ["teacher", "education-admin", "edtech", "counseling"].includes(candidate.id)).length).toBeGreaterThanOrEqual(3);
  });

  it("keeps an explicitly committed cross-major organization during legacy repair", () => {
    const legacy = normalizeCareerNarrativeState(null, { storySeed: "committed-source", major: "방사선학과", coreEventCount: 8 });
    const celltrium = ORGANIZATION_BY_ID(ORGANIZATIONS, "celltrium");
    const raw = { ...legacy, organizations: [celltrium, ...legacy.organizations.filter((item) => item.id !== "celltrium")].slice(0, 8), lastGate: "셀트리움 인턴십 지원" };
    const repaired = normalizeCareerNarrativeState(raw, { storySeed: "committed-source", major: "교육학과", coreEventCount: 8 });
    expect(repaired.organizations.some((organization) => organization.id === "celltrium")).toBe(true);
  });

  it("records a rejected organization and removes it from the next AI prompt", () => {
    const state = normalizeCareerNarrativeState(null, { storySeed: "rejection-run", major: "교육학과", coreEventCount: 3 });
    const organization = state.organizations[0];
    const next = advanceCareerNarrativeState(state, {
      eventTitle: `${organization.name} 인턴십 제안`,
      eventTags: ["진로"],
      choiceSummary: "당신은 지원하지 않고 다른 기관의 정보를 수집하며 더 알아보기로 했다.",
      statDelta: { academic: 1 },
      nextCoreEventCount: 4,
      major: "교육학과",
    });
    expect(next.missedOpportunities).toContain(organization.name);
    expect(summarizeCareerNarrativeForPrompt(next).organizations.some((item) => item.name === organization.name)).toBe(false);
  });

  it("does not turn a generic education-major internship into medical affinity", () => {
    const state = normalizeCareerNarrativeState(null, { storySeed: "education-intern", major: "교육학과", coreEventCount: 4 });
    const withMedicalCandidate = {
      ...state,
      candidates: [...state.candidates.slice(0, 4), { id: "clinical", name: "병원·임상 전문가", interest: 30, fit: 25, evidence: [] }],
    };
    const next = advanceCareerNarrativeState(withMedicalCandidate, {
      eventTitle: "교육기관 인턴 첫날",
      eventTags: ["인턴", "현장"],
      choiceSummary: "당신은 교육 프로그램 운영을 도왔다.",
      statDelta: { practical: 1 },
      nextCoreEventCount: 5,
      major: "교육학과",
    });
    expect(next.candidates.find((candidate) => candidate.id === "clinical")).toMatchObject({ fit: 25, interest: 30, evidence: [] });
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
    // Candidate-pool expansion may include content initially; it must remain
    // able to overtake an initially aligned path through repeated evidence.
    expect(initialContentRank).toBeGreaterThanOrEqual(0);
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

function ORGANIZATION_BY_ID<T extends { id: string }>(organizations: T[], id: string): T {
  const organization = organizations.find((item) => item.id === id);
  if (!organization) throw new Error(`missing organization: ${id}`);
  return organization;
}
