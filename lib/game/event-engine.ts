import { checkForcedEvent } from "@/lib/game/game-rules";
import type {
  AcademicPlan,
  DestinationCandidate,
  GraduationState,
  LifeStageId,
} from "@/lib/game/life-stage";
import { CONDITIONAL_STATIC_EVENTS, STATIC_EVENTS } from "@/lib/game/event-fallbacks";

export { CONDITIONAL_STATIC_EVENTS, STATIC_EVENTS } from "@/lib/game/event-fallbacks";

type PublicStats = Record<string, number>;

export interface EventSelectionContext {
  burnoutRisk: number;
  major?: string;
  coreEventCount?: number;
  age?: number;
  gradeYear?: number | null;
  residence?: string | null;
  stats?: PublicStats;
  relationships?: { name: string; trust: number; role?: string }[];
  eventFlags?: Record<string, unknown>;
  lifeStage?: LifeStageId;
  academicPlan?: AcademicPlan;
  graduation?: GraduationState;
  destinationCandidates?: DestinationCandidate[];
  recentTags?: string[];
  recentRelationshipNames?: string[];
  previousChoiceSummary?: string;
  specs?: { specType: string; specName: string; status: string; score?: string | null }[];
  jobApplications?: { companyName: string; companyType?: string; currentStage: string; isActive: boolean }[];
  careerPaths?: { pathType: string; pathName?: string; status: string }[];
}

export interface ConditionalEvent extends StaticEvent {
  /** Legacy dramatic slots used only to place the hand-authored event pool. */
  arcIds: LegacyStoryArcId[];
  condition: {
    anyFlags?: string[];
    requiredFlags?: Record<string, unknown>;
    blockedFlags?: string[];
    statBelow?: Partial<Record<string, number>>;
    statAbove?: Partial<Record<string, number>>;
    minTrust?: { name: string; trust: number };
    maxTrust?: { name: string; trust: number };
    residences?: string[];
    gradeYears?: number[];
    minAge?: number;
    maxAge?: number;
    lifeStages?: LifeStageId[];
    graduationStates?: GraduationState[];
    requiredDestinationKinds?: DestinationCandidate["kind"][];
    requiredSpecs?: string[];
    requiredApplicationStage?: string;
    requiredCareerPath?: string;
    specScoreBelow?: number;
    specScoreAbove?: number;
  };
}

export type StoryArcId = "arrival" | "belonging" | "proof" | "fracture" | "reckoning" | "narrowing" | "finale" | "aftermath";
export type LegacyStoryArcId = "settling" | "commitment" | "pressure" | "consequence" | "future";
export type StoryAxis = "생존" | "능력" | "관계" | "정체성";

export interface StoryArcDefinition {
  id: StoryArcId;
  title: string;
  phase: string;
  eventRange: [number, number];
  openThread: string;
  dramaticQuestion: string;
  focusAxes: StoryAxis[];
  /** Keeps existing hand-authored events available while the dramatic spine evolves. */
  compatibleEventSlots: LegacyStoryArcId[];
}

export const STORY_CORE_QUESTION = "취업할 수 있는 사람이 되어가는 동안, 돈·관계·건강·자존감 중 무엇을 지키고 무엇을 포기할 것인가?";

