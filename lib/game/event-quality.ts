export const EVENT_QUALITY_DEFAULTS = {
  recentEventLookback: 5,
  strongRepeatLookback: 3,
  hardRetryThreshold: 60,
} as const;

export type EventQualityVerdict = {
  status: "pass" | "fail";
  hardFailure: boolean;
  reasons: string[];
  diversityScore: number;
  continuityExemptions: string[];
  retryRecommended: boolean;
  fallbackRecommended: boolean;
};

export type ThreadLifecycleState =
  | "offered"
  | "accepted"
  | "active"
  | "low_participation"
  | "quit"
  | "expelled"
  | "completed"
  | "closed";

export type ThreadLifecycle = {
  activeThreads: string[];
  closedThreads: string[];
  lowParticipationThreads: string[];
  threads: Record<string, {
    id: string;
    state: ThreadLifecycleState;
    evidence: string[];
    keywords: string[];
  }>;
};

type EventQualityChoice = {
  id?: unknown;
  label?: unknown;
  summary?: unknown;
  statDelta?: unknown;
  relationshipDelta?: unknown;
};

type EventQualityCandidate = {
  title?: unknown;
  body?: unknown;
  tags?: unknown;
  choices?: unknown;
};

type RecentEvent = {
  title?: string | null;
  body?: string | null;
  summary?: string | null;
  tags?: string[] | null;
  people?: string[] | null;
};

export type InferThreadLifecycleInput = {
  eventFlags?: Record<string, unknown> | null;
  recentSummaries?: string[];
};

export type EvaluateEventQualityInput = {
  source: "AI" | "STATIC" | "FALLBACK" | "FORCED" | string;
  candidate: EventQualityCandidate;
  context?: {
    academicStatus?: string | null;
    lifeStage?: string | null;
    eventFlags?: Record<string, unknown> | null;
    recentSummaries?: string[];
    recentEvents?: RecentEvent[];
    previousChoiceSummary?: string | null;
  };
};

const terminalStateValues = new Set([
  "closed",
  "rejected",
  "declined",
  "skipped",
  "refused",
  "ignored",
  "withdrawn",
  "quit",
  "expelled",
  "completed",
]);

const activeStateValues = new Set(["accepted", "active", "joined", "participating", "started"]);
const lowParticipationValues = new Set(["low_participation", "lowParticipation", "inactive", "poor_participation"]);

const terminalFlagSuffixes = [
  "Closure",
  "Closed",
  "Quit",
  "Expelled",
  "Completed",
  "Skipped",
  "Declined",
  "Rejected",
  "Refused",
  "Withdrawn",
];

const participationSuffixes = ["Participation", "Progress", "Status"];

const directResultChoicePattern =
  /(합격한다|불합격한다|통과한다|떨어진다|탈락한다|합격을\s*선택|불합격을\s*선택|통과를\s*선택|탈락을\s*선택|떨어짐을\s*선택)/;

const directLifecycleOutcomeChoicePattern =
  /(퇴출(?:된|당한)다|제명(?:된|당한)다|쫓겨난다|강제로\s*나(?:간|가게\s*된)다|강제\s*퇴장한다|내보내진다|제외된다|방출된다|탈락한다|거절당한다|거부당한다|퇴출을\s*선택|제명을\s*선택|탈락을\s*선택)/;

const numericStatPattern =
  /(건강|멘탈|정신|학점|학업|실무|평판|매력|자산|재산|네트워크|network|academic|practical|health|mental|wealth|reputation|charm)\s*[:：]?\s*[0-9]{1,3}/gi;

const dropoutCampusPattern = /(강의|강의실|수강|출석|과제|학기|전공\s*수업|학생\s*동아리|캠퍼스\s*수업)/;
const dropoutAllowedExceptionPattern =
  /((?:자퇴|중퇴|제적).{0,12}(?:서류|행정|상담|절차|증명)|(?:서류|행정|상담|절차|증명).{0,12}(?:자퇴|중퇴|제적)|복학|재입학|재등록|동문|졸업생|비재학|학교\s*밖|외부\s*공부|온라인\s*강의|검정고시|학점은행|방통대)/;

