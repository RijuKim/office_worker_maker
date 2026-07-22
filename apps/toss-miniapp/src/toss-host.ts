import { getAnonymousKey } from "@apps-in-toss/web-framework";

import { api } from "./api";
import { createSafeAreaInsets, type HostFailure, type HostRequestCredential, type SafeAreaInsets, type SessionBootstrapResult } from "@/lib/game-ui/types";

type AnonymousKeyResult =
  | { type: "HASH"; hash: string }
  | "INVALID_CATEGORY"
  | "ERROR"
  | undefined
  | null
  | Record<string, unknown>;

type TossSessionExchangeResult = Awaited<ReturnType<typeof api.createTossSession>>;

export interface TossSessionBootstrapOptions {
  getAnonymousKey?: () => Promise<AnonymousKeyResult>;
  createTossSession?: (hash: string) => Promise<TossSessionExchangeResult>;
}

export interface TossSafeAreaPort {
  get(): SafeAreaInsets;
  subscribe(listener: (insets: SafeAreaInsets) => void): () => void;
}

export interface TossFeedbackPort {
  vibrate(pattern?: number | number[]): void;
}

const ANONYMOUS_KEY_MISSING_MESSAGE = "토스 앱을 최신 버전으로 업데이트해 주세요.";
const ANONYMOUS_KEY_INVALID_CATEGORY_MESSAGE = "비게임 미니앱 설정을 확인해 주세요.";
const ANONYMOUS_KEY_ERROR_MESSAGE = "토스 사용자 정보를 불러오지 못했습니다.";
const ANONYMOUS_KEY_UNKNOWN_MESSAGE = "토스 사용자 정보를 확인하지 못했습니다.";
const SESSION_EXCHANGE_FAILED_MESSAGE = "사용자 정보를 연결하지 못했습니다. 다시 시도해 주세요.";

function createFailure(code: HostFailure["code"], message: string, retryable = true): HostFailure {
  return { code, message, retryable };
}

function resolveAnonymousKeyResult(value: AnonymousKeyResult): { ok: true; hash: string } | { ok: false; failure: HostFailure } {
  if (!value) {
    return { ok: false, failure: createFailure("anonymous-key-missing", ANONYMOUS_KEY_MISSING_MESSAGE) };
  }

  if (value === "INVALID_CATEGORY") {
    return { ok: false, failure: createFailure("anonymous-key-invalid-category", ANONYMOUS_KEY_INVALID_CATEGORY_MESSAGE) };
  }

  if (value === "ERROR") {
    return { ok: false, failure: createFailure("anonymous-key-error", ANONYMOUS_KEY_ERROR_MESSAGE) };
  }

  if (typeof value === "object" && value !== null && "type" in value && (value as { type?: unknown }).type === "HASH") {
    const hash = (value as { hash?: unknown }).hash;
    if (typeof hash === "string" && hash) {
      return { ok: true, hash };
    }
  }

  return { ok: false, failure: createFailure("anonymous-key-error", ANONYMOUS_KEY_UNKNOWN_MESSAGE) };
}

function createBearerCredential(token: string): HostRequestCredential {
  return {
    kind: "bearer",
    credentials: "omit",
    token,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
}

export async function bootstrapTossSession(
  options: TossSessionBootstrapOptions = {},
): Promise<SessionBootstrapResult> {
  const resolveAnonymousKey = options.getAnonymousKey ?? getAnonymousKey;
  const exchangeSession = options.createTossSession ?? api.createTossSession;

  let anonymousKey: AnonymousKeyResult;
  try {
    anonymousKey = await resolveAnonymousKey();
  } catch {
    return { ok: false, failure: createFailure("anonymous-key-error", ANONYMOUS_KEY_ERROR_MESSAGE) };
  }

  const resolved = resolveAnonymousKeyResult(anonymousKey);
  if (!resolved.ok) {
    return resolved;
  }

  try {
    const session = await exchangeSession(resolved.hash);
    const token = session && session.ok ? session.data?.token : undefined;
    if (typeof token !== "string" || token.length === 0) {
      return { ok: false, failure: createFailure("session-exchange-failed", SESSION_EXCHANGE_FAILED_MESSAGE) };
    }

    return {
      ok: true,
      credential: createBearerCredential(token),
    };
  } catch {
    return { ok: false, failure: createFailure("session-exchange-failed", SESSION_EXCHANGE_FAILED_MESSAGE) };
  }
}

function readInsetPixels(value: string | null | undefined): number {
  const parsed = Number.parseFloat(value ?? "0");
  return Number.isFinite(parsed) ? parsed : 0;
}

function measureSafeAreaInsets(): SafeAreaInsets {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return createSafeAreaInsets();
  }

  const probe = document.createElement("div");
  probe.setAttribute("aria-hidden", "true");
  probe.style.position = "absolute";
  probe.style.pointerEvents = "none";
  probe.style.opacity = "0";
  probe.style.inset = "0";
  probe.style.paddingTop = "env(safe-area-inset-top)";
  probe.style.paddingRight = "env(safe-area-inset-right)";
  probe.style.paddingBottom = "env(safe-area-inset-bottom)";
  probe.style.paddingLeft = "env(safe-area-inset-left)";

  const parent = document.body ?? document.documentElement;
  parent.appendChild(probe);
  const computed = window.getComputedStyle(probe);
  const insets = createSafeAreaInsets(
    readInsetPixels(computed.paddingTop),
    readInsetPixels(computed.paddingRight),
    readInsetPixels(computed.paddingBottom),
    readInsetPixels(computed.paddingLeft),
  );
  probe.remove();

  return insets;
}

function areInsetsEqual(left: SafeAreaInsets, right: SafeAreaInsets) {
  return left.top === right.top
    && left.right === right.right
    && left.bottom === right.bottom
    && left.left === right.left;
}

export function createTossSafeAreaPort(readInsets: () => SafeAreaInsets = measureSafeAreaInsets): TossSafeAreaPort {
  return {
    get() {
      return readInsets();
    },
    subscribe(listener: (insets: SafeAreaInsets) => void) {
      if (typeof window === "undefined") return () => undefined;

      let current = readInsets();
      const notify = () => {
        const next = readInsets();
        if (areInsetsEqual(next, current)) return;
        current = next;
        listener(next);
      };

      const resizeListener = () => notify();
      window.addEventListener("resize", resizeListener);
      window.addEventListener("orientationchange", resizeListener);

      const visualViewport = window.visualViewport;
      visualViewport?.addEventListener("resize", resizeListener);

      return () => {
        window.removeEventListener("resize", resizeListener);
        window.removeEventListener("orientationchange", resizeListener);
        visualViewport?.removeEventListener("resize", resizeListener);
      };
    },
  };
}

export function createTossFeedbackPort(vibrateImpl?: (pattern?: number | number[]) => void): TossFeedbackPort {
  return {
    vibrate(pattern = 12) {
      try {
        if (vibrateImpl) {
          vibrateImpl(pattern);
          return;
        }
        globalThis.navigator?.vibrate?.(pattern);
      } catch {
        // Optional Toss feedback must never block the app.
      }
    },
  };
}
