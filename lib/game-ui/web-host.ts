import type { GameHost, HostAudioPort, HostClipboardPort, HostHapticsPort } from "./host";
import {
  createWebAccountSurface,
  createWebHostCapabilities,
  createZeroInsetSafeAreaPort,
} from "./host";
import type { HostAudioCue, HostRequestCredential, RouteIntent, SessionBootstrapResult } from "./types";
import { parseRouteIntent } from "./types";

export interface WebHostOptions {
  location?: string | URL;
  apiBaseUrl?: string;
  clipboard?: Pick<Clipboard, "writeText">;
  audioContextFactory?: () => AudioContext | null;
  audioElementFactory?: (src: string) => HTMLAudioElement;
  shareBaseUrl?: string | URL;
}

const COOKIE_REQUEST_CREDENTIAL: HostRequestCredential = {
  kind: "cookie",
  credentials: "include",
  headers: {},
};

const DEFAULT_BGM_SRC = "/bgm.mp3";

function resolveUrl(value: string | URL | undefined): URL | null {
  if (!value) return null;
  if (value instanceof URL) return value;

  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function createWebSessionBootstrap() {
  return async function bootstrap(): Promise<SessionBootstrapResult> {
    return { ok: true as const, credential: COOKIE_REQUEST_CREDENTIAL };
  };
}

function createWebApiPort(apiBaseUrl = "", location?: string | URL) {
  const resolvedLocation = resolveUrl(location);
  const baseUrl = (apiBaseUrl || resolvedLocation?.origin || "").replace(/\/$/, "");
  return {
    baseUrl,
    headers(credential: HostRequestCredential) {
      return credential.kind === "bearer" ? credential.headers : {};
    },
  };
}

function createWebClipboardPort(clipboard?: Pick<Clipboard, "writeText">): HostClipboardPort {
  return {
    async copy(text: string) {
      const writeText = clipboard
        ? clipboard.writeText.bind(clipboard)
        : globalThis.navigator?.clipboard?.writeText?.bind(globalThis.navigator.clipboard);
      if (!writeText) {
        throw new Error("Clipboard API is unavailable.");
      }
      await writeText(text);
    },
  };
}

function createWebAudioContextFactory(factory?: () => AudioContext | null) {
  return () => {
    if (factory) {
      return factory();
    }

    const audioGlobals = globalThis as typeof globalThis & {
      webkitAudioContext?: new () => AudioContext;
      AudioContext?: new () => AudioContext;
    };

    const AudioCtor = audioGlobals.AudioContext ?? audioGlobals.webkitAudioContext;
    if (!AudioCtor) return null;

    try {
      return new AudioCtor();
    } catch {
      return null;
    }
  };
}

function createWebAudioPort(options: Pick<WebHostOptions, "audioContextFactory" | "audioElementFactory"> = {}): HostAudioPort {
  const getContext = createWebAudioContextFactory(options.audioContextFactory);
  const createAudioElement = options.audioElementFactory ?? ((src: string) => new Audio(src));
  let backgroundAudio: HTMLAudioElement | null = null;

  async function ensureContext() {
    const context = getContext();
    if (!context) return null;

    if (context.state === "suspended") {
      try {
        await context.resume();
      } catch {
        return null;
      }
    }

    return context;
  }

  return {
    async playCue(cue: HostAudioCue) {
      const context = await ensureContext();
      if (!context) return;

      const now = context.currentTime;
      const cues: Record<HostAudioCue, { frequency: number; duration: number; gain: number; type: OscillatorType }> = {
        tap: { frequency: 520, duration: 0.055, gain: 0.08, type: "square" },
        success: { frequency: 740, duration: 0.12, gain: 0.07, type: "triangle" },
        warning: { frequency: 220, duration: 0.16, gain: 0.08, type: "sawtooth" },
        ending: { frequency: 880, duration: 0.28, gain: 0.075, type: "triangle" },
      };

      try {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const preset = cues[cue];
        oscillator.type = preset.type;
        oscillator.frequency.setValueAtTime(preset.frequency, now);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(preset.gain, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + preset.duration);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(now);
        oscillator.stop(now + preset.duration + 0.01);
      } catch {
        // Optional browser audio must never block the UI.
      }
    },
    async startBackground() {
      try {
        backgroundAudio ??= createAudioElement(DEFAULT_BGM_SRC);
        backgroundAudio.loop = true;
        backgroundAudio.volume = 0.36;
        await Promise.resolve(backgroundAudio.play()).catch(() => undefined);
      } catch {
        backgroundAudio = null;
      }
    },
    stopBackground() {
      if (!backgroundAudio) return;
      try {
        backgroundAudio.pause();
        backgroundAudio.currentTime = 0;
      } catch {
        backgroundAudio = null;
      }
    },
  };
}

function createWebHapticsPort(): HostHapticsPort {
  return {
    vibrate(pattern?: number | number[]) {
      try {
        globalThis.navigator?.vibrate?.(pattern ?? 12);
      } catch {
        // Haptics are an optional enhancement.
      }
    },
  };
}

function resolveInitialIntent(location?: string | URL): RouteIntent {
  if (!location) return { kind: "play" };
  const url = resolveUrl(location);
  return parseRouteIntent(url ?? location);
}

function resolveShareBaseUrl(shareBaseUrl?: string | URL, location?: string | URL) {
  const resolvedShareBase = resolveUrl(shareBaseUrl);
  if (resolvedShareBase) return resolvedShareBase;

  const resolvedLocation = resolveUrl(location);
  if (resolvedLocation) return resolvedLocation;

  return null;
}

export function createWebGameHost(options: WebHostOptions = {}): GameHost {
  const routeLocation = options.location ?? (typeof window !== "undefined" ? window.location.href : undefined);
  const shareBase = resolveShareBaseUrl(options.shareBaseUrl, routeLocation);

  return {
    kind: "web",
    capabilities: createWebHostCapabilities(),
    accountSurface: createWebAccountSurface(),
    session: {
      bootstrap: createWebSessionBootstrap(),
    },
    api: createWebApiPort(options.apiBaseUrl, routeLocation),
    safeArea: createZeroInsetSafeAreaPort(),
    routing: {
      initialIntent: resolveInitialIntent(routeLocation),
    },
    sharing: {
      async createEndingShareLink(recordId: string) {
        const base = shareBase;
        if (!base) {
          throw new Error("Share base URL is unavailable.");
        }
        const url = new URL(`/share/${encodeURIComponent(recordId)}`, base);
        return url.toString();
      },
    },
    clipboard: createWebClipboardPort(options.clipboard),
    audio: createWebAudioPort(options),
    haptics: createWebHapticsPort(),
  };
}
