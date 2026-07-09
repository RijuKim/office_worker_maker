import type { EventSource } from "@prisma/client";

import {
  buildDropoutNextStepEvent,
  isEventAllowedForLifeStage,
  pickRandomStaticEvent,
  STATIC_EVENTS,
  type EventSelectionContext,
  type StaticEvent,
} from "@/lib/game/event-engine";
import {
  evaluateEventQuality,
  type EventQualityVerdict,
  type EvaluateEventQualityInput,
} from "@/lib/game/event-quality";

export type QualityCandidate = Pick<StaticEvent, "title" | "body" | "choices" | "tags"> & {
  source?: StaticEvent["source"] | "AI";
};

export type EventQualityRuntimeContext = {
  academicStatus?: string | null;
  lifeStage?: string | null;
  eventFlags?: Record<string, unknown> | null;
  recentSummaries?: string[];
  recentEvents?: EvaluateEventQualityInput["context"] extends infer Context
    ? Context extends { recentEvents?: infer RecentEvents } ? RecentEvents : never
    : never;
  previousChoiceSummary?: string | null;
};

export type QualityEvaluation = {
  verdict: EventQualityVerdict;
  durationMs: number;
};

export function evaluateCandidateEvent(
  source: EventSource | "AI" | "STATIC" | "FALLBACK" | "FORCED",
  candidate: QualityCandidate,
  context: EventQualityRuntimeContext,
): QualityEvaluation {
  const startedAt = Date.now();
  const verdict = evaluateEventQuality({
    source,
    candidate,
    context,
  });

  return {
    verdict,
    durationMs: Date.now() - startedAt,
  };
}

export function buildAiRetryGuidance(verdict: EventQualityVerdict) {
  const reasons = verdict.reasons.length > 0 ? verdict.reasons.join(", ") : "unknown";
  const diversity = `diversityScore=${verdict.diversityScore}`;
  const exemptions = verdict.continuityExemptions.length > 0
    ? `continuityExemptions=${verdict.continuityExemptions.join(", ")}`
    : "continuityExemptions=none";

  return [
    "[event-quality retry]",
    `previous candidate rejected: ${reasons}`,
    diversity,
    exemptions,
    "Generate a different valid event. Avoid direct pass/fail or forced-removal choice labels, raw stat-number phrases, closed proposal repeats, and stale repetition unless it clearly advances an active thread.",
  ].join(" ");
}

export function findValidatedStaticFallback(input: {
  preferredEvent: QualityCandidate;
  selectionContext: EventSelectionContext;
  excludedEventTitles: string[];
  qualityContext: EventQualityRuntimeContext;
}) {
  const candidates = buildStaticFallbackCandidates(input);

  for (const candidate of candidates) {
    if (!isEventAllowedForLifeStage(candidate, input.selectionContext)) continue;
    const evaluation = evaluateCandidateEvent("FALLBACK", candidate, input.qualityContext);
    if (evaluation.verdict.status === "pass") {
      return {
        event: {
          ...candidate,
          source: "FALLBACK" as const,
        },
        evaluation,
      };
    }
  }

  return null;
}

function buildStaticFallbackCandidates(input: {
  preferredEvent: QualityCandidate;
  selectionContext: EventSelectionContext;
  excludedEventTitles: string[];
  qualityContext: EventQualityRuntimeContext;
}) {
  const candidates: QualityCandidate[] = [];
  const pushCandidate = (candidate: QualityCandidate) => {
    if (!candidates.some((existing) => existing.title === candidate.title)) {
      candidates.push(candidate);
    }
  };

  if (input.qualityContext.academicStatus === "DROPPED_OUT") {
    pushCandidate(buildDropoutNextStepEvent());
  }

  pushCandidate(input.preferredEvent);
  pushCandidate(pickRandomStaticEvent(input.excludedEventTitles, input.selectionContext));

  for (const event of STATIC_EVENTS) {
    if (!input.excludedEventTitles.includes(event.title)) {
      pushCandidate(event);
    }
  }

  for (const event of STATIC_EVENTS) {
    pushCandidate(event);
  }

  return candidates;
}
