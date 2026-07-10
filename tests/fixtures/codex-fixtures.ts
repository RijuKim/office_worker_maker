import type { CareerEndingRecord } from "@prisma/client";

import { CODEX_CATALOG } from "@/lib/game/codex-catalog";

type RecordInput = Omit<CareerEndingRecord, "id" | "createdAt"> & {
  id?: string;
  createdAt?: Date;
};

const baseCreatedAt = new Date("2025-01-01T00:00:00.000Z");

function buildRecord(input: RecordInput): CareerEndingRecord {
  return {
    id: input.id ?? "00000000-0000-4000-8000-000000000000",
    userId: input.userId,
    characterRunId: input.characterRunId,
    title: input.title,
    summary: input.summary,
    longNarrative: input.longNarrative,
    careerPath: input.careerPath,
    jobRole: input.jobRole,
    destinationName: input.destinationName,
    salaryBand: input.salaryBand,
    workplaceTone: input.workplaceTone,
    statSnapshot: input.statSnapshot,
    keyRelationships: input.keyRelationships,
    majorEvents: input.majorEvents,
    satisfaction: input.satisfaction,
    growthPotential: input.growthPotential,
    workLifeBalance: input.workLifeBalance,
    healthState: input.healthState,
    relationshipState: input.relationshipState,
    tags: input.tags,
    similarityKey: input.similarityKey,
    createdAt: input.createdAt ?? baseCreatedAt,
  };
}

function buildTemplate(input: {
  careerPath: string;
  title: string;
  summary: string;
  longNarrative: string;
  tags?: CareerEndingRecord["tags"];
  jobRole?: string | null;
  destinationName?: string | null;
  salaryBand?: string | null;
  similarityKey: string;
}): CareerEndingRecord {
  return buildRecord({
    id: `00000000-0000-4000-8000-${input.similarityKey.slice(0, 12).padStart(12, "0")}`,
    userId: "user-fixture",
    characterRunId: "run-fixture",
    title: input.title,
    summary: input.summary,
    longNarrative: input.longNarrative,
    careerPath: input.careerPath,
    jobRole: input.jobRole ?? null,
    destinationName: input.destinationName ?? null,
    salaryBand: input.salaryBand ?? null,
    workplaceTone: [],
    statSnapshot: {},
    keyRelationships: [],
    majorEvents: [],
    satisfaction: 78,
    growthPotential: 82,
    workLifeBalance: 74,
    healthState: "stable",
    relationshipState: "steady",
    tags: input.tags ?? [],
    similarityKey: input.similarityKey,
    createdAt: baseCreatedAt,
  });
}

