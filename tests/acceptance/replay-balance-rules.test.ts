import { describe, expect, it } from "vitest";

import { shouldCreateFinalEnding } from "@/lib/game/ending-rules";
import {
  CORE_EVENTS_PER_SEMESTER,
  applyLifeStageTransition,
  deriveLifeStageState,
  requiresExtraSemester,
} from "@/lib/game/life-stage";
import { buildUserPrompt, parseAiEventContentDetailed } from "@/lib/game/openrouter";

const gradeFourState = deriveLifeStageState({
  currentGradeYear: 4,
  academicStatus: "ENROLLED",
  coreEventCount: 21,
  eventFlags: {
    lifeStage: { id: "college_late" },
    academicTerm: { gradeYear: 4, semester: 2 },
    stageEventCount: 2,
  },
});

describe("replay balance acceptance", () => {
  it("advances a semester every three committed core events", () => {
    expect(CORE_EVENTS_PER_SEMESTER).toBe(3);
    const result = applyLifeStageTransition({
      currentGradeYear: 1,
      academicStatus: "ENROLLED",
      coreEventCount: 2,
      eventFlags: {
        lifeStage: { id: "college_early" },
        academicTerm: { gradeYear: 1, semester: 1 },
        stageEventCount: 2,
      },
      stats: { academic: 5, practical: 5, health: 6, mental: 6, reputation: 5 },
      burnoutRisk: 10,
    });
    expect(result.state.term.label).toBe("1학년 2학기");
    expect(result.state.stageEventCount).toBe(0);
  });

  it("opens normal endings at 20 and guarantees an eligible fallback by 24", () => {
    expect(shouldCreateFinalEnding({ coreEventCount: 19, lifeStage: "post_graduation", graduation: "graduated" })).toBe(false);
    expect(shouldCreateFinalEnding({ coreEventCount: 20, lifeStage: "post_graduation", graduation: "graduated" })).toBe(true);
    expect(shouldCreateFinalEnding({ coreEventCount: 23, lifeStage: "college_late", graduation: "normal" })).toBe(false);
    expect(shouldCreateFinalEnding({ coreEventCount: 24, lifeStage: "college_late", graduation: "normal" })).toBe(true);
  });

  it("requires extra semester when both academic and practical are <=4; preserves explicit blockers", () => {
    // Both <=4 triggers extra semester
    expect(requiresExtraSemester(gradeFourState, { academic: 4, practical: 4 }, {})).toBe(true);
    expect(requiresExtraSemester(gradeFourState, { academic: 3, practical: 4 }, {})).toBe(true);
    // One stat >4 while other is low does NOT trigger
    expect(requiresExtraSemester(gradeFourState, { academic: 3, practical: 7 }, {})).toBe(false);
    // Both >4 does NOT trigger
    expect(requiresExtraSemester(gradeFourState, { academic: 5, practical: 5 }, {})).toBe(false);
    // Explicit blocker still forces extra semester regardless of scores
    expect(requiresExtraSemester(gradeFourState, { academic: 8, practical: 8 }, {
      graduation: { requirementsPending: true },
    })).toBe(true);
  });

  it("rejects a generated event with four choices", () => {
    const choices = Array.from({ length: 4 }, (_, index) => ({
      id: `choice-${index}`,
      label: `선택 ${index}`,
      summary: `당신은 선택 ${index}을 했다.`,
      statDelta: {},
      relationshipDelta: [],
    }));
    const parsed = parseAiEventContentDetailed(JSON.stringify({
      title: "네 번째 선택",
      body: "당신은 선택지가 너무 많은 상황을 마주했다. 충분한 맥락을 읽은 뒤 무엇을 남길지 결정해야 한다. 이야기는 짧지만 선택의 결과는 이어진다.",
      choices,
      tags: ["선택"],
    }));
    expect(parsed.success).toBe(false);
  });

  it("calculates AI story pacing against a 24-event run", () => {
    const prompt = buildUserPrompt({
      name: "민지",
      major: "사회학",
      gradeYear: 1,
      age: 20,
      coreEventCount: 5,
      recentSummaries: [],
      usedEventTitles: [],
      stats: {},
      relationships: [],
      storyArc: {},
    });
    expect(prompt).toContain("학기=1학년/8");
    expect(prompt).toContain("사건=5");
    expect(prompt).toContain("가이드=전개:");
  });
});
