export interface NpcProfile {
  name: string;
  role: string;
  greeting: string;
  personality: string;
  backstory: string;
  tags: string[];
  thread: string; // story thread this NPC is associated with
  dangerLevel: number; // 0=safe, 1=risky, 2=dangerous
}

export const NPC_POOL: NpcProfile[] = [
  // ===== 학업/진로 라인 =====
  { name: "지민", role: "동아리 선배", greeting: "어, 00아! 잠깐 얘기 좀 할 수 있나?", personality: "진지하고 다정한", backstory: "졸업을 앞둔 동아리 선배로 실제로는 상당히 유능하지만 취업 시장에 대해선 냉소적", tags: ["선배", "동아리", "인턴", "멘토"], thread: "career_internship", dangerLevel: 0 },
  { name: "소연", role: "조교 선배", greeting: "00씨, 교수님이 보낸 메일 보셨어요?", personality: "차분하고 믿음직한", backstory: "교수님의 신임을 받는 조교로 학점과 연구실 인턴에 큰 영향력을 가짐", tags: ["선배", "조교", "학업", "연구"], thread: "academic_research", dangerLevel: 0 },
  { name: "상혁", role: "교수님", greeting: "00씨, 잠깐 내 연구실로 와 보게.", personality: "엄격하지만 제자 생각이 깊은", backstory: "학계에서 이름 좀 날린 교수로 제자의 미래를 진심으로 걱정하지만 시대에 뒤쳐진 조언을 할 때도 있음", tags: ["교수", "학업", "연구실", "진로"], thread: "academic_research", dangerLevel: 0 },
  { name: "도윤", role: "팀플 동료", greeting: "00... 조금 얘기할 시간 있어?", personality: "조용하지만 책임감 없는", backstory: "발표 전날 잠수타는 타입으로 만나면 매번 스트레스를 주지만 어쩔 수 없이 같은 과제를 해야 하는 사이", tags: ["동기", "팀플", "스트레스"], thread: "group_project", dangerLevel: 0 },

  // ===== 친구/일상 라인 =====
  { name: "민하", role: "단짝 친구", greeting: "00야! 오늘 점심 같이 먹을 사람 여기 붙었어!", personality: "밝고 수다스럽지만 은근히 속이 깊은", backstory: "초등학교 때부터 알던 동네 친구는 아니지만 어쩌다 보니 대학까지 같은 길을 걷게 된 운명의 친구", tags: ["친구", "수업", "일상", "진로고민"], thread: "daily_life", dangerLevel: 0 },
  { name: "태수", role: "동기", greeting: "야 00! 어제 그거 봤냐?", personality: "유쾌하고 가벼운 정보통", backstory: "모든 걸 농담으로 넘기지만 모르는 게 없는 인싸. 좋은 정보도 주지만 가끔 위험한 제안도 함", tags: ["친구", "동기", "정보", "유흥"], thread: "social_life", dangerLevel: 1 },
  { name: "유진", role: "취업 선배", greeting: "00, 요즘 어떻게 지내? 나랑 커피 한 잔 할래?", personality: "친절하고 현실적인 조언을 잘하는", backstory: "이미 취업에 성공한 선배지만 회사 생활에 회의를 느끼고 있어 은근히 창업을 권유하는 중", tags: ["선배", "멘토", "취업", "회의"], thread: "career_internship", dangerLevel: 0 },
  { name: "미영", role: "고민 상담소 선배", greeting: "안녕 00아. 요즘 표정이 안 좋아 보여…", personality: "조용히 다가와 진심으로 걱정해주는", backstory: "학생처에서 아르바이트를 하는 선배로 많은 학생들의 고민을 듣지만 그만큼 무거운 비밀도 알고 있음", tags: ["선배", "위로", "상담", "비밀"], thread: "mental_health", dangerLevel: 0 },

  // ===== 동아리/서클 라인 =====
  { name: "은지", role: "동아리 부장", greeting: "00 언니! 회의 준비 다 됐어요?", personality: "꼼꼼하고 리더십 있는", backstory: "동아리를 자신의 커리어처럼 운영하는 부장. 좋은 기회도 많이 주지만 가끔은 사적인 부탁을 하기도 함", tags: ["동아리", "부장", "리더십", "네트워킹"], thread: "club_activities", dangerLevel: 0 },
  { name: "재호", role: "동아리 후배", greeting: "00 선배! 이거 한 번 봐주실 수 있어요?", personality: "열정적이지만 쉽게 불타오르는", backstory: "무언가에 꽂히면 주변도 같이 끌고 다니는 타입. 지금은 창업 동아리에 빠져서 선배를 자주 찾아옴", tags: ["후배", "동아리", "창업", "열정"], thread: "club_activities", dangerLevel: 0 },
  { name: "동규", role: "학생회장", greeting: "00! 잘 됐다, 네 얘기 좀 하자.", personality: "카리스마 있고 정치적 감각이 뛰어난", backstory: "학생회장이라는 타이틀에 걸맞게 사람을 잘 다루지만 뒤에서는 이런저런 얘기가 많은 인물", tags: ["회장", "학생회", "권력", "인맥"], thread: "student_council", dangerLevel: 1 },

  // ===== 위험/범죄 라인 =====
  { name: "재석", role: "유흥업소 사장", greeting: "어, 00씨! 우리 가게 한 번 놀러와요~", personality: "겉은 친절하지만 속을 알 수 없는", backstory: "학교 앞에서 유흥업소를 운영하는 선배. 좋은 돈이 된다고 꼬시지만 한 번 발을 들이면 빠져나오기 어려운 세계", tags: ["유흥", "위험", "돈", "범죄"], thread: "crime_underworld", dangerLevel: 2 },
  { name: "수진", role: "도박 클럽 리크루터", greeting: "00씨, 용돈 벌 기회 있는데 관심 있어요?", personality: "매력적이지만 위험한", backstory: "불법 도박 사이트의 대학가 리크루터. 처음에는 소액으로 유혹하고 점점 깊은 곳으로 끌어들이는 전형적인 나쁜 유혹", tags: ["도박", "빚", "위험", "범죄"], thread: "crime_underworld", dangerLevel: 2 },
  { name: "준호", role: "다단계 권유자", greeting: "00! 요즘 생활비는 어떻게 버냐? 좋은 기회 있는데~", personality: "겉으로는 친구처럼 다가오지만 실속은 없는", backstory: "고등학교 때부터 알고 지내던 사이지만 요즘은 다단계에 빠져서 주변 사람들에게 영업하고 다님", tags: ["다단계", "사기", "위험", "친구"], thread: "crime_underworld", dangerLevel: 2 },
  { name: "비밀(여/남)", role: "의문의 제안자", greeting: "…혼자 있는 시간이 많아 보이네요. 00씨.", personality: "정체를 알 수 없는 신비로운", backstory: "정체를 알 수 없는 인물이 건네는 의문의 제안. 받아들이면 큰 돈을 벌지만 영원히 비밀로 해야 하는 일", tags: ["의문", "비밀", "위험", "선택"], thread: "mystery", dangerLevel: 2 },

  // ===== 연애/관계 라인 =====
  { name: "서연", role: "문학 동아리원", greeting: "00씨, 아까 수업 때 말씀하신 거 정말 인상 깊었어요.", personality: "감수성이 풍부하고 예민한", backstory: "같은 문학 동아리에서 활동하는 조용한 관찰자. 당신을 좋아하는 것 같지만 확실하지 않은 미묘한 관계", tags: ["연애", "동아리", "감수성", "문학"], thread: "romance", dangerLevel: 0 },
  { name: "현우", role: "헬스장 트레이너", greeting: "00! 오늘 운동 안 왔잖아. 내가 찾으러 왔지~", personality: "장난기 많고 적극적인", backstory: "자주 가는 헬스장에서 만난 트레이너로 자연스럽게 가까워진 사이. 호감을 표현하지만 진지한 관계로 발전할지는 미지수", tags: ["연애", "운동", "건강", "적극적"], thread: "romance", dangerLevel: 0 },

  // ===== 돈/생계 라인 =====
  { name: "명수", role: "편의점 점장", greeting: "어, 00 왔어? 오늘도 야간이야?", personality: "무뚝뚝하지만 챙기는", backstory: "단골 편의점의 중년 점장. 생활비 때문에 새벽 알바를 뛰는 당신을 안쓰럽게 생각하면서도 쓸데없는 잔소리를 잘함", tags: ["알바", "생계", "돈", "편의점"], thread: "part_time_job", dangerLevel: 0 },
  { name: "미정", role: "대출 권유자", greeting: "00씨, 혹시 급전 필요한 거 아니에요?", personality: "부드럽지만 집요한", backstory: "합법적인 대출업체 상담사로 위장했지만 실제로는 고금리 불법 사채업자의 앞잡이", tags: ["대출", "빚", "사채", "위험"], thread: "crime_underworld", dangerLevel: 2 },

  // ===== 기타/스페셜 =====
  { name: "노인", role: "도서관 할아버지", greeting: "00라고? 자네, 이 책 한 번 읽어보게.", personality: "나이 든 지혜를 가진 신비로운", backstory: "학교 도서관에서 항상 같은 자리에 앉아 있는 정체불명의 노인. 가끔 건네는 말들이 이상할 정도로 인생에 적중함", tags: ["도서관", "지혜", "신비", "인생"], thread: "mystery", dangerLevel: 0 },
  { name: "혜진", role: "스터디 리더", greeting: "00, 이번 주 스터디 준비됐어? 내가 자료 좀 더 보내줄게.", personality: "철저하고 계획적인", backstory: "공기업 스터디를 이끄는 리더로 자기 관리가 철저하고 주변에도 엄격하지만 꽤 믿을 수 있는 사람", tags: ["공기업", "스터디", "계획적", "취업"], thread: "public_sector", dangerLevel: 0 },
];