const MATCH_TEMPLATES: CareerEndingRecord[] = [
  buildTemplate({
    careerPath: "삼슨전자 신입 실무자",
    title: "삼슨전자 입사",
    summary: "삼슨전자에 신입 실무자로 입사했다.",
    longNarrative: "삼슨전자의 신입 실무자로 들어가 첫 프로젝트를 차분히 따라갔다.",
    similarityKey: "template-samson",
  }),
  buildTemplate({
    careerPath: "네이봐 신입 실무자",
    title: "네이봐 입사",
    summary: "네이봐에 신입 실무자로 입사했다.",
    longNarrative: "네이봐의 신입 실무자로 들어가 검색과 서비스 운영 업무를 익혔다.",
    similarityKey: "template-nb",
  }),
  buildTemplate({
    careerPath: "카캉오 신입 실무자",
    title: "카캉오 입사",
    summary: "카캉오에 신입 실무자로 입사했다.",
    longNarrative: "카캉오의 신입 실무자로 들어가 메신저와 플랫폼 업무를 배웠다.",
    similarityKey: "template-cacao",
  }),
  buildTemplate({
    careerPath: "배달이민족 신입 실무자",
    title: "배달이민족 입사",
    summary: "배달이민족에 신입 실무자로 입사했다.",
    longNarrative: "배달이민족의 신입 실무자로 들어가 서비스 현장 감각을 익혔다.",
    similarityKey: "template-bemin",
  }),
  buildTemplate({
    careerPath: "규글코리아 신입 실무자",
    title: "규글코리아 입사",
    summary: "규글코리아에 신입 실무자로 입사했다.",
    longNarrative: "규글코리아의 신입 실무자로 들어가 검색과 데이터 흐름을 익혔다.",
    similarityKey: "template-google",
  }),
  buildTemplate({
    careerPath: "스타벅수커피 신입 실무자",
    title: "스타벅수커피 입사",
    summary: "스타벅수커피에 신입 실무자로 입사했다.",
    longNarrative: "스타벅수커피의 신입 실무자로 들어가 서비스와 운영을 배웠다.",
    similarityKey: "template-starbuks",
  }),
  buildTemplate({
    careerPath: "엘쥐전자 신입 실무자",
    title: "엘쥐전자 입사",
    summary: "엘쥐전자에 신입 실무자로 입사했다.",
    longNarrative: "엘쥐전자의 신입 실무자로 들어가 제조와 제품 조직을 익혔다.",
    similarityKey: "template-lg",
  }),
  buildTemplate({
    careerPath: "현댜모터스 신입 실무자",
    title: "현댜모터스 입사",
    summary: "현댜모터스에 신입 실무자로 입사했다.",
    longNarrative: "현댜모터스의 신입 실무자로 들어가 생산과 조직 문화를 익혔다.",
    similarityKey: "template-hyundae",
  }),
  buildTemplate({
    careerPath: "에스끼리텔 신입 실무자",
    title: "에스끼리텔 입사",
    summary: "에스끼리텔에 신입 실무자로 입사했다.",
    longNarrative: "에스끼리텔의 신입 실무자로 들어가 통신과 운영 업무를 익혔다.",
    similarityKey: "template-sk",
  }),
  buildTemplate({
    careerPath: "전문직 수습 과정",
    title: "전문직 수습 과정",
    summary: "전문직 수습 과정에 들어갔다.",
    longNarrative: "전문직 수습 과정에서 기본기를 다시 다지며 다음 단계를 준비했다.",
    similarityKey: "template-pro-trainee",
  }),
  buildTemplate({
    careerPath: "전문직 시험 재도전",
    title: "전문직 시험 재도전",
    summary: "전문직 시험에 다시 도전했다.",
    longNarrative: "시험에서 한 번 미끄러졌지만 다시 준비를 시작했다.",
    similarityKey: "template-pro-retry",
  }),
  buildTemplate({
    careerPath: "공공안전 직무 합격자",
    title: "공공안전 직무 합격",
    summary: "공공안전 직무에 합격했다.",
    longNarrative: "공공안전 직무 합격 후 실무 교육을 받기 시작했다.",
    similarityKey: "template-public-safety-pass",
  }),
  buildTemplate({
    careerPath: "공공안전 직무 준비생",
    title: "공공안전 직무 준비",
    summary: "공공안전 직무를 준비하고 있다.",
    longNarrative: "공공안전 직무를 목표로 시험과 체력을 함께 준비했다.",
    similarityKey: "template-public-safety-prep",
  }),
  buildTemplate({
    careerPath: "새싹엔진 선정 창업자",
    title: "새싹엔진 선정 창업자",
    summary: "새싹엔진에 선정된 창업자다.",
    longNarrative: "새싹엔진의 지원을 받아 창업 아이디어를 현실로 옮겼다.",
    similarityKey: "template-startup",
  }),
  buildTemplate({
    careerPath: "창업 또는 자영업",
    title: "창업 또는 자영업",
    summary: "창업이나 자영업을 시작했다.",
    longNarrative: "작은 가게와 사업을 꾸려가며 스스로의 길을 만들었다.",
    similarityKey: "template-self-employed",
  }),
  buildTemplate({
    careerPath: "연애와 결혼을 선택한 생활인",
    title: "연애와 결혼을 선택한 생활인",
    summary: "연애와 결혼을 선택한 생활인이 되었다.",
    longNarrative: "사랑과 가정을 선택해 일상에 안정감을 더했다.",
    similarityKey: "template-marriage",
  }),
  buildTemplate({
    careerPath: "혼자 살며 조용히 안정된 사람",
    title: "혼자 살며 조용히 안정된 사람",
    summary: "혼자 살며 조용히 안정된 삶을 살고 있다.",
    longNarrative: "혼자만의 루틴을 만들어 조용하지만 단단한 생활을 이어갔다.",
    similarityKey: "template-solo",
  }),
  buildTemplate({
    careerPath: "해외 워홀 이후 다시 길을 찾은 사람",
    title: "해외 워홀 이후 다시 길을 찾은 사람",
    summary: "해외 워홀을 마치고 다시 진로를 찾았다.",
    longNarrative: "해외 생활을 경험한 뒤 돌아와 새로운 방향을 정했다.",
    similarityKey: "template-overseas",
  }),
  buildTemplate({
    careerPath: "자퇴 후 진로",
    title: "자퇴 후 진로",
    summary: "자퇴 후 새로운 진로를 찾고 있다.",
    longNarrative: "학교를 떠난 뒤 자신에게 맞는 길을 다시 그려갔다.",
    similarityKey: "template-dropout",
  }),
  buildTemplate({
    careerPath: "건강 붕괴",
    title: "건강 붕괴",
    summary: "건강이 크게 흔들렸다.",
    longNarrative: "과로 끝에 건강이 무너져 잠시 모든 걸 멈췄다.",
    tags: ["건강"],
    similarityKey: "template-burnout-health",
  }),
  buildTemplate({
    careerPath: "멘탈 붕괴",
    title: "멘탈 붕괴",
    summary: "멘탈이 크게 흔들렸다.",
    longNarrative: "압박감이 쌓여 마음이 무너졌고 재정비가 필요해졌다.",
    tags: ["멘탈"],
    similarityKey: "template-burnout-mental",
  }),
  buildTemplate({
    careerPath: "평판 붕괴",
    title: "평판 붕괴",
    summary: "평판이 크게 흔들렸다.",
    longNarrative: "소문과 실수로 평판이 흔들렸지만 다시 회복을 준비했다.",
    tags: ["평판"],
    similarityKey: "template-burnout-reputation",
  }),
  buildTemplate({
    careerPath: "위험한 돈에서 겨우 발을 뺀 생존자",
    title: "위험한 돈에서 겨우 발을 뺀 생존자",
    summary: "위험한 돈의 흐름에서 벗어났다.",
    longNarrative: "위험한 제안을 끊어내고 겨우 안전한 삶으로 돌아왔다.",
    similarityKey: "template-risk-money",
  }),
  buildTemplate({
    careerPath: "아르바이트 경력자",
    title: "아르바이트 경력자",
    summary: "아르바이트 경력으로 자리잡았다.",
    longNarrative: "여러 아르바이트를 거치며 실무 감각과 자산을 쌓아 독립적인 생활을 시작했다.",
    similarityKey: "template-part-time",
  }),
  buildTemplate({
    careerPath: "마케팅·콘텐츠 직무",
    title: "마케팅·콘텐츠 직무",
    summary: "마케팅과 콘텐츠 업무를 맡았다.",
    longNarrative: "브랜드 메시지와 콘텐츠를 다루는 일을 시작했다.",
    similarityKey: "template-marketing-content",
  }),
  buildTemplate({
    careerPath: "기업 채용 재도전",
    title: "기업 채용 재도전",
    summary: "기업 채용에 다시 도전했다.",
    longNarrative: "서류와 면접에서 다시 시작하며 더 나은 결과를 노렸다.",
    similarityKey: "template-company-retry",
  }),
  buildTemplate({
    careerPath: "첫 직장 신입 실무자",
    title: "첫 직장 신입 실무자",
    summary: "첫 직장에 신입 실무자로 입사했다.",
    longNarrative: "첫 직장에서 신입 실무자로 사회생활을 시작했다.",
    similarityKey: "template-first-job",
  }),
  buildTemplate({
    careerPath: "기업 면접 탈락 후 재지원 준비",
    title: "기업 면접 탈락 후 재지원 준비",
    summary: "기업 면접에 탈락했지만 다시 준비하고 있다.",
    longNarrative: "면접에서 아쉽게 탈락했지만 더 나은 준비로 재도전을 준비했다.",
    similarityKey: "template-interview-retry",
  }),
  buildTemplate({
    careerPath: "공공기관 또는 공무원 준비",
    title: "공공기관 또는 공무원 준비",
    summary: "공공기관이나 공무원을 준비하고 있다.",
    longNarrative: "공공기관과 공무원 채용을 목표로 꾸준히 준비했다.",
    similarityKey: "template-public-service",
  }),
  buildTemplate({
    careerPath: "전문직 시험 준비생",
    title: "전문직 시험 준비생",
    summary: "전문직 시험을 준비하고 있다.",
    longNarrative: "전문직 자격증 시험을 목표로 공부에 매진했다.",
    similarityKey: "template-pro-exam-prep",
  }),
  buildTemplate({
    careerPath: "불확실하지만 계속되는 취업 준비",
    title: "불확실하지만 계속되는 취업 준비",
    summary: "취업 준비를 계속하고 있다.",
    longNarrative: "불확실한 상황 속에서도 취업 준비를 멈추지 않았다.",
    similarityKey: "template-uncertain-prep",
  }),
  buildTemplate({
    careerPath: "첫 지원 탈락 후 이어지는 준비",
    title: "첫 지원 탈락 후 이어지는 준비",
    summary: "첫 지원에서 탈락했지만 준비를 이어가고 있다.",
    longNarrative: "첫 지원에서 탈락했지만 좌절하지 않고 다음을 준비했다.",
    similarityKey: "template-first-rejection",
  }),
  buildTemplate({
    careerPath: "창업 심사 탈락 후 아이디어 검증",
    title: "창업 심사 탈락 후 아이디어 검증",
    summary: "창업 심사에 탈락했지만 아이디어를 검증하고 있다.",
    longNarrative: "창업 심사에서 떨어졌지만 아이디어를 더 다듬어 기회를 노렸다.",
    similarityKey: "template-startup-fail",
  }),
  buildTemplate({
    careerPath: "공공안전 전형 재준비",
    title: "공공안전 전형 재준비",
    summary: "공공안전 전형을 다시 준비하고 있다.",
    longNarrative: "공공안전 전형에서 아쉬운 결과를 받고 다시 준비를 시작했다.",
    similarityKey: "template-public-safety-retry",
  }),
  buildTemplate({
    careerPath: "졸업 후 취업",
    title: "졸업 후 취업",
    summary: "졸업 후 취업에 성공했다.",
    longNarrative: "대학을 졸업하고 취업에 성공해 사회인으로 첫발을 내디뎠다.",
    similarityKey: "template-grad-job",
  }),
  buildTemplate({
    careerPath: "자퇴 후 진로",
    title: "자퇴 후 진로",
    summary: "자퇴 후 새로운 진로를 찾고 있다.",
    longNarrative: "학교를 떠난 뒤 자신에게 맞는 길을 다시 그려갔다.",
    similarityKey: "template-dropout-path",
  }),
  buildTemplate({
    careerPath: "휴학 중 경험",
    title: "휴학 중 경험",
    summary: "휴학 중 다양한 경험을 했다.",
    longNarrative: "휴학 기간 동안 다양한 활동과 경험을 쌓았다.",
    similarityKey: "template-leave-exp",
  }),
  buildTemplate({
    careerPath: "진로 탐색",
    title: "진로 탐색",
    summary: "진로를 탐색하고 있다.",
    longNarrative: "여러 가능성을 열어두고 자신에게 맞는 진로를 탐색했다.",
    similarityKey: "template-career-explore",
  }),
  buildTemplate({
    careerPath: "마지막 관문을 앞둔 진로 준비",
    title: "마지막 관문을 앞둔 진로 준비",
    summary: "마지막 관문을 앞두고 진로를 준비하고 있다.",
    longNarrative: "마지막 관문을 앞두고 최선의 선택을 위해 진지하게 준비했다.",
    similarityKey: "template-final-gate",
  }),
];