export const STORY_ARCS: StoryArcDefinition[] = [
  { id: "arrival", title: "빈손으로 시작하기", phase: "발단", eventRange: [0, 2], openThread: "돈도 인맥도 경험도 부족한 상태에서, 어떤 사람이 되어야 살아남을 수 있을지 첫 기준을 세운다", dramaticQuestion: "나는 무엇부터 지키며 시작할 것인가?", focusAxes: ["생존", "정체성"], compatibleEventSlots: ["settling"] },
  { id: "belonging", title: "내 자리를 만드는 법", phase: "전개", eventRange: [3, 5], openThread: "동아리, 알바, 연구실, 스터디 중 하나에 발을 들이고 동료와 경쟁자, 첫 번째 책임을 얻는다", dramaticQuestion: "어디에 속하고 누구에게 책임질 것인가?", focusAxes: ["관계", "능력"], compatibleEventSlots: ["settling", "commitment"] },
  { id: "proof", title: "처음 얻은 증명", phase: "상승", eventRange: [6, 8], openThread: "첫 성과와 인정이 찾아오지만, 이를 유지하기 위해 돈과 시간, 관계 중 하나를 희생해야 한다", dramaticQuestion: "인정을 유지하기 위해 무엇까지 치를 것인가?", focusAxes: ["능력", "생존"], compatibleEventSlots: ["commitment", "pressure"] },
  { id: "fracture", title: "잘하고 있는 줄 알았는데", phase: "위기", eventRange: [9, 12], openThread: "실패, 배신, 경제적 문제 또는 비교로 인해 지금까지 선택한 방식이 흔들리기 시작한다", dramaticQuestion: "지금까지 믿은 방식이 깨질 때 무엇을 바꿀 것인가?", focusAxes: ["정체성", "관계"], compatibleEventSlots: ["pressure", "consequence"] },
  { id: "reckoning", title: "미뤄둔 선택의 청구서", phase: "심화", eventRange: [13, 16], openThread: "초반에 외면했던 사람과 문제들이 돌아오고, 쌓아온 평판과 관계가 실제 결과를 만든다", dramaticQuestion: "과거 선택의 이익과 비용을 어떻게 감당할 것인가?", focusAxes: ["관계", "생존", "정체성"], compatibleEventSlots: ["consequence"] },
  { id: "narrowing", title: "모든 길을 갈 수는 없다", phase: "결단", eventRange: [17, 19], openThread: "취업, 대학원, 창업, 시험, 생계 중 하나를 우선하며 나머지 가능성을 직접 포기해야 한다", dramaticQuestion: "어떤 길을 택하고 어떤 가능성을 놓아줄 것인가?", focusAxes: ["정체성", "생존", "능력"], compatibleEventSlots: ["consequence", "future"] },
  { id: "finale", title: "마지막으로 증명할 것", phase: "절정", eventRange: [20, 22], openThread: "최종 지원과 면접을 앞두고 성공을 위해 자신을 얼마나 노력하거나 꾸미거나 배신할지 결정한다", dramaticQuestion: "마지막 기회 앞에서 어떤 모습의 나를 증명할 것인가?", focusAxes: ["능력", "정체성"], compatibleEventSlots: ["future"] },
  { id: "aftermath", title: "합격 다음 날", phase: "결말", eventRange: [23, 24], openThread: "취업 여부뿐 아니라 돈, 건강, 관계, 평판과 자신에 대한 믿음이 어떤 삶으로 이어지는지 보여준다", dramaticQuestion: "결과 뒤에 남은 삶은 내가 원한 삶인가?", focusAxes: ["생존", "관계", "정체성"], compatibleEventSlots: ["future"] },
];

export interface StaticEventChoice {
  id: string;
  label: string;
  summary: string;
  statDelta: Record<string, number>;
  relationshipDelta: { name: string; trust: number; status?: "acquaintance" | "friend" | "crush" | "dating" | "ex" }[];
  flagDelta: Record<string, unknown>;
}

export interface StaticEvent {
  title: string;
  body: string;
  choices: StaticEventChoice[];
  tags: string[];
  source: "STATIC" | "AI" | "FALLBACK" | "FORCED";
}

const CHARACTER_NAME_PLACEHOLDER = /00|ㅇㅇ|○○|OO/g;

/** Replace legacy player-name placeholders before an event is persisted or shown. */
export function personalizeEvent(event: StaticEvent, characterName: string): StaticEvent {
  const replaceName = (text: string) => text.replace(CHARACTER_NAME_PLACEHOLDER, characterName);

  return {
    ...event,
    title: replaceName(event.title),
    body: replaceName(event.body),
    choices: event.choices.map((choice) => ({
      ...choice,
      label: replaceName(choice.label),
      summary: replaceName(choice.summary),
    })),
  };
}

const QUARANTINED_LEGACY_EVENT_TITLES = new Set([
  "헬스장에서 만난 사람",
  "도서관의 노인",
]);

