export type CareerPhase = "EXPLORATION" | "PREPARATION" | "EXPERIENCE" | "APPLICATION" | "CONVERGENCE";
export type CareerEventKind = "CAREER_GATE" | "CAREER_LINKED" | "LIFE";

export type CareerEvidence = {
  sourceEventTitle: string;
  title: string;
  type: string;
  traits: string[];
  strength: number;
};

export type CareerCandidate = {
  id: string;
  name: string;
  interest: number;
  fit: number;
  evidence: string[];
};

export type CareerOrganization = {
  id: string;
  name: string;
  sector: string;
  companyType: string;
  traits: string[];
  roles: string[];
  preferredTraits: string[];
  majorFamilies?: string[];
};

export type CareerNarrativeState = {
  phase: CareerPhase;
  eventKind: CareerEventKind;
  candidates: CareerCandidate[];
  organizations: CareerOrganization[];
  evidence: CareerEvidence[];
  priorities: Record<"stability" | "salary" | "growth" | "location" | "workLifeBalance", number>;
  takenOpportunities: string[];
  missedOpportunities: string[];
  lastGate?: string | null;
};

export const ORGANIZATIONS: CareerOrganization[] = [
  { id: "samsong-electronics", name: "삼송전자", sector: "전자·반도체", companyType: "대기업", traits: ["높은 보상", "강한 경쟁", "체계적인 교육"], roles: ["헬스케어 사업", "품질관리", "일반 사무"], preferredTraits: ["문제 해결", "프로젝트", "기술 이해"] },
  { id: "sk-hynichip", name: "에스케이하이칩", sector: "반도체", companyType: "대기업", traits: ["기술 중심", "교대 가능성", "빠른 성장"], roles: ["품질", "안전", "기술지원"], preferredTraits: ["실무", "협업", "정확성"] },
  { id: "hyunjae-motors", name: "현재자동차", sector: "자동차·모빌리티", companyType: "대기업", traits: ["전국 사업장", "제조 현장", "직무 이동"], roles: ["품질", "산업안전", "서비스 기획"], preferredTraits: ["현장 대응", "조율", "분석"] },
  { id: "naverly", name: "네이벌리", sector: "플랫폼·콘텐츠", companyType: "IT 대기업", traits: ["자율성", "포트폴리오 중시", "빠른 변화"], roles: ["콘텐츠 기획", "서비스 운영", "헬스케어 플랫폼"], preferredTraits: ["온라인 창작", "데이터", "사용자 이해"] },
  { id: "kakaong", name: "카카옹", sector: "플랫폼·핀테크", companyType: "IT 대기업", traits: ["서비스 중심", "협업", "높은 변화율"], roles: ["서비스 운영", "마케팅", "헬스케어 제휴"], preferredTraits: ["소통", "콘텐츠", "문제 해결"] },
  { id: "coupango", name: "쿠팡고", sector: "이커머스·물류", companyType: "대기업", traits: ["성과 중심", "속도", "운영 규모"], roles: ["운영관리", "고객경험", "산업보건"], preferredTraits: ["고객 대응", "체력", "운영"] },
  { id: "celltrium", name: "셀트리움", sector: "바이오·제약", companyType: "대기업", traits: ["규정 중심", "연구 환경", "품질 중시"], roles: ["품질관리", "임상지원", "연구운영"], preferredTraits: ["정확성", "과학 지식", "기록"] },
  { id: "medivue", name: "메디뷰AI", sector: "의료영상 AI", companyType: "스타트업", traits: ["작은 조직", "넓은 역할", "성장 가능성"], roles: ["의료데이터 검수", "제품 교육", "임상 협력"], preferredTraits: ["의료영상", "설명력", "도전"] },
  { id: "hanbit-medical", name: "한빛의료기기", sector: "의료기기", companyType: "중견기업", traits: ["현장 출장", "고객 교육", "전문성"], roles: ["임상교육", "기술영업", "품질보증"], preferredTraits: ["발표", "현장 대응", "관계"] },
  { id: "seoul-haneul-hospital", name: "서울하늘대병원", sector: "상급종합병원", companyType: "대학병원", traits: ["높은 경쟁", "임상 전문성", "교대근무"], roles: ["방사선사", "검진", "임상연구 지원"], preferredTraits: ["실습", "정확성", "환자 대응"] },
  { id: "mirinae-hospital", name: "미리내종합병원", sector: "지역의료", companyType: "종합병원", traits: ["지역 정착", "폭넓은 업무", "환자 접점"], roles: ["영상의학", "건강검진", "원무 협력"], preferredTraits: ["환자 대응", "책임감", "생활 균형"] },
  { id: "national-health-data", name: "국민건강데이터원", sector: "보건·데이터", companyType: "공공기관", traits: ["안정성", "필기 경쟁", "공공성"], roles: ["보건데이터", "사업운영", "행정"], preferredTraits: ["학업", "문서", "공공성"] },
  { id: "korea-radiation-safety", name: "한국방사선안전공단", sector: "안전·규제", companyType: "공공기관", traits: ["전문성", "지역 근무", "규정 중심"], roles: ["안전관리", "검사 지원", "교육"], preferredTraits: ["전공지식", "정확성", "책임감"] },
  { id: "bluebird-studio", name: "파랑새스튜디오", sector: "콘텐츠·엔터테인먼트", companyType: "콘텐츠 기업", traits: ["프로젝트제", "대중 반응", "포트폴리오"], roles: ["버튜버 운영", "영상기획", "커뮤니티 매니저"], preferredTraits: ["온라인 창작", "무대", "팬 소통"] },
  { id: "daldal-marketing", name: "달달마케팅", sector: "광고·마케팅", companyType: "중소기업", traits: ["고객사 대응", "빠른 실행", "다양한 캠페인"], roles: ["콘텐츠 마케팅", "SNS 운영", "브랜드 기획"], preferredTraits: ["SNS", "창작", "협상"] },
  { id: "global-medix", name: "글로벌메딕스코리아", sector: "외국계 의료", companyType: "외국계", traits: ["영어", "성과 보상", "출장"], roles: ["임상지원", "제품교육", "마케팅"], preferredTraits: ["어학", "발표", "문화 적응"] },
  { id: "saebom-education-office", name: "새봄교육청", sector: "공공교육", companyType: "교육행정기관", traits: ["공공성", "학교 지원", "지역 교육"], roles: ["교육행정", "학교지원", "교육정책"], preferredTraits: ["교육 이해", "문서", "조율"], majorFamilies: ["education"] },
  { id: "baeum-policy-lab", name: "배움정책연구원", sector: "교육정책·연구", companyType: "공공연구기관", traits: ["연구 중심", "정책 분석", "현장 조사"], roles: ["교육연구", "정책분석", "조사운영"], preferredTraits: ["교육학", "연구", "기록"], majorFamilies: ["education"] },
  { id: "onclass", name: "온클래스", sector: "에듀테크", companyType: "교육 스타트업", traits: ["수업 혁신", "사용자 관찰", "빠른 실험"], roles: ["교육콘텐츠 기획", "학습서비스 운영", "교사 연수"], preferredTraits: ["교육 이해", "콘텐츠", "설명력"], majorFamilies: ["education"] },
  { id: "grow-together-center", name: "함께자람청소년센터", sector: "청소년·상담", companyType: "비영리기관", traits: ["학생 접점", "지역 연계", "사례 관리"], roles: ["청소년 프로그램", "학습상담", "진로지원"], preferredTraits: ["상담", "공감", "책임감"], majorFamilies: ["education"] },
  { id: "dodam-learning", name: "도담교육출판", sector: "교재·교육콘텐츠", companyType: "교육기업", traits: ["교재 개발", "학교 시장", "콘텐츠 품질"], roles: ["교재기획", "교육콘텐츠 편집", "교수설계"], preferredTraits: ["교육학", "글쓰기", "기획"], majorFamilies: ["education"] },
  { id: "bridge-lifelong", name: "이음평생학습관", sector: "평생교육", companyType: "지역교육기관", traits: ["성인 학습", "지역 프로그램", "생활 밀착"], roles: ["평생교육 운영", "프로그램 기획", "학습자 지원"], preferredTraits: ["교육 이해", "운영", "소통"], majorFamilies: ["education"] },
  { id: "mirae-teacher-institute", name: "미래교원연수원", sector: "교원연수", companyType: "교육연수기관", traits: ["교사 성장", "수업 연구", "현장 연계"], roles: ["교원연수 기획", "수업컨설팅", "교육과정 운영"], preferredTraits: ["교육학", "발표", "교사 소통"], majorFamilies: ["education"] },
  { id: "open-school-network", name: "열린학교네트워크", sector: "학교혁신·비영리", companyType: "교육 비영리", traits: ["학교 협력", "교육격차", "프로젝트 수업"], roles: ["학교협력", "교육프로그램 기획", "학습지원"], preferredTraits: ["교육 이해", "조율", "공공성"], majorFamilies: ["education"] },
];

