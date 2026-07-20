import { describe, expect, it } from "vitest";

import {
  applyLifeStageTransition,
  buildInitialLifeStageFlags,
  CORE_EVENTS_PER_SEMESTER,
  deriveLifeStageState,
  getDropoutReason,
  getLeaveReason,
  isGraduationGateReady,
  readRiskDebt,
  requiresExtraSemester,
} from "@/lib/game/life-stage";

describe("deriveLifeStageState", () => {
  it("derives a playable semester label for legacy saves without Slice 1 flags", () => {
    const state = deriveLifeStageState({
      currentGradeYear: 1,
      academicStatus: "ENROLLED",
      coreEventCount: 0,
      major: "컴퓨터공학",
      eventFlags: {},
    });

    expect(state.lifeStage).toBe("college_early");
    expect(state.term).toEqual({ gradeYear: 1, semester: 1, label: "1학년 1학기" });
    expect(state.academicPlan.major).toBe("컴퓨터공학");
    expect(state.graduation).toBe("normal");
  });

  it("falls back from corrupt client or AI branch JSON instead of trusting it", () => {
    const state = deriveLifeStageState({
      currentGradeYear: 2,
      academicStatus: "ENROLLED",
      coreEventCount: 5,
      major: "경영학",
      eventFlags: {
        lifeStage: { id: "post_graduation_with_company_offer" },
        academicTerm: { gradeYear: 99, semester: 7, label: "조작된 학기" },
        graduation: { state: "graduated_with_honors" },
        stageEventCount: 99,
        academicPlan: {
          major: "",
          majorChanged: "yes",
          doubleMajor: " 데이터사이언스 ",
          scholarshipWarning: true,
        },
        destinationCandidates: [
          {
            id: "naver-offer",
            kind: "real_company",
            name: "지원하지 않은 회사",
            introducedBy: "ai",
            status: "gate_passed",
          },
        ],
      },
    });

    expect(state.lifeStage).toBe("college_mid");
    expect(state.term).toEqual({ gradeYear: 2, semester: 2, label: "2학년 2학기" });
    expect(state.graduation).toBe("normal");
    expect(state.stageEventCount).toBe(0);
    expect(state.academicPlan).toMatchObject({
      major: "경영학",
      majorChanged: false,
      doubleMajor: "데이터사이언스",
      scholarshipWarning: true,
    });
    expect(state.destinationCandidates).toEqual([]);
  });

  it("keeps valid destination candidates that were introduced through process state", () => {
    const state = deriveLifeStageState({
      currentGradeYear: 3,
      academicStatus: "ENROLLED",
      coreEventCount: 8,
      eventFlags: {
        destinationCandidates: [
          {
            id: "parody-studio-internship",
            kind: "company",
            name: "무지개문구 스튜디오",
            introducedBy: "portfolio-review-event",
            status: "applied",
          },
        ],
      },
    });

    expect(state.destinationCandidates).toEqual([
      {
        id: "parody-studio-internship",
        kind: "company",
        name: "무지개문구 스튜디오",
        introducedBy: "portfolio-review-event",
        status: "applied",
      },
    ]);
  });
});

describe("buildInitialLifeStageFlags", () => {
  it("builds no-migration flags for a new character", () => {
    const flags = buildInitialLifeStageFlags({ currentGradeYear: 1, major: "사회학" });

    expect(flags.lifeStage).toEqual({ id: "college_early" });
    expect(flags.academicTerm.label).toBe("1학년 1학기");
    expect(flags.academicPlan.major).toBe("사회학");
    expect(flags.graduation).toEqual({ state: "normal" });
  });
});

