import { afterEach, describe, expect, it, vi } from "vitest";

import {
  calculateFinancialBurden,
  calculateSpecFatigue,
  calculateSpecScore,
  evaluateCodingTest,
  evaluateDocumentStage,
  evaluateFinalResult,
  evaluateFirstInterview,
  evaluatePersonalityTest,
  evaluateSecondInterview,
  getBlindHiringRandomFactor,
  getCompanyStages,
  isCareerPathEligible,
} from "@/lib/game/spec-system";

function mockRandom(value: number) {
  vi.spyOn(Math, "random").mockReturnValue(value);
}

const RANDOM_ZERO = 5 / 11;
const RANDOM_PLUS_FIVE = 0.9999;
const RANDOM_MINUS_FIVE = 0;

describe("calculateSpecScore", () => {
  it("returns 0 for empty specs", () => {
    expect(calculateSpecScore([])).toBe(0);
  });

  it("ignores specs that are not COMPLETED", () => {
    expect(
      calculateSpecScore([
        { specType: "PORTFOLIO", status: "IN_PROGRESS", score: "우수" },
        { specType: "PORTFOLIO", status: "FAILED", score: "우수" },
      ]),
    ).toBe(0);
  });

  it("scores INTERNSHIP by month duration", () => {
    expect(
      calculateSpecScore([
        { specType: "INTERNSHIP", status: "COMPLETED", score: "3개월" },
      ]),
    ).toBe(10);
    expect(
      calculateSpecScore([
        { specType: "INTERNSHIP", status: "COMPLETED", score: "6개월" },
      ]),
    ).toBe(30);
    expect(
      calculateSpecScore([
        { specType: "INTERNSHIP", status: "COMPLETED", score: "12개월" },
      ]),
    ).toBe(30);
  });

  it("defaults INTERNSHIP without score to 10", () => {
    expect(
      calculateSpecScore([
        { specType: "INTERNSHIP", status: "COMPLETED" },
      ]),
    ).toBe(10);
  });

  it("scores LANGUAGE_SCORE by numeric threshold", () => {
    expect(
      calculateSpecScore([
        { specType: "LANGUAGE_SCORE", status: "COMPLETED", score: "900" },
      ]),
    ).toBe(20);
    expect(
      calculateSpecScore([
        { specType: "LANGUAGE_SCORE", status: "COMPLETED", score: "950" },
      ]),
    ).toBe(25);
    expect(
      calculateSpecScore([
        { specType: "LANGUAGE_SCORE", status: "COMPLETED", score: "800" },
      ]),
    ).toBe(15);
    expect(
      calculateSpecScore([
        { specType: "LANGUAGE_SCORE", status: "COMPLETED", score: "700" },
      ]),
    ).toBe(10);
    expect(
      calculateSpecScore([
        { specType: "LANGUAGE_SCORE", status: "COMPLETED", score: "600" },
      ]),
    ).toBe(5);
  });

  it("scores PORTFOLIO within 5-20 range", () => {
    expect(
      calculateSpecScore([
        { specType: "PORTFOLIO", status: "COMPLETED" },
      ]),
    ).toBe(5);
    expect(
      calculateSpecScore([
        { specType: "PORTFOLIO", status: "COMPLETED", score: "우수" },
      ]),
    ).toBe(13);
    expect(
      calculateSpecScore([
        { specType: "PORTFOLIO", status: "COMPLETED", score: "최우수" },
      ]),
    ).toBe(20);
    expect(
      calculateSpecScore([
        { specType: "PORTFOLIO", status: "COMPLETED", score: "미흡" },
      ]),
    ).toBe(5);
  });

  it("scores CERTIFICATION within 5-15 range", () => {
    expect(
      calculateSpecScore([
        { specType: "CERTIFICATION", status: "COMPLETED" },
      ]),
    ).toBe(5);
    expect(
      calculateSpecScore([
        { specType: "CERTIFICATION", status: "COMPLETED", score: "최우수" },
      ]),
    ).toBe(15);
  });

  it("scores EXAM_PREP within 3-10 range", () => {
    expect(
      calculateSpecScore([
        { specType: "EXAM_PREP", status: "COMPLETED" },
      ]),
    ).toBe(3);
    expect(
      calculateSpecScore([
        { specType: "EXAM_PREP", status: "COMPLETED", score: "최우수" },
      ]),
    ).toBe(10);
  });

  it("does not count CAREER_PATH toward spec score", () => {
    expect(
      calculateSpecScore([
        { specType: "CAREER_PATH", status: "COMPLETED", score: "합격" },
      ]),
    ).toBe(0);
  });

  it("aggregates multiple completed specs", () => {
    const specs = [
      { specType: "INTERNSHIP", status: "COMPLETED", score: "6개월" },
      { specType: "LANGUAGE_SCORE", status: "COMPLETED", score: "900" },
      { specType: "PORTFOLIO", status: "COMPLETED", score: "최우수" },
      { specType: "CERTIFICATION", status: "COMPLETED", score: "우수" },
      { specType: "CAREER_PATH", status: "COMPLETED", score: null },
      { specType: "EXAM_PREP", status: "IN_PROGRESS" },
    ];
    expect(calculateSpecScore(specs)).toBe(30 + 20 + 20 + 10 + 0);
  });

  it("returns 0 for unknown spec types", () => {
    expect(
      calculateSpecScore([
        { specType: "UNKNOWN", status: "COMPLETED", score: "최우수" },
      ]),
    ).toBe(0);
  });
});