const GENERAL_CANDIDATES = [
  ["teacher", "교사·교육 전문가"],
  ["education-admin", "교육행정·공공교육"],
  ["edtech", "에듀테크·교육콘텐츠"],
  ["counseling", "학생상담·청소년지원"],
  ["clinical", "병원·임상 전문가"],
  ["medical-device", "의료기기·임상교육"],
  ["public-health", "공공 보건·안전"],
  ["health-tech", "의료영상 AI·헬스테크"],
  ["content", "의료·디지털 콘텐츠"],
  ["corporate", "일반 기업 직무"],
  ["research", "대학원·연구직"],
  ["global", "해외·외국계 진로"],
] as const;

export function careerPhaseForEventCount(coreEventCount: number): CareerPhase {
  if (coreEventCount < 6) return "EXPLORATION";
  if (coreEventCount < 12) return "PREPARATION";
  if (coreEventCount < 18) return "EXPERIENCE";
  if (coreEventCount < 24) return "APPLICATION";
  return "CONVERGENCE";
}

export function careerEventKindForCount(coreEventCount: number): CareerEventKind {
  const position = coreEventCount % 8;
  if (position === 0 || position === 3 || position === 5) return "CAREER_GATE";
  if (position === 1 || position === 4 || position === 7) return "CAREER_LINKED";
  return "LIFE";
}