export function buildEmptyRecordsFixture(): CareerEndingRecord[] {
  return [];
}

export function buildPartialRecordsFixture(): CareerEndingRecord[] {
  return [
    buildTemplate({
      careerPath: "삼슨전자 신입 실무자",
      title: "삼슨전자 입사",
      summary: "삼슨전자에 신입 실무자로 입사했다.",
      longNarrative: "삼슨전자의 신입 실무자로 입사해 첫 업무를 익혔다.",
      similarityKey: "partial-samson",
    }),
    buildTemplate({
      careerPath: "전문직 수습 과정",
      title: "전문직 수습 과정",
      summary: "전문직 수습 과정에 들어갔다.",
      longNarrative: "전문직 수습 과정에서 실무 기초를 다졌다.",
      similarityKey: "partial-pro",
    }),
    buildTemplate({
      careerPath: "연애와 결혼을 선택한 생활인",
      title: "연애와 결혼을 선택한 생활인",
      summary: "연애와 결혼을 선택한 생활인이 되었다.",
      longNarrative: "연애와 결혼을 선택해 일상을 함께 꾸려갔다.",
      similarityKey: "partial-marriage",
    }),
  ];
}

export function buildCompleteRecordsFixture(): CareerEndingRecord[] {
  return CODEX_CATALOG.map((slot, index) => {
    const template = MATCH_TEMPLATES.find((candidate) => slot.matches(candidate));

    if (!template) {
      throw new Error(`No fixture template matched codex slot: ${slot.id} (${slot.title})`);
    }

    return {
      ...template,
      id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      similarityKey: `${template.similarityKey}-${slot.id}`,
      createdAt: new Date(baseCreatedAt.getTime() + index * 86_400_000),
    };
  });
}

