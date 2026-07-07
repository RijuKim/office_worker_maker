import { deriveLifeStageState, type DestinationCandidate } from "@/lib/game/life-stage";

export type ConcreteResultInput = {
  destinationName?: unknown;
  jobRole?: unknown;
  salaryBand?: unknown;
};

export type ConcreteResultFields = {
  destinationName: string | null;
  jobRole: string | null;
  salaryBand: string | null;
};

export function gateConcreteResultFields(
  generated: ConcreteResultInput | null | undefined,
  hiddenState: unknown,
): ConcreteResultFields {
  const destinationName = sanitizeShortText(generated?.destinationName);
  const allowedCandidates = getPassedDestinationCandidates(hiddenState);
  const matchedDestination = destinationName
    ? allowedCandidates.find((candidate) => namesMatch(candidate.name, destinationName))
    : null;
  const hasPassedProcess = allowedCandidates.length > 0;

  return {
    destinationName: matchedDestination?.name ?? null,
    jobRole: hasPassedProcess ? sanitizeShortText(generated?.jobRole) : null,
    salaryBand: hasPassedProcess ? sanitizeShortText(generated?.salaryBand) : null,
  };
}

export function getPassedDestinationCandidates(hiddenState: unknown): DestinationCandidate[] {
  const state = typeof hiddenState === "object" && hiddenState !== null ? hiddenState as Record<string, unknown> : {};
  const eventFlags = typeof state.eventFlags === "object" && state.eventFlags !== null ? state.eventFlags : {};
  const lifeStage = deriveLifeStageState({ eventFlags });

  return lifeStage.destinationCandidates.filter((candidate) => candidate.status === "gate_passed");
}

function namesMatch(candidateName: string, generatedName: string) {
  return normalizeName(candidateName) === normalizeName(generatedName);
}

function normalizeName(value: string) {
  return value.replace(/\s+/g, "").trim().toLowerCase();
}

function sanitizeShortText(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= 80 ? trimmed : null;
}