const closureConsequencePattern = /(퇴출|그만두|탈퇴|마지막|종료|마무리|정리|함께하기\s*어렵|참여율이\s*낮|낮았던|통보|닫히|닫힌)/;
const invitationPattern = /(초대|제안|모집|구성|가입|참여|들어가|함께하|합류|지원해보|신청|해보겠냐|해보지\s*않겠)/;
const jobProcessPattern = /(회사|채용|지원|서류|인성검사|코딩\s*테스트|면접|최종\s*면접|과제\s*전형|합격|불합격|결과)/;
const specProgressPattern = /(공모전|대회|프로젝트|포트폴리오|자격증|스펙|팀).*(팀\s*구성|기획서|제출|발표|심사|피드백|결과|완성|마감)|(?:팀\s*구성|기획서|제출|발표|심사|피드백|결과|완성|마감).*(공모전|대회|프로젝트|포트폴리오|자격증|스펙|팀)/;

const summaryThreadActionPattern =
  /(가입|참여|그만두|탈퇴|퇴출(?:되|당)?|제명(?:되|당)?|탈락(?:하|되)?|거절당|내보내(?:졌|졌|지)|제외되|방출되|쫓겨나|쫓겨났|강제로\s*나(?:갔|가게\s*되|가게\s*됐|가게\s*되었)|완료|마무리|끝냈|닫혔|종료)/;
const forcedRemovalSummaryPattern =
  /(퇴출|제명|탈락|내보내졌|내보내지|제외되|방출되|쫓겨났|쫓겨나|강제로\s*나갔|강제로\s*나가게\s*(?:되|됐|되었))/;
const terminalSummaryPattern =
  /(그만두|탈퇴|퇴출|제명|탈락|거절당|내보내졌|내보내지|제외되|방출되|쫓겨났|쫓겨나|강제로\s*나갔|강제로\s*나가게\s*(?:되|됐|되었)|완료|마무리|끝냈|닫혔|종료)/;

const englishKeywordMap: Record<string, string[]> = {
  band: ["밴드", "동아리"],
  club: ["동아리", "모임", "클럽"],
  campus: ["캠퍼스", "교내", "동아리"],
  reading: ["독서", "책"],
  study: ["스터디", "공부"],
  contest: ["공모전", "대회"],
  group: ["그룹", "모임", "팀"],
  team: ["팀"],
  job: ["취업", "직무", "지원"],
  outside: ["외부", "전시", "밖"],
  public: ["공공", "공기업"],
  sector: ["공공", "공기업"],
};