export function getMajorCareerAffinity(major: string, careerName: string): number {
  const isRadiology = major.includes("방사선");
  const isBusiness = major.includes("경영") || major.includes("경제") || major.includes("회계");
  const isEngineering = major.includes("공학") || major.includes("컴퓨터") || major.includes("전자");
  const isHumanities = major.includes("문학") || major.includes("역사") || major.includes("철학") || major.includes("심리");
  const isSocial = major.includes("사회") || major.includes("행정") || major.includes("정치");
  const isEducation = major.includes("교육");
  const isArt = major.includes("예술") || major.includes("디자인") || major.includes("음악");

  const careerKeywords: [string, string[], number][] = [
    ["임상", ["방사선"], 3],
    ["방사선", ["방사선"], 3],
    ["의료기기", ["방사선", "공학"], 3],
    ["보건", ["방사선", "사회", "교육"], 2],
    ["안전", ["방사선", "사회", "교육"], 2],
    ["헬스테크", ["방사선", "공학"], 3],
    ["의료영상", ["방사선", "공학"], 3],
    ["의료", ["방사선"], 2],
    ["콘텐츠", ["문학", "예술"], 2],
    ["마케팅", ["경영", "문학", "사회"], 2],
    ["기획", ["경영", "문학", "사회"], 2],
    ["기업", ["경영", "사회", "문학", "공학"], 1],
    ["회사", ["경영", "사회", "문학", "공학"], 1],
    ["연구", ["공학", "문학", "사회"], 2],
    ["대학원", ["공학", "문학", "사회"], 2],
    ["해외", ["경영", "문학", "공학"], 1],
    ["외국계", ["경영", "문학", "공학"], 1],
    ["공공", ["사회", "교육"], 2],
    ["행정", ["사회", "경영"], 2],
    ["교육", ["교육"], 3],
    ["교사", ["교육"], 3],
    ["상담", ["교육", "사회"], 3],
    ["개발", ["공학"], 3],
    ["엔지니어", ["공학"], 3],
  ];

  let score = 0;
  for (const [keyword, majors, weight] of careerKeywords) {
    if (!careerName.includes(keyword)) continue;
    if (isRadiology && majors.includes("방사선")) score = Math.max(score, weight);
    if (isBusiness && majors.includes("경영")) score = Math.max(score, weight);
    if (isEngineering && majors.includes("공학")) score = Math.max(score, weight);
    if (isHumanities && majors.includes("문학")) score = Math.max(score, weight);
    if (isSocial && majors.includes("사회")) score = Math.max(score, weight);
    if (isEducation && majors.includes("교육")) score = Math.max(score, weight);
    if (isArt && majors.includes("예술")) score = Math.max(score, weight);
  }

  return score;
}

