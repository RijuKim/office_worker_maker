import type { Prisma } from "@prisma/client";

import type { CharacterCreateInput } from "@/lib/game/validation";
import type { PublicStatKey } from "@/lib/game/validation";
import { buildInitialLifeStageFlags, deriveLifeStageState } from "@/lib/game/life-stage";

export type NormalizedCharacterCreateInput = CharacterCreateInput & {
  major: string;
  startGradeYear: number;
};

export const randomMajors = [
  "경영학과",
  "컴퓨터공학과",
  "심리학과",
  "미디어커뮤니케이션학과",
  "경제학과",
  "디자인학과",
  "행정학과",
  "사회학과",
];

export function pickRandomMajor() {
  return randomMajors[Math.floor(Math.random() * randomMajors.length)];
}

export function pickRandomGradeYear(age: number) {
  if (age <= 19) return 1;
  if (age >= 25) return 4;
  return Math.max(1, Math.min(4, age - 18));
}

function randomStat(base = 5) {
  return Math.max(2, Math.min(9, base + Math.floor(Math.random() * 5) - 2));
}

export function buildInitialStats(preferredStats: PublicStatKey[]) {
  const stats = {
    academic: randomStat(),
    practical: randomStat(4),
    communication: randomStat(),
    creativity: randomStat(),
    health: randomStat(6),
    mental: randomStat(5),
    network: randomStat(4),
    wealth: randomStat(3),
    reputation: randomStat(5),
    charm: randomStat(5),
  };

  for (const stat of preferredStats) {
    stats[stat] = Math.min(10, stats[stat] + 2);
  }

  return stats satisfies Omit<Prisma.CharacterStatsCreateWithoutCharacterRunInput, "characterRunId">;
}

function residenceLabel(residence: CharacterCreateInput["residence"]) {
  if (residence === "family_home") return "본가";
  if (residence === "dorm") return "기숙사";
  return "자취방";
}

export function buildInitialHiddenState(input: Pick<NormalizedCharacterCreateInput, "major" | "residence" | "preferredStats" | "startGradeYear">) {
  const storyArc = {
    title: "첫 학기와 보이지 않는 제안",
    premise: "당신은 평범한 대학 생활을 시작했지만, 작은 선택들이 인턴, 휴학, 관계, 취업 준비로 이어지는 이상하게 선명한 흐름 속에 놓인다.",
    phase: "발단",
    chapter: 1,
    majorBeats: [
      "첫 학기와 생활 기반",
      "소속과 첫 약속",
      "압박과 유혹",
      "선택의 청구서",
      "졸업 직전의 방향",
    ],
    tension: 2,
    foreshadowing: ["단체 채팅에 올라온 인턴 이야기", "처음 보는 듯 익숙한 아침의 위화감"],
    openThreads: ["첫 학기의 리듬을 잡아야 한다", "지민 선배의 제안이 무엇인지 아직 모른다"],
  };

  return {
    majorFit: 6,
    burnoutRisk: 2,
    romanceState: { status: "NONE", notes: [] },
    familyState: { support: "보통", pressure: "낮음", residence: input.residence },
    friendState: { circle: "작지만 안정적" },
    careerInterests: [input.major, "탐색"],
    companyRolePreferences: [],
    imageFit: { tone: "성실한 관찰자" },
    selfCareCondition: { sleepDebt: 0, meals: "불규칙하지 않음" },
    eventFlags: {
      firstEventIssued: true,
      preferredStats: input.preferredStats,
      storyArc,
      ...buildInitialLifeStageFlags({ currentGradeYear: input.startGradeYear, major: input.major }),
    },
  } satisfies Prisma.HiddenStateCreateWithoutCharacterRunInput;
}

export function buildStarterRelationships() {
  return [
    {
      name: "지민 선배",
      role: "동아리 선배",
      trust: 46,
      tags: ["선배", "동아리", "인턴정보"],
    },
    {
      name: "민하",
      role: "동기",
      trust: 52,
      tags: ["친구", "수업메이트"],
    },
  ] satisfies Prisma.RelationshipCreateWithoutCharacterRunInput[];
}

