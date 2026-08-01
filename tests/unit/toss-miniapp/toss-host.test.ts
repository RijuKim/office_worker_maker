import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createSafeAreaInsets } from "@/lib/game-ui/types";
import {
  bootstrapTossSession,
  createTossEndingShareLink,
  createTossFeedbackPort,
  createTossSafeAreaPort,
  saveTossEndingImage,
  shareTossEnding,
  TOSS_SHARE_ICON_URL,
} from "../../../apps/toss-miniapp/src/toss-host";

const { nativeSaveBase64Data, nativeShare, tossShareLink } = vi.hoisted(() => ({
  nativeSaveBase64Data: vi.fn(),
  nativeShare: vi.fn(),
  tossShareLink: vi.fn(),
}));

vi.mock("@apps-in-toss/web-framework", async () => {
  const actual = await vi.importActual<typeof import("@apps-in-toss/web-framework")>("@apps-in-toss/web-framework");
  return {
    ...actual,
    getTossShareLink: tossShareLink,
    saveBase64Data: nativeSaveBase64Data,
    share: nativeShare,
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

  it("creates a Toss app deep link to the standalone ending screen", async () => {
    tossShareLink.mockResolvedValueOnce("https://toss.im/share/record-42");
    await expect(createTossEndingShareLink("record 42")).resolves.toBe("https://toss.im/share/record-42");
    expect(tossShareLink).toHaveBeenCalledWith("intoss://sano-job-seeker/share/record%2042", TOSS_SHARE_ICON_URL);
  });

  it("opens the Toss native share sheet with the generated Toss link", async () => {
    tossShareLink.mockResolvedValueOnce("https://toss.im/share/ending-42");
    nativeShare.mockResolvedValueOnce(undefined);

    await shareTossEnding("ending-42", "현실적인 첫 직장");

    expect(nativeShare).toHaveBeenCalledWith({
      message: "현실적인 첫 직장\nhttps://toss.im/share/ending-42",
    });
  });

  it("saves a generated PNG through the Toss native data bridge", async () => {
    nativeSaveBase64Data.mockResolvedValueOnce(undefined);

    await saveTossEndingImage("data:image/png;base64,aGVsbG8=", "record-123456789");

    expect(nativeSaveBase64Data).toHaveBeenCalledWith({
      data: "aGVsbG8=",
      fileName: "career-record-record-1.png",
      mimeType: "image/png",
    });
  });

});