export function normalizeCareerNarrativeState(
  raw: unknown,
  input: { storySeed: string; major: string; coreEventCount: number },
): CareerNarrativeState {
  const record = isRecord(raw) ? raw : {};
  const phase = careerPhaseForEventCount(input.coreEventCount);
  const eventKind = careerEventKindForCount(input.coreEventCount);
  const takenOpportunities = readStrings(record.takenOpportunities).slice(-12);
  const missedOpportunities = readStrings(record.missedOpportunities).slice(-12);
  const existingOrganizations = readOrganizations(record.organizations);
  const committedNames = organizationNamesFromCommitments(existingOrganizations ?? [], takenOpportunities, missedOpportunities, record.lastGate);
  const organizations = reconcileOrganizations(existingOrganizations, {
    seed: input.storySeed,
    major: input.major,
    committedNames,
    missedNames: missedOpportunities,
  });
  const candidates = reconcileCandidates(readCandidates(record.candidates), input.storySeed, input.major);
  const evidence = Array.isArray(record.evidence) ? record.evidence.filter(isCareerEvidence).slice(-20) : [];
  const priorities = isRecord(record.priorities) ? {
    stability: readNumber(record.priorities.stability), salary: readNumber(record.priorities.salary),
    growth: readNumber(record.priorities.growth), location: readNumber(record.priorities.location),
    workLifeBalance: readNumber(record.priorities.workLifeBalance),
  } : { stability: 0, salary: 0, growth: 0, location: 0, workLifeBalance: 0 };
  return {
    phase, eventKind, organizations, candidates, evidence, priorities,
    takenOpportunities,
    missedOpportunities,
    lastGate: typeof record.lastGate === "string" ? record.lastGate : null,
  };
}

export function advanceCareerNarrativeState(
  current: CareerNarrativeState,
  input: { eventTitle: string; eventTags: string[]; choiceSummary: string; statDelta: Record<string, number>; nextCoreEventCount: number; major?: string },
): CareerNarrativeState {
  const evidence = inferCareerEvidence(input);
  const updatedCandidates = current.candidates.map((candidate) => {
    const relevance = evidence.flatMap((item) => item.traits).filter((trait) => candidateTraitMatch(candidate.id, trait, input.major)).length;
    return relevance === 0 ? candidate : {
      ...candidate,
      interest: clamp(candidate.interest + relevance * 2),
      fit: clamp(candidate.fit + relevance * 3),
      evidence: [...new Set([...candidate.evidence, ...evidence.map((item) => item.title)])].slice(-8),
    };
  });
  const candidates = unlockCareerCandidates(updatedCandidates, evidence)
    .sort((a, b) => (b.fit + b.interest) - (a.fit + a.interest))
    .slice(0, 5);
  const organizationDecision = inferOrganizationDecision(current.organizations, input.eventTitle, input.choiceSummary);
  return {
    ...current,
    phase: careerPhaseForEventCount(input.nextCoreEventCount),
    eventKind: careerEventKindForCount(input.nextCoreEventCount),
    candidates,
    evidence: [...current.evidence, ...evidence].slice(-20),
    priorities: updatePriorities(current.priorities, input.choiceSummary),
    lastGate: current.eventKind === "CAREER_GATE" ? input.eventTitle : current.lastGate,
    takenOpportunities: organizationDecision?.decision === "taken"
      ? appendUnique(current.takenOpportunities, organizationDecision.name)
      : organizationDecision?.decision === "missed"
        ? current.takenOpportunities.filter((name) => name !== organizationDecision.name)
        : current.takenOpportunities,
    missedOpportunities: organizationDecision?.decision === "missed"
      ? appendUnique(current.missedOpportunities, organizationDecision.name)
      : organizationDecision?.decision === "taken"
        ? current.missedOpportunities.filter((name) => name !== organizationDecision.name)
        : current.missedOpportunities,
  };
}

