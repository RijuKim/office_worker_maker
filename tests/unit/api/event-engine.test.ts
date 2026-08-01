import { describe, expect, it } from "vitest";

import { normalizeStatDeltas } from "@/lib/game/game-rules";
import { buildBurnoutEvent, CONDITIONAL_STATIC_EVENTS, getStoryArc, isEventAllowedForLifeStage, personalizeEvent, pickRandomStaticEvent, selectNextEvent, STATIC_EVENTS } from "@/lib/game/event-engine";

describe("STATIC_EVENTS", () => {
  it("replaces legacy player-name placeholders with the configured name", () => {
    const event = personalizeEvent({
      title: "00의 하루",
      body: "선배가 00와 ㅇㅇ, ○○, OO를 불렀다.",
      choices: [{
        id: "answer",
        label: "00가 답한다.",
        summary: "00는 대답했다.",
        statDelta: {},
        relationshipDelta: [],
        flagDelta: {},
      }],
      tags: ["일상"],
      source: "FALLBACK",
    }, "한서윤");

    expect(event.title).toBe("한서윤의 하루");
    expect(event.body).toBe("선배가 한서윤와 한서윤, 한서윤, 한서윤를 불렀다.");
    expect(event.choices[0].label).toBe("한서윤가 답한다.");
    expect(event.choices[0].summary).toBe("한서윤는 대답했다.");
  });

  it("has events with valid structure", () => {
    for (const event of STATIC_EVENTS) {
      expect(event.title).toBeTruthy();
      expect(event.body).toBeTruthy();
      expect(event.choices.length).toBeGreaterThanOrEqual(2);
      expect(event.choices.length).toBeLessThanOrEqual(3);
      expect(event.tags.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("caps mental loss for every fixed event choice at application time", () => {
    for (const event of [...STATIC_EVENTS, ...CONDITIONAL_STATIC_EVENTS]) {
      for (const choice of event.choices) {
        const mental = normalizeStatDeltas(choice.statDelta).mental ?? 0;
        expect(mental, `${event.title}/${choice.id}`).toBeGreaterThanOrEqual(-1);
      }
    }
  });
});

describe("pickRandomStaticEvent", () => {
  it("returns a valid event", () => {
    const event = pickRandomStaticEvent();
    expect(event.title).toBeTruthy();
    expect(event.choices.length).toBeGreaterThanOrEqual(2);
  });

  it("can exclude specific titles", () => {
    const event = pickRandomStaticEvent(["중간고사 시즌"]);
    expect(event).toBeDefined();
    expect(event.title).not.toBe("중간고사 시즌");
  });

  it("can pick a follow-up event from previous choices and living conditions", () => {
    const event = pickRandomStaticEvent([], {
      burnoutRisk: 10,
      coreEventCount: 4,
      residence: "studio",
      eventFlags: { partTimeJob: "extra_shift" },
      stats: { health: 5, mental: 5, wealth: 4 },
      relationships: [],
    });

    expect(["새벽 알바 이후의 낮 수업", "자취방 월세 고지서"]).toContain(event.title);
  });

  it("prioritizes a career gate before final career results", () => {
    const event = pickRandomStaticEvent([], {
      burnoutRisk: 10,
      coreEventCount: 20,
      gradeYear: 4,
      eventFlags: {},
      stats: { academic: 8, practical: 7, reputation: 6, health: 6, mental: 6 },
      relationships: [],
    });

    expect([
      "전문직 1차 시험장",
      "패러디 기업 최종 면접",
      "공공안전 직무 체력·면접 전형",
      "졸업 전 마지막 지원서",
    ]).toContain(event.title);
  });

  it("does not ban a certification event solely because the major is education", () => {
    expect(isEventAllowedForLifeStage(
      STATIC_EVENTS.find((event) => event.title === "자격증 시험")!,
      { burnoutRisk: 0, major: "교육학과", lifeStage: "college_mid", eventFlags: {} },
    )).toBe(true);
  });

  it("blocks late career gates during early college even when stats are high", () => {
    const event = pickRandomStaticEvent([], {
      burnoutRisk: 10,
      coreEventCount: 20,
      gradeYear: 1,
      lifeStage: "college_early",
      graduation: "normal",
      eventFlags: {},
      stats: { academic: 9, practical: 9, reputation: 9, health: 9, mental: 9 },
      relationships: [],
      academicPlan: {
        major: "컴퓨터공학과",
        majorChanged: false,
        doubleMajor: null,
        minor: null,
        interdisciplinaryTrack: null,
        retakePressure: false,
        scholarshipWarning: false,
      },
      destinationCandidates: [],
    });

    expect([
      "전문직 1차 시험장",
      "패러디 기업 최종 면접",
      "공공안전 직무 체력·면접 전형",
      "창업 지원사업 발표 심사",
      "졸업 전 마지막 지원서",
    ]).not.toContain(event.title);
  });

  it("uses strategy choices when graduation gate state opens career gates", () => {
    const event = pickRandomStaticEvent([], {
      burnoutRisk: 10,
      coreEventCount: 20,
      gradeYear: 4,
      lifeStage: "college_late",
      graduation: "gate_ready",
      eventFlags: {},
      stats: { academic: 8, practical: 7, reputation: 7, health: 7, mental: 7 },
      relationships: [],
      academicPlan: {
        major: "사회학과",
        majorChanged: false,
        doubleMajor: null,
        minor: null,
        interdisciplinaryTrack: null,
        retakePressure: false,
        scholarshipWarning: false,
      },
      destinationCandidates: [],
    });

    expect([
      "전문직 1차 시험장",
      "패러디 기업 최종 면접",
      "공공안전 직무 체력·면접 전형",
      "졸업 전 마지막 지원서",
    ]).toContain(event.title);
    expect(event.source).toBe("STATIC");
    expect(event.choices.map((choice) => choice.label).join(" ")).not.toMatch(/합격한다|떨어진다|통과한다|탈락한다/);
  });

  it("returns contextual career gates as static events", () => {
    const result = selectNextEvent({
      burnoutRisk: 0,
      coreEventCount: 14,
      lifeStage: "college_late",
      graduation: "gate_ready",
      eventFlags: {},
      stats: { academic: 7, practical: 7, health: 7, mental: 7, wealth: 5, reputation: 6 },
      relationships: [],
      previousChoiceSummary: "지원 준비를 계속했다.",
    }, []);

    expect(result.event.source).toBe("STATIC");
    expect(result.event.tags).toContain("진로");
    expect(result.event.body).not.toContain("지난 선택의 결과,");
  });

  it("does not repeat a proposal after it was accepted or declined", () => {
    for (const eventFlags of [{ contestJoined: true }, { contestSkipped: true }]) {
      for (let i = 0; i < 20; i += 1) {
        const event = pickRandomStaticEvent([], {
          burnoutRisk: 10,
          coreEventCount: 6,
          gradeYear: 2,
          lifeStage: "college_mid",
          graduation: "normal",
          eventFlags,
          stats: { academic: 8, practical: 8, reputation: 8, health: 8, mental: 8 },
          relationships: [],
          destinationCandidates: [],
        });

        expect(event.title).not.toBe("공모전 팀 구성");
      }
    }
  });

  it("does not ban an app idea solely because a medical major lacks startup history", () => {
    const appEvent = STATIC_EVENTS.find((event) => event.title === "작은 앱 아이디어");
    expect(appEvent).toBeDefined();
    expect(isEventAllowedForLifeStage(appEvent!, {
      burnoutRisk: 0,
      major: "의학과",
      gradeYear: 4,
      lifeStage: "college_late",
      eventFlags: {},
      careerPaths: [],
    })).toBe(true);
  });
});

describe("buildBurnoutEvent", () => {
  it("builds a forced burnout event", () => {
    const event = buildBurnoutEvent();
    expect(event.title).toContain("번아웃");
    expect(event.source).toBe("FORCED");
    expect(event.choices.length).toBeGreaterThanOrEqual(2);
    expect(event.choices.every((c) => "statDelta" in c)).toBe(true);
  });
});

describe("selectNextEvent", () => {
  it("returns forced event when burnout >= 80", () => {
    const result = selectNextEvent({ burnoutRisk: 90 }, []);
    expect(result.type).toBe("forced");
    expect(result.event.title).toContain("번아웃");
  });

  it("returns normal event when burnout < 80", () => {
    const result = selectNextEvent({ burnoutRisk: 50 }, []);
    expect(result.type).toBe("normal");
    expect(result.event.source).toBe("STATIC");
  });

  it("routes dropout state to school-outside next steps instead of campus life", () => {
    const result = selectNextEvent({
      burnoutRisk: 10,
      lifeStage: "dropout",
      eventFlags: { lifeStage: { id: "dropout" } },
      stats: { health: 4, mental: 4, reputation: 4 },
    }, []);

    expect(result.type).toBe("normal");
    expect(result.event.title).toBe("학교 밖에서 다시 짜는 하루");
    expect(result.event.body).not.toMatch(/강의실|동아리|수강/);
  });

  it("uses eight belief-changing story arcs across the 24-event run", () => {
    expect(getStoryArc(0).id).toBe("arrival");
    expect(getStoryArc(3).id).toBe("belonging");
    expect(getStoryArc(6).id).toBe("proof");
    expect(getStoryArc(9).id).toBe("fracture");
    expect(getStoryArc(13).id).toBe("reckoning");
    expect(getStoryArc(17).id).toBe("narrowing");
    expect(getStoryArc(20).id).toBe("finale");
    expect(getStoryArc(23).id).toBe("aftermath");
    expect(getStoryArc(24).focusAxes).toContain("정체성");
  });

  it("quarantines repeated legacy scenes from the normal fallback pool", () => {
    for (let index = 0; index < 200; index += 1) {
      expect(pickRandomStaticEvent([], { burnoutRisk: 0, coreEventCount: 8 }).title).not.toMatch(/헬스장에서 만난 사람|도서관의 노인/);
    }
  });

  it("blocks university and application procedures after the finale", () => {
    const context = { burnoutRisk: 0, coreEventCount: 23 };
    expect(isEventAllowedForLifeStage({ title: "중간고사 시즌", tags: ["중간고사", "학업"] }, context)).toBe(false);
    expect(isEventAllowedForLifeStage({ title: "추가 서류 제출 안내", tags: ["취업", "서류"] }, context)).toBe(false);
    expect(isEventAllowedForLifeStage({ title: "합격 다음 날의 첫 출근", tags: ["취업", "결과"] }, context)).toBe(true);
  });
});
