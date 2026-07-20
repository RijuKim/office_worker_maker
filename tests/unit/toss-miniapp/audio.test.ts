import { afterEach, describe, expect, it, vi } from "vitest";

type FailurePoint = "constructor" | "resume" | "oscillator" | "gain" | "start";

function installAudioContext(failure: FailurePoint) {
  class TestAudioContext {
    state = failure === "resume" ? "suspended" : "running";
    currentTime = 0;
    destination = {};
    constructor() { if (failure === "constructor") throw new Error("no audio context"); }
    resume() { return failure === "resume" ? Promise.reject(new Error("resume denied")) : Promise.resolve(); }
    createOscillator() {
      if (failure === "oscillator") throw new Error("oscillator unavailable");
      return {
        frequency: { setValueAtTime: vi.fn() }, type: "sine", connect: vi.fn(),
        start: () => { if (failure === "start") throw new Error("start denied"); }, stop: vi.fn(),
      };
    }
    createGain() {
      if (failure === "gain") throw new Error("gain unavailable");
      return { gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn() };
    }
  }
  vi.stubGlobal("AudioContext", TestAudioContext);
}

describe("optional Toss audio and haptics", () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each<FailurePoint>(["constructor", "resume", "oscillator", "gain", "start"])("keeps playCue non-throwing when %s fails", async (failure) => {
    vi.resetModules();
    installAudioContext(failure);
    const { playCue } = await import("../../../apps/toss-miniapp/src/audio");
    expect(() => playCue("tap", true)).not.toThrow();
    await Promise.resolve();
  });

  it("absorbs synchronous and rejected background audio failures", async () => {
    vi.resetModules();
    vi.stubGlobal("Audio", class { constructor() { throw new Error("missing Audio"); } });
    let audio = await import("../../../apps/toss-miniapp/src/audio");
    await expect(audio.startBgm(true)).resolves.toBeUndefined();
    expect(() => audio.stopBgm()).not.toThrow();

    vi.resetModules();
    vi.stubGlobal("Audio", class {
      loop = false; volume = 0; currentTime = 1;
      play() { return Promise.reject(new Error("autoplay denied")); }
      pause() { throw new Error("pause denied"); }
    });
    audio = await import("../../../apps/toss-miniapp/src/audio");
    await expect(audio.startBgm(true)).resolves.toBeUndefined();
    expect(() => audio.stopBgm()).not.toThrow();
  });

  it("absorbs missing and throwing navigator.vibrate", async () => {
    vi.resetModules();
    const audio = await import("../../../apps/toss-miniapp/src/audio");
    expect(() => audio.vibrate(true)).not.toThrow();
    Object.defineProperty(navigator, "vibrate", { configurable: true, value: () => { throw new Error("denied"); } });
    expect(() => audio.vibrate(true)).not.toThrow();
    Reflect.deleteProperty(navigator, "vibrate");
  });
});
