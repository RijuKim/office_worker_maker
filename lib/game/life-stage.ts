export type RelationshipLifeState =
  | "single"
  | "dating"
  | "cohabitation"
  | "married"
  | "divorced"
  | "widowed";

export type ParentingStage = "none" | "expecting" | "newborn" | "toddler" | "school_age";

export type ParentingState = {
  hasChildren: boolean;
  childCount: number;
  parentingStage: ParentingStage;
};

export type LifeStageId =
  | "college_early"
  | "college_mid"
  | "college_late"
  | "leave"
  | "dropout"
  | "post_graduation";

export type AcademicStatus = "ENROLLED" | "LEAVE" | "DROPPED_OUT" | "GRADUATED";
export type GradeYear = 1 | 2 | 3 | 4;
export type Semester = 1 | 2;

export const CORE_EVENTS_PER_SEMESTER = 5;

export type AcademicTerm = {
  gradeYear: GradeYear;
  semester: Semester;
  label: string;
};

export type AcademicPlan = {
  major: string | null;
  majorChanged: boolean;
  doubleMajor: string | null;
  minor: string | null;
  interdisciplinaryTrack: string | null;
  retakePressure: boolean;
  scholarshipWarning: boolean;
};

export type GraduationState =
  | "normal"
  | "requirements_pending"
  | "extra_semester"
  | "delayed"
  | "gate_ready"
  | "graduated";

export type DestinationCandidateStatus = "introduced" | "applied" | "gate_passed" | "gate_failed";
export type DestinationCandidateKind =
  | "overseas"
  | "campus"
  | "lab"
  | "graduate_school"
  | "company"
  | "public_sector"
  | "professional_exam"
  | "startup"
  | "self_employment";

export type ProcessStage =
  | "initial"
  | "screening"
  | "interview"
  | "result"
  | "accepted"
  | "rejected";

export type DestinationCandidate = {
  id: string;
  kind: DestinationCandidateKind;
  name: string;
  introducedBy: string;
  status: DestinationCandidateStatus;
  processStage?: ProcessStage;
};

const RELATIONSHIP_LIFE_STATES = new Set<RelationshipLifeState>([
  "single", "dating", "cohabitation", "married", "divorced", "widowed",
]);

const PARENTING_STAGES = new Set<ParentingStage>([
  "none", "expecting", "newborn", "toddler", "school_age",
]);

export function deriveRelationshipLifeState(eventFlags: unknown): {
  relationshipLife: RelationshipLifeState;
  parenting: ParentingState;
} {
  const flags = asRecord(eventFlags);
  const rawLife = asRecord(flags.relationshipLife);
  const rawParenting = asRecord(flags.parenting);

  const relationshipLife: RelationshipLifeState =
    typeof rawLife.state === "string" && RELATIONSHIP_LIFE_STATES.has(rawLife.state as RelationshipLifeState)
      ? (rawLife.state as RelationshipLifeState)
      : "single";

  const parentingStage: ParentingStage =
    typeof rawParenting.stage === "string" && PARENTING_STAGES.has(rawParenting.stage as ParentingStage)
      ? (rawParenting.stage as ParentingStage)
      : "none";

  return {
    relationshipLife,
    parenting: {
      hasChildren: rawParenting.hasChildren === true || parentingStage !== "none",
      childCount: typeof rawParenting.childCount === "number" && Number.isFinite(rawParenting.childCount)
        ? Math.max(0, Math.min(10, Math.floor(rawParenting.childCount)))
        : 0,
      parentingStage,
    },
  };
}

export function getRelationshipEndingType(
  relationshipLife: RelationshipLifeState,
  stats: Record<string, number>,
  relationships: { name: string; trust: number }[],
): string | null {
  if (relationshipLife === "married") {
    const hasHighTrust = relationships.some((rel) => rel.trust >= 70);
    if (hasHighTrust && (stats.health ?? 5) >= 4 && (stats.mental ?? 5) >= 4) {
      return "결혼과 가정의 삶";
    }
    return "결혼 생활의 현실";
  }

  if (relationshipLife === "cohabitation") {
    return "동거와 생활의 균형";
  }

  if (relationshipLife === "divorced") {
    return "이별 이후의 재정비";
  }

  if (relationshipLife === "widowed") {
    return "상실 이후의 시간";
  }

  if (relationshipLife === "dating") {
    return "연애와 미래의 불확실성";
  }

  return null;
}

