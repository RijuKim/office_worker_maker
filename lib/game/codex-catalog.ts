import type { CareerEndingRecord } from "@prisma/client";

import type { EndingArtType } from "@/lib/game/ending-art";

export type CodexCategory =
  | "회사취업"
  | "전문직"
  | "공공안전"
  | "창업"
  | "자영업"
  | "대학원"
  | "결혼"
  | "육아"
  | "혼자살기"
  | "해외"
  | "자퇴"
  | "번아웃"
  | "기타";

export type CodexSlot = {
  id: string;
  title: string;
  category: CodexCategory;
  categoryHint: string;
  endingArtType: EndingArtType;
  matches: (record: CareerEndingRecord) => boolean;
};

export const CATEGORY_ORDER: CodexCategory[] = [
  "회사취업",
  "전문직",
  "공공안전",
  "창업",
  "자영업",
  "대학원",
  "결혼",
  "육아",
  "혼자살기",
  "해외",
  "자퇴",
  "번아웃",
  "기타",
];

const CATEGORY_HINTS: Record<CodexCategory, string> = {
  회사취업: "특정 회사에 신입으로 취업했다면...",
  전문직: "전문직 시험에 도전했다면...",
  공공안전: "공공안전 직무에 도전했다면...",
  창업: "새로운 사업을 시작했다면...",
  자영업: "혼자서 가게나 프리랜서 일을 꾸려간다면...",
  대학원: "학업과 연구를 더 이어가고 싶다면...",
  결혼: "연애가 결혼으로 이어졌다면...",
  육아: "아이를 돌보는 삶이 중심이라면...",
  혼자살기: "혼자 지내며 생활을 다져가는 이야기라면...",
  해외: "해외 생활이나 워홀을 다녀왔다면...",
  자퇴: "학업을 중단하고 다른 길을 찾았다면...",
  번아웃: "과로와 소진으로 흔들렸다면...",
  기타: "특정 카테고리에 딱 들어맞지 않지만 중요한 진로라면...",
};

export function getCategoryHint(category: CodexCategory): string {
  return CATEGORY_HINTS[category];
}

type SlotMatcher = (record: CareerEndingRecord) => boolean;

const exactCareerPath = (careerPath: string): SlotMatcher => (record) => record.careerPath === careerPath;

const tagPool = (tags: CareerEndingRecord["tags"]): string[] => {
  if (!Array.isArray(tags)) return [];
  return tags.flatMap((value) => (typeof value === "string" ? [value] : []));
};

const hasAnyTag = (...needles: string[]): SlotMatcher => (record) => {
  const tags = tagPool(record.tags);
  const normalized = tags.map((tag) => tag.toLowerCase());
  return needles.some((needle) => normalized.includes(needle.toLowerCase()));
};

const slot = (
  id: string,
  title: string,
  category: CodexCategory,
  endingArtType: EndingArtType,
  matches: SlotMatcher,
): CodexSlot => ({
  id,
  title,
  category,
  categoryHint: getCategoryHint(category),
  endingArtType,
  matches,
});