describe("getCompanyStages", () => {
  it("returns 대기업 six-stage funnel", () => {
    expect(getCompanyStages("대기업")).toEqual([
      "DOCUMENT",
      "PERSONALITY_TEST",
      "CODING_TEST",
      "FIRST_INTERVIEW",
      "SECOND_INTERVIEW",
      "FINAL_RESULT",
    ]);
  });

  it("returns 스타트업 four-stage funnel", () => {
    expect(getCompanyStages("스타트업")).toEqual([
      "DOCUMENT",
      "FIRST_INTERVIEW",
      "SECOND_INTERVIEW",
      "FINAL_RESULT",
    ]);
  });

  it("returns 공기업 stages with personality test but no coding test", () => {
    expect(getCompanyStages("공기업")).toEqual([
      "DOCUMENT",
      "PERSONALITY_TEST",
      "FIRST_INTERVIEW",
      "SECOND_INTERVIEW",
      "FINAL_RESULT",
    ]);
  });

  it("returns 전문직 three-stage funnel", () => {
    expect(getCompanyStages("전문직")).toEqual([
      "DOCUMENT",
      "FIRST_INTERVIEW",
      "FINAL_RESULT",
    ]);
  });

  it("returns 외국계 stages with coding test but only second interview", () => {
    expect(getCompanyStages("외국계")).toEqual([
      "DOCUMENT",
      "PERSONALITY_TEST",
      "CODING_TEST",
      "SECOND_INTERVIEW",
      "FINAL_RESULT",
    ]);
  });

  it("falls back to a default funnel for unknown company types", () => {
    expect(getCompanyStages("unknown-type")).toEqual([
      "DOCUMENT",
      "FIRST_INTERVIEW",
      "FINAL_RESULT",
    ]);
  });
});

describe("evaluateDocumentStage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("passes when spec score plus stats clear the threshold", () => {
    mockRandom(RANDOM_ZERO);
    const result = evaluateDocumentStage(100, 8, 8);
    expect(result.passed).toBe(true);
    expect(result.score).toBe(8 + 8 + 20 + 0);
  });

  it("fails when spec score and stats are both weak", () => {
    mockRandom(RANDOM_ZERO);
    const result = evaluateDocumentStage(0, 2, 2);
    expect(result.passed).toBe(false);
    expect(result.score).toBe(4);
  });

  it("allows spec-overcoming when stats are exceptional", () => {
    mockRandom(RANDOM_ZERO);
    const result = evaluateDocumentStage(0, 10, 10);
    expect(result.passed).toBe(true);
  });

  it("random factor nudges borderline results upward", () => {
    mockRandom(RANDOM_PLUS_FIVE);
    const result = evaluateDocumentStage(30, 4, 5);
    expect(result.score).toBe(4 + 5 + 6 + 5);
    expect(result.passed).toBe(true);
  });

  it("random factor drags borderline results downward", () => {
    mockRandom(RANDOM_MINUS_FIVE);
    const result = evaluateDocumentStage(30, 4, 5);
    expect(result.score).toBe(4 + 5 + 6 - 5);
    expect(result.passed).toBe(false);
  });
});

describe("evaluatePersonalityTest", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("passes when mental and reputation are strong", () => {
    mockRandom(RANDOM_ZERO);
    const result = evaluatePersonalityTest(6, 6);
    expect(result.passed).toBe(true);
    expect(result.score).toBe(12);
  });

  it("fails when mental and reputation are weak", () => {
    mockRandom(RANDOM_ZERO);
    const result = evaluatePersonalityTest(2, 2);
    expect(result.passed).toBe(false);
    expect(result.score).toBe(4);
  });

  it("random boost can flip a borderline outcome", () => {
    mockRandom(RANDOM_PLUS_FIVE);
    const result = evaluatePersonalityTest(3, 3);
    expect(result.score).toBe(11);
    expect(result.passed).toBe(true);
  });
});