export function buildFirstEvent(input: NormalizedCharacterCreateInput) {
  const residence = residenceLabel(input.residence);
  const isOlder = input.age >= 24;
  const isYounger = input.age <= 20;
  const prefersAcademic = input.preferredStats.includes("academic");
  const prefersSocial = input.preferredStats.includes("charm") || input.preferredStats.includes("reputation");
  const prefersPractical = input.preferredStats.includes("practical") || input.preferredStats.includes("wealth");

  const firstEventScenes: Array<{
    title: string;
    body: string;
    choices: {
      id: string;
      label: string;
      summary: string;
      statDelta: Record<string, number>;
      relationshipDelta: { name: string; trust: number }[];
      flagDelta: Record<string, unknown>;
    }[];
    tags: string[];
  }> = [
    {
      title: "눈을 뜬 첫 아침",
      body: `당신은 낯선 듯 익숙한 ${residence} 침대에서 눈을 뜬다. 휴대폰 화면에는 ${input.major} ${input.startGradeYear}학년 수강 정정 알림과 읽지 않은 단체 채팅이 겹쳐 떠 있고, 창밖에서는 이미 등교하는 사람들의 발소리가 이어진다. 이름은 ${input.name}, 나이는 ${input.age}세, 어제까지는 분명 평범한 하루였는데 오늘 아침의 공기는 이상할 만큼 선명하다.

당신은 세면대 앞에서 물을 틀고 거울을 본다. 기억은 이어져 있지만 마음 한쪽에는 이 대학 생활이 곧 회사 생활과 이상한 방식으로 연결될 것 같은 예감이 든다. 첫 강의까지는 아직 시간이 조금 남았고, 책상 위에는 강의계획서와 동아리 모집 전단, 아르바이트 공고가 한꺼번에 놓여 있다. 무엇을 먼저 붙잡느냐에 따라 당신의 하루는 전혀 다른 얼굴을 하게 될 것이다.`,
      choices: [
        {
          id: "ask_senior_internship",
          label: "단체 채팅에 올라온 선배의 인턴 이야기에 답장을 보낸다.",
          summary: "당신은 선배에게 인턴 정보를 물어보며 실무 감각을 넓혔다.",
          statDelta: { practical: 5, reputation: 1, mental: -3, health: -1 },
          relationshipDelta: [{ name: "지민 선배", trust: 4 }],
          flagDelta: { internshipCuriosity: true },
        },
        {
          id: "focus_class",
          label: "강의계획서를 펼치고 이번 학기 생존 계획을 세운다.",
          summary: "당신은 전공 수업의 리듬을 잡기 위해 학업 계획을 세웠다.",
          statDelta: { academic: 5, mental: 1, charm: -1, health: -2 },
          relationshipDelta: [],
          flagDelta: { studyPlan: true },
        },
        {
          id: "join_club_meeting",
          label: "동아리 모집 전단을 챙겨 낯선 사람들 사이로 들어간다.",
          summary: "당신은 동아리 첫 모임에서 새 관계의 실마리를 만들었다.",
          statDelta: { charm: 3, reputation: 2, health: -2, wealth: -1 },
          relationshipDelta: [{ name: "민하", trust: 3 }],
          flagDelta: { clubIntroduced: true },
        },
      ],
      tags: ["시작", "대학", "탐색"],
    },
    {
      title: "등굣길의 낯선 풍경",
      body: `${residence}을 나서자 ${isYounger ? "신입생 환영회 현수막과 단과대 건물이" : isOlder ? "취업 준비생들의 표정과 학식당의 익숙한 냄새가" : "평범한 등굣길 풍경이"} 당신을 맞이한다. ${input.name}은 ${input.major} ${input.startGradeYear}학년으로서의 첫발을 내딛고 있다. ${isOlder ? "늦은 나이에 시작한 대학이라는 점이" : "아직 모든 것이 낯설고"} 마음을 무겁게 한다.

복도 게시판에는 동아리 홍보지와 함께 해외 인턴십 모집 공고가 나란히 붙어 있다. 누군가는 웃으며 인사를 건네고, 누군가는 당신을 스쳐 지나간다. 첫인상이 앞으로의 관계를 결정할 수도 있다.`,
      choices: [
        {
          id: "greet_cheerfully",
          label: "먼저 웃으며 인사하고 말을 건다.",
          summary: "당신은 밝은 인상으로 첫인상을 남겼다.",
          statDelta: { charm: 4, reputation: 2, mental: -1, health: -1 },
          relationshipDelta: [{ name: "민하", trust: 5 }],
          flagDelta: { firstImpression: "friendly" },
        },
        {
          id: "observe_first",
          label: "조용히 주변을 살피며 분위기를 파악한다.",
          summary: "당신은 서두르지 않고 상황을 관찰했다.",
          statDelta: { mental: 3, academic: 1, charm: -2 },
          relationshipDelta: [],
          flagDelta: { firstImpression: "observant" },
        },
        {
          id: "check_notice",
          label: "게시판의 해외 인턴십 공고를 자세히 살펴본다.",
          summary: "당신은 해외 인턴십 정보를 확인하며 진로를 탐색했다.",
          statDelta: { practical: 3, academic: 1, mental: -2, wealth: -1 },
          relationshipDelta: [],
          flagDelta: { overseasCuriosity: true },
        },
      ],
      tags: ["시작", "대학", "탐색"],
    },
    {
      title: "첫 강의실의 긴장",
      body: `${input.major} 전공 강의실 문을 열자 빈자리가 몇 개 보인다. ${isOlder ? "당신보다 어려 보이는 학생들이 대부분이고," : "분위기는 설렘과 긴장이 반반 섞여 있다."} 교수님이 아직 오지 않아서 학생들은 각자 휴대폰을 보거나 옆 사람과 수근거리고 있다.

${prefersAcademic ? "당신은 이미 교재를 펼쳐 예습한 부분을 훑어본다. 첫 수업에서 좋은 인상을 남기면 학점과 추천서 모두에 도움이 될 것이다." : prefersSocial ? "낯선 사람들과의 네트워킹이 중요하다. 옆자리 사람에게 먼저 말을 걸어볼까?" : "강의계획서를 다시 확인한다. 이번 학기는 어떤 내용을 다루게 될지 궁금하다."}

첫 수업의 분위기는 앞으로의 학업 태도를 결정짓는 중요한 순간이다.`,
      choices: [
        {
          id: "sit_front",
          label: "앞자리에 앉아 교수님의 눈에 띄려고 한다.",
          summary: "당신은 앞자리를 차지하며 학업에 집중할 의지를 보였다.",
          statDelta: { academic: 4, reputation: 2, mental: -2, health: -1 },
          relationshipDelta: [],
          flagDelta: { firstClass: "front" },
        },
        {
          id: "sit_with_peers",
          label: "옆자리 사람들과 자연스럽게 인사를 나눈다.",
          summary: "당신은 같은 수업을 듣는 사람들과 관계를 만들었다.",
          statDelta: { charm: 3, reputation: 1, mental: 1, academic: -1 },
          relationshipDelta: [{ name: "민하", trust: 4 }],
          flagDelta: { firstClass: "social" },
        },
        {
          id: "check_syllabus",
          label: "강의계획서를 꼼꼼히 분석하고 일정을 정리한다.",
          summary: "당신은 학기 전체 계획을 미리 파악하며 준비했다.",
          statDelta: { academic: 2, mental: 2, practical: 1, health: -1 },
          relationshipDelta: [],
          flagDelta: { firstClass: "prepared" },
        },
      ],
      tags: ["시작", "학업", "탐색"],
    },
    {
      title: "학생식당의 첫 점심",
      body: `${isYounger ? "신입생 환영회 안내를 받으며" : isOlder ? "진로 고민하는 후배들의 대화를 들으며" : "아무렇게나 빈자리에 앉아"} 당신은 첫 점심을 맞이한다. 식당 메뉴는 평범하지만, 오늘은 모든 것이 새롭게 느껴진다.

${prefersPractical ? "지갑을 열어보니 이번 달 생활비를 어떻게 쓸지 고민된다. 알바를 알아봐야 할지도 모른다." : prefersSocial ? "주변 테이블에서 웃음소리가 들린다. 자연스럽게 대화에 끼어들 기회를 엿본다." : "휴대폰에 학과 단체채팅 알림이 떠 있다. 읽지 않은 메시지가 수십 개다."}

점심시간은 짧고, 선택은 빠르게 이루어져야 한다.`,
      choices: [
        {
          id: "eat_alone_study",
          label: "혼자 먹으며 전공 책을 펼쳐든다.",
          summary: "당신은 점심시간을 활용해 학업에 집중했다.",
          statDelta: { academic: 3, mental: 1, charm: -2, health: -1 },
          relationshipDelta: [],
          flagDelta: { firstLunch: "study" },
        },
        {
          id: "join_strangers",
          label: "낯선 사람들의 테이블에 합류해 이야기한다.",
          summary: "당신은 새로운 사람들과 식사하며 인맥을 넓혔다.",
          statDelta: { charm: 4, reputation: 2, health: -1, wealth: -2 },
          relationshipDelta: [{ name: "민하", trust: 3 }],
          flagDelta: { firstLunch: "social" },
        },
        {
          id: "check_part_time",
          label: "알바 공고를 검색하며 생활비 계획을 세운다.",
          summary: "당신은 경제적 자립을 위해 알바를 알아보기 시작했다.",
          statDelta: { practical: 3, wealth: 2, health: -2, mental: -2 },
          relationshipDelta: [],
          flagDelta: { partTimeSearch: true },
        },
      ],
      tags: ["시작", "일상", "탐색"],
    },
  ];

  const sceneIndex = (input.name.length + input.age + input.startGradeYear + input.preferredStats.length) % firstEventScenes.length;
  const scene = firstEventScenes[sceneIndex];

  return {
    source: "STATIC" as const,
    status: "ACTIVE" as const,
    title: scene.title,
    body: scene.body,
    choices: scene.choices as unknown as Prisma.InputJsonValue,
    tags: scene.tags as unknown as Prisma.InputJsonValue,
    safetyChecked: true,
  } satisfies Prisma.EventCreateWithoutCharacterRunInput;
}

