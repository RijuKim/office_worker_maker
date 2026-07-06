import { describe, expect, it } from "vitest";

import { buildBurnoutEvent, pickRandomStaticEvent, selectNextEvent, STATIC_EVENTS } from "@/lib/game/event-engine";

describe("STATIC_EVENTS", () => {
  it("has events with valid structure", () => {
    for (const event of STATIC_EVENTS) {
      expect(event.title).toBeTruthy();
      expect(event.body).toBeTruthy();
      expect(event.choices.length).toBeGreaterThanOrEqual(2);
      expect(event.choices.length).toBeLessThanOrEqual(4);
      expect(event.tags.length).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("pickRandomStaticEvent", () => {
  it("returns a valid event", () => {
    const event = pickRandomStaticEvent();
    expect(event.title).toBeTruthy();
    expect(event.choices.length).toBeGreaterThanOrEqual(2);
  });

  it("can exclude specific titles", () => {
    const event = pickRandomStaticEvent(["중간고사 시즌"]);
    expect(event).toBeDefined();
    expect(event.title).not.toBe("중간고사 시즌");
  });
});

describe("buildBurnoutEvent", () => {
  it("builds a forced burnout event", () => {
    const event = buildBurnoutEvent();
    expect(event.title).toContain("번아웃");
    expect(event.source).toBe("FORCED");
    expect(event.choices.length).toBeGreaterThanOrEqual(2);
    expect(event.choices.every((c) => "statDelta" in c)).toBe(true);
  });
});

describe("selectNextEvent", () => {
  it("returns forced event when burnout >= 85", () => {
    const result = selectNextEvent({ burnoutRisk: 90 }, []);
    expect(result.type).toBe("forced");
    expect(result.event.title).toContain("번아웃");
  });

  it("returns normal event when burnout < 85", () => {
    const result = selectNextEvent({ burnoutRisk: 30 }, []);
    expect(result.type).toBe("normal");
    expect(result.event.source).toBe("STATIC");
  });
});