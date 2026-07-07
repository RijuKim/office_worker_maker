export type SpecInput = {
  specType: string;
  status: string;
  score?: string | null;
};

export type StageEvaluation = {
  passed: boolean;
  score: number;
};

export type CareerPathEligibility = {
  eligible: boolean;
  reason?: string;
};

const BURNOUT_MAX = 100;
const BURNOUT_PER_REJECTION = 5;

const COMPANY_STAGES: Record<string, string[]> = {
  대기업: [
    "DOCUMENT",
    "PERSONALITY_TEST",
    "CODING_TEST",
    "FIRST_INTERVIEW",
    "SECOND_INTERVIEW",
    "FINAL_RESULT",
  ],
  스타트업: ["DOCUMENT", "FIRST_INTERVIEW", "SECOND_INTERVIEW", "FINAL_RESULT"],
  공기업: [
    "DOCUMENT",
    "PERSONALITY_TEST",
    "FIRST_INTERVIEW",
    "SECOND_INTERVIEW",
    "FINAL_RESULT",
  ],
  전문직: ["DOCUMENT", "FIRST_INTERVIEW", "FINAL_RESULT"],
  외국계: [
    "DOCUMENT",
    "PERSONALITY_TEST",
    "CODING_TEST",
    "SECOND_INTERVIEW",
    "FINAL_RESULT",
  ],
};

const DEFAULT_STAGES = ["DOCUMENT", "FIRST_INTERVIEW", "FINAL_RESULT"];

const APPLICATION_COSTS: Record<string, number> = {
  대기업: 10,
  스타트업: 5,
  공기업: 8,
  전문직: 15,
  외국계: 12,
};

const DEFAULT_APPLICATION_COST = 5;

type CareerRequirement = {
  stats: Record<string, number>;
  major?: string;
};

const CAREER_PATH_REQUIREMENTS: Record<string, CareerRequirement> = {
  WORKING_HOLIDAY: { stats: { wealth: 4, mental: 4 } },
  TEACHER_EXAM: { stats: { academic: 6 }, major: "교육학과" },
  CPA: { stats: { academic: 7, mental: 6 } },
  LAW_SCHOOL: { stats: { academic: 7, communication: 5 } },
  PATENT_ATTORNEY: { stats: { academic: 7, practical: 5 } },
  MEDICAL_TRANSFER: { stats: { academic: 8, health: 6, wealth: 5 } },
};

export function calculateSpecScore(specs: SpecInput[]): number {
  let total = 0;
  for (const spec of specs) {
    if (spec.status !== "COMPLETED") continue;
    total += scoreForSpec(spec);
  }
  return total;
}

export function getCompanyStages(companyType: string): string[] {
  return COMPANY_STAGES[companyType] ?? [...DEFAULT_STAGES];
}

export function evaluateDocumentStage(
  specScore: number,
  academic: number,
  practical: number,
): StageEvaluation {
  const statsScore = academic + practical;
  const specContribution = Math.floor(Math.max(0, specScore) / 5);
  const random = getBlindHiringRandomFactor();
  const score = statsScore + specContribution + random;
  const threshold = 20;
  const specOvercoming = statsScore >= 18 && score >= threshold - 3;
  return { passed: score >= threshold || specOvercoming, score };
}

export function evaluatePersonalityTest(
  mental: number,
  reputation: number,
): StageEvaluation {
  const statsScore = mental + reputation;
  const random = getBlindHiringRandomFactor();
  const score = statsScore + random;
  const threshold = 10;
  return { passed: score >= threshold, score };
}

export function evaluateCodingTest(
  practical: number,
  academic: number,
): StageEvaluation {
  const statsScore = practical + academic;
  const random = getBlindHiringRandomFactor();
  const score = statsScore + random;
  const threshold = 12;
  return { passed: score >= threshold, score };
}

export function evaluateFirstInterview(
  communication: number,
  charm: number,
  practical: number,
): StageEvaluation {
  const statsScore = communication + charm + practical;
  const random = getBlindHiringRandomFactor();
  const score = statsScore + random;
  const threshold = 15;
  return { passed: score >= threshold, score };
}

