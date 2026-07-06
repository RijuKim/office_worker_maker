import { checkForcedEvent } from "@/lib/game/game-rules";

export const STATIC_EVENTS: StaticEvent[] = [
  {
    title: "중간고사 시즌",
    body: "도서관은 이미 만석이다. 벤치에 앉아 노트북을 펼친 사람들 사이로 커피 향이 흐른다. 시험 기간은 모두를 평등하게 만든다 — 각자의 전공 앞에서는 누구나 조금은 불안하다.",
    choices: [
      {
        id: "study_hard",
        label: "도서관에서 밀도 높게 공부한다.",
        summary: "시험 준비에 집중하며 학업 성취를 높였다.",
        statDelta: { academic: 6, mental: -2, health: -1 },
        relationshipDelta: [],
        flagDelta: { midtermPrep: "intensive" },
      },
      {
        id: "study_group",
        label: "같은 과 친구들과 스터디 그룹을 만든다.",
        summary: "친구들과 함께 공부하며 학업과 관계를 모두 챙겼다.",
        statDelta: { academic: 3, communication: 3, network: 2 },
        relationshipDelta: [],
        flagDelta: { midtermPrep: "group" },
      },
      {
        id: "take_break",
        label: "적당히 하고 쉰다. 컨디션을 유지하는 게 우선이다.",
        summary: "무리하지 않고 컨디션을 관리했다.",
        statDelta: { mental: 3, health: 2, academic: -2 },
        relationshipDelta: [],
        flagDelta: { midtermPrep: "relaxed" },
      },
    ],
    tags: ["학업", "일상", "중간고사"],
    source: "STATIC" as const,
  },
  {
    title: "동아리 MT",
    body: "동아리 엠티 버스 안은 떠들썩하다. 선배들은 신입생들에게 노래를 시키고, 창 밖으로는 익숙한 도시가 점점 멀어진다. 누군가 네 옆자리에 앉으며 말을 건넨다.",
    choices: [
      {
        id: "socialize_openly",
        label: "적극적으로 말 걸고 여러 사람과 이야기한다.",
        summary: "MT에서 다양한 사람들과 친해졌다.",
        statDelta: { communication: 5, network: 4, health: -1 },
        relationshipDelta: [],
        flagDelta: { mtSocialized: true },
      },
      {
        id: "observe_quietly",
        label: "조용히 분위기를 관찰하며 사람들을 파악한다.",
        summary: "MT에서 사람들을 관찰하며 통찰을 얻었다.",
        statDelta: { creativity: 3, mental: 2 },
        relationshipDelta: [],
        flagDelta: { mtObserved: true },
      },
    ],
    tags: ["대학", "동아리", "사교"],
    source: "STATIC" as const,
  },
  {
    title: "교수님과의 면담",
    body: "학과 사무실 앞 의자에 앉아 기다리는 시간이 생각보다 길다. 문 틈새로 교수님의 목소리가 흘러나온다 — 앞서 면담 중인 학생의 이야기인 듯하다. 돌아가며 할 말을 정리한다.",
    choices: [
      {
        id: "ask_research",
        label: "연구실 인턴이나 학술 기회에 대해 묻는다.",
        summary: "교수님께 연구 기회를 문의하며 학업 진로를 탐색했다.",
        statDelta: { academic: 4, practical: 2, network: 2 },
        relationshipDelta: [],
        flagDelta: { professorContact: "research" },
      },
      {
        id: "discuss_career",
        label: "진로 고민을 솔직하게 털어놓고 조언을 구한다.",
        summary: "진로 고민을 상담하며 방향성을 고민했다.",
        statDelta: { mental: 3, practical: 2 },
        relationshipDelta: [],
        flagDelta: { professorContact: "career_advice" },
      },
      {
        id: "keep_brief",
        label: "간단히 인사하고 면담을 빠르게 마친다.",
        summary: "면담을 가볍게 마무리하고 개인 시간을 확보했다.",
        statDelta: { mental: 1, health: 1 },
        relationshipDelta: [],
        flagDelta: { professorContact: "brief" },
      },
    ],
    tags: ["학업", "교수", "진로"],
    source: "STATIC" as const,
  },
];

export interface StaticEventChoice {
  id: string;
  label: string;
  summary: string;
  statDelta: Record<string, number>;
  relationshipDelta: { name: string; trust: number }[];
  flagDelta: Record<string, unknown>;
}

export interface StaticEvent {
  title: string;
  body: string;
  choices: StaticEventChoice[];
  tags: string[];
  source: "STATIC" | "FALLBACK" | "FORCED";
}

export function pickRandomStaticEvent(excludeTitles?: string[]): StaticEvent {
  const pool = excludeTitles?.length
    ? STATIC_EVENTS.filter((e) => !excludeTitles.includes(e.title))
    : STATIC_EVENTS;

  return pool[Math.floor(Math.random() * pool.length)];
}

export function buildBurnoutEvent(): StaticEvent {
  return {
    title: "번아웃 위기",
    body: "머리가 무겁고 손끝이 저리다. 쌓여만 가는 과제와 약속들 사이에서 숨이 턱까지 차올랐다. 더 이상 미룰 수 없는 신호다. 잠시 모든 것을 내려놓고 회복에 집중해야 할 때다.",
    choices: [
      {
        id: "rest_properly",
        label: "며칠 푹 쉰다. 컨디션 회복이 우선이다.",
        summary: "충분한 휴식을 통해 번아웃에서 회복하기 시작했다.",
        statDelta: { health: 8, mental: 10, academic: -3, practical: -2 },
        relationshipDelta: [],
        flagDelta: { burnoutRecovered: "rest" },
      },
      {
        id: "seek_counseling",
        label: "학교 상담센터를 방문한다.",
        summary: "전문가의 도움을 받으며 정신 건강을 관리했다.",
        statDelta: { mental: 12, health: 4, network: 1 },
        relationshipDelta: [],
        flagDelta: { burnoutRecovered: "counseling" },
      },
      {
        id: "talk_to_friend",
        label: "가까운 친구에게 속마음을 털어놓는다.",
        summary: "친구에게 마음을 열고 위로를 받았다.",
        statDelta: { mental: 6, communication: 4, health: 2 },
        relationshipDelta: [],
        flagDelta: { burnoutRecovered: "social_support" },
      },
    ],
    tags: ["위기", "번아웃", "회복"],
    source: "FORCED" as const,
  };
}

export function selectNextEvent(
  currentHiddenState: { burnoutRisk: number },
  recentEventTitles: string[],
): { type: "forced" | "normal"; event: StaticEvent } {
  const forced = checkForcedEvent(currentHiddenState);

  if (forced?.type === "burnout") {
    return { type: "forced", event: buildBurnoutEvent() };
  }

  return { type: "normal", event: pickRandomStaticEvent(recentEventTitles) };
}