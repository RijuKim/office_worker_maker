import { describe, expect, it } from "vitest";

import { buildBurnoutEvent, getStoryArc, pickRandomStaticEvent, selectNextEvent, STATIC_EVENTS } from "@/lib/game/event-engine";

describe("STATIC_EVENTS", () => {
  it("has events with valid structure", () => {
    for (const event of STATIC_EVENTS) {
      expect(event.title).toBeTruthy();
      expect(event.body).toBeTruthy();
      expect(event.choices.length).toBeGreaterThanOrEqual(2);
      expect(event.choices.length).toBeLessThanOrEqual(4);
      expect(event.tags.length).toBeGreaterThanOrEqual(1);
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
      coreEventCount: 14,
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

  it("blocks late career gates during early college even when stats are high", () => {
    const event = pickRandomStaticEvent([], {
      burnoutRisk: 10,
      coreEventCount: 14,
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
      coreEventCount: 14,
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

  it("uses five large story arcs across the run", () => {
    expect(getStoryArc(0).title).toBe("첫 학기와 생활 기반");
    expect(getStoryArc(4).title).toBe("소속과 첫 약속");
    expect(getStoryArc(7).title).toBe("압박과 유혹");
    expect(getStoryArc(10).title).toBe("선택의 청구서");
    expect(getStoryArc(14).title).toBe("졸업 직전의 방향");
  });
});