describe("applyLifeStageTransition", () => {
  it("keeps the same semester after two resolved core events in the current semester", () => {
    const result = applyLifeStageTransition({
      currentGradeYear: 1,
      academicStatus: "ENROLLED",
      coreEventCount: 1,
      eventFlags: {
        lifeStage: { id: "college_early" },
        academicTerm: { gradeYear: 1, semester: 1 },
        stageEventCount: 1,
      },
      stats: { health: 6, mental: 6, reputation: 5 },
      burnoutRisk: 10,
    });

    expect(result.state.term).toEqual({ gradeYear: 1, semester: 1, label: "1학년 1학기" });
    expect(result.state.stageEventCount).toBe(2);
    expect(result.reasons).toEqual(["no_transition"]);
  });

  it("advances semester after five resolved core events in the current semester", () => {
    const result = applyLifeStageTransition({
      currentGradeYear: 1,
      academicStatus: "ENROLLED",
      coreEventCount: 4,
      eventFlags: {
        lifeStage: { id: "college_early" },
        academicTerm: { gradeYear: 1, semester: 1 },
        stageEventCount: CORE_EVENTS_PER_SEMESTER - 1,
      },
      stats: { health: 6, mental: 6, reputation: 5 },
      burnoutRisk: 10,
    });

    expect(result.state.term).toEqual({ gradeYear: 1, semester: 2, label: "1학년 2학기" });
    expect(result.state.stageEventCount).toBe(0);
    expect(result.reasons).toEqual(["semester_advanced"]);
    expect(result.flagDelta.academicTerm.label).toBe("1학년 2학기");
  });

  it("advances from second semester into the next grade year", () => {
    const result = applyLifeStageTransition({
      currentGradeYear: 1,
      academicStatus: "ENROLLED",
      coreEventCount: 9,
      eventFlags: {
        lifeStage: { id: "college_early" },
        academicTerm: { gradeYear: 1, semester: 2 },
        stageEventCount: CORE_EVENTS_PER_SEMESTER - 1,
      },
      stats: { health: 6, mental: 6, reputation: 5 },
      burnoutRisk: 10,
    });

    expect(result.state.term).toEqual({ gradeYear: 2, semester: 1, label: "2학년 1학기" });
    expect(result.state.lifeStage).toBe("college_mid");
  });

  it("detects severe health or reputation thresholds as dropout risk", () => {
    const result = getDropoutReason(
      { health: 1, mental: 2, reputation: 5 },
      0,
    );
    expect(result).toBe(true);
  });

  it("detects high riskDebt as dropout risk", () => {
    const result = getDropoutReason(
      { health: 5, mental: 5, reputation: 5 },
      8,
    );
    expect(result).toBe(true);
  });

  it("detects low mental health as leave risk", () => {
    const result = getLeaveReason(
      { health: 5, mental: 2, reputation: 5 },
      20,
    );
    expect(result).toBe(true);
  });

  it("detects high burnoutRisk as leave risk", () => {
    const result = getLeaveReason(
      { health: 5, mental: 5, reputation: 5 },
      85,
    );
    expect(result).toBe(true);
  });

  it("reads riskDebt from event flags", () => {
    const result = readRiskDebt({ riskDebt: 8 });
    expect(result).toBe(8);
  });

  it("moves blocked grade-four late-stage play to extra semester instead of finalizing generically", () => {
    const result = applyLifeStageTransition({
      currentGradeYear: 4,
      academicStatus: "ENROLLED",
      coreEventCount: 39,
      eventFlags: {
        lifeStage: { id: "college_late" },
        academicTerm: { gradeYear: 4, semester: 2 },
        graduation: { state: "normal" },
        stageEventCount: CORE_EVENTS_PER_SEMESTER - 1,
      },
      stats: { academic: 4, practical: 7, health: 6, mental: 6, reputation: 6 },
      burnoutRisk: 10,
    });

    expect(result.state.graduation).toBe("extra_semester");
    expect(result.state.lifeStage).toBe("college_late");
    expect(result.reasons).toEqual(["extra_semester_required"]);
  });

  it("opens the graduation gate from eligible late-stage play", () => {
    const result = applyLifeStageTransition({
      currentGradeYear: 4,
      academicStatus: "ENROLLED",
      coreEventCount: 39,
      eventFlags: {
        lifeStage: { id: "college_late" },
        academicTerm: { gradeYear: 4, semester: 2 },
        graduation: { state: "normal" },
        stageEventCount: CORE_EVENTS_PER_SEMESTER - 1,
      },
      stats: { academic: 7, practical: 7, health: 6, mental: 6, reputation: 6 },
      burnoutRisk: 10,
    });

    expect(result.state.graduation).toBe("gate_ready");
    expect(result.reasons).toEqual(["graduation_gate_ready"]);
    expect(isGraduationGateReady({
      ...result.state,
      graduation: "normal",
    })).toBe(true);
  });
});

describe("requiresExtraSemester", () => {
  it("detects explicit academic blockers in sanitized state", () => {
    const state = deriveLifeStageState({
      currentGradeYear: 4,
      academicStatus: "ENROLLED",
      coreEventCount: 12,
      eventFlags: {
        lifeStage: { id: "college_late" },
        academicTerm: { gradeYear: 4, semester: 2 },
        academicPlan: { retakePressure: true },
      },
    });

    expect(requiresExtraSemester(state, { academic: 8, practical: 8 })).toBe(true);
  });
});