export const CODEX_CATALOG = [
  // 회사취업
  slot("company-samson", "삼슨전자", "회사취업", "company", exactCareerPath("삼슨전자 신입 실무자")),
  slot("company-navaer", "네이봐", "회사취업", "company", exactCareerPath("네이봐 신입 실무자")),
  slot("company-kakango", "카캉오", "회사취업", "company", exactCareerPath("카캉오 신입 실무자")),
  slot("company-baedali", "배달이민족", "회사취업", "company", exactCareerPath("배달이민족 신입 실무자")),
  slot("company-google-kr", "규글코리아", "회사취업", "company", exactCareerPath("규글코리아 신입 실무자")),
  slot("company-starbuks", "스타벅수커피", "회사취업", "company", exactCareerPath("스타벅수커피 신입 실무자")),
  slot("company-lg", "엘쥐전자", "회사취업", "company", exactCareerPath("엘쥐전자 신입 실무자")),
  slot("company-hyundja", "현댜모터스", "회사취업", "company", exactCareerPath("현댜모터스 신입 실무자")),
  slot("company-skiritel", "에스끼리텔", "회사취업", "company", exactCareerPath("에스끼리텔 신입 실무자")),

  // 전문직
  slot("professional-trainee", "전문직 수습 과정", "전문직", "professional", exactCareerPath("전문직 수습 과정")),
  slot("professional-retake", "전문직 시험 재도전", "전문직", "professional", exactCareerPath("전문직 시험 재도전")),

  // 공공안전
  slot("public-safety-pass", "공공안전 직무 합격자", "공공안전", "public_safety", exactCareerPath("공공안전 직무 합격자")),
  slot("public-safety-prep", "공공안전 직무 준비생", "공공안전", "public_safety", exactCareerPath("공공안전 직무 준비생")),

  // 창업
  slot("startup-selected", "새싹엔진 선정 창업자", "창업", "startup", exactCareerPath("새싹엔진 선정 창업자")),

  // 자영업
  slot("self-employment", "창업 또는 자영업", "자영업", "self_employment", exactCareerPath("창업 또는 자영업")),

  // 결혼
  slot("marriage-life", "연애와 결혼을 선택한 생활인", "결혼", "marriage", exactCareerPath("연애와 결혼을 선택한 생활인")),

  // 혼자살기
  slot("solitude-alone", "혼자 살며 조용히 안정된 사람", "혼자살기", "solitude", exactCareerPath("혼자 살며 조용히 안정된 사람")),

  // 해외
  slot("overseas-working-holiday", "해외 워홀 이후 다시 길을 찾은 사람", "해외", "overseas", exactCareerPath("해외 워홀 이후 다시 길을 찾은 사람")),

  // 자퇴
  slot("dropout-midway", "중도 이탈", "자퇴", "dropout", exactCareerPath("자퇴 후 진로")),

  // 번아웃
  slot("burnout-health", "건강 붕괴", "번아웃", "burnout", hasAnyTag("건강", "health")),
  slot("burnout-mental", "멘탈 붕괴", "번아웃", "burnout", hasAnyTag("멘탈", "mental")),
  slot("burnout-reputation", "평판 붕괴", "번아웃", "burnout", hasAnyTag("평판", "reputation")),

  // 기타
  slot("misc-danger-money", "위험한 돈에서 겨우 발을 뺀 생존자", "기타", "default", exactCareerPath("위험한 돈에서 겨우 발을 뺀 생존자")),
  slot("misc-private-investigator", "사설 조사 보조원", "기타", "default", exactCareerPath("사설 조사 보조원")),
  slot("misc-marketing-content", "마케팅·콘텐츠 직무", "기타", "default", exactCareerPath("마케팅·콘텐츠 직무")),
  slot("misc-company-reapply", "기업 채용 재도전", "기타", "company", exactCareerPath("기업 채용 재도전")),
  slot("misc-first-job", "첫 직장 신입 실무자", "기타", "company", exactCareerPath("첫 직장 신입 실무자")),
  slot("misc-interview-reapply", "기업 면접 탈락 후 재지원 준비", "기타", "company", exactCareerPath("기업 면접 탈락 후 재지원 준비")),
  slot("misc-public-service-prep", "공공기관 또는 공무원 준비", "기타", "public_safety", exactCareerPath("공공기관 또는 공무원 준비")),
  slot("misc-professional-prep", "전문직 시험 준비생", "기타", "professional", exactCareerPath("전문직 시험 준비생")),
  slot("misc-uncertain-job-search", "불확실하지만 계속되는 취업 준비", "기타", "company", exactCareerPath("불확실하지만 계속되는 취업 준비")),
  slot("misc-first-rejection", "첫 지원 탈락 후 이어지는 준비", "기타", "company", exactCareerPath("첫 지원 탈락 후 이어지는 준비")),
  slot("misc-startup-screening-failed", "창업 심사 탈락 후 아이디어 검증", "기타", "startup", exactCareerPath("창업 심사 탈락 후 아이디어 검증")),
  slot("misc-public-safety-retry", "공공안전 전형 재준비", "기타", "public_safety", exactCareerPath("공공안전 전형 재준비")),
  slot("misc-after-graduation-job", "졸업 후 취업", "기타", "company", exactCareerPath("졸업 후 취업")),
  slot("misc-while-leave-of-absence", "휴학 중 경험", "기타", "default", exactCareerPath("휴학 중 경험")),
  slot("misc-career-exploration", "진로 탐색", "기타", "default", exactCareerPath("진로 탐색")),
  slot("misc-final-gate-prep", "마지막 관문을 앞둔 진로 준비", "기타", "default", exactCareerPath("마지막 관문을 앞둔 진로 준비")),
] as const satisfies readonly CodexSlot[];