describe("evaluateCodingTest", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("passes with high practical and academic", () => {
    mockRandom(RANDOM_ZERO);
    const result = evaluateCodingTest(8, 8);
    expect(result.passed).toBe(true);
    expect(result.score).toBe(16);
  });

  it("fails with weak practical and academic", () => {
    mockRandom(RANDOM_ZERO);
    const result = evaluateCodingTest(3, 3);
    expect(result.passed).toBe(false);
  });

  it("random penalty can eliminate a borderline candidate", () => {
    mockRandom(RANDOM_MINUS_FIVE);
    const result = evaluateCodingTest(6, 7);
    expect(result.score).toBe(8);
    expect(result.passed).toBe(false);
  });
});

describe("evaluateFirstInterview", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("passes with high communication, charm, and practical", () => {
    mockRandom(RANDOM_ZERO);
    const result = evaluateFirstInterview(6, 6, 6);
    expect(result.passed).toBe(true);
    expect(result.score).toBe(18);
  });

  it("fails when soft skills are lacking", () => {
    mockRandom(RANDOM_ZERO);
    const result = evaluateFirstInterview(2, 2, 2);
    expect(result.passed).toBe(false);
  });
});

describe("evaluateSecondInterview", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("passes when reputation, mental, and charm are strong", () => {
    mockRandom(RANDOM_ZERO);
    const result = evaluateSecondInterview(6, 6, 6);
    expect(result.passed).toBe(true);
    expect(result.score).toBe(18);
  });

  it("fails when the executive-facing profile is weak", () => {
    mockRandom(RANDOM_ZERO);
    const result = evaluateSecondInterview(2, 2, 2);
    expect(result.passed).toBe(false);
  });
});

describe("evaluateFinalResult", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("passes when the aggregate score exceeds threshold", () => {
    mockRandom(RANDOM_ZERO);
    const result = evaluateFinalResult(60);
    expect(result.passed).toBe(true);
    expect(result.score).toBe(60);
  });

  it("fails when the aggregate score is too low", () => {
    mockRandom(RANDOM_ZERO);
    const result = evaluateFinalResult(10);
    expect(result.passed).toBe(false);
  });

  it("random luck can push a borderline candidate over the line", () => {
    mockRandom(RANDOM_PLUS_FIVE);
    const result = evaluateFinalResult(46);
    expect(result.score).toBe(51);
    expect(result.passed).toBe(true);
  });

  it("random misfortune can push a borderline candidate under the line", () => {
    mockRandom(RANDOM_MINUS_FIVE);
    const result = evaluateFinalResult(54);
    expect(result.score).toBe(49);
    expect(result.passed).toBe(false);
  });
});

describe("isCareerPathEligible", () => {
  it("accepts WORKING_HOLIDAY when wealth and mental clear the bar", () => {
    expect(
      isCareerPathEligible(
        "WORKING_HOLIDAY",
        { wealth: 5, mental: 5 },
        "경영학과",
      ),
    ).toEqual({ eligible: true });
  });

  it("rejects WORKING_HOLIDAY when wealth is insufficient", () => {
    const result = isCareerPathEligible(
      "WORKING_HOLIDAY",
      { wealth: 3, mental: 6 },
      "경영학과",
    );
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain("wealth");
  });

  it("rejects WORKING_HOLIDAY when mental is insufficient", () => {
    const result = isCareerPathEligible(
      "WORKING_HOLIDAY",
      { wealth: 5, mental: 2 },
      "경영학과",
    );
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain("mental");
  });

  it("requires 교육학과 major for TEACHER_EXAM", () => {
    expect(
      isCareerPathEligible("TEACHER_EXAM", { academic: 7 }, "경영학과").eligible,
    ).toBe(false);
    expect(
      isCareerPathEligible("TEACHER_EXAM", { academic: 7 }, "교육학과").eligible,
    ).toBe(true);
  });

  it("rejects TEACHER_EXAM with correct major but low academic", () => {
    const result = isCareerPathEligible(
      "TEACHER_EXAM",
      { academic: 4 },
      "교육학과",
    );
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain("academic");
  });

  it("checks academic and mental for CPA", () => {
    expect(
      isCareerPathEligible("CPA", { academic: 8, mental: 7 }, "경영학과").eligible,
    ).toBe(true);
    expect(
      isCareerPathEligible("CPA", { academic: 6, mental: 7 }, "경영학과").eligible,
    ).toBe(false);
    expect(
      isCareerPathEligible("CPA", { academic: 8, mental: 5 }, "경영학과").eligible,
    ).toBe(false);
  });

  it("checks academic and communication for LAW_SCHOOL", () => {
    expect(
      isCareerPathEligible(
        "LAW_SCHOOL",
        { academic: 8, communication: 6 },
        "법학과",
      ).eligible,
    ).toBe(true);
    expect(
      isCareerPathEligible(
        "LAW_SCHOOL",
        { academic: 6, communication: 6 },
        "법학과",
      ).eligible,
    ).toBe(false);
    expect(
      isCareerPathEligible(
        "LAW_SCHOOL",
        { academic: 8, communication: 3 },
        "법학과",
      ).eligible,
    ).toBe(false);
  });

  it("checks academic and practical for PATENT_ATTORNEY", () => {
    expect(
      isCareerPathEligible(
        "PATENT_ATTORNEY",
        { academic: 8, practical: 6 },
        "화학공학과",
      ).eligible,
    ).toBe(true);
    expect(
      isCareerPathEligible(
        "PATENT_ATTORNEY",
        { academic: 8, practical: 4 },
        "화학공학과",
      ).eligible,
    ).toBe(false);
  });

  it("checks academic, health, and wealth for MEDICAL_TRANSFER", () => {
    expect(
      isCareerPathEligible(
        "MEDICAL_TRANSFER",
        { academic: 9, health: 7, wealth: 6 },
        "생명과학과",
      ).eligible,
    ).toBe(true);
    expect(
      isCareerPathEligible(
        "MEDICAL_TRANSFER",
        { academic: 7, health: 7, wealth: 6 },
        "생명과학과",
      ).eligible,
    ).toBe(false);
    expect(
      isCareerPathEligible(
        "MEDICAL_TRANSFER",
        { academic: 9, health: 4, wealth: 6 },
        "생명과학과",
      ).eligible,
    ).toBe(false);
    expect(
      isCareerPathEligible(
        "MEDICAL_TRANSFER",
        { academic: 9, health: 7, wealth: 3 },
        "생명과학과",
      ).eligible,
    ).toBe(false);
  });

  it("treats missing stats as zero", () => {
    const result = isCareerPathEligible("CPA", {}, "경영학과");
    expect(result.eligible).toBe(false);
  });

  it("rejects unknown path types with a reason", () => {
    const result = isCareerPathEligible("UNKNOWN_PATH", { academic: 10 }, "any");
    expect(result.eligible).toBe(false);
    expect(result.reason).toBeDefined();
  });
});