export function serializeCharacterRun(character: {
  id: string;
  name: string;
  age: number;
  startGradeYear: number;
  currentGradeYear: number | null;
  major: string;
  academicStatus: string;
  lifeStatus: unknown;
  majorEventCount: number;
  coreEventCount: number;
  currentEventId: string | null;
  createdAt: Date;
  updatedAt: Date;
  stats?: unknown;
  hiddenState?: unknown;
  relationships?: unknown;
  events?: unknown;
  eventHistory?: unknown;
}) {
  const hiddenState = readRecord(character.hiddenState);
  const eventFlags = hiddenState?.eventFlags;
  const lifeStage = deriveLifeStageState({
    eventFlags,
    currentGradeYear: character.currentGradeYear,
    academicStatus: character.academicStatus,
    coreEventCount: character.coreEventCount,
    major: character.major,
  });

  return {
    ...character,
    lifeStage,
    progressLabel: buildProgressLabel(lifeStage),
    createdAt: character.createdAt.toISOString(),
    updatedAt: character.updatedAt.toISOString(),
  };
}

function buildProgressLabel(lifeStage: ReturnType<typeof deriveLifeStageState>) {
  if (lifeStage.lifeStage === "leave") return "휴학";
  if (lifeStage.lifeStage === "dropout") return "자퇴";
  if (lifeStage.lifeStage === "post_graduation") return "졸업";
  if (lifeStage.graduation === "extra_semester") return "추가학기";
  if (lifeStage.graduation === "delayed") return "졸업 유예";
  if (lifeStage.graduation === "gate_ready") return `${lifeStage.term.label} · 졸업요건 점검`;
  return lifeStage.term.label;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
