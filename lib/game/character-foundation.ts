import type { Prisma } from "@prisma/client";

import type { CharacterCreateInput } from "@/lib/game/validation";

export const initialStats = {
  academic: 52,
  practical: 42,
  communication: 50,
  creativity: 48,
  health: 64,
  mental: 58,
  network: 36,
  wealth: 30,
  reputation: 45,
  charm: 46,
} satisfies Omit<Prisma.CharacterStatsCreateWithoutCharacterRunInput, "characterRunId">;

export function buildInitialHiddenState(input: Pick<CharacterCreateInput, "major">) {
  return {
    majorFit: 55,
    burnoutRisk: 18,
    romanceState: { status: "NONE", notes: [] },
    familyState: { support: "보통", pressure: "낮음" },
    friendState: { circle: "작지만 안정적" },
    careerInterests: [input.major, "탐색"],
    companyRolePreferences: [],
    imageFit: { tone: "성실한 관찰자" },
    selfCareCondition: { sleepDebt: 0, meals: "불규칙하지 않음" },
    eventFlags: { firstEventIssued: true },
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

export function buildFirstEvent(input: CharacterCreateInput) {
  return {
    source: "STATIC" as const,
    status: "ACTIVE" as const,
    title: "봄 학기 첫 갈림길",
    body: `${input.name}은 ${input.major} ${input.startGradeYear}학년으로 새 학기를 시작했다. 강의실 앞 게시판에는 동아리 모집 포스터와 공모전 안내가 겹겹이 붙어 있고, 지민 선배는 조심스럽게 인턴 이야기를 꺼낸다. 아직 모든 길이 선명하지 않지만 오늘의 선택이 다음 기억을 만든다.`,
    choices: [
      {
        id: "ask_senior_internship",
        label: "지민 선배에게 인턴 이야기를 더 물어본다.",
        summary: "선배에게 인턴 정보를 물어보며 실무 감각을 넓혔다.",
        statDelta: { practical: 5, communication: 2, mental: -1 },
        relationshipDelta: [{ name: "지민 선배", trust: 4 }],
        flagDelta: { internshipCuriosity: true },
      },
      {
        id: "focus_class",
        label: "첫 주 강의 계획서를 꼼꼼히 읽고 공부 계획을 세운다.",
        summary: "전공 수업의 리듬을 잡기 위해 학업 계획을 세웠다.",
        statDelta: { academic: 5, mental: 1, network: -1 },
        relationshipDelta: [],
        flagDelta: { studyPlan: true },
      },
      {
        id: "join_club_meeting",
        label: "동아리 첫 모임에 들러 사람들을 관찰한다.",
        summary: "동아리 첫 모임에서 새 관계의 실마리를 만들었다.",
        statDelta: { communication: 4, network: 4, health: -1 },
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
