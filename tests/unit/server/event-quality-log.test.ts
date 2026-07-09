import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EventQualityVerdict } from "@/lib/game/event-quality";

const info = vi.fn();

vi.mock("@/lib/server/logger", () => ({
  logger: { info },
}));

describe("recordEventQualityLog", () => {
  beforeEach(() => {
    info.mockClear();
  });

  it("emits a structured quality log through the server logger without persistence", async () => {
    const { recordEventQualityLog } = await import("@/lib/server/event-quality-log");
    const verdict: EventQualityVerdict = {
      status: "fail",
      hardFailure: true,
      reasons: ["direct_result_choice"],
      diversityScore: 100,
      continuityExemptions: [],
      retryRecommended: true,
      fallbackRecommended: true,
    };

    recordEventQualityLog({
      characterRunId: "run-1",
      eventId: null,
      phase: "initial_ai",
      source: "AI",
      verdict,
      reasons: verdict.reasons,
      diversityScore: verdict.diversityScore,
      continuityExemptions: verdict.continuityExemptions,
      retryUsed: false,
      fallbackUsed: false,
      selectedFallbackTitle: null,
      durationMs: 4,
      createdAt: "2026-07-09T00:00:00.000Z",
    });

    expect(info).toHaveBeenCalledWith("event_quality_verdict", expect.objectContaining({
      characterRunId: "run-1",
      phase: "initial_ai",
      source: "AI",
      reasons: ["direct_result_choice"],
    }));
  });
});