export function inferThreadLifecycle(input: InferThreadLifecycleInput): ThreadLifecycle {
  const threads: ThreadLifecycle["threads"] = {};
  const flags = input.eventFlags ?? {};
  const summaries = input.recentSummaries ?? [];

  for (const [rawKey, rawValue] of Object.entries(flags)) {
    const key = String(rawKey);
    const value = normalizeFlagValue(rawValue);
    const { threadId, suffix } = splitThreadFlagKey(key);
    const thread = ensureThread(threads, threadId);

    thread.evidence.push(`${key}:${value}`);
    addKeywords(thread, keywordsForFlagKey(threadId));

    if (suffix && participationSuffixes.includes(suffix) && lowParticipationValues.has(value)) {
      applyState(thread, "low_participation");
      continue;
    }

    if (suffix && terminalFlagSuffixes.includes(suffix) && rawValue !== false && rawValue !== null && rawValue !== undefined) {
      applyState(thread, stateFromTerminalValue(value, suffix));
      continue;
    }

    if (lowParticipationValues.has(value)) {
      applyState(thread, "low_participation");
    } else if (terminalStateValues.has(value)) {
      applyState(thread, stateFromTerminalValue(value));
    } else if (activeStateValues.has(value) || rawValue === true) {
      applyState(thread, value === "accepted" ? "accepted" : "active");
    } else if (value === "offered" || value === "pending") {
      applyState(thread, "offered");
    }
  }

  for (const summary of summaries) {
    const phrase = extractThreadPhrase(summary);
    if (!phrase) continue;
    const normalizedPhrase = phrase.trim();
    const matchedThread = findThreadBySummaryPhrase(threads, normalizedPhrase);
    if (!matchedThread) continue;

    matchedThread.evidence.push(summary);
    addKeywords(matchedThread, keywordsForText(normalizedPhrase));

    if (/(참여율이\s*낮|몇 번 빠|출석이.*밀|과제.*밀|소홀|뜸해)/.test(summary)) {
      applyState(matchedThread, "low_participation");
    }
    if (terminalSummaryPattern.test(summary)) {
      applyState(matchedThread, forcedRemovalSummaryPattern.test(summary) ? "expelled" : "closed");
    }
  }

  const activeThreads = Object.values(threads)
    .filter((thread) => !isClosedState(thread.state) && (thread.state === "accepted" || thread.state === "active" || thread.state === "low_participation"))
    .map((thread) => thread.id);
  const closedThreads = Object.values(threads)
    .filter((thread) => isClosedState(thread.state))
    .map((thread) => thread.id);
  const lowParticipationThreads = Object.values(threads)
    .filter((thread) => thread.state === "low_participation")
    .map((thread) => thread.id);

  return { activeThreads, closedThreads, lowParticipationThreads, threads };
}

export function evaluateEventQuality(input: EvaluateEventQualityInput): EventQualityVerdict {
  const reasons: string[] = [];
  const continuityExemptions: string[] = [];
  const candidate = input.candidate;
  const text = eventText(candidate);
  const choices = Array.isArray(candidate.choices) ? candidate.choices as EventQualityChoice[] : [];
  const lifecycle = inferThreadLifecycle({
    eventFlags: input.context?.eventFlags,
    recentSummaries: input.context?.recentSummaries,
  });

  if (isMalformedCandidate(candidate, choices)) reasons.push("malformed_event");
  if (hasDropoutAcademicConflict(input.context?.academicStatus, text)) reasons.push("academic_conflict");
  if (choices.some((choice) => typeof choice.label === "string" && directResultChoicePattern.test(choice.label))) {
    reasons.push("direct_result_choice");
  }
  if (choices.some((choice) => typeof choice.label === "string" && directLifecycleOutcomeChoicePattern.test(choice.label))) {
    reasons.push("direct_lifecycle_outcome_choice");
  }
  if (hasNumericStatExposure(text)) reasons.push("numeric_stat_exposure");
  if (choices.some(hasForbiddenOrdinaryStatDrop) && input.source === "AI") {
    reasons.push("health_mental_delta_violation");
  }
  if (isClosedThreadRepeat(text, lifecycle)) reasons.push("closed_thread_repeat");

  if (isLifecycleClosureConsequence(text, lifecycle)) {
    continuityExemptions.push("lifecycle_closure");
  }
  continuityExemptions.push(...detectContinuityExemptions(input, choices, text));

  const diversityScore = scoreDiversity(input, continuityExemptions);
  if (diversityScore < EVENT_QUALITY_DEFAULTS.hardRetryThreshold) {
    reasons.push("low_diversity_score");
  }

  const hardFailure = reasons.some((reason) => reason !== "low_diversity_score");
  const status = reasons.length > 0 ? "fail" : "pass";

  return {
    status,
    hardFailure,
    reasons: [...new Set(reasons)],
    diversityScore,
    continuityExemptions: [...new Set(continuityExemptions)],
    retryRecommended: status === "fail" && input.source === "AI",
    fallbackRecommended: status === "fail" && input.source !== "FORCED",
  };
}

