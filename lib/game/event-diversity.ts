const DEFAULT_REPEAT_THRESHOLD = 2;

export const EVENT_DIVERSITY_CATEGORIES = [
  "사소한 갈등",
  "취미/문화",
  "온라인 창작",
  "여행/외출",
  "우정/사교",
  "연애",
  "가족",
  "건강/운동",
  "돈/소비",
  "알바/일",
  "학업/수업",
  "진로/취업",
  "동아리/모임",
  "주거/생활",
  "SNS/디지털",
  "창작/도전",
  "봉사/지역사회",
  "반려동물/자연",
  "행정/돌발상황",
  "휴식/감정",
] as const;

export type EventDiversityCategory = typeof EVENT_DIVERSITY_CATEGORIES[number];

const STORY_CATEGORY_ANCHORS: EventDiversityCategory[] = [
  "학업/수업",
  "진로/취업",
  "우정/사교",
  "돈/소비",
  "휴식/감정",
];

export const DEFAULT_STORY_CATEGORY_LIMIT = 9;

const CATEGORY_KEYWORDS: Record<EventDiversityCategory, string[]> = {
  "사소한 갈등": ["다툼", "말다툼", "오해", "갈등", "새치기", "소음", "약속", "눈치", "민폐", "실수", "서운"],
  "취미/문화": ["취미", "문화", "뮤지컬", "공연", "콘서트", "연극", "전시", "영화", "독서", "게임", "음악", "밴드", "축제", "페스티벌"],
  "온라인 창작": ["인플루언서", "버튜버", "스트리머", "방송", "라이브", "크리에이터", "콘텐츠", "영상", "채널", "팬", "구독자"],
  "여행/외출": ["여행", "해외", "국내여행", "당일치기", "캠핑", "호캉스", "교환학생", "워홀", "소풍", "나들이"],
  "우정/사교": ["우정", "친구", "동창", "소개팅", "모임", "친목", "파티", "생일", "동기", "선배", "후배"],
  "연애": ["연애", "썸", "데이트", "고백", "애인", "이별", "결혼"],
  "가족": ["가족", "본가", "부모", "엄마", "아빠", "형제", "자매", "친척"],
  "건강/운동": ["건강", "운동", "병원", "감기", "부상", "헬스", "러닝", "요가", "수영", "등산"],
  "돈/소비": ["돈", "소비", "쇼핑", "중고거래", "월세", "카드", "저축", "투자", "택배", "환불"],
  "알바/일": ["알바", "아르바이트", "근무", "점장", "손님", "급여", "퇴근", "출근"],
  "학업/수업": ["학업", "스터디", "시험", "수업", "과제", "교수", "연구실", "자격증", "실습", "도서관"],
  "진로/취업": ["취업", "진로", "면접", "지원서", "회사", "인턴", "채용", "포트폴리오"],
  "동아리/모임": ["동아리", "학생회", "학회", "소모임", "회식", "MT", "리더십"],
  "주거/생활": ["주거", "자취", "기숙사", "룸메", "하숙", "이사", "집주인", "고장", "청소", "요리"],
  "SNS/디지털": ["SNS", "인스타", "커뮤니티", "온라인", "디지털", "댓글", "DM", "메신저", "계정"],
  "창작/도전": ["창작", "공모전", "글쓰기", "그림", "사진", "작곡", "댄스", "무대", "오디션", "프로젝트"],
  "봉사/지역사회": ["봉사", "기부", "지역사회", "플리마켓", "환경", "캠페인", "멘토링"],
  "반려동물/자연": ["반려동물", "강아지", "고양이", "동물", "식물", "공원", "자연", "구조"],
  "행정/돌발상황": ["행정", "서류", "분실", "신고", "민원", "교통", "지연", "정전", "택배", "사고"],
  "휴식/감정": ["휴식", "번아웃", "스트레스", "우울", "불안", "낮잠", "상담", "혼자", "마음"],
};

export function eventCategoryExamples(category: string) {
  return CATEGORY_KEYWORDS[category as EventDiversityCategory]?.slice(0, 8) ?? [];
}

export function normalizeEventCategory(value: string): string {
  const normalized = value.trim();
  const direct = EVENT_DIVERSITY_CATEGORIES.find((category) => category === normalized);
  if (direct) return direct;
  const lower = normalized.toLowerCase();
  for (const category of EVENT_DIVERSITY_CATEGORIES) {
    if (CATEGORY_KEYWORDS[category].some((keyword) => lower.includes(keyword.toLowerCase()))) return category;
  }
  return normalized;
}

