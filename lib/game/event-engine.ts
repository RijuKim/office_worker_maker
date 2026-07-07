import { checkForcedEvent } from "@/lib/game/game-rules";
import type {
  AcademicPlan,
  DestinationCandidate,
  GraduationState,
  LifeStageId,
} from "@/lib/game/life-stage";

type PublicStats = Record<string, number>;

export interface EventSelectionContext {
  burnoutRisk: number;
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
  jobApplications?: { companyName: string; currentStage: string; isActive: boolean }[];
  careerPaths?: { pathType: string; status: string }[];
}

interface ConditionalEvent extends StaticEvent {
  arcIds: StoryArcId[];
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

type StoryArcId = "settling" | "commitment" | "pressure" | "consequence" | "future";

export const STORY_ARCS: { id: StoryArcId; title: string; phase: string; eventRange: [number, number]; openThread: string }[] = [
  { id: "settling", title: "첫 학기와 생활 기반", phase: "발단", eventRange: [0, 2], openThread: "수업, 주거, 돈, 첫 관계의 리듬을 잡아야 한다" },
  { id: "commitment", title: "소속과 첫 약속", phase: "전개", eventRange: [3, 5], openThread: "동아리, 알바, 연구실, 스터디 중 하나가 생활의 중심이 된다" },
  { id: "pressure", title: "압박과 유혹", phase: "위기", eventRange: [6, 8], openThread: "돈과 평판, 가족 압박, 위험한 제안이 같은 시기에 겹친다" },
  { id: "consequence", title: "선택의 청구서", phase: "절정", eventRange: [9, 11], openThread: "이전 선택이 사람과 사건을 통해 되돌아온다" },
  { id: "future", title: "졸업 직전의 방향", phase: "결말", eventRange: [12, 15], openThread: "중도 이탈을 피했다면 마지막 관문을 거쳐 선택의 결과로 수렴한다" },
];

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
        statDelta: { academic: 3, reputation: 3, mental: -2, wealth: -5 },
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
      { id: "take_extra_shift", label: "주말 대타까지 맡아 생활비를 확보한다.", summary: "당신은 생활비를 벌기 위해 더 긴 새벽을 받아들였다.", statDelta: { wealth: 80, practical: 2, health: -5, mental: -2 }, relationshipDelta: [], flagDelta: { partTimeJob: "extra_shift" } },
      { id: "reduce_shift", label: "이번 달까지만 하고 근무 시간을 줄이겠다고 말한다.", summary: "당신은 돈보다 회복과 수업 리듬을 우선했다.", statDelta: { health: 4, mental: 3, wealth: -50, reputation: -1 }, relationshipDelta: [], flagDelta: { partTimeJob: "reduced" } },
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
      { id: "answer_honestly", label: "불안하지만 솔직하게 현재 상황을 말한다.", summary: "당신은 가족에게 불안을 드러내고 도움을 요청했다.", statDelta: { mental: 3, wealth: 20, reputation: -1 }, relationshipDelta: [{ name: "부모님", trust: 7 }], flagDelta: { familyPressure: "honest" } },
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
      { id: "portfolio_only", label: "포트폴리오로 정리하고 취업 준비에 활용한다.", summary: "당신은 아이디어를 현실적인 포트폴리오 자산으로 다듬었다.", statDelta: { practical: 4, mental: 1, wealth: -10, charm: -1 }, relationshipDelta: [], flagDelta: { startupThread: "portfolio" } },
    ],
    tags: ["창업", "실무", "포트폴리오"],
    source: "STATIC" as const,
  },
  {
    title: "스터디 카페의 낯선 제안",
    body: `당신은 스터디 카페 구석자리에서 자격증 기출문제를 풀다가 옆자리 사람이 남긴 메모를 발견한다. 메모에는 공기업 필기 스터디 모집 시간과 연락처가 적혀 있고, 아래에는 급하게 쓴 듯한 한 줄이 덧붙어 있다. ‘혼자 준비하면 오래 버티기 힘듭니다.’

말도 안 되는 우연이라고 생각하면서도 당신은 그 문장을 자꾸 다시 읽는다. 안정적인 직업이라는 말은 때로 구명줄처럼 보이지만, 그 줄을 잡는 순간 다른 길에서 멀어질 수도 있다. 당신은 오늘 저녁 그 스터디에 나갈지 말지 결정해야 한다.`,
    choices: [
      { id: "join_public_study", label: "공기업 필기 스터디에 나간다.", summary: "당신은 안정적인 진로 가능성을 붙잡기 위해 새 스터디에 들어갔다.", statDelta: { academic: 4, reputation: 1, mental: -2, wealth: -10 }, relationshipDelta: [{ name: "현우", trust: 6 }], flagDelta: { publicSectorThread: "study", careerPathChosen: true } },
      { id: "ignore_note", label: "메모를 접어두고 원래 하던 준비를 계속한다.", summary: "당신은 흔들리는 마음을 접고 기존 계획을 유지했다.", statDelta: { mental: 2, academic: 1, practical: -2 }, relationshipDelta: [], flagDelta: { publicSectorThread: "ignored" } },
    ],
    tags: ["공무원", "공기업", "자격증"],
    source: "STATIC" as const,
  },
  {
    title: "분실 지갑과 CCTV",
    body: `당신은 학생회관 계단 아래에서 낡은 지갑 하나를 줍는다. 안에는 현금보다 더 눈에 띄는 USB와 경찰공무원 학원 영수증, 그리고 누군가의 이름이 적힌 쪽지가 들어 있다. 분실물 센터에 바로 맡기면 가장 안전하지만, 이상하게도 USB 라벨에 적힌 '면접 자료'라는 글자가 마음에 걸린다.

그때 복도 끝에서 누군가 급히 뛰어가는 발소리가 들린다. 당신은 이 일이 단순한 분실인지, 누군가 일부러 흘린 단서인지 알 수 없다. 사소한 호기심은 때로 탐정 같은 하루를 만들고, 때로는 곤란한 사건의 공범처럼 보이게 만든다.`,
    choices: [
      { id: "turn_wallet_in", label: "바로 분실물 센터에 맡긴다.", summary: "당신은 안전한 절차를 택해 괜한 의심을 피했다.", statDelta: { reputation: 4, mental: 1, practical: -1, charm: -1 }, relationshipDelta: [], flagDelta: { investigationThread: "lawful" } },
      { id: "check_usb", label: "USB 안의 내용을 먼저 확인한다.", summary: "당신은 위험한 호기심을 따라가며 사건의 단서를 보았다.", statDelta: { practical: 4, mental: -3, reputation: -5, health: -1 }, relationshipDelta: [{ name: "수상한 조교", trust: -12 }], flagDelta: { investigationThread: "snooped" } },
    ],
    tags: ["탐정", "경찰", "위험"],
    source: "STATIC" as const,
  },
  {
    title: "호주 워홀 포스터",
    body: `당신은 국제교류처 앞 게시판에서 오래된 워킹홀리데이 설명회 포스터를 본다. 사진 속 사람들은 햇빛 아래에서 웃고 있고, 포스터 아래에는 '도망이 아니라 경험'이라는 문장이 굵게 적혀 있다. 취업 준비가 막막해질수록 먼 나라의 계절은 이상할 만큼 구체적인 탈출구처럼 보인다.

하지만 비행기표는 싸지 않고, 돌아왔을 때 이력서의 빈칸을 어떻게 설명할지도 알 수 없다. 당신은 지금의 답답함을 벗어나고 싶은 마음과, 여기서 버텨야 한다는 마음 사이에 선다.`,
    choices: [
      { id: "prepare_working_holiday", label: "워홀 자금을 모으고 영어 공부를 시작한다.", summary: "당신은 해외에서 다른 삶을 시험해보기로 마음먹었다.", statDelta: { charm: 3, practical: 3, wealth: -30, mental: -1 }, relationshipDelta: [], flagDelta: { overseasThread: "working_holiday", careerPathChosen: true } },
      { id: "stay_and_apply", label: "포스터를 접어두고 국내 인턴 지원서를 쓴다.", summary: "당신은 떠나는 상상 대신 지금의 경쟁에 남기로 했다.", statDelta: { practical: 3, reputation: 2, mental: -3, health: -1 }, relationshipDelta: [], flagDelta: { overseasThread: "stayed" } },
    ],
    tags: ["해외", "워홀", "진로"],
    source: "STATIC" as const,
  },
  {
    title: "불법 과외 제안",
    body: `당신은 과외 중개 단체방에서 이상하게 높은 시급의 제안을 받는다. 학생의 성적을 올리는 일이라기보다, 특정 시험 자료를 대신 정리해달라는 말에 가깝다. 제안자는 별일 아니라는 듯 웃는 이모티콘을 붙였지만, 문장 사이에는 분명 선을 넘는 냄새가 있다.

돈은 급하고, 이번 달 카드값은 이미 계산보다 커졌다. 그러나 한 번 쉬운 돈을 받아들이면 다음 제안은 더 쉽게 들어올 것이다. 당신은 자산과 평판, 그리고 스스로에 대한 설명 사이에서 잠시 멈춘다.`,
    choices: [
      { id: "refuse_dirty_money", label: "제안을 거절하고 단체방을 나온다.", summary: "당신은 쉬운 돈을 포기하고 위험한 연결을 끊었다.", statDelta: { reputation: 4, mental: 2, wealth: -30, practical: -1 }, relationshipDelta: [{ name: "중개자", trust: -20 }], flagDelta: { crimeThread: "refused" } },
      { id: "accept_gray_work", label: "이번 한 번만 하겠다고 답한다.", summary: "당신은 돈 때문에 회색지대의 일을 받아들였다.", statDelta: { wealth: 200, practical: 2, reputation: -8, mental: -4 }, relationshipDelta: [{ name: "중개자", trust: 10 }], flagDelta: { crimeThread: "accepted" } },
    ],
    tags: ["범죄", "자산", "평판"],
    source: "STATIC" as const,
  },
  {
    title: "같이 살자는 말",
    body: `당신은 늦은 저녁, 익숙해진 사람과 학교 앞 분식집에 앉아 있다. 상대는 농담처럼 월세가 너무 비싸다고 말하다가, 문득 같이 살면 어떻겠냐고 묻는다. 가볍게 던진 말처럼 들리지만 숟가락을 내려놓는 손끝이 조금 떨린다.

연애는 스펙처럼 관리되지 않고, 결혼이나 동거는 더더욱 계획표대로 움직이지 않는다. 하지만 누군가와 삶의 비용을 나눈다는 상상은 생각보다 현실적이고, 생각보다 무섭다.`,
    choices: [
      { id: "consider_living_together", label: "진지하게 같이 사는 가능성을 이야기한다.", summary: "당신은 관계를 생활의 문제로 끌어와 진지하게 마주했다.", statDelta: { charm: 4, wealth: 15, mental: -3, reputation: -1 }, relationshipDelta: [{ name: "서연", trust: 18 }], flagDelta: { romanceFuture: "cohabitation" } },
      { id: "choose_solitude", label: "아직은 혼자 사는 시간이 필요하다고 말한다.", summary: "당신은 관계보다 혼자 버티는 리듬을 선택했다.", statDelta: { mental: 3, health: 1, charm: -3, wealth: -20 }, relationshipDelta: [{ name: "서연", trust: -10 }], flagDelta: { romanceFuture: "solitude" } },
    ],
    tags: ["연애", "결혼", "혼자살기"],
    source: "STATIC" as const,
  },
  {
    title: "취업 선배의 고백",
    body: `점심시간 학생식당에서 유진 선배를 마주친다. 선배는 이미 취업에 성공했지만 표정이 밝지만은 않다. "00, 나 요즘 회사 그만둘까 고민이야." 선배가 김치찌개를 비비며 뜬금없이 말을 꺼낸다. "사람들이 다 부러워하는 곳인데, 왜?"라고 묻자 선배는 씁쓸하게 웃는다. "좋은 회사랑 잘 맞는 회사는 다른 법이야. 00는 진짜 하고 싶은 게 뭔지 잘 생각해."`,
    choices: [
      { id: "ask_senior_detail", label: "왜 그만두고 싶은지 진짜 이유를 묻는다.", summary: "선배의 고민을 들으며 진로에 대해 더 깊이 고민하게 되었다.", statDelta: { mental: -2, practical: 3, reputation: 1 }, relationshipDelta: [{ name: "유진", trust: 5 }], flagDelta: { seniorAdvice: "heard" } },
      { id: "encourage_senior", label: "선배는 잘할 거라며 응원해 준다.", summary: "선배를 응원하며 관계를 돈독히 했다.", statDelta: { charm: 3, mental: 1 }, relationshipDelta: [{ name: "유진", trust: 8 }], flagDelta: { seniorAdvice: "encouraged" } },
    ],
    tags: ["진로", "취업", "회의"],
    source: "STATIC" as const,
  },
  {
    title: "도서관의 노인",
    body: `당신은 도서관 구석에서 레포트를 쓰다가 고개를 든다. 맞은편에는 항상 같은 자리에 앉아 있는 할아버지가 오늘도 조용히 책을 읽고 있다. 그가 갑자기 책을 내려놓고 말을 건다. "00라고? 자네 요즘 무슨 고민이 있나 보군." 당신은 깜짝 놀라지만, 그의 목소리는 이상할 정도로 편안하다. "내가 한마디만 하지. 자네가 지금 선택하는 길이 옳다고 생각하지 마. 옳게 만드는 거야."`,
    choices: [
      { id: "listen_old_man", label: "그의 말을 진지하게 듣고 인생 조언을 묻는다.", summary: "도서관 노인의 조언이 오래도록 마음에 남았다.", statDelta: { mental: 4, academic: 2 }, relationshipDelta: [{ name: "노인", trust: 9 }], flagDelta: { oldManAdvice: "listened" } },
      { id: "ignore_old_man", label: "웃어넘기고 레포트에 다시 집중한다.", summary: "당신은 알 수 없는 노인의 말을 흘려듣고 학업에 집중했다.", statDelta: { academic: 3, mental: -1 }, relationshipDelta: [], flagDelta: { oldManAdvice: "ignored" } },
    ],
    tags: ["도서관", "인생", "조언"],
    source: "STATIC" as const,
  },
  {
    title: "다단계의 유혹",
    body: `고등학교 때 알던 준호가 오랜만에 연락와서 커피를 마시자고 한다. 반가운 마음에 나갔더니 준호는 이런저런 이야기 끝에 슬슬 본론을 꺼낸다. "00, 요즘 생활비는 어떻게 버냐? 나 좋은 기회 있는데." 그의 핸드폰에는 외제차를 탄 사람들의 사진과 정체불명의 교육 프로그램 일정이 가득하다. 그의 눈빛은 반갑지만, 제안은 점점 위험해진다.`,
    choices: [
      { id: "refuse_pyramid", label: "정중하게 거절하고 자리에서 일어난다.", summary: "위험한 제안을 뿌리치고 평판을 지켰다.", statDelta: { reputation: 3, mental: 2, wealth: -5 }, relationshipDelta: [{ name: "준호", trust: -15 }], flagDelta: { pyramidRefused: true } },
      { id: "hear_more", label: "일단 설명을 더 들어보기로 한다.", summary: "호기심에 다단계 설명을 들었지만 빠져나오기 어려워졌다.", statDelta: { wealth: 10, reputation: -3, mental: -3 }, relationshipDelta: [{ name: "준호", trust: 3 }], flagDelta: { pyramidHeard: true } },
    ],
    tags: ["다단계", "사기", "위험"],
    source: "STATIC" as const,
  },
  {
    title: "학생회장의 제안",
    body: `복도를 걷는데 동규 학생회장이 당신을 붙잡는다. "00, 나랑 좀 얘기할 시간 있어?" 그의 표정은 진지하다. "다음 학기 학생회 부회장 생각 있어?" 갑작스러운 제안에 당신은 멈칫한다. "스펙에도 좋고, 사람들도 많이 만날 수 있어. 대신 시간은 많이 뺏길 거야. 선택은 네 몫이야."`,
    choices: [
      { id: "accept_vp", label: "부회장 제안을 수락한다.", summary: "학생회 부회장으로서 바쁜 한 학기를 보내게 되었다.", statDelta: { reputation: 5, practical: 3, academic: -3, health: -3, mental: -2 }, relationshipDelta: [{ name: "동규", trust: 10 }], flagDelta: { studentCouncil: "vp" } },
      { id: "decline_vp", label: "정중하게 거절한다. 시간이 부족하다.", summary: "학생회 제안을 거절하고 개인 시간을 확보했다.", statDelta: { academic: 2, mental: 2, reputation: -1 }, relationshipDelta: [{ name: "동규", trust: -5 }], flagDelta: { studentCouncil: "declined" } },
    ],
    tags: ["학생회", "리더십", "스펙"],
    source: "STATIC" as const,
  },
  {
    title: "밤거리의 제안",
    body: `늦은 밤, 편의점 알바를 끝내고 집으로 돌아가는 길. 학교 앞 골목에서 재석이라는 선배가 담배를 피우며 서 있다. "어, 00씨! 요즘 잘 지내?" 그는 당신이 아르바이트를 뛰는 걸 알고 있다. "내가 하는 일이 있는데, 시간 대비 꽤 괜찮아. 한번 들어와 볼 생각 없어?" 그의 미소는 친절하지만, 그 뒤에 무엇이 있는지 알 길이 없다.`,
    choices: [
      { id: "refuse_underworld", label: "고맙지만 괜찮다고 말하고 빨리 집에 간다.", summary: "당신은 위험한 제안을 뿌리치고 안전한 길을 선택했다.", statDelta: { reputation: 2, mental: 2, wealth: -10 }, relationshipDelta: [{ name: "재석", trust: -10 }], flagDelta: { underworldRefused: true } },
      { id: "accept_underworld", label: "무슨 일인지 궁금해서 한 번 들어본다.", summary: "당신은 위험한 세계에 첫발을 내디뎠다.", statDelta: { wealth: 150, practical: 2, reputation: -5, mental: -4 }, relationshipDelta: [{ name: "재석", trust: 12 }], flagDelta: { underworldEntered: true } },
    ],
    tags: ["범죄", "알바", "위험"],
    source: "STATIC" as const,
  },
  {
    title: "동아리 MT의 고백",
    body: `MT 마지막 밤, 모닥불 옆에서 은지 동아리 부장이 조용히 다가와 앉는다. "00, 나 할 말이 있어." 평소와 다른 진지한 말투에 심장이 내려앉는다. "사실 나…… 다음 학기부터는 동아리 못 나올 것 같아. 취업 준비 때문에." 당신은 안도하면서도 왠지 모를 실망감을 느낀다. 은지가 작게 덧붙인다. "대신 내가 알게 모르게 도움될 만한 연락처는 좀 남겨줄게."`,
    choices: [
      { id: "support_eunji", label: "은지의 결정을 응원하고 앞으로도 자주 보자고 한다.", summary: "은지 부장의 결정을 응원하며 관계를 이어갔다.", statDelta: { charm: 3, mental: 1 }, relationshipDelta: [{ name: "은지", trust: 8 }], flagDelta: { eunjiDeparture: "supported" } },
      { id: "ask_contacts", label: "유용한 연락처를 지금 바로 달라고 한다.", summary: "당신은 은지의 인맥을 받아들여 실용적인 선택을 했다.", statDelta: { practical: 4, network: 3, reputation: -1 }, relationshipDelta: [{ name: "은지", trust: 2 }], flagDelta: { eunjiDeparture: "contacts" } },
    ],
    tags: ["동아리", "이별", "인맥"],
    source: "STATIC" as const,
  },
  {
    title: "의문의 USB",
    body: `학교 후문에서 누군가 당신에게 USB 하나를 건넨다. 정체를 알 수 없는 남자는 "이거, 너한테 도움될 거야"라는 말만 남기고 사라진다. USB 안에는 '면접_족보'라는 이름의 폴더와 함께 이상한 실행 파일이 들어 있다. 이건 누군가가 일부러 당신에게 준 것 같지만, 열어보기 전에는 함정인지 기회인지 알 수 없다.`,
    choices: [
      { id: "report_usb", label: "USB를 학교에 신고한다.", summary: "의문의 USB를 신고하고 안전한 선택을 했다.", statDelta: { reputation: 4, mental: 1, practical: -2 }, relationshipDelta: [], flagDelta: { usbInvestigation: "reported" } },
      { id: "open_usb", label: "USB 내용물을 확인한다.", summary: "USB 안의 정보를 확인하고 위험한 지식을 얻었다.", statDelta: { practical: 5, reputation: -3, mental: -2, wealth: 30 }, relationshipDelta: [], flagDelta: { usbInvestigation: "opened" } },
    ],
    tags: ["의문", "위험", "선택"],
    source: "STATIC" as const,
  },
  {
    title: "과 선배의 도박 제안",
    body: `수업이 끝난 뒤, 평소에 친하게 지내던 선배가 조용히 다가와 쪽지를 건넨다. '오늘 밤 10시, 학교 후문. 재미보고 용돈도 벌 기회.' 선배는 눈빛으로 말하지 말라는 신호를 보낸다. 주변에서는 아무도 이 상황을 눈치채지 못했다. 당신의 손에는 작은 쪽지 한 장이 남아 있다.`,
    choices: [
      { id: "refuse_gambling", label: "쪽지를 찢어 버리고 없는 일로 한다.", summary: "위험한 도박의 유혹을 뿌리치고 깨끗한 길을 선택했다.", statDelta: { reputation: 3, mental: 2, wealth: -10 }, relationshipDelta: [{ name: "수진", trust: -10 }], flagDelta: { gamblingRefused: true } },
      { id: "try_gambling", label: "호기심에 한 번 나가본다.", summary: "작은 도박이 큰 빚으로 이어질지도 모른다.", statDelta: { wealth: 100, practical: 1, reputation: -4, mental: -5 }, relationshipDelta: [{ name: "수진", trust: 8 }], flagDelta: { gamblingTried: true } },
    ],
    tags: ["도박", "위험", "선배"],
    source: "STATIC" as const,
  },
  {
    title: "공모전 팀 구성",
    body: `교수님 연구실에서 나오는데 같은 과 태수가 달려온다. "00! 나 지금 아이디어 있는데 같이 공모전 나갈 사람 찾고 있었어!" 태수의 눈은 반짝이고 있다. "아직 구체적이지는 않은데, 상만 타도 스펙에 좋고. 어때?" 당신의 전공 실력과 그의 네트워크를 합치면 꽤 괜찮은 팀이 될 수도 있다. 하지만 지금 당신의 일정은 이미 꽉 차 있다.`,
    choices: [
      { id: "join_contest", label: "공모전에 함께 나가기로 한다.", summary: "공모전 준비로 바쁘지만 스펙과 관계를 쌓았다.", statDelta: { practical: 4, reputation: 3, academic: -2, health: -3 }, relationshipDelta: [{ name: "태수", trust: 7 }], flagDelta: { contestJoined: true } },
      { id: "skip_contest", label: "일정이 안 된다고 정중히 거절한다.", summary: "공모전 대신 안정적인 학업에 집중하기로 했다.", statDelta: { academic: 2, mental: 1, reputation: -2 }, relationshipDelta: [{ name: "태수", trust: -3 }], flagDelta: { contestSkipped: true } },
    ],
    tags: ["공모전", "스펙", "팀플"],
    source: "STATIC" as const,
  },
  {
    title: "건강검진 결과",
    body: `학교 정기 건강검진 결과가 나왔다. 결과지에는 몇 가지 수치가 정상 범위를 벗어났다는 표시가 찍혀 있다. 의사는 "무리하지 말고, 규칙적인 생활하세요"라는 평범한 조언을 건넸지만, 당신은 요즘 들어 부쩍 피곤함을 느낀다. 컨디션 관리를 의식적으로 해야 할 때다.`,
    choices: [
      { id: "start_exercise", label: "헬스장에 등록하고 규칙적으로 운동한다.", summary: "운동을 시작하며 컨디션 회복에 힘썼다.", statDelta: { health: 6, mental: 2, wealth: -5, practical: -1 }, relationshipDelta: [], flagDelta: { healthRoutine: "exercise" } },
      { id: "reduce_schedule", label: "약속과 알바를 줄이고 휴식을 늘린다.", summary: "일정을 줄이고 회복에 집중했다.", statDelta: { health: 4, mental: 3, wealth: -10, reputation: -2 }, relationshipDelta: [], flagDelta: { healthRoutine: "rest" } },
      { id: "ignore", label: "별일 아니겠거니 하고 무시한다.", summary: "건강 경고를 무시하고 기존 일정을 밀어붙였다.", statDelta: { practical: 2, health: -4, mental: -2 }, relationshipDelta: [], flagDelta: { healthRoutine: "ignored" } },
    ],
    tags: ["건강", "운동", "일상"],
    source: "STATIC" as const,
  },
  {
    title: "동아리 회식 자리",
    body: `동아리 회식 자리, 분위기가 무르익을 무렵 은지 부장이 벌써 술에 취했다. "00야~ 나 사장님이랑 친해져서…… 좋은 자리 하나 만들어줬어. 근데 조건이 있어." 주변 사람들이 왁자지껄한 사이, 은지가 작게 속삭인다. "내일 면접 보는데, 대신 좀 봐줘. 내가 전에 정리해둔 자료 있는데……" 그녀의 눈빛이 반 농담인지 진담인지 알 수 없다.`,
    choices: [
      { id: "help_eunji", label: "은지 부장을 도와주기로 한다.", summary: "은지 부장의 면접을 도와주며 관계를 강화했다.", statDelta: { reputation: 2, charm: 2, academic: -1, health: -2 }, relationshipDelta: [{ name: "은지", trust: 10 }], flagDelta: { eunjiInterview: "helped" } },
      { id: "refuse_help", label: "술 취한 말이라 치고 넘어간다.", summary: "은지 부장의 부탁을 흘려듣고 선을 지켰다.", statDelta: { mental: 2, health: 1 }, relationshipDelta: [{ name: "은지", trust: -3 }], flagDelta: { eunjiInterview: "refused" } },
    ],
    tags: ["동아리", "회식", "관계"],
    source: "STATIC" as const,
  },
  {
    title: "취업 스터디의 경쟁자",
    body: `취업 스터디 모임에서 혜진이 당신에게 다가와 말을 건다. "00, 나 요즘 네가 준비하는 곳이랑 같은 기업 준비 중이야." 그녀의 표정은 호의적이지만, 눈빛은 경계심을 숨기지 않는다. "자료 공유하면서 같이 준비할 사람 필요한데, 어때?" 스터디 그룹에서 자연스러운 제안이지만, 같은 포지션에 지원할지도 모른다는 불안감이 스친다.`,
    choices: [
      { id: "share_with_rival", label: "자료를 공유하고 함께 준비한다.", summary: "경쟁자와 자료를 공유하며 실력을 키웠다.", statDelta: { academic: 3, practical: 3, reputation: 2 }, relationshipDelta: [{ name: "혜진", trust: 6 }], flagDelta: { studyShare: "shared" } },
      { id: "keep_to_self", label: "자료는 따로 준비하겠다고 말한다.", summary: "경쟁자와 거리를 두고 혼자 준비하는 길을 택했다.", statDelta: { academic: 2, mental: 1, reputation: -2 }, relationshipDelta: [{ name: "혜진", trust: -5 }], flagDelta: { studyShare: "kept" } },
    ],
    tags: ["취업", "경쟁", "스터디"],
    source: "STATIC" as const,
  },
  {
    title: "헬스장에서 만난 사람",
    body: `헬스장에서 운동을 마치고 나오는데 현우 트레이너가 다가온다. "00, 오늘 운동 잘했어! 근데 자세가 조금 이상하더라." 그는 장난기 가득한 미소를 지으며 교정해 줄 테니 다음에 개인 운동을 제안한다. "내가 봤을 때 00는 충분히 더 잘할 수 있어. 운동도 인생도, 가이드가 있으면 훨씬 쉬워." 그의 말은 운동 이상의 의미로 들리기도 한다.`,
    choices: [
      { id: "accept_personal_training", label: "개인 운동을 받아들인다.", summary: "현우 트레이너와 가까워지며 운동과 관계 모두 발전했다.", statDelta: { health: 5, charm: 2, wealth: -5 }, relationshipDelta: [{ name: "현우", trust: 7 }], flagDelta: { personalTraining: "accepted" } },
      { id: "decline_training", label: "괜찮다며 혼자 하겠다고 말한다.", summary: "혼자 운동하며 개인 시간을 유지했다.", statDelta: { health: 2, mental: 1 }, relationshipDelta: [{ name: "현우", trust: -2 }], flagDelta: { personalTraining: "declined" } },
    ],
    tags: ["운동", "건강", "관계"],
    source: "STATIC" as const,
  },
  {
    title: "어머니의 전화",
    body: `늦은 밤, 어머니에게서 전화가 온다. "00아, 밥은 먹었니? 요즘 잘 지내?" 평소와 다름없는 안부지만, 목소리에 평소보다 더 많은 걱정이 묻어 있다. "이번에 네 사촌이 취업했단다. …00는 잘 준비되고 있니?" 침묵이 전화선을 타고 흐른다. 당신은 대답을 준비하지 못했다.`,
    choices: [
      { id: "honest_with_mom", label: "솔직하게 불안하다고 말씀드린다.", summary: "어머니께 솔직한 심정을 털어놓고 위로를 받았다.", statDelta: { mental: 4, wealth: 10 }, relationshipDelta: [{ name: "부모님", trust: 8 }], flagDelta: { momCall: "honest" } },
      { id: "lie_to_mom", label: "잘되고 있다고 둘러댄다.", summary: "어머니를 안심시켰지만 혼자 부담을 짊어졌다.", statDelta: { mental: -3, reputation: 1 }, relationshipDelta: [{ name: "부모님", trust: -4 }], flagDelta: { momCall: "lied" } },
      { id: "change_topic", label: "화제를 돌리며 대화를 얼른 끝낸다.", summary: "어색한 대화를 피하고 혼자 있는 시간을 택했다.", statDelta: { mental: -1, health: 1 }, relationshipDelta: [{ name: "부모님", trust: -2 }], flagDelta: { momCall: "avoided" } },
    ],
    tags: ["가족", "진로", "압박"],
    source: "STATIC" as const,
  },
  {
    title: "토익 시험 접수",
    body: `학교 게시판에서 TOEIC 접수 마감 안내를 본다. 마감까지 얼마 남지 않았다. 응시료는 부담스럽지만, 취업 준비 어디에나 따라붙는 점수라는 사실은 변하지 않는다. 이번 회차를 놓치면 다음 시험까지 최소 한 달을 기다려야 한다.

책상 앞에 앉아 카드와 접수 페이지를 번갈아 본다. 지금 접수하면 준비 기간은 짧지만 목표가 생긴다. 이번은 넘기고 다음을 노리면 여유는 생기지만, 그만큼 미루는 습관도 굳어질지 모른다.`,
    choices: [
      { id: "toeic_register", label: "접수한다. 일단 신청하고 공부를 시작한다.", summary: "당신은 토익 접수를 마치고 어학 스펙 준비를 시작했다.", statDelta: { wealth: -5, academic: 1 }, relationshipDelta: [], flagDelta: { specInit: { specType: "LANGUAGE_SCORE", specName: "TOEIC" } } },
      { id: "toeic_skip", label: "이번은 넘기고 다음 기회에 준비한다.", summary: "당신은 무리하지 않고 다음 기회를 기다리기로 했다.", statDelta: { mental: 1 }, relationshipDelta: [], flagDelta: { toeicSkipped: true } },
    ],
    tags: ["스펙", "어학", "시험"],
    source: "STATIC" as const,
  },
  {
    title: "인턴 공고",
    body: `학교 게시판에 눈에 띄는 공고가 붙었다. 이름은 들어본 스타트업, 3개월 인턴 과정이다. 실무 경험을 준다는 문구 옆에는 급여와 근무 시간이 작게 적혀 있다. 큰 회사는 아니지만, 이력서에 쓸 수 있는 첫 줄이 될 수도 있다.

당신은 사진을 찍어두고 잠시 걷는다. 지원하면 학기 리듬은 흔들릴 것이고, 지원하지 않으면 이번 학기도 스펙 없이 지나갈지 모른다. 결정은 빠를수록 좋다.`,
    choices: [
      { id: "intern_apply", label: "지원한다. 실무 경험이 지금 필요하다.", summary: "당신은 스타트업 인턴에 지원하며 실무 경력을 쌓기로 했다.", statDelta: { practical: 2, mental: -1 }, relationshipDelta: [], flagDelta: { specInit: { specType: "INTERNSHIP", specName: "스타트업 인턴 (3개월)" } } },
      { id: "intern_watch", label: "일단 지켜본다. 상황을 더 파악한다.", summary: "당신은 성급한 결정을 미루고 학업 리듬을 지켰다.", statDelta: { academic: 1 }, relationshipDelta: [], flagDelta: { internWatched: true } },
    ],
    tags: ["스펙", "인턴", "진로"],
    source: "STATIC" as const,
  },
  {
    title: "공모전 소식",
    body: `교수님이 강의 끝에 잠깐 남으라고 부른다. 책상 위에 놓인 A4 한 장에는 유망한 공모전 정보가 정리되어 있다. "자네 실력이면 해볼 만해." 짧은 문장이지만, 그 안에 담긴 기대는 무겁게 느껴진다.

팀을 꾸리면 밤샘과 갈등이 따라오지만 결과가 커진다. 개인 포트폴리오로 정리하면 안정적이지만, 눈에 띄는 스펙 한 줄은 얻기 어렵다. 어느 쪽이든 이번 학기의 무게는 달라진다.`,
    choices: [
      { id: "contest_team", label: "팀을 꾸려 참가한다. 결과를 노린다.", summary: "당신은 팀을 꾸려 공모전에 뛰어들며 포트폴리오를 쌓기 시작했다.", statDelta: { practical: 2, charm: 1, health: -2 }, relationshipDelta: [], flagDelta: { specInit: { specType: "PORTFOLIO", specName: "공모전 참가" } } },
      { id: "contest_solo", label: "개인 포트폴리오를 준비한다.", summary: "당신은 개인 포트폴리오에 시간을 쏟으며 안정적인 성과를 노렸다.", statDelta: { academic: 2 }, relationshipDelta: [], flagDelta: { contestSolo: true } },
    ],
    tags: ["스펙", "공모전", "포트폴리오"],
    source: "STATIC" as const,
  },
  {
    title: "자격증 시험",
    body: `정보처리기사 필기 접수 기간이 시작되었다. 인터넷에 접속해 접수 페이지를 열어놓고 한참을 망설인다. 자격증은 취업 시장의 최소 조건 같은 것이 되었고, 없어도 되지만 있는 편이 낫다는 애매한 위치에 있다.

접수하면 몇 달 동안 문제집과 씨름해야 한다. 시간을 다른 곳에 쓰면 더 직접적인 스펙을 만들 수도 있다. 손끝은 결제 버튼 근처에서 여전히 멈춰 있다.`,
    choices: [
      { id: "cert_register", label: "접수하고 공부를 시작한다.", summary: "당신은 자격증 준비에 뛰어들며 취업 최소 조건을 채우기로 했다.", statDelta: { academic: 3, mental: -2, wealth: -3 }, relationshipDelta: [], flagDelta: { specInit: { specType: "CERTIFICATION", specName: "정보처리기사" } } },
      { id: "cert_skip", label: "취업에 직접적 도움되는 걸 준비한다.", summary: "당신은 자격증 대신 실무 스펙에 시간을 투자하기로 했다.", statDelta: { practical: 2 }, relationshipDelta: [], flagDelta: { certSkipped: true } },
    ],
    tags: ["스펙", "자격증", "시험"],
    source: "STATIC" as const,
  },
  {
    title: "워홀 준비",
    body: `학교 카페에서 오랜만에 만난 친구가 워킹홀리데이를 준비 중이라고 한다. 필요한 서류, 비자 절차, 도착 첫 달의 예산까지, 친구는 이미 반쯤 떠난 사람 같았다. 당신은 커피 잔을 감싼 채 그 이야기를 오래 듣는다.

친구는 정보를 나눠줄 수 있다고 했다. 함께 준비하면 부담은 줄지만, 진로는 그만큼 크게 흔들린다. 여기서 다시 생각해보면 안정은 지키겠지만, 마음 한쪽은 계속 그쪽을 바라볼 것이다.`,
    choices: [
      { id: "wh_prepare", label: "정보를 공유받고 함께 준비한다.", summary: "당신은 워킹홀리데이 준비에 마음을 열고 첫걸음을 뗐다.", statDelta: { practical: 2, charm: 1 }, relationshipDelta: [], flagDelta: { careerPathInit: { pathType: "WORKING_HOLIDAY" }, careerPathChosen: true } },
      { id: "wh_reconsider", label: "내 상황을 다시 생각해본다.", summary: "당신은 지금의 안정을 지키기 위해 결정을 미뤘다.", statDelta: { mental: 2 }, relationshipDelta: [], flagDelta: { whReconsidered: true } },
    ],
    tags: ["해외", "워홀", "진로"],
    source: "STATIC" as const,
  },
  {
    title: "고시 준비",
    body: `학교 근처 고시촌에서 우연히 마주친 선배가 두꺼운 기본서를 들고 있다. 사법고시가 폐지된 지 오래지만, 로스쿨과 행정고시, 각종 고시반은 여전히 어딘가에서 사람들을 붙잡고 있었다. 선배의 얼굴은 창백했고, 눈은 이상하게 침착했다.

몇 년을 걸어야 하는 길이라는 걸 서로 잘 알고 있다. 조언을 구하면 현실적인 그림이 그려질 것이고, 지금의 진로와 비교하면 결심이 생기거나 흔들릴 것이다. 어느 쪽이든 오늘 이 대화는 오래 기억에 남을 것 같다.`,
    choices: [
      { id: "gosi_ask", label: "선배에게 조언을 구한다.", summary: "당신은 고시 준비 선배에게 진지한 조언을 구했다.", statDelta: { academic: 2 }, relationshipDelta: [{ name: "선배", trust: 4 }], flagDelta: { gosiInterest: "asked", careerPathChosen: true } },
      { id: "gosi_compare", label: "내 진로와 비교해본다.", summary: "당신은 자신의 진로를 다시 정리하며 방향을 고민했다.", statDelta: { mental: 2 }, relationshipDelta: [], flagDelta: { gosiCompared: true } },
    ],
    tags: ["진로", "고시", "시험"],
    source: "STATIC" as const,
  },
  {
    title: "취준 우울",
    body: `벌써 몇 번째 불합격 통보인지 세는 것도 지쳤다. 침대에 누워 천장을 보고 있으면 아침이 되고, 아침이 되면 다시 지원서와 마주해야 한다. 방 안의 공기는 무겁고, 밖으로 나가는 계단은 유난히 길어 보인다.

몸이 신호를 보내고 있다는 걸 안다. 여기서 잠시 쉬면 회복은 되지만 다른 사람들은 더 앞서갈 것 같은 두려움이 든다. 더 밀어붙이면 뭐라도 잡힐 것 같지만, 더 깊게 무너질 위험도 크다.`,
    choices: [
      { id: "burn_rest", label: "잠시 쉬면서 재충전한다.", summary: "당신은 취준 번아웃을 인정하고 회복을 우선했다.", statDelta: { mental: 3, health: 2, practical: -1 }, relationshipDelta: [], flagDelta: { jobSeekBurnout: "rested" } },
      { id: "burn_push", label: "더 악착같이 준비한다.", summary: "당신은 지친 몸을 밀어붙이며 준비를 이어갔다.", statDelta: { practical: 2, mental: -4 }, relationshipDelta: [], flagDelta: { jobSeekBurnout: "pushed" } },
    ],
    tags: ["취준", "멘탈", "번아웃"],
    source: "STATIC" as const,
  },
];