export function getParentingEndingType(parenting: ParentingState): string | null {
  if (!parenting.hasChildren) return null;
  if (parenting.childCount === 0) return null;

  if (parenting.parentingStage === "newborn" || parenting.parentingStage === "expecting") {
    return "새로운 가족의 시작";
  }
  if (parenting.parentingStage === "toddler") {
    return "아이와 함께 자라는 시간";
  }
  if (parenting.parentingStage === "school_age") {
    return "자녀와 함께하는 일상";
  }

  return "아이와 함께하는 삶";
}

export function advanceProcessStage(
  candidate: DestinationCandidate,
  passed: boolean,
): DestinationCandidate {
  const stageOrder: ProcessStage[] = ["initial", "screening", "interview", "result"];
  const currentIndex = candidate.processStage
    ? stageOrder.indexOf(candidate.processStage)
    : -1;

  if (passed) {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= stageOrder.length) {
      return { ...candidate, processStage: "accepted", status: "gate_passed" };
    }
    return { ...candidate, processStage: stageOrder[nextIndex] };
  }

  return { ...candidate, processStage: "rejected", status: "gate_failed" };
}

export function getProcessStageLabel(stage?: ProcessStage): string {
  switch (stage) {
    case "initial": return "지원 준비";
    case "screening": return "서류 심사";
    case "interview": return "면접 전형";
    case "result": return "최종 결과";
    case "accepted": return "합격";
    case "rejected": return "불합격";
    default: return "지원 전";
  }
}

export type LifeStageState = {
  lifeStage: LifeStageId;
  term: AcademicTerm;
  academicPlan: AcademicPlan;
  graduation: GraduationState;
  destinationCandidates: DestinationCandidate[];
  stageEventCount: number;
};

export type LifeStageDerivationInput = {
  eventFlags?: unknown;
  currentGradeYear?: number | null;
  academicStatus?: string | null;
  coreEventCount?: number | null;
  major?: string | null;
};

export type LifeStageTransitionInput = LifeStageDerivationInput & {
  stats?: Partial<Record<"academic" | "practical" | "health" | "mental" | "reputation", number>>;
  burnoutRisk?: number | null;
};

export type LifeStageTransitionReason =
  | "dropout_threshold"
  | "leave_threshold"
  | "semester_advanced"
  | "extra_semester_required"
  | "graduation_gate_ready"
  | "no_transition";

export type LifeStageTransitionResult = {
  state: LifeStageState;
  flagDelta: LifeStageFlagDelta;
  reasons: LifeStageTransitionReason[];
};

export type LifeStageFlagDelta = {
  lifeStage: { id: LifeStageId };
  academicTerm: AcademicTerm;
  academicPlan: AcademicPlan;
  graduation: { state: GraduationState };
  destinationCandidates: DestinationCandidate[];
  stageEventCount: number;
  lifeStageTransition: {
    reasons: LifeStageTransitionReason[];
    atCoreEventCount: number;
  };
};

const LIFE_STAGE_IDS = new Set<LifeStageId>([
  "college_early",
  "college_mid",
  "college_late",
  "leave",
  "dropout",
  "post_graduation",
]);

const GRADUATION_STATES = new Set<GraduationState>([
  "normal",
  "requirements_pending",
  "extra_semester",
  "delayed",
  "gate_ready",
  "graduated",
]);

const DESTINATION_KINDS = new Set<DestinationCandidateKind>([
  "overseas",
  "campus",
  "lab",
  "graduate_school",
  "company",
  "public_sector",
  "professional_exam",
  "startup",
  "self_employment",
]);

const DESTINATION_STATUSES = new Set<DestinationCandidateStatus>([
  "introduced",
  "applied",
  "gate_passed",
  "gate_failed",
]);

const PROCESS_STAGES = new Set<ProcessStage>([
  "initial",
  "screening",
  "interview",
  "result",
  "accepted",
  "rejected",
]);

