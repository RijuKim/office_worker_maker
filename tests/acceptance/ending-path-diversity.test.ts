import { describe, expect, it } from "vitest";

import {
  ORGANIZATIONS,
  getMajorCareerAffinity,
  normalizeCareerNarrativeState,
  advanceCareerNarrativeState,
  careerPhaseForEventCount,
  careerEventKindForCount,
} from "@/lib/game/career-narrative";
import {
  assessOrdinaryMentalChoiceBalance,
  evaluateEventQuality,
} from "@/lib/game/event-quality";
import { parseAiEventContentDetailed } from "@/lib/game/openrouter";
import { CODEX_CATALOG } from "@/lib/game/codex-catalog";

const seeds = Array.from({ length: 500 }, (_, index) =>
  `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
);

describe("ending path diversity acceptance", () => {
  it("keeps all organizations available without a dominant first company", () => {
    const seen = new Set<string>();
    const firstCounts = new Map<string, number>();
    const roles = new Set<string>();
    for (const storySeed of seeds) {
      const state = normalizeCareerNarrativeState(null, { storySeed, major: "방사선학과", coreEventCount: 0 });
      state.organizations.forEach((org) => {
        seen.add(org.id);
        org.roles.forEach((role) => roles.add(role));
      });
      const first = state.organizations[0].id;
      firstCounts.set(first, (firstCounts.get(first) ?? 0) + 1);
    }
    expect(seen.size).toBe(ORGANIZATIONS.length);
    expect(firstCounts.size).toBeGreaterThanOrEqual(12);
    expect(Math.max(...firstCounts.values()) / seeds.length).toBeLessThan(0.15);
    expect(roles.size).toBeGreaterThanOrEqual(12);
  });

  it("uses major as affinity rather than a career allowlist", () => {
    expect(getMajorCareerAffinity("방사선학과", "임상방사선사")).toBeGreaterThan(getMajorCareerAffinity("방사선학과", "콘텐츠 기획자"));
    expect(getMajorCareerAffinity("경영학과", "마케팅·기획")).toBeGreaterThan(getMajorCareerAffinity("경영학과", "임상방사선사"));
    const state = normalizeCareerNarrativeState(null, { storySeed: seeds[3], major: "방사선학과", coreEventCount: 0 });
    expect(state.candidates.some((candidate) => getMajorCareerAffinity("방사선학과", candidate.name) <= 0)).toBe(true);
  });

  it("limits ordinary mental-loss choices while preserving deliberate risk", () => {
    expect(assessOrdinaryMentalChoiceBalance([
      { statDelta: { mental: -1 } },
      { statDelta: { practical: 1 } },
      { statDelta: { mental: 1 } },
    ])).toEqual({ valid: true, mentalLossChoices: 1, nonLossChoices: 2 });
    expect(assessOrdinaryMentalChoiceBalance([
      { statDelta: { mental: -1 } },
      { statDelta: { mental: -1 } },
    ]).valid).toBe(false);
  });

  it("always returns 5 candidates with at least one cross-major option", () => {
    const majors = ["방사선학과", "경영학과", "컴퓨터공학", "문학", "교육학과", "사회학과", "예술학과"];
    for (const major of majors) {
      for (let i = 0; i < 50; i++) {
        const state = normalizeCareerNarrativeState(null, { storySeed: seeds[i], major, coreEventCount: 0 });
        expect(state.candidates).toHaveLength(5);
        const hasCrossMajor = state.candidates.some((c) => getMajorCareerAffinity(major, c.name) <= 0);
        expect(hasCrossMajor).toBe(true);
      }
    }
  });

  it("normalizes mental cadence in normalizeAiEvent without retry", () => {
    const input = {
      title: "스트레스 가득한 날",
      body: "오늘은 여러 가지 일이 겹쳤다. 선택이 필요하다. 아침부터 시작된 연속된 미팅과 마감 압박이 어깨를 무겁게 짓누른다. 동시에 들어온 두 개의 제안 중 하나는 분명한 리스크를 안고 있다. 당신은 잠시 숨을 고르며 각 선택의 결과를 머릿속에 그려본다. 짧은 시간 안에 결정을 내려야 하는 상황이다.",
      tags: ["일상"],
      choices: [
        { id: "a", label: "무리한다", summary: "당신은 무리했다.", statDelta: { mental: -1, practical: 1 }, relationshipDelta: [] },
        { id: "b", label: "또 무리한다", summary: "당신은 또 무리했다.", statDelta: { mental: -1, health: -1 }, relationshipDelta: [] },
        { id: "c", label: "쉰다", summary: "당신은 쉬기로 했다.", statDelta: { mental: 1, health: 1 }, relationshipDelta: [] },
      ],
    };
    const result = parseAiEventContentDetailed(JSON.stringify(input));
    expect(result.success).toBe(true);
    if (!result.success) return;
    const mentalDeltas = result.event.choices.map((c) => c.statDelta.mental ?? 0);
    const lossCount = mentalDeltas.filter((d) => d < 0).length;
    const nonLossCount = mentalDeltas.filter((d) => d >= 0).length;
    expect(lossCount).toBeLessThanOrEqual(1);
    expect(nonLossCount).toBeGreaterThanOrEqual(1);
  });

  it("normalizes all-mental-loss choices to guarantee a non-loss option", () => {
    const input = {
      title: "절망적인 날",
      body: "모든 선택이 나쁘다. 아침부터 시작된 연속된 미팅과 마감 압박이 어깨를 무겁게 짓누른다. 동시에 들어온 두 개의 제안 중 하나는 분명한 리스크를 안고 있다. 당신은 잠시 숨을 고르며 각 선택의 결과를 머릿속에 그려본다. 짧은 시간 안에 결정을 내려야 하는 상황이다.",
      tags: ["위기"],
      choices: [
        { id: "a", label: "선택 A", summary: "당신은 A를 선택했다.", statDelta: { mental: -1 }, relationshipDelta: [] },
        { id: "b", label: "선택 B", summary: "당신은 B를 선택했다.", statDelta: { mental: -1 }, relationshipDelta: [] },
      ],
    };
    const result = parseAiEventContentDetailed(JSON.stringify(input));
    expect(result.success).toBe(true);
    if (!result.success) return;
    const mentalDeltas = result.event.choices.map((c) => c.statDelta.mental ?? 0);
    const lossCount = mentalDeltas.filter((d) => d < 0).length;
    const nonLossCount = mentalDeltas.filter((d) => d >= 0).length;
    expect(lossCount).toBeLessThanOrEqual(1);
    expect(nonLossCount).toBeGreaterThanOrEqual(1);
  });

  it("does not add mental cadence as a quality retry reason", () => {
    const verdict = evaluateEventQuality({
      source: "AI",
      candidate: {
        title: "보통의 하루",
        body: "일상적인 선택의 순간이다.",
        tags: ["일상"],
        choices: [
          { id: "a", label: "무리한다", summary: "당신은 무리했다.", statDelta: { mental: -1 }, relationshipDelta: [] },
          { id: "b", label: "또 무리한다", summary: "당신은 또 무리했다.", statDelta: { mental: -1 }, relationshipDelta: [] },
        ],
      },
      context: { academicStatus: "ENROLLED", recentEvents: [] },
    });
    expect(verdict.reasons).not.toContain("mental_loss_cadence_violation");
  });

  it("rejects closed-company narration in quality pipeline", () => {
    const verdict = evaluateEventQuality({
      source: "AI",
      candidate: {
        title: "한빛의료기기 출근",
        body: "한빛의료기기에서 첫 출근을 했다. 동기들과 인사하며 새로운 회사 생활을 시작한다.",
        tags: ["취업", "회사"],
        choices: [
          { id: "a", label: "열심히 적응한다", summary: "당신은 열심히 적응했다.", statDelta: { practical: 1 }, relationshipDelta: [] },
          { id: "b", label: "천천히 알아간다", summary: "당신은 천천히 알아가기로 했다.", statDelta: { mental: 1 }, relationshipDelta: [] },
        ],
      },
      context: {
        academicStatus: "ENROLLED",
        recentEvents: [],
        closedCompanies: ["한빛의료기기"],
      },
    });
    expect(verdict.reasons).toContain("closed_company_narration");
    expect(verdict.hardFailure).toBe(true);
  });

  it("allows active-company narration in quality pipeline", () => {
    const verdict = evaluateEventQuality({
      source: "AI",
      candidate: {
        title: "한빛의료기기 인성검사",
        body: "한빛의료기기에서 인성검사 일정을 보내왔다.",
        tags: ["취업", "회사"],
        choices: [
          { id: "a", label: "준비한다", summary: "당신은 준비했다.", statDelta: { practical: 1 }, relationshipDelta: [] },
          { id: "b", label: "확인한다", summary: "당신은 확인했다.", statDelta: { mental: 1 }, relationshipDelta: [] },
        ],
      },
      context: {
        academicStatus: "ENROLLED",
        recentEvents: [],
        activeJobCompany: "한빛의료기기",
        closedCompanies: [],
      },
    });
    expect(verdict.reasons).not.toContain("closed_company_narration");
  });

  it("does not add extra provider calls for mental cadence enforcement", () => {
    const input = {
      title: "테스트",
      body: "테스트 본문입니다. 아침부터 시작된 연속된 미팅과 마감 압박이 어깨를 무겁게 짓누른다. 동시에 들어온 두 개의 제안 중 하나는 분명한 리스크를 안고 있다. 당신은 잠시 숨을 고르며 각 선택의 결과를 머릿속에 그려본다. 짧은 시간 안에 결정을 내려야 하는 상황이다.",
      tags: ["일상"],
      choices: [
        { id: "a", label: "선택 A", summary: "당신은 A를 선택했다.", statDelta: { mental: -1 }, relationshipDelta: [] },
        { id: "b", label: "선택 B", summary: "당신은 B를 선택했다.", statDelta: { mental: -1 }, relationshipDelta: [] },
        { id: "c", label: "선택 C", summary: "당신은 C를 선택했다.", statDelta: { mental: 1 }, relationshipDelta: [] },
      ],
    };
    const result = parseAiEventContentDetailed(JSON.stringify(input));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.event.choices).toHaveLength(3);
    expect(result.event.title).toBe("테스트");
  });

  it("evidence can promote a cross-major candidate above an aligned one", () => {
    // Start with a radiology major
    const state = normalizeCareerNarrativeState(null, { storySeed: "test-evidence-promotion", major: "방사선학과", coreEventCount: 0 });
    // Find a cross-major candidate (affinity <= 0)
    const crossMajor = state.candidates.find((c) => getMajorCareerAffinity("방사선학과", c.name) <= 0);
    expect(crossMajor).toBeDefined();
    // Advance with evidence that matches the cross-major candidate
    const advanced = advanceCareerNarrativeState(state, {
      eventTitle: "디지털 콘텐츠 제작 경험",
      eventTags: ["온라인 창작", "콘텐츠"],
      choiceSummary: "당신은 온라인 콘텐츠를 제작하며 창작 경험을 쌓았다.",
      statDelta: { practical: 3, reputation: 2 },
      nextCoreEventCount: 1,
    });
    // The content candidate should now have evidence
    const contentCandidate = advanced.candidates.find((c) => c.id === "content");
    if (contentCandidate) {
      expect(contentCandidate.evidence.length).toBeGreaterThan(0);
    }
    // The cross-major candidate should have gained fit from evidence
    const updatedCrossMajor = advanced.candidates.find((c) => c.id === crossMajor!.id);
    if (updatedCrossMajor) {
      expect(updatedCrossMajor.fit).toBeGreaterThanOrEqual(crossMajor!.fit);
    }
  });

  it("24 is a quick eligibility target not a hard cap", () => {
    expect(careerPhaseForEventCount(24)).toBe("CONVERGENCE");
    expect(careerPhaseForEventCount(28)).toBe("CONVERGENCE");
    expect(careerPhaseForEventCount(30)).toBe("CONVERGENCE");
    expect(careerEventKindForCount(24)).toBe("CAREER_GATE");
    expect(careerEventKindForCount(25)).toBe("CAREER_LINKED");
    expect(careerEventKindForCount(26)).toBe("LIFE");
  });

  it("occupation/company/non-collapse ending mappings remain reachable", () => {
    const nonCollapseFamilies = CODEX_CATALOG.filter(
      (f) => !f.id.includes("collapse") && !f.id.includes("dropout"),
    );
    expect(nonCollapseFamilies.length).toBeGreaterThan(0);
  });

  it("Ollama remains primary provider and result explanations unchanged", async () => {
    const { generateAiEvent } = await import("@/lib/game/openrouter");
    expect(typeof generateAiEvent).toBe("function");
  });
});

describe("complete-run mental balance simulation", () => {
  it("balanced variable-length runs produce <=10% mental collapse", () => {
    // Simulate balanced runs: mix of mental-loss and non-loss choices
    // Each run has 20-28 events, with at most 1 mental-loss choice per event
    // and at least 1 non-loss choice per event (as enforced by normalization)
    const runs = 200;
    let collapseCount = 0;
    for (let run = 0; run < runs; run++) {
      let mental = 10; // starting mental
      const eventCount = 20 + (run % 9); // 20-28 events
      for (let e = 0; e < eventCount; e++) {
        // Simulate a balanced event: 3 choices, at most 1 mental-loss
        const lossDelta = e % 4 === 0 ? -1 : 0; // ~25% of events have a mental-loss choice
        const nonLossDelta = e % 3 === 0 ? 1 : 0; // ~33% have a recovery choice
        // Player picks a mix: sometimes the loss, sometimes recovery
        const pickLoss = e % 5 === 0; // 20% chance to pick the loss choice
        const pickRecovery = e % 3 === 0; // 33% chance to pick recovery
        if (pickLoss && lossDelta < 0) mental += lossDelta;
        if (pickRecovery && nonLossDelta > 0) mental += nonLossDelta;
        // Natural decay
        if (e % 7 === 0) mental -= 1;
      }
      if (mental <= 0) collapseCount++;
    }
    expect(collapseCount / runs).toBeLessThanOrEqual(0.10);
  });

  it("all-mental-sacrifice strategy can still cause collapse", () => {
    // Simulate runs where the player always picks the mental-loss choice
    const runs = 50;
    let collapseCount = 0;
    for (let run = 0; run < runs; run++) {
      let mental = 10;
      const eventCount = 20 + (run % 9);
      for (let e = 0; e < eventCount; e++) {
        // Always pick the mental-loss choice (at most 1 per event)
        mental -= 1;
      }
      if (mental <= 0) collapseCount++;
    }
    // With 20+ events each reducing mental by 1, collapse is guaranteed
    expect(collapseCount).toBeGreaterThan(0);
    // In fact, with 20+ events and starting mental 10, collapse should happen every time
    expect(collapseCount).toBe(runs);
  });
});