export const CONDITIONAL_STATIC_EVENTS: ConditionalEvent[] = [
  {
    title: "새벽 알바 이후의 낮 수업",
    body: `당신은 강의실 맨 뒷자리에서 눈을 뜬다. 분명 필기를 하려고 펼친 노트에는 계산대에서 외운 담배 이름과 전공 용어가 뒤섞여 있다. 어젯밤 더 긴 새벽을 받아들인 선택은 통장 잔고에는 숫자로 남았지만, 낮의 얼굴에서는 빠르게 티가 나기 시작했다.

교수님은 출석을 부르다 당신의 이름 앞에서 잠깐 멈춘다. 옆자리의 민하가 조용히 물병을 밀어주고, 휴대폰에는 점장의 주말 대타 메시지가 다시 떠 있다. 돈을 버는 일은 끝난 뒤에도 하루를 계속 점령한다는 걸, 당신은 이제 몸으로 알고 있다.`,
    choices: [
      { id: "ask_shift_boundary", label: "점장에게 주말 대타는 어렵다고 선을 긋는다.", summary: "당신은 돈보다 수업 리듬을 지키기 위해 알바 시간을 제한했다.", statDelta: { health: 4, mental: 2, wealth: -40, reputation: -1 }, relationshipDelta: [{ name: "명수", trust: -4 }], flagDelta: { partTimeBoundary: true, moneyThread: "strained" } },
      { id: "hide_fatigue", label: "피곤한 티를 숨기고 대타까지 다시 맡는다.", summary: "당신은 생활비를 붙잡기 위해 피로를 더 깊이 숨겼다.", statDelta: { wealth: 60, practical: 1, health: -6, mental: -4 }, relationshipDelta: [{ name: "민하", trust: -3 }], flagDelta: { sleepDebtThread: "deepened", moneyThread: "urgent" } },
    ],
    tags: ["알바", "건강", "학업"],
    source: "STATIC",
    arcIds: ["commitment", "pressure"],
    condition: { requiredFlags: { partTimeJob: "extra_shift" } },
  },
  {
    title: "위험한 알바의 첫 청구서",
    body: `재석에게서 온 메시지는 짧았다. '오늘은 진짜 일 하나만 도와줘.' 지난번 골목에서 호기심을 멈추지 못한 뒤로, 그는 당신을 예전보다 훨씬 자연스럽게 부른다. 돈은 빠르게 들어왔지만, 그 돈이 왜 쉬웠는지 설명할 수 없는 순간도 같이 늘었다.

약속 장소에 도착하자 봉투 하나와 낯선 이름이 적힌 메모가 놓여 있다. 재석은 별일 아니라며 웃지만, 당신은 이 일이 단순한 심부름이 아니라 누군가의 약점을 옮기는 일일 수도 있다는 생각을 지우지 못한다. 지금 물러서면 손해를 볼 것이고, 계속하면 더 깊은 문이 열린다.`,
    choices: [
      { id: "walk_away_underworld", label: "봉투를 내려놓고 더는 못 하겠다고 말한다.", summary: "당신은 위험한 돈에서 빠져나오려 했지만 재석의 눈밖에 났다.", statDelta: { reputation: 3, mental: -3, wealth: -50, health: -1 }, relationshipDelta: [{ name: "재석", trust: -24 }], flagDelta: { underworldExitAttempt: true, crimeThread: "exit_attempt" } },
      { id: "deliver_envelope", label: "아무것도 묻지 않고 봉투를 전달한다.", summary: "당신은 위험한 심부름을 받아들이며 회색지대에 더 깊이 들어갔다.", statDelta: { wealth: 250, practical: 2, reputation: -10, mental: -6 }, relationshipDelta: [{ name: "재석", trust: 14 }], flagDelta: { underworldDebt: true, crimeThread: "entangled" } },
    ],
    tags: ["범죄", "알바", "위험"],
    source: "STATIC",
    arcIds: ["pressure", "consequence"],
    condition: { anyFlags: ["underworldEntered", "accept_gray_work"] },
  },
  {
    title: "도박 클럽의 두 번째 초대",
    body: `수진은 마치 우연처럼 학생회관 앞에 서 있었다. 지난번의 작은 호기심은 이미 끝난 일이라고 생각했지만, 그녀는 당신이 그날 어떤 표정으로 나왔는지까지 기억하고 있었다. "이번엔 진짜 판이 좋아요." 낮은 목소리는 친절했고, 그래서 더 위험했다.

휴대폰에는 카드값 알림이 떠 있고, 머릿속에서는 잃은 돈을 한 번에 되찾는 장면이 자꾸 재생된다. 그러나 옆 계단에는 같은 과 후배가 앉아 있어, 당신이 누구와 이야기하는지 볼 수도 있다. 한 번 더 들어가는 선택은 돈만이 아니라 평판과 관계까지 건다.`,
    choices: [
      { id: "block_gambling_contact", label: "수진의 연락처를 차단하고 후배에게도 조심하라고 말한다.", summary: "당신은 도박 연결을 끊고 주변에 경고했다.", statDelta: { reputation: 4, mental: 2, wealth: -20, charm: -1 }, relationshipDelta: [{ name: "수진", trust: -25 }], flagDelta: { gamblingCutOff: true, crimeThread: "resisted" } },
      { id: "chase_losses", label: "이번 한 번만 손실을 메우겠다고 따라간다.", summary: "당신은 잃은 돈을 되찾으려다 더 큰 빚의 문을 열었다.", statDelta: { wealth: -200, mental: -8, reputation: -7, practical: 2 }, relationshipDelta: [{ name: "수진", trust: 12 }], flagDelta: { gamblingDebt: true, crimeThread: "debt" } },
    ],
    tags: ["도박", "빚", "평판"],
    source: "STATIC",
    arcIds: ["pressure", "consequence"],
    condition: { anyFlags: ["gamblingTried", "pyramidHeard"] },
  },
  {
    title: "기숙사 세탁실의 소문",
    body: `기숙사 세탁실은 밤이 깊을수록 이상하게 솔직해진다. 건조기 앞에 모인 사람들은 과제보다 룸메이트 이야기와 장학금, 누가 누구와 다투었는지를 더 많이 말한다. 당신이 바구니를 내려놓는 순간, 누군가 당신 이름이 섞인 말을 급히 삼킨다.

소문은 아직 작지만 방향이 있다. 같은 층 사람이 당신의 지난 선택을 다르게 해석했고, 그 말이 관계와 평판을 조금씩 긁고 있다. 기숙사는 가까워서 편하지만, 가까운 만큼 도망갈 문이 적다.`,
    choices: [
      { id: "confront_dorm_rumor", label: "소문의 출처를 차분히 묻고 바로잡는다.", summary: "당신은 기숙사 소문에 직접 대응하며 불편한 대화를 감수했다.", statDelta: { reputation: 3, mental: -3, charm: 1, health: -1 }, relationshipDelta: [{ name: "민하", trust: 3 }], flagDelta: { dormRumorHandled: "direct" } },
      { id: "avoid_dorm_people", label: "대화를 피하고 방으로 돌아가 문을 잠근다.", summary: "당신은 소문을 피했지만 기숙사 안에서 더 고립되었다.", statDelta: { mental: -2, reputation: -3, health: 1 }, relationshipDelta: [{ name: "민하", trust: -3 }], flagDelta: { dormRumorHandled: "avoidant" } },
    ],
    tags: ["기숙사", "소문", "관계"],
    source: "STATIC",
    arcIds: ["settling", "commitment"],
    condition: { residences: ["dorm"] },
  },
  {
    title: "자취방 월세 고지서",
    body: `우편함에 꽂힌 월세 고지서는 생각보다 얇았고, 그래서 더 무거웠다. 공과금과 관리비를 합친 숫자는 지난달의 계산을 조용히 비웃고 있었다. 자취방은 자유를 주지만, 자유는 매달 날짜를 맞춰 돈으로 증명해야 했다.

책상 위에는 과제 자료와 아르바이트 공고, 그리고 가족에게 차마 보내지 못한 메시지가 나란히 놓여 있다. 도움을 청하면 숨통은 트일 수 있다. 대신 독립했다는 말을 스스로 조금 거둬야 한다.`,
    choices: [
      { id: "ask_family_rent_help", label: "가족에게 이번 달만 도움을 부탁한다.", summary: "당신은 자존심을 접고 가족에게 월세 도움을 요청했다.", statDelta: { wealth: 50, mental: -2, reputation: -1 }, relationshipDelta: [{ name: "부모님", trust: 5 }], flagDelta: { rentHelpAsked: true, familyPressure: "financial_help" } },
      { id: "find_more_work", label: "도움을 청하지 않고 단기 알바를 더 찾는다.", summary: "당신은 독립을 지키기 위해 노동 시간을 늘렸다.", statDelta: { wealth: 50, health: -5, mental: -3, practical: 1 }, relationshipDelta: [], flagDelta: { rentStress: true, moneyThread: "urgent" } },
    ],
    tags: ["자취", "돈", "가족"],
    source: "STATIC",
    arcIds: ["settling", "pressure"],
    condition: { residences: ["studio"] },
  },
  {
    title: "본가 식탁의 진로 심문",
    body: `저녁 식탁은 평소처럼 조용했지만, 질문은 정확히 당신의 약한 곳을 향했다. 부모님은 걱정이라는 말투로 이번 학기 성적과 인턴, 알바 시간을 차례로 물었다. 본가에 산다는 것은 가끔 밥값을 아끼는 대신, 불안을 숨길 공간을 잃는 일이기도 했다.

당신은 숟가락을 내려놓고 어느 정도까지 말할지 계산한다. 솔직해지면 도움을 받을 수도 있지만, 앞으로의 모든 선택에 의견이 따라붙을 것이다. 숨기면 오늘 밤은 조용히 지나가겠지만 압박은 더 오래 남는다.`,
    choices: [
      { id: "share_home_plan", label: "이번 학기 계획과 불안을 같이 말한다.", summary: "당신은 본가 식탁에서 진로 불안을 공유하고 현실적인 지원을 얻었다.", statDelta: { mental: 3, wealth: 20, reputation: -1 }, relationshipDelta: [{ name: "부모님", trust: 7 }], flagDelta: { familyPlanShared: true } },
      { id: "perform_confidence", label: "아무 문제 없다고 말하고 방으로 들어간다.", summary: "당신은 가족을 안심시키려 했지만 혼자 감당할 압박을 키웠다.", statDelta: { reputation: 2, mental: -5, health: -1 }, relationshipDelta: [{ name: "부모님", trust: -4 }], flagDelta: { familyPressure: "hidden" } },
    ],
    tags: ["본가", "가족", "진로"],
    source: "STATIC",
    arcIds: ["settling", "pressure"],
    condition: { residences: ["family_home"] },
  },
  {
    title: "연구실 출입 카드",
    body: `교수님은 낡은 출입 카드 하나를 책상 위에 올려두었다. "생각이 있으면 이번 주부터 와도 좋네." 지난 면담에서 연구실 이야기를 꺼낸 뒤로, 이 제안은 언젠가 올 수도 있다고 생각했지만 실제 카드를 보니 무게가 달랐다.

연구실은 좋은 추천서와 깊은 공부를 약속한다. 동시에 선배들의 피곤한 얼굴과 늦은 밤 불이 꺼지지 않는 창문도 함께 떠오른다. 당신이 카드를 집는 순간, 이번 학기의 중심은 분명 바뀔 것이다.`,
    choices: [
      { id: "take_lab_card", label: "출입 카드를 받고 연구실 일을 시작한다.", summary: "당신은 연구실에 들어가 학업 진로의 깊은 문을 열었다.", statDelta: { academic: 7, reputation: 3, health: -4, mental: -3 }, relationshipDelta: [{ name: "상혁", trust: 10 }], flagDelta: { labJoined: true, academicThread: "lab" } },
      { id: "delay_lab_decision", label: "이번 학기는 수업에 집중하겠다고 미룬다.", summary: "당신은 연구실 기회를 미루고 현재 생활의 균형을 택했다.", statDelta: { mental: 2, health: 2, academic: -2, reputation: -2 }, relationshipDelta: [{ name: "상혁", trust: -4 }], flagDelta: { labDelayed: true } },
    ],
    tags: ["연구실", "학업", "교수"],
    source: "STATIC",
    arcIds: ["commitment", "future"],
    condition: { requiredFlags: { professorContact: "research" }, statAbove: { academic: 6 } },
  },
  {
    title: "읽씹 이후의 같은 조",
    body: `발표 조 편성표에서 당신은 서연의 이름을 발견한다. 지난번 메시지 이후 어색하게 비껴가던 시간이 갑자기 같은 테이블 위에 놓였다. 서연은 당신을 보고 짧게 고개를 끄덕였지만, 그 표정만으로는 아무것도 알 수 없었다.

조별 문서에는 아직 빈칸이 많고, 팀원들은 둘 사이의 공기를 모른 채 역할을 나누기 시작한다. 감정을 덮어두면 일은 쉬워질 수 있다. 하지만 덮은 감정은 발표 당일 다른 방식으로 새어 나올지도 모른다.`,
    choices: [
      { id: "work_with_seoyeon_plainly", label: "감정 이야기는 접고 역할부터 명확히 나눈다.", summary: "당신은 서연과 어색함을 눌러두고 과제의 선을 먼저 세웠다.", statDelta: { academic: 3, reputation: 2, mental: -3 }, relationshipDelta: [{ name: "서연", trust: 3 }], flagDelta: { romanceThread: "professional_distance" } },
      { id: "apologize_before_project", label: "과제 전에 지난 대화를 짧게 사과한다.", summary: "당신은 과제의 불편함을 줄이기 위해 먼저 사과했다.", statDelta: { charm: 3, mental: -2, reputation: -1 }, relationshipDelta: [{ name: "서연", trust: 9 }], flagDelta: { romanceThread: "repaired" } },
    ],
    tags: ["연애", "팀플", "관계"],
    source: "STATIC",
    arcIds: ["commitment", "consequence"],
    condition: { anyFlags: ["romanceThread"] },
  },
  {
    title: "공개된 MVP의 첫 악성 리뷰",
    body: `밤새 올린 작은 앱에는 생각보다 빨리 댓글이 달렸다. 처음 몇 개는 고맙다는 말이었지만, 곧이어 화면 캡처와 함께 조롱 섞인 리뷰가 올라왔다. 당신이 만든 가능성은 세상에 나간 순간부터 당신 마음대로 해석되지 않았다.

친구는 빠르게 수정하면 된다고 말하지만, 당신은 댓글 하나하나를 오래 들여다본다. 포트폴리오로 남겼다면 안전했을 결과가, 공개했다는 이유로 평판과 자존심을 동시에 건드린다.`,
    choices: [
      { id: "patch_mvp_publicly", label: "오류를 인정하고 공개적으로 수정 내역을 올린다.", summary: "당신은 악성 리뷰 앞에서 도망치지 않고 제품을 고쳤다.", statDelta: { practical: 5, reputation: 2, mental: -4, health: -2 }, relationshipDelta: [], flagDelta: { startupThread: "recovered" } },
      { id: "delete_mvp", label: "앱을 내리고 포트폴리오에서 조용히 지운다.", summary: "당신은 공개 실패의 부담을 피하려고 앱을 내려버렸다.", statDelta: { mental: 2, reputation: -3, practical: -2 }, relationshipDelta: [], flagDelta: { startupThread: "withdrawn" } },
    ],
    tags: ["창업", "평판", "실무"],
    source: "STATIC",
    arcIds: ["pressure", "consequence"],
    condition: { requiredFlags: { startupThread: "mvp" } },
  },
  {
    title: "워홀 합격 메일",
    body: `국제교류처에서 온 메일 제목은 생각보다 담담했다. 설명회 이후 조금씩 준비해온 워킹홀리데이 신청이 통과되었다는 내용이었다. 막상 떠날 수 있게 되자, 도망치고 싶던 마음과 남아야 한다는 마음이 동시에 고개를 들었다.

비행기표를 결제하면 이번 학기의 많은 약속은 끊긴다. 반대로 접어두면 다시 취업 준비의 좁은 복도로 돌아가야 한다. 어느 쪽도 완전한 정답처럼 보이지 않는다.`,
    choices: [
      { id: "book_working_holiday", label: "비행기표를 결제하고 휴학 상담을 잡는다.", summary: "당신은 해외에서 다른 삶을 시험하기 위해 실제 출국 준비를 시작했다.", statDelta: { charm: 4, practical: 3, wealth: -150, reputation: -2 }, relationshipDelta: [{ name: "부모님", trust: -5 }], flagDelta: { overseasThread: "ticket_booked" } },
      { id: "defer_working_holiday", label: "합격 메일을 보관하고 이번 학기는 남는다.", summary: "당신은 떠날 기회를 미루고 현재의 경쟁에 남았다.", statDelta: { academic: 2, reputation: 2, mental: -4 }, relationshipDelta: [], flagDelta: { overseasThread: "deferred" } },
    ],
    tags: ["해외", "휴학", "진로"],
    source: "STATIC",
    arcIds: ["consequence", "future"],
    condition: { requiredFlags: { overseasThread: "working_holiday" } },
  },
  {
    title: "학생회 예산 파일",
    body: `동규가 보낸 파일은 학생회 행사 예산안이라고 되어 있었다. 부회장 일을 맡은 뒤로 당신은 회의록과 영수증 사이에서 시간을 많이 보냈지만, 이번 파일에는 숫자가 어딘가 맞지 않는 부분이 있었다. 단순한 실수일 수도 있고, 누군가 일부러 흐린 흔적일 수도 있다.

동규는 "괜히 크게 만들지 말자"고 말했다. 그 말은 조언처럼 들렸지만, 동시에 당신이 어디까지 침묵할 수 있는지 시험하는 말이기도 했다. 리더십은 스펙이 아니라 책임의 다른 이름으로 돌아오고 있었다.`,
    choices: [
      { id: "audit_council_budget", label: "예산 오류를 공식 회의 안건으로 올린다.", summary: "당신은 학생회 예산 문제를 공개적으로 다루며 갈등을 감수했다.", statDelta: { reputation: 4, practical: 3, mental: -5, charm: -1 }, relationshipDelta: [{ name: "동규", trust: -18 }], flagDelta: { studentCouncil: "audited" } },
      { id: "bury_budget_issue", label: "일단 동규의 말대로 조용히 넘어간다.", summary: "당신은 학생회 내부 갈등을 피했지만 찜찜한 책임을 남겼다.", statDelta: { reputation: -5, mental: -4, practical: 1 }, relationshipDelta: [{ name: "동규", trust: 8 }], flagDelta: { studentCouncil: "complicit" } },
    ],
    tags: ["학생회", "평판", "갈등"],
    source: "STATIC",
    arcIds: ["consequence", "future"],
    condition: { requiredFlags: { studentCouncil: "vp" } },
  },
  {
    title: "등 돌린 팀원의 평판전",
    body: `도윤은 발표가 끝난 뒤에도 조용하지 않았다. 교수님께 기록을 남긴 선택은 정당했지만, 그는 단체 채팅과 과방에서 당신을 까다로운 사람으로 말하고 다녔다. 성적표에는 반영되지 않는 전쟁이 시작된 셈이었다.

민하는 그냥 두면 소문이 굳는다고 말한다. 하지만 맞서 싸우면 당신도 같은 진흙탕에 들어가야 한다. 조별과제는 끝났지만 관계의 비용은 아직 끝나지 않았다.`,
    choices: [
      { id: "show_project_receipts", label: "기록과 대화 캡처를 차분히 공개한다.", summary: "당신은 도윤의 평판전에 근거로 대응했다.", statDelta: { reputation: 4, mental: -4, charm: -1 }, relationshipDelta: [{ name: "도윤", trust: -25 }, { name: "민하", trust: 4 }], flagDelta: { groupProjectAftermath: "receipts" } },
      { id: "let_rumor_pass", label: "소문에 대응하지 않고 다음 과제에 집중한다.", summary: "당신은 갈등을 키우지 않았지만 일부 평판 손상을 감수했다.", statDelta: { academic: 2, mental: 1, reputation: -4 }, relationshipDelta: [{ name: "도윤", trust: -8 }], flagDelta: { groupProjectAftermath: "ignored" } },
    ],
    tags: ["복수", "평판", "팀플"],
    source: "STATIC",
    arcIds: ["consequence"],
    condition: { anyFlags: ["groupProject"] },
  },
  {
    title: "졸업 직전의 마지막 추천서",
    body: `졸업 요건 확인 메일과 함께 추천서 요청 마감일이 도착했다. 이제 선택지는 더 이상 막연한 가능성이 아니라 실제 제출 서류와 면접 일정으로 바뀌고 있었다. 지난 사건들에서 남은 관계들이 머릿속에 차례로 떠오른다.

누구에게 부탁하느냐는 단순한 행정 절차가 아니다. 당신이 어떤 사람으로 기억되고 싶은지, 그리고 어떤 과거를 앞으로 가져갈지 정하는 마지막 확인에 가깝다. 중간에 무너지지 않고 여기까지 왔다면, 이 결말은 파멸보다 방향에 가까워야 한다.`,
    choices: [
      { id: "ask_best_relationship", label: "가장 신뢰가 남은 사람에게 추천서를 부탁한다.", summary: "당신은 끝까지 남은 관계를 기반으로 다음 길을 열었다.", statDelta: { reputation: 4, mental: -2, charm: 1 }, relationshipDelta: [], flagDelta: { finalDirection: "relationship_based" } },
      { id: "submit_without_recommendation", label: "추천 없이 포트폴리오와 성적만으로 지원한다.", summary: "당신은 관계보다 자신의 기록으로 마지막 지원서를 냈다.", statDelta: { academic: 2, practical: 2, reputation: -2, mental: -3 }, relationshipDelta: [], flagDelta: { finalDirection: "self_reliant" } },
    ],
    tags: ["졸업", "추천서", "진로"],
    source: "STATIC",
    arcIds: ["future"],
    condition: { gradeYears: [4] },
  },
  {
    title: "전문직 1차 시험장",
    body: `당신은 새벽 버스를 타고 낯선 고사장 앞에 내린다. 책상 위에는 신분증과 수험표, 그리고 지난 몇 학기 동안 접어둔 약속들이 조용히 놓여 있다. 전문직이라는 말은 멀리서 들을 때는 선명했지만, 막상 시험장에서는 한 문제씩 버티는 체력과 기억력의 문제로 바뀌었다.

복도에는 이미 몇 번 떨어져 본 사람들의 표정과 처음 온 사람들의 불안이 섞여 있다. 합격하면 당신은 특정 자격의 길로 들어갈 수 있다. 떨어지면 이 공부는 끝이 아니라 비용으로 남고, 다른 선택지를 다시 계산해야 한다.`,
    choices: [
      { id: "license_endurance", label: "마지막 과목까지 붙들고 버틴다.", summary: "당신은 흔들리는 집중력을 붙잡고 시험지를 끝까지 채웠다.", statDelta: { academic: 4, reputation: 1, health: -5, mental: -4 }, relationshipDelta: [], flagDelta: { careerGateAttempt: { path: "licensed_profession", approach: "endurance" } } },
      { id: "license_accuracy", label: "아는 문제를 정확히 맞히는 쪽으로 시간을 배분한다.", summary: "당신은 욕심을 줄이고 맞힐 수 있는 문제에 집중했다.", statDelta: { academic: 2, mental: -2, health: -1 }, relationshipDelta: [], flagDelta: { careerGateAttempt: { path: "licensed_profession", approach: "accuracy" } } },
    ],
    tags: ["전문직", "시험", "진로"],
    source: "STATIC",
    arcIds: ["future"],
    condition: { statAbove: { academic: 8, mental: 5 }, blockedFlags: ["careerGate"] },
  },
  {
    title: "패러디 기업 최종 면접",
    body: `면접 대기실 벽에는 '다람소프트 신입 공개채용'이라는 포스터가 붙어 있다. 이름은 장난처럼 들리지만, 대기실의 공기는 전혀 장난스럽지 않다. 당신은 지난 사건들에서 쌓은 프로젝트, 관계, 평판을 짧은 답변 몇 개로 증명해야 한다.

문이 열리고 면접관이 당신의 이름을 부른다. 합격하면 이 회사의 첫 직무가 당신의 다음 생활이 된다. 떨어지면 스펙이 사라지는 것은 아니지만, 특정 기업에 다닌다는 결과는 아직 당신 것이 아니다.`,
    choices: [
      { id: "company_project_cases", label: "프로젝트와 갈등 해결 사례를 중심으로 답한다.", summary: "당신은 대학 생활에서 실제로 해낸 일들을 면접 답변으로 꺼냈다.", statDelta: { reputation: 2, practical: 3, mental: -4, health: -2 }, relationshipDelta: [{ name: "유진", trust: 4 }], flagDelta: { careerGateAttempt: { path: "company", approach: "project_cases" } } },
      { id: "company_stability_pitch", label: "성실함과 안정적인 태도를 강조한다.", summary: "당신은 화려한 성과보다 오래 버틸 수 있는 사람이라는 점을 보여주려 했다.", statDelta: { practical: 1, mental: -2, reputation: 1 }, relationshipDelta: [{ name: "유진", trust: 1 }], flagDelta: { careerGateAttempt: { path: "company", approach: "stability" } } },
    ],
    tags: ["기업", "면접", "취업"],
    source: "STATIC",
    arcIds: ["future"],
    condition: { statAbove: { practical: 6, reputation: 6 }, blockedFlags: ["careerGate"] },
  },
  {
    title: "공공안전 직무 체력·면접 전형",
    body: `운동장 트랙의 흰 선은 생각보다 차갑게 보였다. 공공안전 직무 전형은 필기 점수만으로 끝나지 않았다. 체력 측정, 상황 판단 면접, 평판 조회까지 당신이 대학 생활에서 어떻게 버텨왔는지가 한꺼번에 드러나는 날이었다.

대기 번호가 가까워질수록 지난 건강검진과 밤샘, 회복의 선택들이 몸 안에서 대답하는 것 같았다. 합격하면 제복과 책임이 함께 온다. 실패하면 안정적인 길은 잠시 멀어지고, 다른 방향을 다시 찾아야 한다.`,
    choices: [
      { id: "public_safety_pace", label: "체력 측정은 페이스를 조절하고 면접에 집중한다.", summary: "당신은 무리한 기록보다 끝까지 버틸 수 있는 페이스를 택했다.", statDelta: { reputation: 2, health: -2, mental: -2, academic: 1 }, relationshipDelta: [], flagDelta: { careerGateAttempt: { path: "public_safety", approach: "paced" } } },
      { id: "public_safety_push", label: "초반부터 기록을 끌어올려 강한 인상을 남긴다.", summary: "당신은 체력 측정에서 먼저 승부를 걸었다.", statDelta: { health: -5, mental: -3, reputation: 2 }, relationshipDelta: [], flagDelta: { careerGateAttempt: { path: "public_safety", approach: "push" } } },
    ],
    tags: ["공공", "체력", "면접"],
    source: "STATIC",
    arcIds: ["future"],
    condition: { statAbove: { health: 6, academic: 6 }, blockedFlags: ["careerGate"] },
  },
  {
    title: "창업 지원사업 발표 심사",
    body: `작은 발표장 앞에서 당신은 노트북을 다시 연다. 지원사업 이름은 '새싹엔진 캠프'였고, 심사위원들은 당신의 아이디어보다 숫자와 실행력을 더 집요하게 물을 것이다. 앱을 공개했던 밤, 악성 리뷰, 돈이 모자랐던 달들이 모두 발표 자료의 보이지 않는 각주처럼 붙어 있었다.

선정되면 당신은 취업 대신 사업자의 길로 들어갈 수 있다. 떨어지면 아이디어는 사라지지 않지만, 당장 회사를 만들 수 있는 돈과 명분은 부족해진다.`,
    choices: [
      { id: "startup_metrics_pitch", label: "사용자 반응과 수익 모델을 숫자로 설명한다.", summary: "당신은 아이디어보다 검증과 실행 기록을 앞세워 발표했다.", statDelta: { practical: 4, reputation: 2, wealth: 1, mental: -5, health: -2 }, relationshipDelta: [], flagDelta: { careerGateAttempt: { path: "startup", approach: "metrics" } } },
      { id: "startup_vision_pitch", label: "문제의식과 장기 비전을 강하게 밀어붙인다.", summary: "당신은 아직 부족한 숫자를 이야기의 힘으로 보완하려 했다.", statDelta: { practical: 1, reputation: 1, mental: -3, wealth: -2, charm: 2 }, relationshipDelta: [], flagDelta: { careerGateAttempt: { path: "startup", approach: "vision" } } },
    ],
    tags: ["창업", "발표", "심사"],
    source: "STATIC",
    arcIds: ["future"],
    condition: { anyFlags: ["startupThread"], statAbove: { practical: 6 }, blockedFlags: ["careerGate"] },
  },
  {
    title: "서류 합격 통보",
    body: `당신은 메일함을 열고 오래도록 숨을 멈춘다. 지원서를 낸 지 꽤 시간이 흘렀고, 이미 잊어버린 듯한 기분이었다. 그런데 화면에는 '서류 전형 합격'이라는 문장이 선명하게 떠 있다. 합격은 기쁘지만, 이제부터가 진짜라는 생각이 곧바로 따라온다.

다음 단계는 면접이다. 준비할 시간은 충분하지 않지만, 지금까지의 선택들이 면접에서 어떤 식으로든 드러날 것이다. 당신은 이 기회를 어떻게 활용할지 고민한다.`,
    choices: [
      {
        id: "prepare_interview_thoroughly",
        label: "면접 준비에 집중한다. 예상 질문과 답변을 정리한다.",
        summary: "당신은 면접 준비에 시간을 쏟으며 가능성을 높였다.",
        statDelta: { practical: 4, mental: -3, health: -2, reputation: 1 },
        relationshipDelta: [],
        flagDelta: { interviewPrep: "thorough" },
      },
      {
        id: "network_for_interview",
        label: "선배나 교수님께 면접 조언을 구한다.",
        summary: "당신은 주변의 경험을 통해 면접 전략을 다듬었다.",
        statDelta: { charm: 3, reputation: 2, mental: -2, wealth: -1 },
        relationshipDelta: [],
        flagDelta: { interviewPrep: "networked" },
      },
    ],
    tags: ["면접", "진로", "취업"],
    source: "STATIC",
    arcIds: ["future"],
    condition: { requiredDestinationKinds: ["company", "public_sector", "professional_exam", "startup"] },
  },
  {
    title: "면접 결과와 다음 행보",
    body: `면접이 끝난 후 며칠이 흘렀다. 당신은 휴대폰 알림이 울릴 때마다 심장이 내려앉는 기분을 반복한다. 드디어 온 메일은 짧고 간결했다. 결과는 합격 또는 불합격, 그 사이의 회색지대는 없었다.

결과에 상관없이, 당신은 이 경험이 앞으로의 선택에 영향을 줄 것임을 안다. 합격했다면 새로운 환경에 적응해야 하고, 불합격했다면 다른 문을 찾아야 한다.`,
    choices: [
      {
        id: "accept_result_forward",
        label: "결과를 받아들이고 다음 단계를 준비한다.",
        summary: "당신은 결과에 연연하지 않고 다음 행보를 준비했다.",
        statDelta: { mental: 3, practical: 2, reputation: 1, health: -1 },
        relationshipDelta: [],
        flagDelta: { interviewResult: "accepted" },
      },
      {
        id: "seek_alternative_path",
        label: "결과와 관계없이 다른 옵션도 함께 알아본다.",
        summary: "당신은 하나의 결과에 의존하지 않고 여러 가능성을 열어두었다.",
        statDelta: { practical: 3, charm: 1, mental: -2, wealth: -2 },
        relationshipDelta: [],
        flagDelta: { interviewResult: "diversified" },
      },
    ],
    tags: ["면접", "진로", "결과"],
    source: "STATIC",
    arcIds: ["future"],
    condition: { requiredDestinationKinds: ["company", "public_sector", "professional_exam", "startup"] },
  },
  {
    title: "대학원 연구실 면담",
    body: `당신은 대학원 연구실 문 앞에 서 있다. 교수님과의 사전 연락은 이미 끝났고, 오늘은 실제 연구실 분위기와 선배들의 이야기를 들을 차례다. 연구실 안에서는 형광등 아래로 모니터 불빛이 새어 나오고, 책상 위에는 논문 출력물과 커피잔이 나란히 놓여 있다.

대학원은 취업과는 또 다른 종류의 헌신을 요구한다. 학비와 생활비, 연구 주제의 자유도, 졸업 후의 진로까지, 오늘의 면담은 당신이 앞으로 2-3년을 어떻게 보낼지 결정하는 중요한 이정표가 될 것이다.`,
    choices: [
      {
        id: "express_strong_interest",
        label: "연구실 참여 의지를 적극적으로 표현한다.",
        summary: "당신은 연구실에 강한 관심을 보이며 대학원 진학 의사를 밝혔다.",
        statDelta: { academic: 5, reputation: 2, mental: -3, health: -2 },
        relationshipDelta: [],
        flagDelta: { gradSchoolInterest: "strong" },
      },
      {
        id: "ask_about_funding",
        label: "장학금과 연구비 지원에 대해 현실적으로 묻는다.",
        summary: "당신은 대학원의 현실적인 조건을 확인하며 신중하게 접근했다.",
        statDelta: { practical: 3, mental: 1, reputation: -1, wealth: 2 },
        relationshipDelta: [],
        flagDelta: { gradSchoolInterest: "pragmatic" },
      },
    ],
    tags: ["대학원", "연구실", "진로"],
    source: "STATIC",
    arcIds: ["future"],
    condition: { requiredDestinationKinds: ["graduate_school", "lab"] },
  },
  {
    title: "추가 서류 제출 안내",
    body: `지원한 곳에서 추가 서류를 요청하는 메일이 도착했다. 기본 서류 외에 자기소개서, 포트폴리오, 추천서 등 예상치 못한 추가 자료가 필요하다. 마감일은 촉박하고, 당신은 이미 다른 준비로 시간이 빠듯하다.

이 추가 요청은 당신이 아직 경쟁 중이라는 신호이기도 하다. 포기하기에는 너무 가까워진 상황, 하지만 준비에 시간을 쏟으면 다른 일정이 밀릴 것이다.`,
    choices: [
      {
        id: "submit_extra_docs",
        label: "밤을 새서라도 추가 서류를 준비해 제출한다.",
        summary: "당신은 추가 서류를 준비하며 기회를 놓치지 않으려 했다.",
        statDelta: { practical: 4, reputation: 2, health: -5, mental: -3 },
        relationshipDelta: [],
        flagDelta: { extraDocsSubmitted: true },
      },
      {
        id: "decline_extra_docs",
        label: "시간이 부족하다고 판단하고 포기한다.",
        summary: "당신은 추가 요청을 포기하고 다른 기회에 집중하기로 했다.",
        statDelta: { mental: 2, health: 2, practical: -2, reputation: -2 },
        relationshipDelta: [],
        flagDelta: { extraDocsDeclined: true },
      },
    ],
    tags: ["서류", "지원", "진로"],
    source: "STATIC",
    arcIds: ["future"],
    condition: { requiredDestinationKinds: ["company", "public_sector", "graduate_school"] },
  },
  {
    title: "졸업 전 마지막 지원서",
    body: `마감 20분 전, 당신은 지원서 제출 버튼 앞에서 멈춘다. 특정 회사나 자격증처럼 선명한 관문은 아니지만, 그래도 이 지원서는 대학 생활 이후의 첫 문이다. 자기소개서에는 그동안의 선택들이 지나치게 짧은 문장으로 압축되어 있다.

서류를 내고 면접까지 통과하면 당신은 임시직이든 계약직이든 하나의 조직 안에서 다음 계절을 맞게 된다. 통과하지 못하면 아직 끝난 것이 아니라, 준비 기간이 조금 더 길어질 뿐이다.`,
    choices: [
      { id: "general_tailor_application", label: "지난 경험을 직무에 맞게 다시 정리해 제출한다.", summary: "당신은 마지막까지 지원서의 문장을 고쳐 실제 경험과 직무를 연결했다.", statDelta: { reputation: 2, practical: 2, mental: -3, health: -1 }, relationshipDelta: [], flagDelta: { careerGateAttempt: { path: "general_job", approach: "tailored" } } },
      { id: "general_submit_fast", label: "마감 전에 일단 제출하고 면접 준비 시간을 확보한다.", summary: "당신은 완벽한 서류보다 다음 단계에 쓸 시간을 남겼다.", statDelta: { practical: 1, mental: -2, reputation: -1 }, relationshipDelta: [], flagDelta: { careerGateAttempt: { path: "general_job", approach: "fast_submit" } } },
    ],
    tags: ["지원서", "면접", "진로"],
    source: "STATIC",
    arcIds: ["future"],
    condition: { blockedFlags: ["careerGate"] },
  },
  {
    title: "시험 결과 발표",
    body: `접수했던 어학 시험 결과가 발표되는 날이다. 새벽부터 여러 번 새로고침한 페이지 위에서 마우스 커서가 잠깐 멈춘다. 지난 몇 주 동안 채워온 문제집과 무너진 수면 시간이 짧은 숫자 하나로 요약되려 한다.

결과가 어떻든 다음 단계는 정해져 있다. 만족스러우면 다른 스펙으로 시선을 옮기고, 아쉬우면 다시 접수 페이지로 돌아가야 한다. 오늘의 숫자는 앞으로 몇 달의 시간표를 조용히 바꿀 것이다.`,
    choices: [
      { id: "toeic_check_result", label: "결과를 확인한다. 다음 계획을 세운다.", summary: "당신은 어학 시험 결과를 확인하고 스펙을 업데이트했다.", statDelta: { academic: 2 }, relationshipDelta: [], flagDelta: { specComplete: { score: "850" } } },
      { id: "toeic_retry_prep", label: "다음 시험을 곧바로 준비한다.", summary: "당신은 결과에 만족하지 않고 다음 시험을 준비하기로 했다.", statDelta: { practical: 1, mental: 1 }, relationshipDelta: [], flagDelta: { toeicRetry: true } },
    ],
    tags: ["스펙", "결과", "어학"],
    source: "STATIC",
    arcIds: ["commitment", "pressure"],
    condition: { requiredSpecs: ["LANGUAGE_SCORE"] },
  },
  {
    title: "인턴 종료",
    body: `인턴십 마지막 날 오후, 팀장과의 짧은 평가 자리가 잡혔다. 3개월은 짧지 않았고, 배운 것보다 견딘 것이 더 많았다는 생각도 든다. 명함첩에는 몇 개의 이름이 늘었고, 프로젝트 목록에는 이력서에 쓸 만한 문장이 생겼다.

지금 인상을 어떻게 남기느냐가 다음 시즌의 문장을 바꾼다. 추천서를 부탁하면 관계가 조금 더 이어질 것이고, 조용히 마무리하면 부담 없이 다음으로 넘어갈 수 있다.`,
    choices: [
      { id: "intern_reference", label: "좋은 인상을 남기고 추천서를 요청한다.", summary: "당신은 인턴십을 마무리하며 추천서까지 확보했다.", statDelta: { reputation: 3, charm: 2 }, relationshipDelta: [], flagDelta: { specComplete: { score: "3개월" } } },
      { id: "intern_quiet_exit", label: "조용히 마무리하고 다음을 준비한다.", summary: "당신은 인턴십을 담담하게 마치고 다음 단계로 넘어갔다.", statDelta: { practical: 2, mental: 1 }, relationshipDelta: [], flagDelta: { internQuietExit: true } },
    ],
    tags: ["스펙", "인턴", "실무"],
    source: "STATIC",
    arcIds: ["commitment", "pressure"],
    condition: { requiredSpecs: ["INTERNSHIP"] },
  },
  {
    title: "공모전 결과",
    body: `공모전 심사 결과가 발표되는 날이다. 팀 채팅방에는 아침부터 조용한 긴장이 흐르고 있고, 아무도 먼저 결과 페이지를 열려 하지 않는다. 지난 몇 달의 밤샘과 갈등이 짧은 발표 하나로 정리되기 직전이다.

결과가 어떻든 오늘의 선택은 다음 도전의 밑그림이 된다. 등록해서 스펙으로 남기든, 경험 자체로 정리하든, 이 프로젝트가 남긴 자국은 지워지지 않는다.`,
    choices: [
      { id: "contest_register", label: "결과를 스펙에 등록한다.", summary: "당신은 공모전 성과를 스펙에 정식으로 등록했다.", statDelta: { reputation: 3, practical: 2 }, relationshipDelta: [], flagDelta: { specComplete: { score: "수상" } } },
      { id: "contest_experience", label: "경험 자체로 정리하고 다음을 노린다.", summary: "당신은 결과보다 경험을 자산으로 남기며 다음 공모전을 준비했다.", statDelta: { mental: 2, practical: 1 }, relationshipDelta: [], flagDelta: { contestExperience: true } },
    ],
    tags: ["스펙", "공모전", "결과"],
    source: "STATIC",
    arcIds: ["commitment", "pressure"],
    condition: { requiredSpecs: ["PORTFOLIO"] },
  },
  {
    title: "자격증 합격",
    body: `합격 발표 페이지의 파란색 글자는 이상하게 오래 눈에 남는다. 지난 몇 달 동안 접었다 폈던 문제집이 처음으로 정당한 이유를 얻은 기분이다. 자격증 하나가 인생을 바꾸지는 않지만, 이력서의 한 줄이 채워졌다는 사실은 분명 다르다.

다음 단계를 어떻게 잡느냐에 따라 이 성취가 이어질지, 여기서 멈출지가 정해진다. 스펙에 정식으로 등록하고 다음 준비를 이어가면 흐름이 생기지만, 다음 자격증에 곧장 손대면 부담도 커진다.`,
    choices: [
      { id: "cert_register_spec", label: "자격증을 스펙에 등록한다.", summary: "당신은 자격증 합격을 정식 스펙으로 등록하며 흐름을 이어갔다.", statDelta: { practical: 3, reputation: 2 }, relationshipDelta: [], flagDelta: { specComplete: { score: "합격" } } },
      { id: "cert_next_level", label: "다음 단계 자격증을 준비한다.", summary: "당신은 여세를 몰아 상위 자격증 준비에 뛰어들었다.", statDelta: { academic: 2, mental: -2 }, relationshipDelta: [], flagDelta: { certNextLevel: true } },
    ],
    tags: ["스펙", "자격증", "합격"],
    source: "STATIC",
    arcIds: ["commitment", "pressure"],
    condition: { requiredSpecs: ["CERTIFICATION"] },
  },
  {
    title: "서류 합격",
    body: `아침에 확인한 메일 제목은 담담했다. '서류 전형 합격 안내.' 지원한 여러 곳 중 하나에서 온 답이었고, 벌써 몇 번을 소리 내지 않고 다시 읽었는지 모른다. 서류가 통과됐다는 것은 이제부터가 진짜라는 뜻이기도 했다.

다음 단계는 인적성 혹은 면접 스터디로 이어진다. 준비 방향을 어떻게 잡느냐에 따라 이 합격이 하나의 문으로 남을지, 그저 짧은 알림으로 지나갈지 정해진다.`,
    choices: [
      { id: "prep_aptitude", label: "인적성 검사를 준비한다.", summary: "당신은 서류 합격 이후 인적성 검사 준비에 집중했다.", statDelta: { mental: 2, practical: 1 }, relationshipDelta: [], flagDelta: { advanceApplication: true } },
      { id: "join_interview_group", label: "면접 스터디를 찾는다.", summary: "당신은 면접 스터디에 합류하며 다음 관문을 준비했다.", statDelta: { charm: 2, network: 1 }, relationshipDelta: [], flagDelta: { advanceApplication: true } },
    ],
    tags: ["취업", "서류", "합격"],
    source: "STATIC",
    arcIds: ["future"],
    condition: { requiredApplicationStage: "DOCUMENT_REVIEW" },
  },
  {
    title: "서류 불합격",
    body: `메일함에 쌓인 '아쉽게도'라는 단어들이 오늘도 하나 더 늘었다. 익숙해질 만도 한데, 매번 처음처럼 어깨가 내려앉는다. 이력서와 자기소개서를 다시 열어보면 잘못된 곳은 안 보이는데, 결과는 다시 같은 방향이었다.

다른 회사에 지원을 이어가면 흐름은 유지되지만, 이유를 찾지 못한 채로 반복될 위험이 있다. 스펙을 더 쌓기로 하면 준비 기간이 길어지지만, 다음 시즌은 조금 다른 얼굴로 서게 될지도 모른다.`,
    choices: [
      { id: "apply_more", label: "다른 회사에 지원을 이어간다.", summary: "당신은 불합격을 뒤로하고 다음 지원서를 준비했다.", statDelta: { mental: -2, practical: 2 }, relationshipDelta: [], flagDelta: { applicationFailed: true } },
      { id: "reinforce_spec", label: "스펙을 더 쌓기로 한다.", summary: "당신은 부족함을 인정하고 스펙 보강에 시간을 투자했다.", statDelta: { academic: 2, wealth: -2 }, relationshipDelta: [], flagDelta: { applicationFailed: true, specReinforce: true } },
    ],
    tags: ["취업", "서류", "불합격"],
    source: "STATIC",
    arcIds: ["future"],
    condition: { requiredApplicationStage: "DOCUMENT_REVIEW" },
  },
  {
    title: "코딩테스트",
    body: `약속된 시각에 브라우저를 켜자 문제 화면이 뜬다. 두 시간, 세 문제. 첫 문제는 익숙한 유형이고, 두 번째는 애매하고, 세 번째는 처음 보는 알고리즘이다. 시간은 이미 조용히 흐르기 시작했다.

전략을 어떻게 세우느냐가 오늘의 결과를 가른다. 쉬운 문제부터 확실히 잡으면 최소한의 점수는 보장되고, 어려운 문제에 도전하면 승부수가 되지만 자칫 아무것도 남기지 못할 수 있다.`,
    choices: [
      { id: "code_easy_first", label: "쉬운 문제부터 확실히 푼다.", summary: "당신은 안정적으로 점수를 확보하며 코딩테스트를 통과하려 했다.", statDelta: { practical: 3, mental: 1 }, relationshipDelta: [], flagDelta: { codingTestApproach: "safe" } },
      { id: "code_hard_first", label: "어려운 문제에 도전한다.", summary: "당신은 승부수를 던지며 어려운 문제에 시간을 쏟았다.", statDelta: { academic: 3, mental: -2 }, relationshipDelta: [], flagDelta: { codingTestApproach: "risk" } },
    ],
    tags: ["취업", "코딩테스트", "실무"],
    source: "STATIC",
    arcIds: ["future"],
    condition: { requiredApplicationStage: "CODING_TEST" },
  },
  {
    title: "면접 준비",
    body: `달력 위에 크게 표시된 면접일이 일주일 앞으로 다가왔다. 예상 질문 리스트는 이미 길었고, 지원 회사의 최근 뉴스도 어느 정도 훑어봤다. 남은 시간을 어떻게 쓰느냐가 자소서 이후의 진짜 인상을 만든다.

철저한 예상 답변을 준비하면 안정감은 얻지만 답이 딱딱해질 수 있다. 자연스러운 대화 연습에 시간을 쓰면 유연해지지만, 어려운 질문에서 흔들릴 수도 있다.`,
    choices: [
      { id: "interview_scripted", label: "예상 질문을 철저히 준비한다.", summary: "당신은 예상 답변을 촘촘히 준비하며 안정감을 높였다.", statDelta: { academic: 2, mental: -1 }, relationshipDelta: [], flagDelta: { interviewStyle: "scripted" } },
      { id: "interview_conversation", label: "자연스러운 대화를 연습한다.", summary: "당신은 대화의 흐름에 집중하며 유연한 면접을 준비했다.", statDelta: { charm: 3, communication: 2 }, relationshipDelta: [], flagDelta: { interviewStyle: "conversation" } },
    ],
    tags: ["취업", "면접", "준비"],
    source: "STATIC",
    arcIds: ["future"],
    condition: { requiredApplicationStage: "INTERVIEW" },
  },
  {
    title: "최종 합격",
    body: `발표일 오후, 낯선 번호로 전화가 걸려온다. 목소리는 담담했지만 내용은 담담하지 않았다. "축하합니다. 최종 합격되셨습니다." 짧은 한 문장이 지난 몇 달의 지원과 시험과 면접을 한꺼번에 갈무리한다.

지금의 감각을 오래 붙잡아둘지, 곧바로 다음을 준비할지 정해야 한다. 어느 쪽이든 이 순간은 앞으로의 리듬을 정하는 첫 결정이다.`,
    choices: [
      { id: "final_celebrate", label: "기쁨을 만끽하고 스스로를 축하한다.", summary: "당신은 최종 합격의 순간을 온전히 누리며 자기 자신을 돌봤다.", statDelta: { mental: 4, health: 2 }, relationshipDelta: [], flagDelta: { finalOutcome: "accepted" } },
      { id: "final_prep_next", label: "다음 스텝을 곧바로 준비한다.", summary: "당신은 축하보다 다음 단계 준비를 우선하며 앞으로 나아갔다.", statDelta: { practical: 3, mental: -1 }, relationshipDelta: [], flagDelta: { finalOutcome: "accepted", finalNextPrep: true } },
    ],
    tags: ["취업", "합격", "진로"],
    source: "STATIC",
    arcIds: ["future"],
    condition: { requiredApplicationStage: "FINAL_INTERVIEW" },
  },
  {
    title: "블라인드 채용 반전",
    body: `기대하지 않았던 회사에서 합격 소식이 왔다. 이력서와 자기소개서만으로 판단한다던 블라인드 채용, 처음에는 큰 기대를 걸지 않았기에 오히려 놀랐다. 이 결과는 운인지 실력인지 여전히 헷갈린다.

어떻게 받아들이느냐에 따라 앞으로의 태도가 달라진다. 운이 따랐다고 인정하면 겸손해지지만 자신감은 흔들릴 수 있다. 내 실력이 통했다고 확신하면 다음 도전은 담대해지겠지만, 자만은 다른 실수를 부른다.`,
    choices: [
      { id: "blind_luck", label: "운이 따랐다고 인정한다.", summary: "당신은 예상치 못한 결과를 겸손하게 받아들였다.", statDelta: { mental: 2, reputation: 1 }, relationshipDelta: [], flagDelta: { blindResult: "luck" } },
      { id: "blind_skill", label: "내 실력이 통했다고 받아들인다.", summary: "당신은 결과를 자신의 실력으로 받아들이며 자신감을 얻었다.", statDelta: { charm: 3, practical: 2 }, relationshipDelta: [], flagDelta: { blindResult: "skill" } },
    ],
    tags: ["취업", "반전", "운"],
    source: "STATIC",
    arcIds: ["future"],
    condition: { requiredApplicationStage: "FINAL_INTERVIEW" },
  },
  {
    title: "워홀 진행 확인",
    body: `워킹홀리데이 준비를 시작한 이후, 오늘은 첫 서류 접수일이다. 여권 사본과 잔고 증명서, 그리고 앞으로 몇 달의 예산이 담긴 문서를 순서대로 정리해둔다. 실제로 서류를 넘기는 손끝에서 결심이 다시 확인된다.

이대로 밀어붙이면 출국일은 눈에 보이는 날짜로 좁혀진다. 반대로 여기서 잠시 멈추면 다시 국내 계획으로 돌아가야 한다. 오늘의 선택은 통장 잔고보다 마음의 방향을 더 정확히 드러낸다.`,
    choices: [
      { id: "wh_push_through", label: "서류를 접수하고 다음 단계로 넘어간다.", summary: "당신은 워홀 준비를 실제 단계로 밀어붙였다.", statDelta: { practical: 3, wealth: -3 }, relationshipDelta: [], flagDelta: { workingHolidayProgress: "submitted" } },
      { id: "wh_pause", label: "일단 잠시 멈추고 다시 고민한다.", summary: "당신은 결정을 잠시 미루고 상황을 다시 정리했다.", statDelta: { mental: 2 }, relationshipDelta: [], flagDelta: { workingHolidayProgress: "paused" } },
    ],
    tags: ["해외", "워홀", "진로"],
    source: "STATIC",
    arcIds: ["consequence", "future"],
    condition: { requiredCareerPath: "WORKING_HOLIDAY" },
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

export function pickRandomStaticEvent(excludeTitles?: string[], context?: EventSelectionContext): StaticEvent {
  const arc = getStoryArc(context?.coreEventCount ?? 0);
  const hasChosenCareerPath = context?.eventFlags?.careerPathChosen === true;
  const conditionalPool = context ? CONDITIONAL_STATIC_EVENTS
    .filter((event) => event.arcIds.includes(arc.id))
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
    .filter((event) => !context || isEventAllowedForLifeStage(event, context))
    .filter((event) => !hasChosenCareerPath || !event.tags.includes("진로"));
  const pool = filteredPool.length > 0 ? filteredPool : STATIC_EVENTS;
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
  currentHiddenState: EventSelectionContext,
  recentEventTitles: string[],
): { type: "forced" | "normal"; event: StaticEvent } {
  const result = pickBaseEvent(currentHiddenState, recentEventTitles);
  const summary = currentHiddenState.previousChoiceSummary?.trim();

  if (summary) {
    const bridgedBody = `지난 선택의 결과, ${summary}. 그리고 이어지는 이야기...\n\n${result.event.body}`;
    return { type: result.type, event: { ...result.event, body: bridgedBody } };
  }

  return result;
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

  return { type: "normal", event: pickRandomStaticEvent(recentEventTitles, currentHiddenState) };
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

  if (lifeStage === "college_late") {
    if (tags.has("스펙") || tags.has("취업") || tags.has("면접") || tags.has("진로") ||
        tags.has("합격") || tags.has("불합격") || tags.has("기업") || tags.has("공공") ||
        tags.has("전문직") || tags.has("창업") || tags.has("지원서") || tags.has("시험") ||
        tags.has("인턴") || tags.has("어학") || tags.has("자격증")) return 8;
    if (tags.has("해외") || tags.has("워홀") || tags.has("고시")) return 6;
    if (tags.has("돈") || tags.has("가족") || tags.has("멘탈") || tags.has("건강") ||
        tags.has("알바") || tags.has("자산") || tags.has("범죄") || tags.has("위험")) return 3;
    return 0;
  }

  if (lifeStage === "college_mid") {
    if (tags.has("스펙") || tags.has("인턴") || tags.has("어학") || tags.has("자격증")) return 4;
    if (tags.has("취업") || tags.has("면접") || tags.has("기업")) return -2;
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
  if (event.tags.some((tag) => ["돈", "가족", "연애", "범죄", "위험", "해외", "건강", "알바", "자취", "본가"].includes(tag))) {
    score += 2;
  }

  return score;
}

function isStudyLikeTag(tag: string) {
  return ["학업", "스터디", "시험", "중간고사", "교수", "연구실", "대학원", "수업", "공무원", "공기업", "자격증"].includes(tag);
}

export function isEventAllowedForLifeStage(event: Pick<StaticEvent, "title" | "tags">, context: EventSelectionContext) {
  const tags = new Set(event.tags);
  const title = event.title;
  const lifeStage = context.lifeStage;
  const graduation = context.graduation;
  const candidates = context.destinationCandidates ?? [];

  if (isResolvedOfferEvent(title, context.eventFlags)) {
    return false;
  }

  if (lifeStage === "leave") {
    return hasAny(tags, ["위기", "번아웃", "회복", "가족", "멘탈", "건강", "자산", "알바"]) ||
      title.includes("휴학") ||
      title.includes("회복") ||
      title.includes("가족") ||
      title.includes("알바");
  }

  if (lifeStage === "dropout" || lifeStage === "post_graduation") {
    return hasAny(tags, ["진로", "자산", "가족", "관계", "회복"]) ||
      title.includes("지원서") ||
      title.includes("알바");
  }

  if (graduation === "extra_semester" || graduation === "delayed") {
    return hasAny(tags, ["학업", "교수", "졸업", "진로", "건강", "멘탈"]) ||
      title.includes("졸업") ||
      title.includes("교수") ||
      title.includes("수업");
  }

  if (graduation === "gate_ready") {
    return hasAny(tags, ["졸업", "추천서", "진로", "면접", "시험", "기업", "공공", "창업", "지원서"]) ||
      title.includes("졸업") ||
      title.includes("면접") ||
      title.includes("시험") ||
      title.includes("지원서");
  }

  if (lifeStage === "college_early") {
    return !hasAny(tags, ["기업", "면접", "공공", "전문직", "창업", "지원서", "스펙", "취업"]);
  }

  if (hasAny(tags, ["해외", "워홀"]) && !hasCandidateOrThread(candidates, context.eventFlags, "overseas", ["overseasThread"])) {
    return lifeStage === "college_mid" || lifeStage === "college_late";
  }

  if (lifeStage && hasAny(tags, ["기업", "면접", "공공", "전문직", "창업", "지원서"]) && lifeStage !== "college_late") {
    return false;
  }

  if (lifeStage && hasAny(tags, ["교수", "연구실", "대학원", "졸업"]) && (lifeStage as string) === "college_early" && !title.includes("교수님과의 면담")) {
    return false;
  }

  return true;
}

function isResolvedOfferEvent(title: string, flags: Record<string, unknown> | undefined) {
  if (!flags) return false;
  const resolvedOfferFlagsByTitle: Array<[string, string[]]> = [
    ["공모전 팀 구성", ["contestJoined", "contestSkipped"]],
    ["학생회장의 제안", ["studentCouncil"]],
    ["불법 과외 제안", ["crimeThread"]],
    ["다단계의 유혹", ["pyramidRefused", "pyramidHeard"]],
    ["밤거리의 제안", ["underworldRefused", "underworldEntered"]],
    ["과 선배의 도박 제안", ["gamblingRefused", "gamblingTried"]],
    ["의문의 USB", ["usbInvestigation"]],
    ["스터디 카페의 낯선 제안", ["publicSectorThread"]],
    ["호주 워홀 포스터", ["overseasThread"]],
    ["작은 앱 아이디어", ["startupThread"]],
    ["헬스장에서 만난 사람", ["personalTraining"]],
    ["동아리 회식 자리", ["eunjiInterview"]],
    ["취업 스터디의 경쟁자", ["studyShare"]],
  ];

  const matched = resolvedOfferFlagsByTitle.find(([eventTitle]) => eventTitle === title);
  return matched ? matched[1].some((flag) => flags[flag] !== undefined) : false;
}

function hasCandidateOrThread(
  candidates: DestinationCandidate[],
  flags: Record<string, unknown> | undefined,
  kind: DestinationCandidate["kind"],
  threadKeys: string[],
) {
  return candidates.some((candidate) => candidate.kind === kind) ||
    threadKeys.some((key) => flags?.[key] !== undefined);
}

function hasAny(tags: Set<string>, wanted: string[]) {
  return wanted.some((tag) => tags.has(tag));
}
