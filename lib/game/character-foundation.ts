import type { Prisma } from "@prisma/client";

import type { CharacterCreateInput } from "@/lib/game/validation";
import type { PublicStatKey } from "@/lib/game/validation";

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

function randomStat(base = 50) {
  return Math.max(24, Math.min(76, base + Math.floor(Math.random() * 25) - 12));
}

export function buildInitialStats(preferredStats: PublicStatKey[]) {
  const stats = {
    academic: randomStat(),
    practical: randomStat(46),
    communication: randomStat(),
    creativity: randomStat(),
    health: randomStat(56),
    mental: randomStat(54),
    network: randomStat(42),
    wealth: randomStat(36),
    reputation: randomStat(45),
    charm: randomStat(48),
  };

  for (const stat of preferredStats) {
    stats[stat] = Math.min(82, stats[stat] + 14);
  }

  return stats satisfies Omit<Prisma.CharacterStatsCreateWithoutCharacterRunInput, "characterRunId">;
}

function residenceLabel(residence: CharacterCreateInput["residence"]) {
  if (residence === "family_home") return "본가";
  if (residence === "dorm") return "기숙사";
  return "자취방";
}

export function buildInitialHiddenState(input: Pick<NormalizedCharacterCreateInput, "major" | "residence" | "preferredStats">) {
  const storyArc = {
    title: "첫 학기와 보이지 않는 제안",
    premise: "당신은 평범한 대학 생활을 시작했지만, 작은 선택들이 인턴, 휴학, 관계, 취업 준비로 이어지는 이상하게 선명한 흐름 속에 놓인다.",
    phase: "발단",
    chapter: 1,
    tension: 18,
    foreshadowing: ["단체 채팅에 올라온 인턴 이야기", "처음 보는 듯 익숙한 아침의 위화감"],
    openThreads: ["첫 학기의 리듬을 잡아야 한다", "지민 선배의 제안이 무엇인지 아직 모른다"],
  };

  return {
    majorFit: 55,
    burnoutRisk: 18,
    romanceState: { status: "NONE", notes: [] },
    familyState: { support: "보통", pressure: "낮음", residence: input.residence },
    friendState: { circle: "작지만 안정적" },
    careerInterests: [input.major, "탐색"],
    companyRolePreferences: [],
    imageFit: { tone: "성실한 관찰자" },
    selfCareCondition: { sleepDebt: 0, meals: "불규칙하지 않음" },
    eventFlags: { firstEventIssued: true, preferredStats: input.preferredStats, storyArc },
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

  return {
    source: "STATIC" as const,
    status: "ACTIVE" as const,
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
  return {
    ...character,
    createdAt: character.createdAt.toISOString(),
    updatedAt: character.updatedAt.toISOString(),
  };
}