export function evaluateSecondInterview(
  reputation: number,
  mental: number,
  charm: number,
): StageEvaluation {
  const statsScore = reputation + mental + charm;
  const random = getBlindHiringRandomFactor();
  const score = statsScore + random;
  const threshold = 15;
  return { passed: score >= threshold, score };
}

export function evaluateFinalResult(aggregateScore: number): StageEvaluation {
  const random = getBlindHiringRandomFactor();
  const score = aggregateScore + random;
  const threshold = 50;
  return { passed: score >= threshold, score };
}

export function isCareerPathEligible(
  pathType: string,
  stats: Record<string, number>,
  major: string,
): CareerPathEligibility {
  const requirement = CAREER_PATH_REQUIREMENTS[pathType];
  if (!requirement) {
    return { eligible: false, reason: "알 수 없는 경로 유형" };
  }

  if (requirement.major && major !== requirement.major) {
    return {
      eligible: false,
      reason: `전공 요건 미충족 (필요: ${requirement.major})`,
    };
  }

  for (const [stat, min] of Object.entries(requirement.stats)) {
    const value = stats[stat] ?? 0;
    if (value < min) {
      return {
        eligible: false,
        reason: `${stat} 능력치 부족 (필요: ${min}, 현재: ${value})`,
      };
    }
  }

  return { eligible: true };
}

export function calculateSpecFatigue(
  burnoutRisk: number,
  rejections: number,
): number {
  const base = Number.isFinite(burnoutRisk) ? burnoutRisk : 0;
  const count = Math.max(0, Math.floor(rejections));
  const next = base + count * BURNOUT_PER_REJECTION;
  return Math.max(0, Math.min(BURNOUT_MAX, next));
}

export function calculateFinancialBurden(
  wealth: number,
  applicationType: string,
): number {
  const cost = APPLICATION_COSTS[applicationType] ?? DEFAULT_APPLICATION_COST;
  return wealth - cost;
}

export function getBlindHiringRandomFactor(): number {
  return Math.floor(Math.random() * 11) - 5;
}

function scoreForSpec(spec: SpecInput): number {
  switch (spec.specType) {
    case "INTERNSHIP":
      return internshipPoints(spec.score);
    case "LANGUAGE_SCORE":
      return languagePoints(spec.score);
    case "PORTFOLIO":
      return tieredPoints(spec.score, 5, 20);
    case "CERTIFICATION":
      return tieredPoints(spec.score, 5, 15);
    case "EXAM_PREP":
      return tieredPoints(spec.score, 3, 10);
    case "CAREER_PATH":
    default:
      return 0;
  }
}

function internshipPoints(score: string | null | undefined): number {
  const months = parseLeadingInt(score);
  if (months === null) return 10;
  if (months >= 6) return 30;
  if (months >= 3) return 10;
  return 10;
}

function languagePoints(score: string | null | undefined): number {
  const value = parseLeadingInt(score);
  if (value === null) return 5;
  if (value >= 950) return 25;
  if (value >= 900) return 20;
  if (value >= 800) return 15;
  if (value >= 700) return 10;
  return 5;
}

function tieredPoints(
  score: string | null | undefined,
  min: number,
  max: number,
): number {
  if (!score) return min;
  const mid = Math.round((min + max) / 2);
  const numeric = parseLeadingInt(score);
  if (numeric !== null) {
    if (numeric >= 8) return max;
    if (numeric >= 5) return mid;
    return min;
  }
  if (score.includes("최우수") || score.includes("최고")) return max;
  if (score.includes("우수")) return mid;
  if (score.includes("보통")) return mid;
  if (score.includes("미흡") || score.includes("부족")) return min;
  return mid;
}

function parseLeadingInt(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = value.match(/-?\d+/);
  if (!match) return null;
  const parsed = parseInt(match[0], 10);
  return Number.isNaN(parsed) ? null : parsed;
}
