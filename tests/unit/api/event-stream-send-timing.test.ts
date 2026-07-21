import { describe, expect, it, vi } from "vitest";

import { createSseSender } from "@/app/api/characters/[id]/events/next/stream/handler";

describe("SSE enqueue-boundary timing", () => {
  it("samples immediately before enqueue and observes only after delivery", () => {
    const calls: string[] = [];
    const observations: Array<{ event: string; elapsedMs: number }> = [];
    const timestamps = [1_180, 1_240];
    const now = vi.fn(() => {
      calls.push("clock");
      return timestamps.shift()!;
    });
    const controller = {
      enqueue: vi.fn<(chunk: Uint8Array) => void>(() => { calls.push("enqueue"); }),
    };
    const send = createSseSender({
      controller,
      encoder: new TextEncoder(),
      generationStartedAt: 1_000,
      now,
      observe: (observation) => {
        calls.push("observe");
        observations.push(observation);
      },
    });

    send("body_delta", { text: "committed narrative" });
    send("event", { event: { id: "winner" } });

    expect(calls).toEqual(["clock", "enqueue", "observe", "clock", "enqueue", "observe"]);
    expect(observations).toEqual([
      { event: "body_delta", elapsedMs: 180 },
      { event: "event", elapsedMs: 240 },
    ]);
    expect(controller.enqueue).toHaveBeenCalledTimes(2);
    expect(ArrayBuffer.isView(controller.enqueue.mock.calls[1][0])).toBe(true);
  });

  it("delivers even when the observer throws", () => {
    const calls: string[] = [];
    const controller = {
      enqueue: vi.fn(() => { calls.push("enqueue"); }),
    };
    const send = createSseSender({
      controller,
      encoder: new TextEncoder(),
      generationStartedAt: 100,
      now: () => { calls.push("clock"); return 125; },
      observe: () => { calls.push("observe"); throw new Error("telemetry failed"); },
    });

    expect(() => send("event", { event: { id: "winner" } })).not.toThrow();
    expect(calls).toEqual(["clock", "enqueue", "observe"]);
    expect(controller.enqueue).toHaveBeenCalledOnce();
  });

  it("does not await an arbitrarily slow observer before delivering", () => {
    const calls: string[] = [];
    let release!: () => void;
    const heldObserver = new Promise<void>((resolve) => { release = resolve; });
    const controller = {
      enqueue: vi.fn(() => { calls.push("enqueue"); }),
    };
    const send = createSseSender({
      controller,
      encoder: new TextEncoder(),
      generationStartedAt: 100,
      now: () => { calls.push("clock"); return 130; },
      observe: () => { calls.push("observe"); return heldObserver; },
    });

    send("event", { event: { id: "winner" } });

    expect(calls).toEqual(["clock", "enqueue", "observe"]);
    expect(controller.enqueue).toHaveBeenCalledOnce();
    release();
  });

  it("sinks an asynchronous observer rejection without changing delivery order", async () => {
    const calls: string[] = [];
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    const controller = {
      enqueue: vi.fn(() => { calls.push("enqueue"); }),
    };
    const send = createSseSender({
      controller,
      encoder: new TextEncoder(),
      generationStartedAt: 100,
      now: () => { calls.push("clock"); return 140; },
      observe: () => { calls.push("observe"); return Promise.reject(new Error("async telemetry failed")); },
    });

    send("event", { event: { id: "winner" } });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(calls).toEqual(["clock", "enqueue", "observe"]);
    expect(controller.enqueue).toHaveBeenCalledOnce();
    expect(unhandled).not.toHaveBeenCalled();
    process.off("unhandledRejection", unhandled);
  });
});
