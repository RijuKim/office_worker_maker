import type {
  GameHostKind,
  HostAudioCue,
  HostCapabilities,
  HostFailure,
  HostRequestCredential,
  RouteIntent,
  SafeAreaInsets,
  SessionBootstrapResult,
} from "./types";
import { ZERO_SAFE_AREA_INSETS, createHostFailure, createSafeAreaInsets } from "./types";

export interface HostAccountSurface {
  available: boolean;
  label: string;
}

export interface SafeAreaPort {
  get(): SafeAreaInsets;
  subscribe(listener: (insets: SafeAreaInsets) => void): () => void;
}

export interface HostSessionPort {
  bootstrap(): Promise<SessionBootstrapResult>;
}

export interface HostApiPort {
  baseUrl: string;
  headers(credential: HostRequestCredential): Record<string, string>;
}

export interface HostClipboardPort {
  copy(text: string): Promise<void>;
}

export interface HostSharingPort {
  createEndingShareLink(recordId: string): Promise<string>;
}

export interface HostAudioPort {
  playCue(cue: HostAudioCue): Promise<void> | void;
  startBackground(): Promise<void> | void;
  stopBackground(): void;
}

export interface HostHapticsPort {
  vibrate(pattern?: number | number[]): void;
}

export interface GameHost {
  kind: GameHostKind;
  capabilities: HostCapabilities;
  accountSurface: HostAccountSurface;
  session: HostSessionPort;
  api: HostApiPort;
  safeArea: SafeAreaPort;
  routing: {
    initialIntent: RouteIntent;
  };
  sharing: HostSharingPort;
  clipboard: HostClipboardPort;
  audio?: HostAudioPort;
  haptics?: HostHapticsPort;
}

export function createWebHostCapabilities(): HostCapabilities {
  return {
    kind: "web",
    accountSurface: { available: true },
    audio: true,
    haptics: true,
  };
}

export function createTossHostCapabilities(): HostCapabilities {
  return {
    kind: "toss",
    accountSurface: {
      available: false,
      reason: "토스 앱에서는 계정/이메일 표면을 숨깁니다.",
    },
    audio: true,
    haptics: true,
  };
}

export function createWebAccountSurface(): HostAccountSurface {
  return {
    available: true,
    label: "계정",
  };
}

export function createTossAccountSurface(): HostAccountSurface {
  return {
    available: false,
    label: "계정 없음",
  };
}

export function createStaticSafeAreaPort(insets: SafeAreaInsets = ZERO_SAFE_AREA_INSETS): SafeAreaPort {
  return {
    get: () => insets,
    subscribe: () => () => undefined,
  };
}

export function createZeroInsetSafeAreaPort(): SafeAreaPort {
  return createStaticSafeAreaPort(createSafeAreaInsets());
}

export function createHostFailureForRetry(
  code: HostFailure["code"],
  message: string,
): HostFailure {
  return createHostFailure(code, message, true);
}
