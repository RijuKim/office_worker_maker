import { logger } from "@/lib/server/logger";
import type { EventQualityVerdict } from "@/lib/game/event-quality";

export type EventQualityLogPhase =
  | "initial_ai"
  | "retry_ai"
  | "static_fallback"
  | "ending"
  | "choice_result";

export type EventQualityLogPayload = {
  characterRunId: string;
  eventId?: string | null;
  phase: EventQualityLogPhase;
  source: string;
  verdict: EventQualityVerdict;
  reasons: string[];
  diversityScore: number;
  continuityExemptions: string[];
  retryUsed: boolean;
  fallbackUsed: boolean;
  selectedFallbackTitle?: string | null;
  durationMs: number;
  createdAt: string;
};

export function recordEventQualityLog(payload: EventQualityLogPayload) {
  logger.info("event_quality_verdict", payload);
}
