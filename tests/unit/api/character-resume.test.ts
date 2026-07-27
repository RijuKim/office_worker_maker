import { describe, expect, it } from "vitest";

import { resolveCurrentEvent } from "@/lib/server/current-event";

describe("character resume event recovery", () => {
  const older = { id: "event-old", createdAt: new Date("2026-07-27T08:00:00Z") };
  const newer = { id: "event-new", createdAt: new Date("2026-07-27T09:00:00Z") };

  it("keeps the event referenced by currentEventId", () => {
    expect(resolveCurrentEvent([newer, older], older.id)).toBe(older);
  });

  it("recovers the latest active event when the pointer is missing", () => {
    expect(resolveCurrentEvent([older, newer], null)).toBe(newer);
  });

  it("recovers the latest active event when the pointer is stale", () => {
    expect(resolveCurrentEvent([older, newer], "deleted-event")).toBe(newer);
  });

  it("returns null when no active event exists", () => {
    expect(resolveCurrentEvent([], "deleted-event")).toBeNull();
  });
});