export function pickRandomStaticEvent(excludeTitles?: string[], context?: EventSelectionContext): StaticEvent {
  const arc = getStoryArc(context?.coreEventCount ?? 0);
  const hasChosenCareerPath = context?.eventFlags?.careerPathChosen === true;
  const conditionalPool = context ? CONDITIONAL_STATIC_EVENTS
    .filter((event) => event.arcIds.some((slot) => arc.compatibleEventSlots.includes(slot)))
    .filter((event) => !excludeTitles?.includes(event.title))
    .filter((event) => !hasChosenCareerPath || !event.tags.includes("진로"))
    .map((event) => ({ event, score: scoreConditionalEvent(event, context) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score) : [];

  if (conditionalPool.length > 0) {
    const bestScore = conditionalPool[0].score;
    const bestPool = conditionalPool.filter(({ score }) => score === bestScore);
    return bestPool[Math.floor(Math.random() * bestPool.length)].event;
  }

  const filteredPool = (excludeTitles?.length
    ? STATIC_EVENTS.filter((e) => !excludeTitles.includes(e.title))
    : STATIC_EVENTS)
    .filter((event) => !QUARANTINED_LEGACY_EVENT_TITLES.has(event.title))
    .filter((event) => !context || isEventAllowedForLifeStage(event, context))
    .filter((event) => !hasChosenCareerPath || !event.tags.includes("진로"));
  const pool = filteredPool.length > 0
    ? filteredPool
    : STATIC_EVENTS.filter((event) => !QUARANTINED_LEGACY_EVENT_TITLES.has(event.title));
  return pickWeightedStaticEvent(pool, context);
}

export function buildDropoutNextStepEvent(): StaticEvent {
  return {
    title: "학교 밖에서 다시 짜는 하루",
    body: `자퇴 처리가 끝난 뒤에도 아침은 평소처럼 온다. 달라진 것은 더 이상 시간표가 하루를 대신 정해주지 않는다는 점이다. 휴대폰에는 밀린 생활비, 가족에게 설명해야 할 말, 그리고 아직 지우지 못한 채용 공고와 포트폴리오 폴더가 나란히 남아 있다.

당신은 이제 다음 학기 계획이 아니라 학교 밖에서 이어질 생활을 정해야 한다. 이 선택은 실패를 만회하는 버튼이 아니라, 남은 체력과 돈과 관계를 어디에 먼저 쓸지 정하는 현실적인 시작점에 가깝다.`,
    choices: [
      {
        id: "dropout_rebuild_portfolio",
        label: "작은 일부터 맡을 수 있게 포트폴리오를 다시 정리한다.",
        summary: "당신은 학교 밖에서 보여줄 수 있는 작업 기록을 다시 묶기 시작했다.",
        statDelta: { practical: 4, mental: -2, health: -1, reputation: 1 },
        relationshipDelta: [],
        flagDelta: { dropoutPath: "portfolio_rebuild" },
      },
      {
        id: "dropout_stabilize_life",
        label: "당장 버틸 수 있도록 생활비와 수면부터 안정시킨다.",
        summary: "당신은 진로 결정보다 생활 기반을 먼저 복구하기로 했다.",
        statDelta: { health: 3, mental: 3, wealth: -2, reputation: -1 },
        relationshipDelta: [],
        flagDelta: { dropoutPath: "life_stabilized" },
      },
      {
        id: "dropout_talk_family",
        label: "가족에게 자퇴 이후 계획을 숨기지 않고 설명한다.",
        summary: "당신은 불편한 대화를 피하지 않고 앞으로의 계획을 꺼냈다.",
        statDelta: { mental: -3, reputation: 2, wealth: 1, charm: -1 },
        relationshipDelta: [{ name: "부모님", trust: 5 }],
        flagDelta: { dropoutPath: "family_plan_shared" },
      },
    ],
    tags: ["자퇴", "진로", "회복"],
    source: "FALLBACK" as const,
  };
}

export function buildHealthCrisisEvent(): StaticEvent {
  return {
    title: "건강 이상 신호",
    body: `아침에 일어나자 몸이 평소와 다르다. 열이 오른 것 같고, 목은 칼칼하며, 온몸이 무겁게 가라앉는다. 거울 속 얼굴은 창백하고 눈 밑에는 그늘이 졌다.

당신은 이 신호를 무시하고 평소처럼 하루를 보낼 수도 있다. 하지만 몸이 보내는 경고를 계속 외면하면 더 큰 대가를 치를 수도 있다. 지금 필요한 것은 회복을 위한 선택이다.`,
    choices: [
      {
        id: "visit_hospital",
        label: "병원에 가서 제대로 진료를 받는다.",
        summary: "당신은 병원에서 진료를 받고 약을 처방받아 회복에 집중했다.",
        statDelta: { health: 10, mental: 2, wealth: -15, practical: -3, academic: -2 },
        relationshipDelta: [],
        flagDelta: { healthCrisisResolved: "hospital" },
      },
      {
        id: "rest_at_home",
        label: "집에서 푹 쉰다. 약이라도 먹고.",
        summary: "당신은 집에서 휴식을 취하며 컨디션을 회복했다.",
        statDelta: { health: 6, mental: 3, wealth: -3, practical: -2, academic: -1 },
        relationshipDelta: [],
        flagDelta: { healthCrisisResolved: "rest" },
      },
      {
        id: "ask_for_help",
        label: "가족이나 친구에게 도움을 요청한다.",
        summary: "당신은 주변의 도움을 받으며 몸과 마음을 추스렸다.",
        statDelta: { health: 5, mental: 4, charm: 1, wealth: -5, practical: -1 },
        relationshipDelta: [],
        flagDelta: { healthCrisisResolved: "social" },
      },
    ],
    tags: ["위기", "건강", "회복"],
    source: "FORCED" as const,
  };
}

export function buildBurnoutEvent(): StaticEvent {
  return {
    title: "번아웃 위기",
    body: `아침에 눈을 떴지만, 일어날 의욕이 전혀 들지 않는다. 머리는 안개가 낀 것처럼 흐릿하고, 아무것도 하고 싶지 않다. 해야 할 일은 산처럼 쌓여 있지만, 그걸 생각할수록 더 깊은 무기력이 밀려온다.

당신은 이 상태가 단순한 게으름이 아니라는 것을 안다. 정신적으로 지친 것이다. 계속 밀어붙이면 당장은 버틸 수 있겠지만, 그 대가는 점점 커질 것이다. 지금 필요한 것은 멘탈 회복을 위한 선택이다.`,
    choices: [
      {
        id: "rest_properly",
        label: "며칠 푹 쉰다. 아무 생각도 하지 않는다.",
        summary: "당신은 충분한 휴식을 통해 정신적 피로를 회복하기 시작했다.",
        statDelta: { mental: 10, health: 4, academic: -3, practical: -2 },
        relationshipDelta: [],
        flagDelta: { burnoutRecovered: "rest" },
      },
      {
        id: "seek_counseling",
        label: "학교 상담센터를 방문한다.",
        summary: "당신은 전문가의 도움을 받으며 정신 건강을 관리했다.",
        statDelta: { mental: 12, health: 2, reputation: 1 },
        relationshipDelta: [],
        flagDelta: { burnoutRecovered: "counseling" },
      },
      {
        id: "talk_to_friend",
        label: "가까운 친구에게 속마음을 털어놓는다.",
        summary: "당신은 친구에게 마음을 열고 정서적 지지를 받았다.",
        statDelta: { mental: 8, charm: 2, health: 1 },
        relationshipDelta: [],
        flagDelta: { burnoutRecovered: "social_support" },
      },
    ],
    tags: ["위기", "멘탈", "번아웃", "회복"],
    source: "FORCED" as const,
  };
}

export function selectNextEvent(
  currentHiddenState: EventSelectionContext,
  recentEventTitles: string[],
): { type: "forced" | "normal"; event: StaticEvent } {
  // The previous choice is already shown in the choice-result panel. It is
  // still available in the selection context for continuity decisions, but
  // must not be prepended to the next story body or it is rendered twice.
  return pickBaseEvent(currentHiddenState, recentEventTitles);
}

function pickBaseEvent(
  currentHiddenState: EventSelectionContext,
  recentEventTitles: string[],
): { type: "forced" | "normal"; event: StaticEvent } {
  if (currentHiddenState.lifeStage === "dropout") {
    return { type: "normal", event: buildDropoutNextStepEvent() };
  }

  const forced = checkForcedEvent(currentHiddenState);

  if (forced?.type === "burnout") {
    return { type: "forced", event: buildBurnoutEvent() };
  }

  const contextualGate = buildContextualCareerGateEvent(currentHiddenState, recentEventTitles);
  if (contextualGate) {
    return { type: "normal", event: contextualGate };
  }

  return { type: "normal", event: pickRandomStaticEvent(recentEventTitles, currentHiddenState) };
}

function buildContextualCareerGateEvent(
  context: EventSelectionContext,
  recentEventTitles: string[],
): StaticEvent | null {
  const isLateGate =
    context.lifeStage === "college_late" &&
    (context.graduation === "gate_ready" || (context.coreEventCount ?? 0) >= 14);
  if (!isLateGate) return null;

  const activeApplication = context.jobApplications?.find((app) => app.isActive);
  const activeSpec = context.specs?.find((spec) => spec.status === "IN_PROGRESS");
  const activePath = context.careerPaths?.find((path) => path.status !== "COMPLETED" && path.status !== "FAILED");
  const trustedPerson = [...(context.relationships ?? [])].sort((a, b) => b.trust - a.trust)[0];
  const lowStat = Object.entries(context.stats ?? {})
    .filter(([key]) => ["health", "mental", "wealth", "reputation"].includes(key))
    .sort((a, b) => a[1] - b[1])[0]?.[0];

  const focus = activeApplication
    ? `${activeApplication.companyName} ${formatApplicationStage(activeApplication.currentStage)}`
    : activeSpec
      ? `${activeSpec.specName} 마감`
      : activePath
        ? `${activePath.pathName || activePath.pathType} 진로 점검`
        : "졸업 전 마지막 진로 점검";

  const title = activeApplication
    ? `${activeApplication.companyName} ${formatApplicationStage(activeApplication.currentStage)} 전날`
    : activeSpec
      ? `${activeSpec.specName} 마감 전날`
      : activePath
        ? `${activePath.pathName || "진로 트랙"} 마지막 점검`
        : "졸업 전 마지막 갈림길";

  if (recentEventTitles.includes(title)) return null;

  const continuity = "지나온 선택들은 성적표보다 더 복잡한 모양으로 당신의 책상 위에 쌓여 있다.";
  const relationshipLine = trustedPerson
    ? `${trustedPerson.name}에게 연락하면 도움은 받을 수 있겠지만, 그 관계에도 부담이 생길 것이다.`
    : "이번에는 대신 결정해 줄 사람이 없다.";
  const pressureLine = lowStat
    ? `${formatStatName(lowStat)}이 부족하다는 감각도 계속 발목을 잡는다.`
    : "능력치는 충분해 보여도, 마지막 문턱 앞에서는 작은 빈틈이 크게 보인다.";

  // This contextual career gate is authored locally and must remain STATIC.
  return {
    title,
    body: `${continuity}

오늘의 초점은 ${focus}이다. 서류 한 줄, 면접 답변 하나, 포트폴리오의 순서, 추천을 부탁할 사람까지 모두 지난 몇 년의 행보를 다시 묻고 있다. ${relationshipLine}

${pressureLine} 이번 선택은 단순히 합격과 불합격을 고르는 문제가 아니다. 지금까지 만든 기록 중 무엇을 앞세우고, 무엇을 감추고, 어떤 길을 포기하지 않을지 정해야 한다.`,
    choices: [
      {
        id: "contextual_gate_use_history",
        label: "지금까지 해낸 일을 직무와 연결해 정리한다.",
        summary: "당신은 흩어진 경험을 하나의 지원 논리로 엮었다.",
        statDelta: { practical: 3, reputation: 1, mental: -3, health: -1 },
        relationshipDelta: [],
        flagDelta: { careerGateAttempt: { path: "contextual", approach: "history_based" }, contextualCareerGate: true },
      },
      {
        id: "contextual_gate_ask_support",
        label: trustedPerson ? `${trustedPerson.name}에게 조언을 구한다.` : "믿을 만한 사람에게 조언을 구한다.",
        summary: "당신은 혼자 판단하지 않고 관계 속에서 마지막 전략을 조정했다.",
        statDelta: { charm: 2, reputation: 1, mental: -2, wealth: -1 },
        relationshipDelta: trustedPerson ? [{ name: trustedPerson.name, trust: 3 }] : [],
        flagDelta: { careerGateAttempt: { path: "contextual", approach: "relationship_support" }, contextualCareerGate: true },
      },
      {
        id: "contextual_gate_widen_options",
        label: "한 곳에 매달리지 않고 다른 선택지도 같이 열어둔다.",
        summary: "당신은 마지막 관문을 하나의 문으로만 보지 않기로 했다.",
        statDelta: { mental: 2, practical: 1, reputation: -1, wealth: -2 },
        relationshipDelta: [],
        flagDelta: { careerGateAttempt: { path: "contextual", approach: "portfolio_of_options" }, contextualCareerGate: true },
      },
    ],
    tags: ["졸업", "진로", "지원서", "면접"],
    source: "STATIC",
  };
}

function formatApplicationStage(stage: string) {
  const labels: Record<string, string> = {
    DOCUMENT: "서류 전형",
    PERSONALITY_TEST: "인성검사",
    CODING_TEST: "코딩테스트",
    FIRST_INTERVIEW: "1차 면접",
    SECOND_INTERVIEW: "2차 면접",
    FINAL_RESULT: "최종 결과",
  };
  return labels[stage] ?? stage;
}

function formatStatName(stat: string) {
  const labels: Record<string, string> = {
    health: "건강",
    mental: "멘탈",
    wealth: "자산",
    reputation: "평판",
  };
  return labels[stat] ?? stat;
}

export function getStoryArc(coreEventCount: number) {
  return STORY_ARCS.find((arc) => coreEventCount >= arc.eventRange[0] && coreEventCount <= arc.eventRange[1])
    ?? STORY_ARCS[STORY_ARCS.length - 1];
}

function scoreConditionalEvent(event: ConditionalEvent, context: EventSelectionContext) {
  const flags = context.eventFlags ?? {};
  let score = 0;

  if (!isEventAllowedForLifeStage(event, context)) return 0;

  if (event.condition.lifeStages) {
    if (!context.lifeStage || !event.condition.lifeStages.includes(context.lifeStage)) return 0;
    score += 4;
  }

  if (event.condition.graduationStates) {
    if (!context.graduation || !event.condition.graduationStates.includes(context.graduation)) return 0;
    score += 4;
  }

  if (event.condition.requiredDestinationKinds) {
    const eligibleKinds = new Set(
      context.destinationCandidates
        ?.filter((candidate) => candidate.status === "introduced" || candidate.status === "applied" || candidate.status === "gate_passed")
        .map((candidate) => candidate.kind) ?? [],
    );
    if (!event.condition.requiredDestinationKinds.some((kind) => eligibleKinds.has(kind))) return 0;
    score += 4;
  }

  if (event.condition.requiredFlags) {
    for (const [key, value] of Object.entries(event.condition.requiredFlags)) {
      if (flags[key] !== value) return 0;
      score += 4;
    }
  }

  if (event.condition.blockedFlags?.some((flag) => flags[flag] !== undefined)) {
    return 0;
  }
  if (event.condition.blockedFlags?.includes("careerGate")) {
    score += 5;
  }

  if (event.condition.anyFlags) {
    const matched = event.condition.anyFlags.filter((flag) => flags[flag] !== undefined);
    if (matched.length === 0) return 0;
    score += matched.length * 3;
  }

  if (event.condition.statBelow) {
    for (const [stat, threshold] of Object.entries(event.condition.statBelow)) {
      if (threshold === undefined) continue;
      if ((context.stats?.[stat] ?? 50) >= threshold) return 0;
      score += 2;
    }
  }

  if (event.condition.statAbove) {
    for (const [stat, threshold] of Object.entries(event.condition.statAbove)) {
      if (threshold === undefined) continue;
      if ((context.stats?.[stat] ?? 50) < threshold) return 0;
      score += 2;
    }
  }

  if (event.condition.residences) {
    if (!context.residence || !event.condition.residences.includes(context.residence)) return 0;
    score += 2;
  }

  if (event.condition.gradeYears) {
    if (!context.gradeYear || !event.condition.gradeYears.includes(context.gradeYear)) return 0;
    score += 2;
  }

  if (event.condition.minAge !== undefined && (context.age ?? 0) < event.condition.minAge) return 0;
  if (event.condition.maxAge !== undefined && (context.age ?? 99) > event.condition.maxAge) return 0;

  if (event.condition.minTrust) {
    const trust = context.relationships?.find((rel) => rel.name.includes(event.condition.minTrust?.name ?? ""))?.trust ?? 0;
    if (trust < event.condition.minTrust.trust) return 0;
    score += 2;
  }

  if (event.condition.maxTrust) {
    const trust = context.relationships?.find((rel) => rel.name.includes(event.condition.maxTrust?.name ?? ""))?.trust ?? 0;
    if (trust > event.condition.maxTrust.trust) return 0;
    score += 2;
  }

  if (event.condition.requiredSpecs) {
    const specTypes = new Set((context.specs ?? []).map((s) => s.specType));
    if (!event.condition.requiredSpecs.every((type) => specTypes.has(type))) return 0;
    score += 4;
  }

  if (event.condition.requiredApplicationStage) {
    const activeStages = (context.jobApplications ?? [])
      .filter((app) => app.isActive)
      .map((app) => app.currentStage);
    if (!activeStages.includes(event.condition.requiredApplicationStage)) return 0;
    score += 4;
  }

  if (event.condition.requiredCareerPath) {
    const paths = (context.careerPaths ?? []).map((p) => p.pathType);
    if (!paths.includes(event.condition.requiredCareerPath)) return 0;
    score += 4;
  }

  if (event.condition.specScoreBelow !== undefined) {
    const numericScores = (context.specs ?? [])
      .map((s) => Number(s.score))
      .filter((n) => Number.isFinite(n));
    if (numericScores.length === 0) return 0;
    const maxScore = Math.max(...numericScores);
    if (maxScore >= event.condition.specScoreBelow) return 0;
    score += 2;
  }

  if (event.condition.specScoreAbove !== undefined) {
    const numericScores = (context.specs ?? [])
      .map((s) => Number(s.score))
      .filter((n) => Number.isFinite(n));
    if (numericScores.length === 0) return 0;
    const maxScore = Math.max(...numericScores);
    if (maxScore < event.condition.specScoreAbove) return 0;
    score += 2;
  }

  return Math.max(1, score + scoreEventDiversity(event, context));
}

function pickWeightedStaticEvent(events: StaticEvent[], context?: EventSelectionContext) {
  if (!context) return events[Math.floor(Math.random() * events.length)];
  const weighted = events.map((event) => ({
    event,
    weight: Math.max(1, 10 + scoreEventDiversity(event, context) + scoreLifeStageBonus(event, context)),
  }));
  const total = weighted.reduce((sum, item) => sum + item.weight, 0);
  let cursor = Math.random() * total;

  for (const item of weighted) {
    cursor -= item.weight;
    if (cursor <= 0) return item.event;
  }

  return weighted[weighted.length - 1].event;
}

function scoreLifeStageBonus(event: Pick<StaticEvent, "tags">, context: EventSelectionContext) {
  const tags = new Set(event.tags);
  const lifeStage = context.lifeStage;

  if (lifeStage === "college_early") {
    if (tags.has("학업") || tags.has("동아리") || tags.has("사교") || tags.has("일상") ||
        tags.has("취미") || tags.has("운동") || tags.has("SNS") || tags.has("문화") ||
        tags.has("여행") || tags.has("기숙사") || tags.has("자취") || tags.has("중간고사")) return 8;
    if (tags.has("알바") || tags.has("돈") || tags.has("가족") || tags.has("건강") ||
        tags.has("멘탈") || tags.has("관계")) return 4;
    if (tags.has("취업") || tags.has("면접") || tags.has("기업") || tags.has("스펙")) return -4;
    return 0;
  }

  if (lifeStage === "college_mid") {
    if (tags.has("연애") || tags.has("관계") || tags.has("알바") || tags.has("동아리") ||
        tags.has("스터디") || tags.has("시험") || tags.has("갈등") || tags.has("SNS") ||
        tags.has("취미") || tags.has("문화") || tags.has("인턴") || tags.has("공모전") ||
        tags.has("팀플") || tags.has("회식") || tags.has("본가") || tags.has("여행")) return 6;
    if (tags.has("스펙") || tags.has("어학") || tags.has("자격증")) return 4;
    if (tags.has("취업") || tags.has("면접") || tags.has("기업")) return -2;
    return 0;
  }

  if (lifeStage === "college_late") {
    if (tags.has("스펙") || tags.has("취업") || tags.has("면접") || tags.has("진로") ||
        tags.has("합격") || tags.has("불합격") || tags.has("기업") || tags.has("공공") ||
        tags.has("전문직") || tags.has("창업") || tags.has("지원서") || tags.has("시험") ||
        tags.has("인턴") || tags.has("어학") || tags.has("자격증") || tags.has("서류") ||
        tags.has("코딩테스트") || tags.has("인성검사") || tags.has("발표") || tags.has("심사") ||
        tags.has("추천서")) return 8;
    if (tags.has("해외") || tags.has("워홀") || tags.has("고시") || tags.has("대학원")) return 6;
    if (tags.has("돈") || tags.has("가족") || tags.has("멘탈") || tags.has("건강") ||
        tags.has("알바") || tags.has("자산") || tags.has("범죄") || tags.has("위험") ||
        tags.has("번아웃") || tags.has("스트레스")) return 3;
    return 0;
  }

  return 0;
}

function scoreEventDiversity(event: Pick<StaticEvent, "title" | "tags" | "choices">, context: EventSelectionContext) {
  const recentTags = context.recentTags ?? [];
  const recentNames = context.recentRelationshipNames ?? [];
  let score = 0;

  for (const tag of event.tags) {
    const recentCount = recentTags.filter((recent) => recent === tag).length;
    if (recentCount >= 2) score -= isStudyLikeTag(tag) ? 10 : 6;
    else if (recentCount === 1) score -= isStudyLikeTag(tag) ? 4 : 2;
  }

  const relationshipNames = new Set(
    event.choices.flatMap((choice) => choice.relationshipDelta.map((rel) => rel.name)),
  );
  for (const name of relationshipNames) {
    const recentCount = recentNames.filter((recent) => recent === name).length;
    if (recentCount >= 2) score -= 8;
    else if (recentCount === 1) score -= 3;
  }

  if (event.tags.every((tag) => !recentTags.includes(tag))) score += 4;
  if (relationshipNames.size > 0 && [...relationshipNames].every((name) => !recentNames.includes(name))) score += 3;
  if (event.tags.some((tag) => ["돈", "가족", "연애", "범죄", "위험", "해외", "건강", "알바", "자취", "본가", "SNS", "취미", "문화", "여행", "게임", "독서", "음악", "밴드", "전시", "영화", "커뮤니티", "온라인", "디지털", "인스타", "유튜브", "기숙사", "룸메", "하숙"].includes(tag))) {
    score += 2;
  }
  if ((context.coreEventCount ?? 0) <= 4) {
    if (event.tags.some((tag) => ["외부모임", "전시", "독서", "게임", "취미", "운동", "알바", "가족", "해외", "어학", "자취", "본가"].includes(tag))) {
      score += 5;
    }
    if ([...relationshipNames].some((name) => name.includes("민하") || name.includes("지민"))) {
      score -= 6;
    }
  }

  return score;
}

function isStudyLikeTag(tag: string) {
  return ["학업", "스터디", "시험", "중간고사", "교수", "연구실", "대학원", "수업", "공무원", "공기업", "자격증"].includes(tag);
}

export function isEventAllowedForLifeStage(event: Pick<StaticEvent, "title" | "tags"> & Partial<Pick<StaticEvent, "choices">>, context: EventSelectionContext) {
  const tags = new Set(event.tags);
  const title = event.title;
  const lifeStage = context.lifeStage;
  if (isResolvedOfferEvent(event, context.eventFlags)) {
    return false;
  }

  const arc = getStoryArc(context.coreEventCount ?? 0);
  if (arc.id === "finale" && hasAny(tags, ["중간고사", "동아리", "MT", "기숙사", "새내기"])) {
    return false;
  }
  if (arc.id === "aftermath") {
    const reopensUniversityLife = hasAny(tags, ["중간고사", "수업", "동아리", "MT", "기숙사", "새내기"]);
    const reopensApplication = hasAny(tags, ["서류", "추천서", "지원서", "면접"])
      || /서류|추천서|지원서|면접/.test(title);
    if (reopensUniversityLife || reopensApplication) return false;
  }

  // Hard rejection is reserved for scenes that require an impossible current
  // enrollment state. Other thematic mismatches are handled by scoring so the
  // fallback pool does not collapse into a small checklist.
  if (lifeStage === "leave") {
    return !hasAny(tags, ["중간고사", "수업", "졸업심사"]);
  }

  if (lifeStage === "dropout" || lifeStage === "post_graduation") {
    return !hasAny(tags, ["중간고사", "수업", "동아리", "기숙사", "졸업심사"]);
  }

  if (lifeStage === "college_early") {
    const advancedGate = hasAny(tags, ["면접", "전문직", "공공", "심사", "추천서", "졸업심사"]) ||
      /최종|졸업 직전|마지막 지원서/.test(title);
    if (advancedGate) return false;
  }

  return true;
}

function isResolvedOfferEvent(
  event: Partial<Pick<StaticEvent, "choices">>,
  flags: Record<string, unknown> | undefined,
) {
  if (!flags || !event.choices) return false;
  const resolutionKeys = new Set(event.choices.flatMap((choice) => Object.keys(choice.flagDelta)));
  return [...resolutionKeys].some((key) => flags[key] !== undefined);
}

function hasAny(tags: Set<string>, wanted: string[]) {
  return wanted.some((tag) => tags.has(tag));
}