const DEFAULT_ACADEMIC_PLAN: AcademicPlan = {
  major: null,
  majorChanged: false,
  doubleMajor: null,
  minor: null,
  interdisciplinaryTrack: null,
  retakePressure: false,
  scholarshipWarning: false,
};

export function deriveLifeStageState(input: LifeStageDerivationInput): LifeStageState {
  const flags = asRecord(input.eventFlags);
  const fallbackTerm = deriveFallbackTerm(input.currentGradeYear, input.coreEventCount);
  const fallbackStage = deriveLifeStageFromStatus(input.academicStatus, fallbackTerm.gradeYear);

  const term = sanitizeTerm(flags.academicTerm, fallbackTerm);
  const lifeStage = sanitizeLifeStage(flags.lifeStage, fallbackStage);
  const graduation = sanitizeGraduation(flags.graduation, input.academicStatus);
  const academicPlan = sanitizeAcademicPlan(flags.academicPlan, input.major);
  const destinationCandidates = sanitizeDestinationCandidates(flags.destinationCandidates);

  return {
    lifeStage,
    term,
    academicPlan,
    graduation,
    destinationCandidates,
    stageEventCount: sanitizeStageEventCount(flags.stageEventCount, input.coreEventCount),
  };
}

export function buildInitialLifeStageFlags(input: Pick<LifeStageDerivationInput, "currentGradeYear" | "major"> = {}): LifeStageFlagDelta {
  const state = deriveLifeStageState({
    currentGradeYear: input.currentGradeYear ?? 1,
    academicStatus: "ENROLLED",
    coreEventCount: 0,
    major: input.major,
    eventFlags: {},
  });

  return toLifeStageFlagDelta(state, ["no_transition"], 0);
}

export function applyLifeStageTransition(input: LifeStageTransitionInput): LifeStageTransitionResult {
  const current = deriveLifeStageState(input);
  const currentCoreEventCount = clampNonNegativeInteger(input.coreEventCount, 0);
  const riskDebt = readRiskDebt(input.eventFlags);

  // Dropout/leave are NOT forced here. They are detected and flagged,
  // but the actual transition happens only through the forced-check route
  // which presents a narrative event first. This function only handles
  // normal academic progression (semester advance, graduation gate, etc.)

  if (current.lifeStage === "leave" || current.lifeStage === "dropout" || current.lifeStage === "post_graduation") {
    return buildTransitionResult(current, ["no_transition"], currentCoreEventCount);
  }

  let next: LifeStageState = {
    ...current,
    stageEventCount: current.stageEventCount + 1,
  };
  const reasons: LifeStageTransitionReason[] = [];

  if (next.stageEventCount >= CORE_EVENTS_PER_SEMESTER && shouldRequireExtraSemester(next, input.stats, input.eventFlags)) {
    next = {
      ...next,
      graduation: "extra_semester",
      stageEventCount: 0,
    };
    reasons.push("extra_semester_required");
  } else if (shouldOpenGraduationGate(next)) {
    next = {
      ...next,
      graduation: "gate_ready",
    };
    reasons.push("graduation_gate_ready");
  } else if (next.stageEventCount >= CORE_EVENTS_PER_SEMESTER && next.graduation !== "gate_ready") {
    const advancedTerm = advanceTerm(next.term);
    next = {
      ...next,
      term: advancedTerm,
      lifeStage: deriveLifeStageFromStatus(input.academicStatus, advancedTerm.gradeYear),
      stageEventCount: 0,
    };
    reasons.push("semester_advanced");
  }

  if (reasons.length === 0) {
    reasons.push("no_transition");
  }

  return buildTransitionResult(next, reasons, currentCoreEventCount + 1);
}

export function toLifeStageFlagDelta(
  state: LifeStageState,
  reasons: LifeStageTransitionReason[] = ["no_transition"],
  atCoreEventCount = 0,
): LifeStageFlagDelta {
  return {
    lifeStage: { id: state.lifeStage },
    academicTerm: state.term,
    academicPlan: state.academicPlan,
    graduation: { state: state.graduation },
    destinationCandidates: state.destinationCandidates,
    stageEventCount: state.stageEventCount,
    lifeStageTransition: {
      reasons,
      atCoreEventCount,
    },
  };
}