export function eventMatchesCategory(
  category: string,
  event: { title?: string; body?: string; tags?: string[] },
) {
  const normalizedTags = (event.tags ?? []).map(normalizeEventCategory);
  if (normalizedTags.includes(category)) return true;
  const text = [event.title, event.body, ...(event.tags ?? [])].filter(Boolean).join(" ").toLowerCase();
  return eventCategoryExamples(category).some((keyword) => text.includes(keyword.toLowerCase()));
}

/**
 * Finds persisted people who actually appeared in recent scenes. This keeps a
 * familiar cast available without making the same person drive consecutive events.
 */
export function collectRecentPeople(
  history: Array<{
    event?: { title?: string | null; body?: string | null };
    relationshipDelta?: unknown;
  }>,
  relationships: Array<{ name: string }>,
) {
  const persistedNames = relationships
    .map(({ name }) => name.trim())
    .filter(Boolean);
  const recentPeople: string[] = [];

  for (const item of history) {
    const sceneText = `${item.event?.title ?? ""} ${item.event?.body ?? ""}`;
    const deltaNames = Array.isArray(item.relationshipDelta)
      ? item.relationshipDelta
        .map((delta) => typeof delta === "object" && delta !== null ? (delta as Record<string, unknown>).name : null)
        .filter((name): name is string => typeof name === "string")
      : [];

    for (const name of persistedNames) {
      if ((sceneText.includes(name) || deltaNames.includes(name)) && !recentPeople.includes(name)) {
        recentPeople.push(name);
      }
    }
  }

  return {
    recentPeople,
    avoidPeople: recentPeople.slice(0, 3),
  };
}

/** Keep one run cohesive by drawing repeatedly from a stable, personalized palette. */
export function selectStoryCategoryPalette(
  storySeed: string,
  limit = DEFAULT_STORY_CATEGORY_LIMIT,
): EventDiversityCategory[] {
  const optional = EVENT_DIVERSITY_CATEGORIES.filter((category) => !STORY_CATEGORY_ANCHORS.includes(category));
  let state = [...storySeed].reduce((hash, char) => ((hash * 31) + char.charCodeAt(0)) >>> 0, 2166136261);
  const shuffled = [...optional];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    state = ((state * 1664525) + 1013904223) >>> 0;
    const swapIndex = state % (index + 1);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return [...STORY_CATEGORY_ANCHORS, ...shuffled].slice(0, Math.max(STORY_CATEGORY_ANCHORS.length, limit));
}

/** Select one concrete underrepresented life area instead of giving the model a vague list. */
export function buildDiversityCategoryGuidance(
  recentCategories: string[],
  allCategories: readonly string[] = EVENT_DIVERSITY_CATEGORIES,
  repeatThreshold = DEFAULT_REPEAT_THRESHOLD,
  requireNewCategory = true,
) {
  const normalizedRecent = recentCategories.map(normalizeEventCategory);
  const normalizedAllCategories = [...new Set(allCategories.map(normalizeEventCategory))];
  const counts = normalizedRecent.reduce<Record<string, number>>((result, category) => {
    result[category] = (result[category] ?? 0) + 1;
    return result;
  }, {});
  const immediateCategories = [...new Set(normalizedRecent.slice(0, 2))];
  const repeatedCategories = Object.entries(counts)
    .filter(([, count]) => count >= repeatThreshold)
    .map(([category]) => category);
  const avoidCategories = [...new Set([...immediateCategories, ...repeatedCategories])];
  const eligible = normalizedAllCategories.filter((category) => !immediateCategories.includes(category));
  const minimumCount = Math.min(...eligible.map((category) => counts[category] ?? 0));
  const leastUsed = eligible.filter((category) => (counts[category] ?? 0) === minimumCount);
  const seed = normalizedRecent.join("|").split("").reduce((total, char) => total + char.charCodeAt(0), 0);
  const targetCategory = requireNewCategory
    ? (leastUsed[seed % Math.max(1, leastUsed.length)] ?? normalizedAllCategories[0])
    : null;
  const preferCategories = [
    ...(targetCategory ? [targetCategory] : []),
    ...leastUsed.filter((category) => category !== targetCategory),
    ...eligible.filter((category) => !leastUsed.includes(category)),
  ].slice(0, 4);

  return { avoidCategories, preferCategories, targetCategory };
}