describe("calculateSpecFatigue", () => {
  it("adds 5 burnout per rejection", () => {
    expect(calculateSpecFatigue(0, 3)).toBe(15);
    expect(calculateSpecFatigue(50, 5)).toBe(75);
  });

  it("keeps burnout unchanged when there are no rejections", () => {
    expect(calculateSpecFatigue(40, 0)).toBe(40);
  });

  it("caps burnout risk at 100", () => {
    expect(calculateSpecFatigue(90, 5)).toBe(100);
    expect(calculateSpecFatigue(80, 20)).toBe(100);
  });

  it("clamps negative rejection counts to zero", () => {
    expect(calculateSpecFatigue(40, -3)).toBe(40);
  });

  it("treats non-finite burnout as zero", () => {
    expect(calculateSpecFatigue(Number.NaN, 2)).toBe(10);
  });

  it("floors fractional rejection counts", () => {
    expect(calculateSpecFatigue(0, 2.9)).toBe(10);
  });
});

describe("calculateFinancialBurden", () => {
  it("charges 10 for 대기업 applications", () => {
    expect(calculateFinancialBurden(100, "대기업")).toBe(90);
  });

  it("charges 5 for 스타트업 applications", () => {
    expect(calculateFinancialBurden(100, "스타트업")).toBe(95);
  });

  it("charges 8 for 공기업 applications", () => {
    expect(calculateFinancialBurden(100, "공기업")).toBe(92);
  });

  it("charges 15 for 전문직 applications", () => {
    expect(calculateFinancialBurden(100, "전문직")).toBe(85);
  });

  it("charges 12 for 외국계 applications", () => {
    expect(calculateFinancialBurden(100, "외국계")).toBe(88);
  });

  it("uses the default cost for unknown application types", () => {
    expect(calculateFinancialBurden(100, "기타")).toBe(95);
  });

  it("allows wealth to drop below zero when short on funds", () => {
    expect(calculateFinancialBurden(3, "전문직")).toBe(-12);
  });
});

describe("getBlindHiringRandomFactor", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns -5 when Math.random returns 0", () => {
    mockRandom(0);
    expect(getBlindHiringRandomFactor()).toBe(-5);
  });

  it("returns 5 when Math.random returns close to 1", () => {
    mockRandom(0.9999);
    expect(getBlindHiringRandomFactor()).toBe(5);
  });

  it("returns 0 when Math.random returns 5/11", () => {
    mockRandom(5 / 11);
    expect(getBlindHiringRandomFactor()).toBe(0);
  });

  it("always returns an integer within [-5, 5]", () => {
    for (let i = 0; i < 200; i++) {
      const value = getBlindHiringRandomFactor();
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(-5);
      expect(value).toBeLessThanOrEqual(5);
    }
  });
});