export function advanceTerm(term: AcademicTerm): AcademicTerm {
  if (term.semester === 1) {
    return buildTerm(term.gradeYear, 2);
  }
  return buildTerm(clampGradeYear(term.gradeYear + 1), 1);
}

export function isGraduationGateReady(state: LifeStageState): boolean {
  return shouldOpenGraduationGate(state);
}

export function requiresExtraSemester(
  state: LifeStageState,
  stats?: LifeStageTransitionInput["stats"],
  eventFlags?: unknown,
): boolean {
  return shouldRequireExtraSemester(state, stats, eventFlags);
}

function buildTransitionResult(
  state: LifeStageState,
  reasons: LifeStageTransitionReason[],
  atCoreEventCount: number,
): LifeStageTransitionResult {
  return {
    state,
    reasons,
    flagDelta: toLifeStageFlagDelta(state, reasons, atCoreEventCount),
  };
}

function sanitizeLifeStage(raw: unknown, fallback: LifeStageId): LifeStageId {
  const candidate = typeof raw === "string" ? raw : asRecord(raw).id;
  return typeof candidate === "string" && LIFE_STAGE_IDS.has(candidate as LifeStageId)
    ? candidate as LifeStageId
    : fallback;
}

function sanitizeTerm(raw: unknown, fallback: AcademicTerm): AcademicTerm {
  const value = asRecord(raw);
  if (
    typeof value.gradeYear !== "number" ||
    typeof value.semester !== "number" ||
    !Number.isFinite(value.gradeYear) ||
    !Number.isFinite(value.semester) ||
    value.gradeYear < 1 ||
    value.gradeYear > 4 ||
    (value.semester !== 1 && value.semester !== 2)
  ) {
    return fallback;
  }
  return buildTerm(clampGradeYear(value.gradeYear), value.semester);
}

function sanitizeGraduation(raw: unknown, academicStatus?: string | null): GraduationState {
  const candidate = typeof raw === "string" ? raw : asRecord(raw).state;
  if (typeof candidate === "string" && GRADUATION_STATES.has(candidate as GraduationState)) {
    return candidate as GraduationState;
  }
  return academicStatus === "GRADUATED" ? "graduated" : "normal";
}

function sanitizeAcademicPlan(raw: unknown, major?: string | null): AcademicPlan {
  const value = asRecord(raw);
  return {
    major: sanitizeOptionalText(value.major, major ?? DEFAULT_ACADEMIC_PLAN.major),
    majorChanged: value.majorChanged === true,
    doubleMajor: sanitizeOptionalText(value.doubleMajor, null),
    minor: sanitizeOptionalText(value.minor, null),
    interdisciplinaryTrack: sanitizeOptionalText(value.interdisciplinaryTrack, null),
    retakePressure: value.retakePressure === true,
    scholarshipWarning: value.scholarshipWarning === true,
  };
}

function sanitizeDestinationCandidates(raw: unknown): DestinationCandidate[] {
  if (!Array.isArray(raw)) return [];

  const seen = new Set<string>();
  const candidates: DestinationCandidate[] = [];

  for (const item of raw) {
    const value = asRecord(item);
    if (
      typeof value.id !== "string" ||
      typeof value.kind !== "string" ||
      typeof value.name !== "string" ||
      typeof value.introducedBy !== "string" ||
      typeof value.status !== "string" ||
      !DESTINATION_KINDS.has(value.kind as DestinationCandidateKind) ||
      !DESTINATION_STATUSES.has(value.status as DestinationCandidateStatus)
    ) {
      continue;
    }

    const id = value.id.trim();
    const name = value.name.trim();
    const introducedBy = value.introducedBy.trim();
    if (!id || !name || !introducedBy || seen.has(id)) continue;

    const processStage = typeof value.processStage === "string" && PROCESS_STAGES.has(value.processStage as ProcessStage)
      ? (value.processStage as ProcessStage)
      : undefined;

    seen.add(id);
    candidates.push({
      id,
      kind: value.kind as DestinationCandidateKind,
      name,
      introducedBy,
      status: value.status as DestinationCandidateStatus,
      ...(processStage ? { processStage } : {}),
    });
  }

  return candidates.slice(0, 12);
}

