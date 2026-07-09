import { describe, expect, it } from "vitest";

import { buildAiRetryGuidance, findValidatedStaticFallback } from "@/lib/game/event-quality-policy";
import { evaluateEventQuality } from "@/lib/game/event-quality";
import type { EventSelectionContext } from "@/lib/game/event-engine";

const selectionContext: EventSelectionContext = {
  burnoutRisk: 0,
  coreEventCount: 3,
  age: 21,
  gradeYear: 1,
  eventFlags: {},
  lifeStage: "college_early",
};

describe("event quality route policy", () => {
  it("selects a validated static fallback when the preferred candidate fails hard validation", () => {
    const fallback = findValidatedStaticFallback({
      preferredEvent: {
        title: "서류 결과 조작",
        body: "면접관이 학점 10과 네트워크 3을 그대로 말한다.",
        tags: ["취업"],
        choices: [
          {
            id: "pass",
            label: "서류 합격을 선택한다.",
            summary: "당신은 결과를 직접 골랐다.",
            statDelta: { reputation: 1 },
            relationshipDelta: [],
            flagDelta: {},
          },
          {
            id: "fail",
            label: "불합격한다.",
            summary: "당신은 결과를 직접 골랐다.",
            statDelta: { mental: 1 },
            relationshipDelta: [],
            flagDelta: {},
          },
        ],
      },
      selectionContext,
      excludedEventTitles: [],
      qualityContext: {
        academicStatus: "ENROLLED",
        lifeStage: "college_early",
        eventFlags: {},
        recentEvents: [],
        recentSummaries: [],
      },
    });

    expect(fallback).not.toBeNull();
    expect(fallback?.evaluation.verdict.status).toBe("pass");
    expect(fallback?.event.source).toBe("FALLBACK");
  });

  it("prefers the dropout-safe fallback for dropped-out characters", () => {
    const fallback = findValidatedStaticFallback({
      preferredEvent: {
        title: "전공 강의 복귀",
        body: "자퇴한 뒤 평소처럼 강의실에 출석해 이번 학기 전공 과제를 낸다.",
        tags: ["학업", "강의"],
        choices: [
          {
            id: "attend",
            label: "강의실로 들어간다.",
            summary: "당신은 강의실로 향했다.",
            statDelta: { academic: 1 },
            relationshipDelta: [],
            flagDelta: {},
          },
          {
            id: "submit",
            label: "과제를 제출한다.",
            summary: "당신은 과제를 냈다.",
            statDelta: { reputation: 1 },
            relationshipDelta: [],
            flagDelta: {},
          },
        ],
      },
      selectionContext,
      excludedEventTitles: [],
      qualityContext: {
        academicStatus: "DROPPED_OUT",
        lifeStage: "dropout",
        eventFlags: {},
        recentEvents: [],
        recentSummaries: [],
      },
    });

    expect(fallback?.event.title).toBe("학교 밖에서 다시 짜는 하루");
    expect(fallback?.evaluation.verdict.status).toBe("pass");
  });

  it("builds retry guidance from validator reasons and score", () => {
    const verdict = evaluateEventQuality({
      source: "AI",
      candidate: {
        title: "결과 버튼",
        body: "지원 결과를 직접 고르는 장면이다.",
        tags: ["취업"],
        choices: [
          {
            id: "pass",
            label: "합격한다.",
            summary: "당신은 합격을 골랐다.",
            statDelta: { reputation: 1 },
            relationshipDelta: [],
          },
          {
            id: "wait",
            label: "결과를 기다린다.",
            summary: "당신은 결과를 기다렸다.",
            statDelta: { mental: 1 },
            relationshipDelta: [],
          },
        ],
      },
      context: { academicStatus: "ENROLLED", recentEvents: [] },
    });

    const guidance = buildAiRetryGuidance(verdict);

    expect(guidance).toContain("direct_result_choice");
    expect(guidance).toContain(`diversityScore=${verdict.diversityScore}`);
  });
});