function unlockCareerCandidates(candidates: CareerCandidate[], evidence: CareerEvidence[]) {
  const unlocks: Record<string, string[]> = {
    DIGITAL_CONTENT: ["content"],
    CREATIVE_EXPERIENCE: ["content"],
    ADAPTABILITY: ["global"],
    PRACTICAL_EXPERIENCE: ["clinical", "medical-device"],
    ACADEMIC_EXPERIENCE: ["research", "public-health"],
  };
  const next = [...candidates];
  for (const item of evidence) {
    const candidateId = unlocks[item.type]?.find((id) => !next.some((candidate) => candidate.id === id));
    if (!candidateId) continue;
    const definition = GENERAL_CANDIDATES.find(([id]) => id === candidateId);
    if (!definition) continue;
    next.push({
      id: definition[0],
      name: definition[1],
      interest: 34,
      fit: 34 + item.strength,
      evidence: [item.title],
    });
  }
  return next;
}

export function summarizeCareerNarrativeForPrompt(state: CareerNarrativeState) {
  return {
    phase: state.phase,
    eventKind: state.eventKind,
    leadingCandidates: state.candidates.slice(0, 4),
    organizations: state.organizations
      .filter((organization) => !state.missedOpportunities.includes(organization.name) || state.takenOpportunities.includes(organization.name))
      .map(({ name, sector, companyType, traits, roles }) => ({ name, sector, companyType, traits, roles })),
    recentEvidence: state.evidence.slice(-8),
    priorities: state.priorities,
    lastGate: state.lastGate,
  };
}

function selectOrganizations(seed: string, major: string, limit: number, excludedNames: string[] = []) {
  const available = ORGANIZATIONS.filter((organization) => !excludedNames.includes(organization.name));
  const alignedTarget = major.includes("교육") ? limit : Math.min(5, limit);
  const aligned = deterministicShuffle(
    available.filter((organization) => organizationAffinity(major, organization) > 0),
    `${seed}:${major}:aligned-organizations`,
  ).slice(0, alignedTarget);
  const alignedIds = new Set(aligned.map((organization) => organization.id));
  const crossMajor = deterministicShuffle(
    available.filter((organization) => !alignedIds.has(organization.id)),
    `${seed}:${major}:cross-organizations`,
  ).slice(0, limit - aligned.length);
  return [...aligned, ...crossMajor];
}

function reconcileOrganizations(
  existing: CareerOrganization[] | null,
  input: { seed: string; major: string; committedNames: string[]; missedNames: string[] },
) {
  const alignedCount = existing?.filter((organization) => organizationAffinity(input.major, organization) > 0).length ?? 0;
  if (existing && (!input.major.includes("교육") || alignedCount >= 4)) {
    return existing.filter((organization) => !input.missedNames.includes(organization.name) || input.committedNames.includes(organization.name));
  }
  const selected = selectOrganizations(input.seed, input.major, 8, input.missedNames);
  const committed = (existing ?? []).filter((organization) => input.committedNames.includes(organization.name));
  return [...committed, ...selected.filter((organization) => !committed.some((item) => item.id === organization.id))].slice(0, 8);
}

function organizationAffinity(major: string, organization: CareerOrganization) {
  const family = major.includes("교육") ? "education" : major.includes("방사선") ? "health" : null;
  return family && organization.majorFamilies?.includes(family) ? 5 : 0;
}

function organizationNamesFromCommitments(organizations: CareerOrganization[], taken: string[], missed: string[], lastGate: unknown) {
  const gate = typeof lastGate === "string" ? lastGate : "";
  return organizations
    .filter((organization) => taken.includes(organization.name) || (gate.includes(organization.name) && !missed.includes(organization.name)))
    .map((organization) => organization.name);
}

function reconcileCandidates(existing: CareerCandidate[] | null, seed: string, major: string) {
  if (!existing) return selectCandidates(seed, major);
  if (!major.includes("교육") || existing.filter((candidate) => getMajorCareerAffinity(major, candidate.name) > 0).length >= 3) return existing;
  const fresh = selectCandidates(seed, major);
  const evidenceById = new Map(existing.map((candidate) => [candidate.id, candidate.evidence]));
  return fresh.map((candidate) => ({ ...candidate, evidence: evidenceById.get(candidate.id) ?? candidate.evidence }));
}

function inferOrganizationDecision(organizations: CareerOrganization[], eventTitle: string, summary: string) {
  const organization = organizations.find((item) => eventTitle.includes(item.name) || summary.includes(item.name));
  if (!organization) return null;
  if (/(다른\s*(회사|기관|길|경로)|거절|지원하지|신청하지|포기|보류|지켜보|더 알아|정보를 수집|탐색)/.test(summary)) {
    return { name: organization.name, decision: "missed" as const };
  }
  if (/(지원|신청|수락|합류|제출|입사|인턴을?\s*시작|근무를?\s*시작|참여하기로)/.test(summary)) {
    return { name: organization.name, decision: "taken" as const };
  }
  return null;
}