function sanitizeStageEventCount(raw: unknown, coreEventCount?: number | null): number {
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0 && raw <= CORE_EVENTS_PER_SEMESTER) {
    return Math.floor(raw);
  }
  return clampNonNegativeInteger(coreEventCount, 0) % CORE_EVENTS_PER_SEMESTER;
}

function deriveFallbackTerm(currentGradeYear?: number | null, coreEventCount?: number | null): AcademicTerm {
  const events = clampNonNegativeInteger(coreEventCount, 0);
  const grade = clampGradeYear(currentGradeYear ?? Math.floor(events / (CORE_EVENTS_PER_SEMESTER * 2)) + 1);
  const semester = Math.floor(events / CORE_EVENTS_PER_SEMESTER) % 2 === 0 ? 1 : 2;
  return buildTerm(grade, semester);
}

function deriveLifeStageFromStatus(academicStatus: string | null | undefined, gradeYear: GradeYear): LifeStageId {
  if (academicStatus === "LEAVE") return "leave";
  if (academicStatus === "DROPPED_OUT") return "dropout";
  if (academicStatus === "GRADUATED") return "post_graduation";
  if (gradeYear >= 4) return "college_late";
  if (gradeYear >= 2) return "college_mid";
  return "college_early";
}

function shouldOpenGraduationGate(state: LifeStageState): boolean {
  return state.lifeStage === "college_late" &&
    state.term.gradeYear === 4 &&
    state.stageEventCount >= CORE_EVENTS_PER_SEMESTER &&
    state.graduation === "normal";
}

function shouldRequireExtraSemester(
  state: LifeStageState,
  stats?: LifeStageTransitionInput["stats"],
  eventFlags?: unknown,
): boolean {
  if (state.lifeStage !== "college_late" || state.term.gradeYear !== 4) return false;
  if (state.graduation === "extra_semester" || state.graduation === "delayed" || state.graduation === "graduated") {
    return false;
  }

  const flags = asRecord(eventFlags);
  const graduationFlags = asRecord(flags.graduation);
  const academicPlanFlags = asRecord(flags.academicPlan);
  const hasRequirementBlocker =
    graduationFlags.requirementsPending === true ||
    graduationFlags.thesisFailed === true ||
    graduationFlags.capstoneFailed === true ||
    academicPlanFlags.requirementBlocker === true ||
    state.academicPlan.retakePressure === true ||
    state.academicPlan.scholarshipWarning === true;

  return (stats?.academic !== undefined && stats.academic <= 4) ||
    (stats?.practical !== undefined && stats.practical <= 4) ||
    hasRequirementBlocker;
}

export function getDropoutReason(
  stats: LifeStageTransitionInput["stats"] | undefined,
  riskDebt: number,
): boolean {
  return (stats?.reputation !== undefined && stats.reputation <= 1) ||
    (stats?.health !== undefined && stats.health <= 1) ||
    (stats?.mental !== undefined && stats.mental <= 1) ||
    riskDebt >= 8;
}

export function getLeaveReason(
  stats: LifeStageTransitionInput["stats"] | undefined,
  burnoutRisk?: number | null,
): boolean {
  return (stats?.health !== undefined && stats.health <= 2) ||
    (stats?.mental !== undefined && stats.mental <= 2) ||
    (burnoutRisk !== undefined && burnoutRisk !== null && burnoutRisk >= 80);
}

export function readRiskDebt(eventFlags: unknown): number {
  const flags = asRecord(eventFlags);
  return typeof flags.riskDebt === "number" && Number.isFinite(flags.riskDebt) ? Math.floor(flags.riskDebt) : 0;
}

function buildTerm(gradeYear: GradeYear, semester: Semester): AcademicTerm {
  return {
    gradeYear,
    semester,
    label: `${gradeYear}학년 ${semester}학기`,
  };
}

function clampGradeYear(value: number): GradeYear {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(4, Math.floor(value))) as GradeYear;
}

function clampNonNegativeInteger(value: number | null | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.floor(value));
}

function sanitizeOptionalText(raw: unknown, fallback: string | null): string | null {
  if (typeof raw !== "string") return fallback;
  const value = raw.trim();
  return value.length > 0 && value.length <= 80 ? value : fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