export function pickNpcs(
  existingRelationships: { name: string; role: string; tags?: string[] }[],
  count: number,
  preferredThread?: string,
): NpcProfile[] {
  const existingNames = new Set(existingRelationships.map((r) => r.name));
  const candidates = NPC_POOL;

  if (preferredThread) {
    const threadMatch = candidates.filter((npc) => npc.thread === preferredThread && !existingNames.has(npc.name));
    if (threadMatch.length > 0) {
      const selected = threadMatch[Math.floor(Math.random() * threadMatch.length)];
      existingNames.add(selected.name);
    }
  }

  const available = NPC_POOL.filter((npc) => existingNames.has(npc.name));
  const result = [...available];
  const remaining = count - result.length;

  if (remaining > 0) {
    const newNpcs = shuffleArray(NPC_POOL.filter((npc) => !existingNames.has(npc.name)));
    result.push(...newNpcs.slice(0, remaining));
  }

  return shuffleArray(result).slice(0, count);
}

function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function greetCharacter(npc: NpcProfile, characterName: string): string {
  return npc.greeting.replace("00", characterName);
}

export function getNpcName(relationships: { name: string }[]): string {
  if (relationships.length === 0) return "누군가";
  const known = shuffleArray(relationships);
  return known[0].name;
}

export function pickNpcDangerous(relationships: { name: string }[]): NpcProfile | null {
  const existingNames = new Set(relationships.map((r) => r.name));
  const dangerous = NPC_POOL.filter((npc) => npc.dangerLevel >= 2 && !existingNames.has(npc.name));
  if (dangerous.length === 0) return null;
  return dangerous[Math.floor(Math.random() * dangerous.length)];
}
