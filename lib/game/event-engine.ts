import { checkForcedEvent } from "@/lib/game/game-rules";

export const STATIC_EVENTS: StaticEvent[] = [
  {
    title: "중간고사 시즌",
    body: `당신은 중간고사 기간의 도서관 앞에서 멈춰 선다. 이미 열람실은 만석이고, 복도 벤치에 앉은 사람들은 노트북과 커피를 붙잡은 채 거의 같은 표정을 하고 있다. 시험 기간은 모두를 평등하게 불안하게 만들지만, 이상하게도 그 불안 속에서 누군가는 더 가까워지고 누군가는 완전히 혼자가 된다.

당신은 가방 안쪽에서 구겨진 강의 자료를 꺼낸다. 단체 채팅에는 족보를 구했다는 말, 스터디를 하자는 말, 그냥 포기하고 싶다는 농담이 동시에 올라온다. 오늘을 어떻게 쓰느냐에 따라 점수만이 아니라 이번 학기의 리듬 자체가 달라질 것 같다.`,
    choices: [
      {
        id: "study_hard",
        label: "도서관에서 밀도 높게 공부한다.",
        summary: "당신은 시험 준비에 집중하며 학업 성취를 높였다.",
        statDelta: { academic: 6, mental: -2, health: -1 },
        relationshipDelta: [],
        flagDelta: { midtermPrep: "intensive" },
      },
      {
        id: "study_group",
        label: "같은 과 친구들과 스터디 그룹을 만든다.",
        summary: "당신은 친구들과 함께 공부하며 학업과 평판을 모두 챙겼다.",
        statDelta: { academic: 3, reputation: 3, mental: -1 },
        relationshipDelta: [],
        flagDelta: { midtermPrep: "group" },
      },
      {
        id: "take_break",
        label: "적당히 하고 쉰다. 컨디션을 유지하는 게 우선이다.",
        summary: "당신은 무리하지 않고 컨디션을 관리했다.",
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
    body: `당신은 동아리 MT 버스 창가 자리에 앉아 도시가 뒤로 밀려나는 모습을 본다. 앞자리에서는 누군가 과자를 돌리고, 뒷자리에서는 이미 친한 사람들끼리 웃음이 터진다. 당신은 이 분위기가 싫지는 않지만, 너무 빨리 섞이면 나중에 빠져나오기 어려울 것 같다는 생각도 한다.

휴게소에 도착하자 선배 한 명이 당신에게 자연스럽게 말을 건다. 그는 회사 이름을 직접 말하지는 않았지만, 아는 사람이 작은 브랜드 회사에서 인턴을 구한다는 이야기를 흘린다. 당신은 이것이 단순한 잡담인지, 아니면 나중에 커리어를 바꿀 수도 있는 작은 문인지 아직 알 수 없다.`,
    choices: [
      {
        id: "socialize_openly",
        label: "적극적으로 말 걸고 여러 사람과 이야기한다.",
        summary: "당신은 MT에서 다양한 사람들과 친해졌다.",
        statDelta: { charm: 5, reputation: 3, health: -1 },
        relationshipDelta: [],
        flagDelta: { mtSocialized: true },
      },
      {
        id: "observe_quietly",
        label: "조용히 분위기를 관찰하며 사람들을 파악한다.",
        summary: "당신은 MT에서 사람들을 관찰하며 마음의 여유를 지켰다.",
        statDelta: { mental: 3, reputation: 1 },
        relationshipDelta: [],
        flagDelta: { mtObserved: true },
      },
    ],
    tags: ["대학", "동아리", "사교"],
    source: "STATIC" as const,
  },
  {
    title: "교수님과의 면담",
    body: `당신은 학과 사무실 앞 의자에 앉아 면담 순서를 기다린다. 문틈으로 교수님의 목소리가 낮게 새어 나오고, 앞서 들어간 학생은 졸업 요건과 진로 사이에서 꽤 오래 망설이는 듯하다. 복도 벽에는 대학원 설명회 포스터와 현장실습 모집 공고가 나란히 붙어 있다.

당신은 무릎 위에 올려둔 손을 한 번 펴고 다시 쥔다. 교수님에게 무엇을 묻느냐에 따라 대답도 달라질 것이다. 연구실, 취업, 휴학, 혹은 아무것도 아닌 안부까지, 오늘의 면담은 생각보다 많은 길을 열 수도 있다.`,
    choices: [
      {
        id: "ask_research",
        label: "연구실 인턴이나 학술 기회에 대해 묻는다.",
        summary: "당신은 교수님께 연구 기회를 문의하며 학업 진로를 탐색했다.",
        statDelta: { academic: 4, practical: 2, reputation: 2 },
        relationshipDelta: [],
        flagDelta: { professorContact: "research" },
      },
      {
        id: "discuss_career",
        label: "진로 고민을 솔직하게 털어놓고 조언을 구한다.",
        summary: "당신은 진로 고민을 상담하며 방향성을 고민했다.",
        statDelta: { mental: 3, practical: 2 },
        relationshipDelta: [],
        flagDelta: { professorContact: "career_advice" },
      },
      {
        id: "keep_brief",
        label: "간단히 인사하고 면담을 빠르게 마친다.",
        summary: "당신은 면담을 가볍게 마무리하고 개인 시간을 확보했다.",
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
    body: `당신은 알람이 세 번 울린 뒤에도 몸을 일으키지 못한다. 머리는 물에 젖은 솜처럼 무겁고, 휴대폰 화면에는 과제 마감과 약속 알림이 겹쳐 쌓여 있다. 이상하게도 해야 할 일은 많은데, 어느 것부터 시작해야 하는지 생각하는 것만으로도 숨이 막힌다.

당신은 이 상태가 단순한 게으름이 아니라는 것을 안다. 계속 밀어붙이면 오늘 하루를 넘길 수는 있겠지만, 그 다음 날의 당신은 더 망가져 있을지도 모른다. 지금 필요한 것은 의지가 아니라 회복 방식의 선택이다.`,
    choices: [
      {
        id: "rest_properly",
        label: "며칠 푹 쉰다. 컨디션 회복이 우선이다.",
        summary: "당신은 충분한 휴식을 통해 번아웃에서 회복하기 시작했다.",
        statDelta: { health: 8, mental: 10, academic: -3, practical: -2 },
        relationshipDelta: [],
        flagDelta: { burnoutRecovered: "rest" },
      },
      {
        id: "seek_counseling",
        label: "학교 상담센터를 방문한다.",
        summary: "당신은 전문가의 도움을 받으며 정신 건강을 관리했다.",
        statDelta: { mental: 12, health: 4, reputation: 1 },
        relationshipDelta: [],
        flagDelta: { burnoutRecovered: "counseling" },
      },
      {
        id: "talk_to_friend",
        label: "가까운 친구에게 속마음을 털어놓는다.",
        summary: "당신은 친구에게 마음을 열고 위로를 받았다.",
        statDelta: { mental: 6, charm: 2, health: 2 },
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
