import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createSafeAreaInsets } from "@/lib/game-ui/types";
import {
  bootstrapTossSession,
  createTossEndingShareLink,
  createTossFeedbackPort,
  createTossSafeAreaPort,
  TOSS_SHARE_ICON_URL,
} from "../../../apps/toss-miniapp/src/toss-host";

const { tossShareLink } = vi.hoisted(() => ({
  tossShareLink: vi.fn(),
}));

vi.mock("@apps-in-toss/web-framework", async () => {
  const actual = await vi.importActual<typeof import("@apps-in-toss/web-framework")>("@apps-in-toss/web-framework");
  return {
    ...actual,
    getTossShareLink: tossShareLink,
  };
});

describe("Toss host adapter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each([
    ["missing key", async () => undefined, "anonymous-key-missing", "토스 앱을 최신 버전으로 업데이트해 주세요."],
    ["invalid category", async () => "INVALID_CATEGORY" as const, "anonymous-key-invalid-category", "비게임 미니앱 설정을 확인해 주세요."],
    ["sdk error", async () => "ERROR" as const, "anonymous-key-error", "토스 사용자 정보를 불러오지 못했습니다."],
    ["unexpected payload", async () => ({ type: "HASH" }) as never, "anonymous-key-error", "토스 사용자 정보를 확인하지 못했습니다."],
  ])("maps %s to a typed Korean failure", async (_label, getAnonymousKey, code, message) => {
    const createTossSession = vi.fn();

    await expect(bootstrapTossSession({
      getAnonymousKey,
      createTossSession,
    })).resolves.toEqual({
      ok: false,
      failure: {
        code,
        message,
        retryable: true,
      },
    });

    expect(createTossSession).not.toHaveBeenCalled();
  });

  it("exchanges a hash for a bearer credential and can retry after a failure", async () => {
    const getAnonymousKey = vi.fn()
      .mockResolvedValueOnce({ type: "HASH", hash: "anonymous-hash-1" })
      .mockResolvedValueOnce({ type: "HASH", hash: "anonymous-hash-2" });
    const createTossSession = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 500, data: { error: "fail" } })
      .mockResolvedValueOnce({ ok: true, status: 200, data: { token: "signed-token-2", expiresIn: 60 } });

    await expect(bootstrapTossSession({ getAnonymousKey, createTossSession })).resolves.toEqual({
      ok: false,
      failure: {
        code: "session-exchange-failed",
        message: "사용자 정보를 연결하지 못했습니다. 다시 시도해 주세요.",
        retryable: true,
      },
    });

    await expect(bootstrapTossSession({ getAnonymousKey, createTossSession })).resolves.toEqual({
      ok: true,
      credential: {
        kind: "bearer",
        credentials: "omit",
        token: "signed-token-2",
        headers: {
          Authorization: "Bearer signed-token-2",
        },
      },
    });

    expect(getAnonymousKey).toHaveBeenCalledTimes(2);
    expect(createTossSession).toHaveBeenCalledWith("anonymous-hash-1");
    expect(createTossSession).toHaveBeenCalledWith("anonymous-hash-2");
  });

  it("treats thrown anonymous-key failures as retryable and succeeds on the next attempt", async () => {
    const getAnonymousKey = vi.fn()
      .mockRejectedValueOnce(new Error("permission denied"))
      .mockResolvedValueOnce({ type: "HASH", hash: "anonymous-hash" });
    const createTossSession = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, data: { token: "signed-token", expiresIn: 60 } });

    await expect(bootstrapTossSession({ getAnonymousKey, createTossSession })).resolves.toEqual({
      ok: false,
      failure: {
        code: "anonymous-key-error",
        message: "토스 사용자 정보를 불러오지 못했습니다.",
        retryable: true,
      },
    });

    await expect(bootstrapTossSession({ getAnonymousKey, createTossSession })).resolves.toEqual({
      ok: true,
      credential: {
        kind: "bearer",
        credentials: "omit",
        token: "signed-token",
        headers: {
          Authorization: "Bearer signed-token",
        },
      },
    });
  });

  it("treats thrown session exchange failures as retryable and succeeds on the next attempt", async () => {
    const getAnonymousKey = vi.fn()
      .mockResolvedValueOnce({ type: "HASH", hash: "anonymous-hash-1" })
      .mockResolvedValueOnce({ type: "HASH", hash: "anonymous-hash-2" });
    const createTossSession = vi.fn()
      .mockRejectedValueOnce(new Error("network denied"))
      .mockResolvedValueOnce({ ok: true, status: 200, data: { token: "signed-token", expiresIn: 60 } });

    await expect(bootstrapTossSession({ getAnonymousKey, createTossSession })).resolves.toEqual({
      ok: false,
      failure: {
        code: "session-exchange-failed",
        message: "사용자 정보를 연결하지 못했습니다. 다시 시도해 주세요.",
        retryable: true,
      },
    });

    await expect(bootstrapTossSession({ getAnonymousKey, createTossSession })).resolves.toEqual({
      ok: true,
      credential: {
        kind: "bearer",
        credentials: "omit",
        token: "signed-token",
        headers: {
          Authorization: "Bearer signed-token",
        },
      },
    });
  });

  it("subscribes to safe-area changes and cleans up every listener", () => {
    const values = [
      createSafeAreaInsets(10, 20, 30, 40),
      createSafeAreaInsets(11, 21, 31, 41),
      createSafeAreaInsets(12, 22, 32, 42),
    ];
    let index = 0;
    const readInsets = vi.fn(() => values[index]);
    const port = createTossSafeAreaPort(readInsets);
    const observed: Array<ReturnType<typeof createSafeAreaInsets>> = [];

    expect(port.get()).toEqual(values[0]);

    const unsubscribe = port.subscribe((insets) => {
      observed.push(insets);
    });

    index = 1;
    window.dispatchEvent(new Event("resize"));
    expect(observed).toEqual([values[1]]);

    index = 2;
    window.dispatchEvent(new Event("orientationchange"));
    expect(observed).toEqual([values[1], values[2]]);

    unsubscribe();
    index = 0;
    window.dispatchEvent(new Event("resize"));
    expect(observed).toEqual([values[1], values[2]]);
  });

  it("keeps optional feedback non-blocking when vibrate is missing or rejected", () => {
    const vibrate = vi.fn();
    const port = createTossFeedbackPort(vibrate);

    expect(() => port.vibrate([12, 24])).not.toThrow();
    expect(vibrate).toHaveBeenCalledWith([12, 24]);

    const silentPort = createTossFeedbackPort();
    try {
      Object.defineProperty(navigator, "vibrate", {
        configurable: true,
        value: () => {
          throw new Error("blocked");
        },
      });

      expect(() => silentPort.vibrate()).not.toThrow();
    } finally {
      Reflect.deleteProperty(navigator, "vibrate");
    }
  });

  it("creates an exact Toss share link with the production icon and times out cleanly", async () => {
    tossShareLink.mockResolvedValueOnce("https://share.example/link");

    await expect(createTossEndingShareLink("record-42")).resolves.toBe("https://share.example/link");
    expect(tossShareLink).toHaveBeenCalledWith(
      "intoss://sano-job-seeker/share/record-42",
      TOSS_SHARE_ICON_URL,
    );
  });

  it("rejects after five seconds when Toss share-link generation stalls", async () => {
    vi.useFakeTimers();
    tossShareLink.mockImplementationOnce(() => new Promise(() => undefined));

    const pending = createTossEndingShareLink("record-42");
    const assertion = expect(pending).rejects.toThrow("링크를 만들지 못했습니다. 다시 시도해 주세요.");
    await vi.advanceTimersByTimeAsync(5_000);
    await assertion;
  });
});
