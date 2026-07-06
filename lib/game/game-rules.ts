export const STAT_MIN = 0;
export const STAT_MAX = 100;
export const MAX_STAT_DELTA_PER_CHOICE = 15;
export const BURNOUT_THRESHOLD = 85;

export const TRUST_MIN = -100;
export const TRUST_MAX = 100;

export type StatDelta = Partial<Record<string, number>>;
export type RelationshipDelta = { name: string; trust: number };
export type FlagDelta = Record<string, unknown>;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function clampPublicStat(value: number): number {
  return clamp(value, STAT_MIN, STAT_MAX);
}

export function clampTrust(value: number): number {
  return clamp(value, TRUST_MIN, TRUST_MAX);
}

export function applyStatDeltas(
  currentStats: Record<string, number>,
  deltas: StatDelta,
): Record<string, number> {
  const result = { ...currentStats };

  for (const [stat, delta] of Object.entries(deltas)) {
    if (typeof delta !== "number") continue;
    const clampedDelta = clamp(delta, -MAX_STAT_DELTA_PER_CHOICE, MAX_STAT_DELTA_PER_CHOICE);
    const current = result[stat] ?? 50;
    result[stat] = clampPublicStat(current + clampedDelta);
  }

  return result;
}

export function applyRelationshipDeltas(
  currentRelationships: { name: string; trust: number }[],
  deltas: RelationshipDelta[],
): { name: string; trust: number }[] {
  return currentRelationships.map((rel) => {
    const delta = deltas.find((d) => d.name === rel.name);
    if (!delta) return rel;
    return { ...rel, trust: clampTrust(rel.trust + delta.trust) };
  });
}

export function applyFlagDeltas(
  currentFlags: Record<string, unknown>,
  deltas: FlagDelta,
): Record<string, unknown> {
  return { ...currentFlags, ...deltas };
}

export function checkForcedEvent(
  hiddenState: { burnoutRisk: number },
): { type: "burnout" } | null {
  if (hiddenState.burnoutRisk >= BURNOUT_THRESHOLD) {
    return { type: "burnout" };
  }
  return null;
}

export function validateChoiceIndex(choices: unknown[], index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < choices.length;
}

export function buildEventHistoryRecord(
  characterRunId: string,
  eventId: string,
  choiceId: string | null,
  summary: string,
  statDelta: StatDelta,
  relationshipDelta: RelationshipDelta[],
  flagDelta: FlagDelta,
) {
  return {
    characterRunId,
    eventId,
    choiceId,
    summary,
    statDelta,
    relationshipDelta,
    flagDelta,
  };
}
