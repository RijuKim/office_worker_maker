export const STAT_MIN = 1;
export const STAT_MAX = 10;
export const MAX_STAT_DELTA_PER_CHOICE = 3;
export const MAX_HEALTH_LOSS_PER_CHOICE = 1;
export const MAX_MENTAL_LOSS_PER_CHOICE = 1;
export const BURNOUT_THRESHOLD = 80;

/**
 * Cumulative balance guard thresholds.
 * Prevents implausible early stat collapse from consecutive fixed-event costs.
 * The guard activates only during the early/mid college window (first 8 events)
 * and ensures health/mental cannot drop below the floor through ordinary
 * consecutive depletion. Meaningful risk and later failure paths are preserved.
 */
export const CUMULATIVE_GUARD_EVENT_LIMIT = 8;
export const CUMULATIVE_GUARD_FLOOR = 2;

export const TRUST_MIN = -100;
export const TRUST_MAX = 100;

export type StatDelta = Partial<Record<string, number>>;
export const RELATIONSHIP_STATUSES = ["acquaintance", "friend", "crush", "dating", "ex"] as const;
export type RelationshipStatus = typeof RELATIONSHIP_STATUSES[number];
export type RelationshipDelta = { name: string; trust: number; status?: RelationshipStatus };
export type FlagDelta = Record<string, unknown>;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function clampPublicStat(value: number, stat?: string): number {
  if (stat === "wealth") return value; // wealth is unbounded (원화 scale)
  return clamp(value, STAT_MIN, STAT_MAX);
}

export function clampTrust(value: number): number {
  return clamp(value, TRUST_MIN, TRUST_MAX);
}

export function applyStatDeltas(
  currentStats: Record<string, number>,
  deltas: StatDelta,
  options?: { coreEventCount?: number },
): Record<string, number> {
  const result = { ...currentStats };
  const normalizedDeltas = normalizeStatDeltas(deltas);

  for (const [stat, delta] of Object.entries(normalizedDeltas)) {
    if (typeof delta !== "number") continue;
    const current = result[stat] ?? 5;
    const clamped = stat === "wealth"
      ? Math.round(delta)
      : clamp(Math.round(delta), -MAX_STAT_DELTA_PER_CHOICE, MAX_STAT_DELTA_PER_CHOICE);
    result[stat] = clampPublicStat(current + clamped, stat);
  }

  return applyCumulativeBalanceGuard(result, options);
}

/**
 * Prevents implausible early stat collapse from consecutive fixed-event costs.
 * During the first CUMULATIVE_GUARD_EVENT_LIMIT events, health and mental
 * cannot drop below CUMULATIVE_GUARD_FLOOR. This preserves meaningful risk
 * (the floor is still low enough to trigger collapse warnings) while preventing
 * the five-consecutive-minus-one regression. After the guard window, normal
 * depletion rules apply, so late-game failure paths are unaffected.
 */
export function applyCumulativeBalanceGuard(
  stats: Record<string, number>,
  options?: { coreEventCount?: number },
): Record<string, number> {
  const count = options?.coreEventCount;
  if (count === undefined || count > CUMULATIVE_GUARD_EVENT_LIMIT) return stats;
  return {
    ...stats,
    health: Math.max(CUMULATIVE_GUARD_FLOOR, stats.health),
    mental: Math.max(CUMULATIVE_GUARD_FLOOR, stats.mental),
  };
}

export function normalizeStatDeltas(deltas: StatDelta): StatDelta {
  const normalized: StatDelta = {};

  for (const [stat, delta] of Object.entries(deltas)) {
    if (typeof delta !== "number") continue;
    if (stat === "health" && delta < -MAX_HEALTH_LOSS_PER_CHOICE) {
      normalized[stat] = -MAX_HEALTH_LOSS_PER_CHOICE;
    } else if (stat === "mental" && delta < -MAX_MENTAL_LOSS_PER_CHOICE) {
      normalized[stat] = -MAX_MENTAL_LOSS_PER_CHOICE;
    } else {
      normalized[stat] = delta;
    }
  }

  return normalized;
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
  stats?: { health: number; mental: number },
): { type: "burnout" } | { type: "health_crisis" } | null {
  if (stats && stats.health <= 2) {
    return { type: "health_crisis" };
  }
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