function appendUnique(values: string[], value: string) {
  return [...values.filter((item) => item !== value), value].slice(-12);
}

function selectCandidates(seed: string, major: string): CareerCandidate[] {
  const shuffled = deterministicShuffle(GENERAL_CANDIDATES, `${seed}:${major}`);
  const scored = shuffled.map(([id, name]) => ({
    id,
    name,
    affinity: getMajorCareerAffinity(major, name),
  })).sort((a, b) => b.affinity - a.affinity);
  // Always select 5 candidates: top 4 by affinity plus at least one cross-major
  const selected = scored.slice(0, 4);
  const crossMajor = scored.find((c) => c.affinity <= 0);
  if (crossMajor && !selected.includes(crossMajor)) {
    selected.push(crossMajor);
  }
  // If we still don't have 5 (e.g. no cross-major found), add the next available
  if (selected.length < 5) {
    for (const c of scored) {
      if (!selected.includes(c)) {
        selected.push(c);
        if (selected.length >= 5) break;
      }
    }
  }
  return selected.map(({ id, name, affinity }, index) => ({
    id,
    name,
    interest: 35 - index * 3,
    fit: 25 + affinity * 5,
    evidence: [],
  }));
}

function inferCareerEvidence(input: { eventTitle: string; eventTags: string[]; choiceSummary: string; statDelta: Record<string, number> }): CareerEvidence[] {
  const text = `${input.eventTitle} ${input.eventTags.join(" ")} ${input.choiceSummary}`;
  const rules = [
    ["갈등 해결", "CONFLICT_RESOLUTION", ["갈등", "다툼", "조율", "협상", "사과"]],
    ["고객·사람 응대", "COMMUNICATION", ["손님", "환자", "고객", "상담", "설명"]],
    ["온라인 콘텐츠 제작", "DIGITAL_CONTENT", ["버튜버", "인플루언서", "영상", "방송", "콘텐츠", "SNS"]],
    ["문화·무대 경험", "CREATIVE_EXPERIENCE", ["뮤지컬", "공연", "무대", "밴드", "전시", "창작"]],
    ["낯선 환경 적응", "ADAPTABILITY", ["여행", "해외", "캠핑", "이사", "돌발"]],
    ["현장·실무 경험", "PRACTICAL_EXPERIENCE", ["실습", "인턴", "알바", "현장", "프로젝트"]],
    ["학습과 전문성", "ACADEMIC_EXPERIENCE", ["시험", "자격증", "공부", "연구", "수업"]],
    ["책임과 회복", "RESILIENCE", ["건강", "번아웃", "실수", "회복", "책임"]],
  ] as const;
  return rules.filter(([, , keywords]) => keywords.some((keyword) => text.includes(keyword))).slice(0, 2).map(([title, type]) => ({
    sourceEventTitle: input.eventTitle,
    title,
    type,
    traits: evidenceTraits(type, input.statDelta),
    strength: Math.min(5, Math.max(1, Math.max(0, ...Object.values(input.statDelta).map(Math.abs)))),
  }));
}

function evidenceTraits(type: string, delta: Record<string, number>) {
  const traits = type === "DIGITAL_CONTENT" ? ["온라인 창작", "사용자 이해"] :
    type === "CREATIVE_EXPERIENCE" ? ["창작", "발표"] :
    type === "ADAPTABILITY" ? ["문화 적응", "도전"] :
    type === "CONFLICT_RESOLUTION" ? ["협상", "소통"] :
    type === "COMMUNICATION" ? ["고객 대응", "설명력"] :
    type === "PRACTICAL_EXPERIENCE" ? ["실무", "현장 대응"] :
    type === "ACADEMIC_EXPERIENCE" ? ["학업", "정확성"] : ["책임감", "회복"];
  return traits;
}