export function stripNumericStatExposure(text: string): string {
  return text
    .replace(/학점\s*[0-9]{1,3}의\s*지식/g, "탄탄한 학업 기반")
    .replace(/네트워크\s*[0-9]{1,3}/g, "관계망")
    .replace(numericStatPattern, (match) => {
      const lower = match.toLowerCase();
      if (lower.includes("건강") || lower.includes("health")) return "몸 상태";
      if (lower.includes("멘탈") || lower.includes("정신") || lower.includes("mental")) return "마음 상태";
      if (lower.includes("학점") || lower.includes("학업") || lower.includes("academic")) return "학업 기반";
      if (lower.includes("실무") || lower.includes("practical")) return "실무 감각";
      if (lower.includes("평판") || lower.includes("reputation")) return "평판";
      if (lower.includes("매력") || lower.includes("charm")) return "대인 매력";
      if (lower.includes("자산") || lower.includes("재산") || lower.includes("wealth")) return "경제 사정";
      return "관계망";
    })
    .replace(/\s{2,}/g, " ")
    .trim();
}

function ensureThread(threads: ThreadLifecycle["threads"], id: string) {
  threads[id] ??= { id, state: "offered", evidence: [], keywords: [] };
  return threads[id];
}

function applyState(thread: ThreadLifecycle["threads"][string], state: ThreadLifecycleState) {
  if (isClosedState(thread.state) && state === "closed") {
    return;
  }
  if (stateRank(state) >= stateRank(thread.state)) {
    thread.state = state;
  }
}

function stateRank(state: ThreadLifecycleState) {
  return {
    offered: 0,
    accepted: 1,
    active: 2,
    low_participation: 3,
    quit: 4,
    expelled: 4,
    completed: 4,
    closed: 4,
  }[state];
}

function isClosedState(state: ThreadLifecycleState) {
  return state === "closed" || state === "quit" || state === "expelled" || state === "completed";
}

function normalizeFlagValue(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value && typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function splitThreadFlagKey(key: string) {
  for (const suffix of [...terminalFlagSuffixes, ...participationSuffixes]) {
    if (key.endsWith(suffix) && key.length > suffix.length) {
      return { threadId: key.slice(0, -suffix.length), suffix };
    }
  }
  if (key.endsWith("Joined")) return { threadId: key.slice(0, -"Joined".length), suffix: "Joined" };
  return { threadId: key, suffix: null };
}

function stateFromTerminalValue(value: string, suffix?: string): ThreadLifecycleState {
  if (value === "quit" || suffix === "Quit" || value === "withdrawn") return "quit";
  if (value === "expelled" || suffix === "Expelled") return "expelled";
  if (value === "completed" || suffix === "Completed") return "completed";
  return "closed";
}

function keywordsForFlagKey(key: string) {
  const words = key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z가-힣0-9]+/)
    .map((word) => word.toLowerCase())
    .filter((word) => word.length >= 2);
  return words.flatMap((word) => [word, ...(englishKeywordMap[word] ?? [])]);
}

function keywordsForText(text: string) {
  return [...new Set(text.split(/[^A-Za-z가-힣0-9]+/).filter((word) => word.length >= 2))];
}

function addKeywords(thread: ThreadLifecycle["threads"][string], keywords: string[]) {
  thread.keywords = [...new Set([...thread.keywords, ...keywords])];
}

function extractThreadPhrase(summary: string) {
  return summary.match(new RegExp(`([가-힣A-Za-z0-9 ]{2,30}?)(?:에|에서|을|를)\\s*${summaryThreadActionPattern.source}`))?.[1] ?? null;
}

function findThreadBySummaryPhrase(threads: ThreadLifecycle["threads"], phrase: string) {
  const words = keywordsForText(phrase);
  const existing = Object.values(threads).find((thread) => words.some((word) => thread.keywords.some((keyword) => keyword === word || keyword.includes(word) || word.includes(keyword))));
  if (existing) return existing;

  const id = phrase
    .replace(/\s+/g, "")
    .replace(/^[^가-힣A-Za-z0-9]+|[^가-힣A-Za-z0-9]+$/g, "");
  if (!id) return null;
  const thread = ensureThread(threads, id);
  addKeywords(thread, words);
  return thread;
}

