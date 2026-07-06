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
        statDelta: { academic: 6, mental: -3, health: -2 },
        relationshipDelta: [],
        flagDelta: { midtermPrep: "intensive" },
      },
      {
        id: "study_group",
        label: "같은 과 친구들과 스터디 그룹을 만든다.",
        summary: "당신은 친구들과 함께 공부하며 학업과 평판을 모두 챙겼다.",
        statDelta: { academic: 3, reputation: 3, mental: -2, wealth: -1 },
        relationshipDelta: [],
        flagDelta: { midtermPrep: "group" },
      },
      {
        id: "take_break",
        label: "적당히 하고 쉰다. 컨디션을 유지하는 게 우선이다.",
        summary: "당신은 무리하지 않고 컨디션을 관리했다.",
        statDelta: { mental: 3, health: 2, academic: -3, reputation: -1 },
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
        statDelta: { charm: 5, reputation: 3, health: -3, mental: -1 },
        relationshipDelta: [],
        flagDelta: { mtSocialized: true },
      },
      {
        id: "observe_quietly",
        label: "조용히 분위기를 관찰하며 사람들을 파악한다.",
        summary: "당신은 MT에서 사람들을 관찰하며 마음의 여유를 지켰다.",
        statDelta: { mental: 3, reputation: 1, charm: -2 },
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
        statDelta: { academic: 4, practical: 2, reputation: 2, mental: -2 },
        relationshipDelta: [],
        flagDelta: { professorContact: "research" },
      },
      {
        id: "discuss_career",
        label: "진로 고민을 솔직하게 털어놓고 조언을 구한다.",
        summary: "당신은 진로 고민을 상담하며 방향성을 고민했다.",
        statDelta: { mental: 3, practical: 2, reputation: -1 },
        relationshipDelta: [],
        flagDelta: { professorContact: "career_advice" },
      },
      {
        id: "keep_brief",
        label: "간단히 인사하고 면담을 빠르게 마친다.",
        summary: "당신은 면담을 가볍게 마무리하고 개인 시간을 확보했다.",
        statDelta: { mental: 1, health: 1, reputation: -2 },
        relationshipDelta: [],
        flagDelta: { professorContact: "brief" },
      },
    ],
    tags: ["학업", "교수", "진로"],
    source: "STATIC" as const,
  },
  {
    title: "편의점 새벽 알바",
    body: `당신은 새벽 두 시 편의점 계산대 안에서 컵라면 물이 끓는 소리를 듣는다. 손님은 드문드문 들어오고, 매대 아래 숨겨둔 전공 책은 형광등 빛 아래에서 유난히 낯설어 보인다. 돈은 필요하지만, 이 시간이 계속되면 낮의 수업과 사람들 사이에서 당신의 얼굴은 점점 흐려질 것이다.

카운터 옆 작은 모니터에는 점장이 남긴 메시지가 깜빡인다. 주말 대타를 더 해줄 수 있냐는 부탁과, 오래 일하면 시급을 조금 올려주겠다는 말이 붙어 있다. 당신은 지갑과 몸, 그리고 아직 이름 붙이지 못한 미래 사이에서 잠시 계산을 멈춘다.`,
    choices: [
      { id: "take_extra_shift", label: "주말 대타까지 맡아 생활비를 확보한다.", summary: "당신은 생활비를 벌기 위해 더 긴 새벽을 받아들였다.", statDelta: { wealth: 6, practical: 2, health: -5, mental: -2 }, relationshipDelta: [], flagDelta: { partTimeJob: "extra_shift" } },
      { id: "reduce_shift", label: "이번 달까지만 하고 근무 시간을 줄이겠다고 말한다.", summary: "당신은 돈보다 회복과 수업 리듬을 우선했다.", statDelta: { health: 4, mental: 3, wealth: -4, reputation: -1 }, relationshipDelta: [], flagDelta: { partTimeJob: "reduced" } },
    ],
    tags: ["알바", "자산", "건강"],
    source: "STATIC" as const,
  },
  {
    title: "읽씹된 고백",
    body: `당신은 강의가 끝난 뒤에도 휴대폰 화면을 뒤집어 놓지 못한다. 어젯밤 보낸 메시지는 아직 읽음 표시만 남긴 채 조용하고, 복도 끝에서 그 사람이 웃으며 다른 친구들과 지나가는 모습이 보인다. 마음은 별일 아닌 척하려 하지만, 몸은 이미 한 박자 늦게 반응하고 있다.

이 감정을 여기서 접어두면 하루는 비교적 안전하게 지나갈 것이다. 그러나 그냥 넘어가기에는 당신이 건넨 말들이 너무 오래 맴돈다. 관계는 스탯처럼 숫자로만 움직이지 않지만, 오늘의 태도는 분명 다음 사건의 온도를 바꾼다.`,
    choices: [
      { id: "ask_directly", label: "따로 불러 어제 메시지 이야기를 묻는다.", summary: "당신은 불편함을 감수하고 마음의 답을 확인하려 했다.", statDelta: { charm: 3, mental: -4, reputation: -1 }, relationshipDelta: [{ name: "서연", trust: 8 }], flagDelta: { romanceThread: "direct" } },
      { id: "pretend_nothing", label: "아무렇지 않은 척하고 조용히 거리를 둔다.", summary: "당신은 마음을 숨기고 관계의 거리를 조절했다.", statDelta: { mental: 2, charm: -2, reputation: 1 }, relationshipDelta: [{ name: "서연", trust: -6 }], flagDelta: { romanceThread: "withdrawn" } },
    ],
    tags: ["연애", "관계", "감정"],
    source: "STATIC" as const,
  },
  {
    title: "가족 단체방의 압박",
    body: `당신은 점심을 먹다 말고 가족 단체방 알림을 확인한다. 친척의 공무원 합격 소식, 사촌의 대기업 인턴 사진, 부모님의 짧은 축하 메시지가 차례로 올라와 있다. 아무도 당신을 직접 탓하지 않았지만, 이상하게도 모든 문장이 당신을 향해 걸어오는 것처럼 느껴진다.

곧이어 부모님에게서 개인 메시지가 온다. 이번 방학에는 무엇을 할 생각인지, 전공은 취업이 잘 되는지, 돈은 괜찮은지 묻는 말들이 너무 현실적이다. 당신은 사랑과 압박이 같은 말투로 도착할 수 있다는 사실을 새삼 깨닫는다.`,
    choices: [
      { id: "answer_honestly", label: "불안하지만 솔직하게 현재 상황을 말한다.", summary: "당신은 가족에게 불안을 드러내고 도움을 요청했다.", statDelta: { mental: 3, wealth: 2, reputation: -1 }, relationshipDelta: [{ name: "부모님", trust: 7 }], flagDelta: { familyPressure: "honest" } },
      { id: "lie_busy", label: "잘하고 있다고 둘러대고 대화를 빨리 끝낸다.", summary: "당신은 가족을 안심시키려 했지만 혼자 감당할 부담을 키웠다.", statDelta: { reputation: 2, mental: -5, health: -1 }, relationshipDelta: [{ name: "부모님", trust: -4 }], flagDelta: { familyPressure: "hidden" } },
    ],
    tags: ["가족", "압박", "멘탈"],
    source: "STATIC" as const,
  },
  {
    title: "조별과제의 배신",
    body: `당신은 발표 전날 밤 공유 문서를 열고 한동안 아무 말도 하지 못한다. 맡은 부분을 하겠다던 팀원의 칸은 여전히 비어 있고, 단체 채팅에는 미안하다는 말 대신 읽지 않은 숫자만 떠 있다. 교수님은 협업을 배우는 과정이라고 했지만, 지금 당신이 배우는 것은 협업보다 손해를 견디는 방법에 가깝다.

문서를 혼자 메우면 발표는 무사히 지나갈 수 있다. 하지만 그렇게 넘어가면 다음에도 같은 일이 반복될지도 모른다. 당신은 성적, 평판, 분노 사이에서 손가락을 키보드 위에 올려둔다.`,
    choices: [
      { id: "cover_team", label: "밤을 새워 빈 부분을 대신 채운다.", summary: "당신은 조별과제를 살리기 위해 자신의 시간을 갈아 넣었다.", statDelta: { academic: 4, reputation: 3, health: -5, mental: -4 }, relationshipDelta: [{ name: "도윤", trust: -10 }], flagDelta: { groupProject: "covered" } },
      { id: "call_out", label: "팀원의 미참여 기록을 교수님께 남긴다.", summary: "당신은 불편한 갈등을 감수하고 책임 소재를 남겼다.", statDelta: { mental: -2, reputation: -2, academic: 2 }, relationshipDelta: [{ name: "도윤", trust: -18 }], flagDelta: { groupProject: "called_out" } },
    ],
    tags: ["갈등", "복수", "학업"],
    source: "STATIC" as const,
  },
  {
    title: "작은 앱 아이디어",
    body: `당신은 과제용으로 만들던 작은 기록 앱이 생각보다 쓸 만하다는 말을 듣는다. 친구는 장난처럼 이거 진짜 서비스로 내보면 어떠냐고 말하고, 당신은 웃어넘기려다 잠깐 멈춘다. 취업 준비와 창업 사이에는 멋진 포스터보다 훨씬 많은 밤샘과 불확실성이 놓여 있다.

그래도 이상하게 손이 간다. 노트북 화면에는 아직 투박한 버튼과 깨진 레이아웃이 남아 있지만, 그 안에는 당신이 직접 만든 가능성이 있다. 오늘 밤 이 아이디어를 밀어붙일지, 아니면 안전하게 포트폴리오 수준에서 정리할지 선택해야 한다.`,
    choices: [
      { id: "ship_mvp", label: "밤을 새워 MVP를 공개한다.", summary: "당신은 작은 서비스를 세상에 내놓으며 창업의 문턱을 밟았다.", statDelta: { practical: 6, reputation: 3, health: -5, mental: -3 }, relationshipDelta: [], flagDelta: { startupThread: "mvp" } },
      { id: "portfolio_only", label: "포트폴리오로 정리하고 취업 준비에 활용한다.", summary: "당신은 아이디어를 현실적인 포트폴리오 자산으로 다듬었다.", statDelta: { practical: 4, mental: 1, wealth: -2, charm: -1 }, relationshipDelta: [], flagDelta: { startupThread: "portfolio" } },
    ],
    tags: ["창업", "실무", "포트폴리오"],
    source: "STATIC" as const,
  },
  {
    title: "스터디 카페의 낯선 제안",
    body: `당신은 스터디 카페 구석자리에서 자격증 기출문제를 풀다가 옆자리 사람이 남긴 메모를 발견한다. 메모에는 공기업 필기 스터디 모집 시간과 연락처가 적혀 있고, 아래에는 급하게 쓴 듯한 한 줄이 덧붙어 있다. ‘혼자 준비하면 오래 버티기 힘듭니다.’

말도 안 되는 우연이라고 생각하면서도 당신은 그 문장을 자꾸 다시 읽는다. 안정적인 직업이라는 말은 때로 구명줄처럼 보이지만, 그 줄을 잡는 순간 다른 길에서 멀어질 수도 있다. 당신은 오늘 저녁 그 스터디에 나갈지 말지 결정해야 한다.`,
    choices: [
      { id: "join_public_study", label: "공기업 필기 스터디에 나간다.", summary: "당신은 안정적인 진로 가능성을 붙잡기 위해 새 스터디에 들어갔다.", statDelta: { academic: 4, reputation: 1, mental: -2, wealth: -2 }, relationshipDelta: [{ name: "현우", trust: 6 }], flagDelta: { publicSectorThread: "study" } },
      { id: "ignore_note", label: "메모를 접어두고 원래 하던 준비를 계속한다.", summary: "당신은 흔들리는 마음을 접고 기존 계획을 유지했다.", statDelta: { mental: 2, academic: 1, practical: -2 }, relationshipDelta: [], flagDelta: { publicSectorThread: "ignored" } },
    ],
    tags: ["공무원", "공기업", "자격증"],
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