function candidateTraitMatch(id: string, trait: string, major?: string) {
  if (major?.includes("교육") && ["clinical", "medical-device", "health-tech"].includes(id)) return false;
  const map: Record<string, string[]> = {
    teacher: ["학업", "설명력", "책임감", "소통", "발표"],
    "education-admin": ["학업", "정확성", "책임감", "협상", "소통"],
    edtech: ["온라인 창작", "사용자 이해", "설명력", "실무", "창작"],
    counseling: ["소통", "고객 대응", "책임감", "회복", "설명력"],
    clinical: ["실무", "현장 대응", "정확성", "고객 대응"],
    "medical-device": ["설명력", "발표", "관계", "현장 대응"],
    "public-health": ["학업", "정확성", "책임감"],
    "health-tech": ["온라인 창작", "문제 해결", "실무"],
    content: ["온라인 창작", "창작", "사용자 이해", "발표"],
    corporate: ["협상", "소통", "문제 해결"],
    research: ["학업", "정확성", "문제 해결"],
    global: ["문화 적응", "도전", "설명력"],
  };
  return map[id]?.includes(trait) ?? false;
}

function updatePriorities(current: CareerNarrativeState["priorities"], summary: string) {
  return {
    stability: current.stability + (/(안정|공공|정규)/.test(summary) ? 1 : 0),
    salary: current.salary + (/(돈|연봉|보상|급여)/.test(summary) ? 1 : 0),
    growth: current.growth + (/(도전|성장|배우|경험)/.test(summary) ? 1 : 0),
    location: current.location + (/(지역|본가|이사|해외|통근)/.test(summary) ? 1 : 0),
    workLifeBalance: current.workLifeBalance + (/(휴식|건강|균형|워라밸)/.test(summary) ? 1 : 0),
  };
}

/** SplitMix32 — a well-known 32-bit PRNG.  All operations stay within the
 * 32-bit integer range so JavaScript arithmetic is exact. */
function splitmix32(state: number) {
  state = (state + 0x9e3779b9) | 0;
  let z = state;
  z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
  z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
  return (z ^ (z >>> 16)) >>> 0;
}

/** Deterministic Fisher–Yates shuffle using SplitMix32 PRNG with two
 * interleaved state words so that seeds differing by a single character
 * produce completely different permutations. */
function deterministicShuffle<T>(values: readonly T[], seed: string) {
  const result = [...values];
  // Hash the seed into two independent 32-bit seeds via different algorithms:
  //   lo — FNV-1a, hi — PJW (a.k.a. ELF hash)
  let lo = [...seed].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 0x1000193) >>> 0, 0x811c9dc5);
  let hi = [...seed].reduce((h, c) => ((h << 4) + c.charCodeAt(0) + ((h & 0xf0000000) >>> 24)) >>> 0, 0x6b8b4567);
  // Additional mixing pass over reversed seed to spread short seeds
  for (let i = seed.length - 1; i >= 0; i--) {
    lo = splitmix32(lo ^ seed.charCodeAt(i));
    hi = splitmix32(hi ^ seed.charCodeAt(i));
  }
  for (let index = result.length - 1; index > 0; index -= 1) {
    hi = splitmix32(hi ^ lo);
    lo = splitmix32(lo ^ hi);
    // Unbiased range reduction: reject values that would introduce modulo bias
    const n = index + 1;
    const limit = 0x100000000 - (0x100000000 % n);
    let target = hi;
    while (target >= limit) {
      hi = splitmix32(hi ^ lo);
      lo = splitmix32(lo ^ hi);
      target = hi;
    }
    target = target % n;
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function readOrganizations(value: unknown) { return Array.isArray(value) && value.every(isCareerOrganization) ? value.slice(0, 8) : null; }
function readCandidates(value: unknown) { return Array.isArray(value) && value.every(isCareerCandidate) ? value.slice(0, 5) : null; }
function readStrings(value: unknown) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }
function readNumber(value: unknown) { return typeof value === "number" && Number.isFinite(value) ? value : 0; }
function clamp(value: number) { return Math.max(0, Math.min(100, value)); }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function isCareerOrganization(value: unknown): value is CareerOrganization { return isRecord(value) && typeof value.id === "string" && typeof value.name === "string" && Array.isArray(value.roles); }
function isCareerCandidate(value: unknown): value is CareerCandidate { return isRecord(value) && typeof value.id === "string" && typeof value.name === "string" && typeof value.fit === "number" && Array.isArray(value.evidence); }
function isCareerEvidence(value: unknown): value is CareerEvidence { return isRecord(value) && typeof value.title === "string" && typeof value.type === "string" && Array.isArray(value.traits); }
