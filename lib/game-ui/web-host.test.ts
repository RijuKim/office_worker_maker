import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createWebGameHost } from "./web-host";

describe("web game host adapter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exposes browser defaults, cookie bootstrap, and same-origin share routing", async () => {
    const host = createWebGameHost({
      location: "https://example.com/share/ending-42?from=clipboard",
    });

    expect(host.kind).toBe("web");
    expect(host.capabilities).toEqual({
      kind: "web",
      accountSurface: { available: true },
      audio: true,
      haptics: true,
    });
    expect(host.accountSurface).toEqual({ available: true, label: "계정" });
    expect(host.safeArea.get()).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
    expect(host.routing.initialIntent).toEqual({ kind: "share", recordId: "ending-42" });
    expect(host.api.baseUrl).toBe("https://example.com");
    expect(host.api.headers({ kind: "cookie", credentials: "include", headers: {} })).toEqual({});

    await expect(host.session.bootstrap()).resolves.toEqual({
      ok: true,
      credential: {
        kind: "cookie",
        credentials: "include",
        headers: {},
      },
    });

    await expect(host.sharing.createEndingShareLink("record-99")).resolves.toBe("https://example.com/share/record-99");
  });

  it("copies clipboard text with the browser clipboard primitive and fails cleanly when unavailable", async () => {
    const writeText = vi.fn(async () => undefined);
    const host = createWebGameHost({
      location: "https://example.com/play",
      clipboard: { writeText },
    });

    await expect(host.clipboard.copy("https://example.com/share/record-1")).resolves.toBeUndefined();
    expect(writeText).toHaveBeenCalledOnce();
    expect(writeText).toHaveBeenCalledWith("https://example.com/share/record-1");

    const missingClipboardHost = createWebGameHost({ location: "https://example.com/play" });
    await expect(missingClipboardHost.clipboard.copy("x")).rejects.toThrow("Clipboard API is unavailable.");
  });

  it("plays cues, background audio, and haptics without blocking when the browser primitives are present", async () => {
    const oscillator = {
      frequency: { setValueAtTime: vi.fn() },
      type: "square" as OscillatorType,
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
    const gainNode = {
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    };
    const resume = vi.fn(async () => undefined);
    const context = {
      state: "suspended",
      currentTime: 123,
      destination: {},
      createOscillator: vi.fn(() => oscillator),
      createGain: vi.fn(() => gainNode),
      resume,
    } as unknown as AudioContext;
    const play = vi.fn(async () => undefined);
    const pause = vi.fn(() => undefined);
    const audioElement = {
      loop: false,
      volume: 1,
      currentTime: 0,
      play,
      pause,
    } as unknown as HTMLAudioElement;
    const vibrate = vi.fn();
    const originalVibrate = navigator.vibrate;
    Object.defineProperty(navigator, "vibrate", {
      configurable: true,
      value: vibrate,
    });

    const host = createWebGameHost({
      location: "https://example.com/play",
      audioContextFactory: () => context,
      audioElementFactory: () => audioElement,
    });

    await expect(host.audio?.playCue("success")).resolves.toBeUndefined();
    expect(resume).toHaveBeenCalledOnce();
    expect(context.createOscillator).toHaveBeenCalledOnce();
    expect(context.createGain).toHaveBeenCalledOnce();
    expect(oscillator.frequency.setValueAtTime).toHaveBeenCalledWith(740, 123);
    expect(gainNode.gain.exponentialRampToValueAtTime).toHaveBeenCalled();

    await expect(host.audio?.startBackground()).resolves.toBeUndefined();
    expect(play).toHaveBeenCalledOnce();
    expect(audioElement.loop).toBe(true);
    expect(audioElement.volume).toBe(0.36);

    host.audio?.stopBackground();
    expect(pause).toHaveBeenCalledOnce();
    expect(audioElement.currentTime).toBe(0);

    host.haptics?.vibrate([12, 24]);
    expect(vibrate).toHaveBeenCalledWith([12, 24]);

    Object.defineProperty(navigator, "vibrate", {
      configurable: true,
      value: originalVibrate,
    });
  });
});