function eventText(candidate: EventQualityCandidate) {
  const choiceText = Array.isArray(candidate.choices)
    ? candidate.choices.map((choice) => {
      const record = choice as EventQualityChoice;
      return [record.label, record.summary].filter((item): item is string => typeof item === "string").join(" ");
    }).join(" ")
    : "";
  const tagText = Array.isArray(candidate.tags) ? candidate.tags.filter((tag): tag is string => typeof tag === "string").join(" ") : "";
  return [candidate.title, candidate.body, tagText, choiceText].filter((item): item is string => typeof item === "string").join(" ");
}

function isMalformedCandidate(candidate: EventQualityCandidate, choices: EventQualityChoice[]) {
  if (typeof candidate.title !== "string" || candidate.title.trim().length === 0) return true;
  if (typeof candidate.body !== "string" || candidate.body.trim().length === 0) return true;
  if (!Array.isArray(candidate.tags) || candidate.tags.length === 0 || candidate.tags.some((tag) => typeof tag !== "string" || tag.trim().length === 0)) return true;
  if (choices.length < 2 || choices.length > 4) return true;
  return choices.some((choice) => {
    if (typeof choice.id !== "string" || choice.id.trim().length === 0) return true;
    if (typeof choice.label !== "string" || choice.label.trim().length === 0) return true;
    if (typeof choice.summary !== "string" || choice.summary.trim().length === 0) return true;
    if (!isPlainObject(choice.statDelta)) return true;
    if (Object.values(choice.statDelta).some((value) => typeof value !== "number" || !Number.isFinite(value))) return true;
    if (choice.relationshipDelta !== undefined && !isRelationshipDeltaArray(choice.relationshipDelta)) return true;
    return false;
  });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasForbiddenOrdinaryStatDrop(choice: EventQualityChoice) {
  if (!isPlainObject(choice.statDelta)) return false;
  const health = choice.statDelta.health;
  const mental = choice.statDelta.mental;
  return (typeof health === "number" && health < -1) || (typeof mental === "number" && mental < -1);
}

function hasNumericStatExposure(text: string) {
  numericStatPattern.lastIndex = 0;
  return numericStatPattern.test(text);
}

function hasDropoutAcademicConflict(academicStatus: string | null | undefined, text: string) {
  return academicStatus === "DROPPED_OUT" && dropoutCampusPattern.test(text) && !dropoutAllowedExceptionPattern.test(text);
}

function isRelationshipDeltaArray(value: unknown) {
  if (!Array.isArray(value)) return false;
  return value.every((item) => {
    if (!isPlainObject(item)) return false;
    if (typeof item.name !== "string" || item.name.trim().length === 0) return false;
    return typeof item.trust === "number" && Number.isFinite(item.trust);
  });
}

function isClosedThreadRepeat(text: string, lifecycle: ThreadLifecycle) {
  if (!invitationPattern.test(text)) return false;
  return lifecycle.closedThreads.some((threadId) => {
    const thread = lifecycle.threads[threadId];
    return thread.keywords.some((keyword) => keyword.length >= 2 && text.includes(keyword));
  });
}

function isLifecycleClosureConsequence(text: string, lifecycle: ThreadLifecycle) {
  if (!closureConsequencePattern.test(text)) return false;
  return lifecycle.lowParticipationThreads.some((threadId) => {
    const thread = lifecycle.threads[threadId];
    return thread.keywords.length === 0 || thread.keywords.some((keyword) => text.includes(keyword));
  });
}

function detectContinuityExemptions(input: EvaluateEventQualityInput, choices: EventQualityChoice[], text: string) {
  const exemptions: string[] = [];
  const recentText = recentContextText(input);
  if (jobProcessPattern.test(text) && jobProcessPattern.test(recentText)) {
    exemptions.push("job_application");
  }
  if (specProgressPattern.test(text) && specProgressPattern.test(recentText)) {
    exemptions.push("spec_progression");
  }
  if (choices.some((choice) => Array.isArray(choice.relationshipDelta) && choice.relationshipDelta.some((delta) => isPlainObject(delta) && typeof delta.trust === "number" && delta.trust !== 0))) {
    exemptions.push("relationship_shift");
  }
  const previousChoiceSummary = input.context?.previousChoiceSummary;
  if (previousChoiceSummary && hasSharedMeaningfulToken(text, previousChoiceSummary)) {
    exemptions.push("previous_choice_followup");
  }
  return exemptions;
}

function scoreDiversity(input: EvaluateEventQualityInput, continuityExemptions: string[]) {
  if (continuityExemptions.length > 0) return 100;
  const candidateTags = Array.isArray(input.candidate.tags)
    ? input.candidate.tags.filter((tag): tag is string => typeof tag === "string")
    : [];
  const recentEvents = input.context?.recentEvents?.slice(0, EVENT_QUALITY_DEFAULTS.recentEventLookback) ?? [];
  const candidateText = eventText(input.candidate);
  const candidateActivities = activityKeywords(candidateText);
  let penalty = 0;

  for (const tag of candidateTags) {
    const recentCount = recentEvents.filter((event) => event.tags?.includes(tag)).length;
    penalty += recentCount * 8;
    const strongCount = recentEvents
      .slice(0, EVENT_QUALITY_DEFAULTS.strongRepeatLookback)
      .filter((event) => event.tags?.includes(tag)).length;
    if (strongCount >= 2) penalty += 10;
  }

  for (const activity of candidateActivities) {
    const recentCount = recentEvents.filter((event) => activityKeywords(recentEventText(event)).includes(activity)).length;
    penalty += recentCount * 12;
    const strongCount = recentEvents
      .slice(0, EVENT_QUALITY_DEFAULTS.strongRepeatLookback)
      .filter((event) => activityKeywords(recentEventText(event)).includes(activity)).length;
    if (strongCount >= 2) penalty += 10;
  }

  if (recentEvents.slice(0, EVENT_QUALITY_DEFAULTS.strongRepeatLookback).some((event) => sameProposalPattern(candidateText, recentEventText(event)))) {
    penalty += 25;
  }

  return Math.max(0, 100 - penalty);
}

function recentContextText(input: EvaluateEventQualityInput) {
  return [
    ...(input.context?.recentSummaries ?? []),
    ...(input.context?.recentEvents ?? []).map(recentEventText),
  ].join(" ");
}

function recentEventText(event: RecentEvent) {
  return [event.title, event.body, event.summary, ...(event.tags ?? []), ...(event.people ?? [])]
    .filter((item): item is string => typeof item === "string")
    .join(" ");
}

function activityKeywords(text: string) {
  const keywords = [
    "도서관",
    "강의",
    "수업",
    "과제",
    "스터디",
    "공모전",
    "대회",
    "동아리",
    "면접",
    "서류",
    "회사",
    "알바",
    "가족",
    "팀",
  ];
  return keywords.filter((keyword) => text.includes(keyword));
}

function sameProposalPattern(candidateText: string, recentText: string) {
  if (!invitationPattern.test(candidateText) || !invitationPattern.test(recentText)) return false;
  const candidateTokens = keywordsForText(candidateText);
  const recentTokens = keywordsForText(recentText);
  return candidateTokens.some((token) => token.length >= 3 && recentTokens.includes(token));
}

function hasSharedMeaningfulToken(left: string, right: string) {
  const rightTokens = new Set(keywordsForText(right).filter((token) => token.length >= 3));
  return keywordsForText(left).some((token) => rightTokens.has(token));
}