export function buildOrphanRecordFixture(): CareerEndingRecord {
  return buildRecord({
    id: "00000000-0000-4000-8000-00000000ffff",
    userId: "user-orphan",
    characterRunId: "run-orphan",
    title: "오래된 엔딩",
    summary: "어떤 도감 슬롯에도 속하지 않는 엔딩 기록이다.",
    longNarrative: "obsolete_ending_v0라는 낡은 경로로 남은 기록이다.",
    careerPath: "obsolete_ending_v0",
    jobRole: null,
    destinationName: null,
    salaryBand: null,
    workplaceTone: [],
    statSnapshot: {},
    keyRelationships: [],
    majorEvents: [],
    satisfaction: 10,
    growthPotential: 10,
    workLifeBalance: 10,
    healthState: "unknown",
    relationshipState: "unknown",
    tags: [],
    similarityKey: "orphan-obsolete",
    createdAt: baseCreatedAt,
  });
}

export function buildDuplicateRecordsFixture(): CareerEndingRecord[] {
  return [
    buildTemplate({
      careerPath: "삼슨전자 신입 실무자",
      title: "삼슨전자 입사",
      summary: "삼슨전자에 신입 실무자로 입사했다.",
      longNarrative: "가장 먼저 남겨진 삼슨전자 기록이다.",
      similarityKey: "duplicate-samson-1",
    }),
    buildTemplate({
      careerPath: "삼슨전자 신입 실무자",
      title: "삼슨전자 입사",
      summary: "삼슨전자에 신입 실무자로 입사했다.",
      longNarrative: "두 번째로 남겨진 삼슨전자 기록이다.",
      similarityKey: "duplicate-samson-2",
    }),
    buildTemplate({
      careerPath: "삼슨전자 신입 실무자",
      title: "삼슨전자 입사",
      summary: "삼슨전자에 신입 실무자로 입사했다.",
      longNarrative: "세 번째로 남겨진 삼슨전자 기록이다.",
      similarityKey: "duplicate-samson-3",
    }),
  ].map((record, index) => ({
    ...record,
    createdAt: new Date(baseCreatedAt.getTime() + index * 86_400_000),
  }));
}
