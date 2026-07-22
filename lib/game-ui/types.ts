export type GameHostKind = "web" | "toss";

export interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export type AccountSurfaceCapability =
  | {
      available: true;
    }
  | {
      available: false;
      reason: string;
    };

export interface HostCapabilities {
  kind: GameHostKind;
  accountSurface: AccountSurfaceCapability;
  audio: boolean;
  haptics: boolean;
}

export type HostAudioCue = "tap" | "success" | "warning" | "ending";

export type RouteIntent =
  | {
      kind: "play";
    }
  | {
      kind: "share";
      recordId: string;
    };

export type HostFailureCode =
  | "anonymous-key-missing"
  | "anonymous-key-invalid-category"
  | "anonymous-key-error"
  | "session-exchange-failed"
  | "session-expired"
  | "share-link-failed"
  | "clipboard-failed"
  | "route-unavailable";

export interface HostFailure {
  code: HostFailureCode;
  message: string;
  retryable: boolean;
}

export type HostRequestCredential =
  | {
      kind: "cookie";
      credentials: "include";
      headers: Record<string, never>;
    }
  | {
      kind: "bearer";
      credentials: "omit";
      token: string;
      headers: {
        Authorization: `Bearer ${string}`;
      };
    };

export type SessionBootstrapResult =
  | {
      ok: true;
      credential: HostRequestCredential;
    }
  | {
      ok: false;
      failure: HostFailure;
    };

export interface PublicEndingRelationship {
  name: string;
  role: string;
  trust: number;
}

export interface PublicEndingMajorEvent {
  summary: string;
}

export interface PublicEndingDto {
  id: string;
  title: string;
  summary: string;
  longNarrative: string;
  careerPath: string;
  jobRole: string | null;
  destinationName: string | null;
  salaryBand: string | null;
  workplaceTone: string[];
  satisfaction: number;
  growthPotential: number;
  workLifeBalance: number;
  healthState: string;
  relationshipState: string;
  tags: string[];
  statSnapshot: Record<string, number>;
  keyRelationships: PublicEndingRelationship[];
  majorEvents: PublicEndingMajorEvent[];
}

export function createSafeAreaInsets(
  top = 0,
  right = 0,
  bottom = 0,
  left = 0,
): SafeAreaInsets {
  return { top, right, bottom, left };
}

export const ZERO_SAFE_AREA_INSETS = createSafeAreaInsets();

export function createHostFailure(
  code: HostFailureCode,
  message: string,
  retryable = true,
): HostFailure {
  return { code, message, retryable };
}

export function createEmptyPublicEndingDto(): PublicEndingDto {
  return {
    id: "",
    title: "",
    summary: "",
    longNarrative: "",
    careerPath: "",
    jobRole: null,
    destinationName: null,
    salaryBand: null,
    workplaceTone: [],
    satisfaction: 0,
    growthPotential: 0,
    workLifeBalance: 0,
    healthState: "",
    relationshipState: "",
    tags: [],
    statSnapshot: {},
    keyRelationships: [],
    majorEvents: [],
  };
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asFiniteNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function asRelationships(value: unknown): PublicEndingRelationship[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): PublicEndingRelationship[] => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Record<string, unknown>;
    const name = asString(candidate.name);
    const role = asString(candidate.role);
    const trust = asFiniteNumber(candidate.trust);
    if (!name && !role && trust === 0) return [];
    return [{ name, role, trust }];
  });
}

function asMajorEvents(value: unknown): PublicEndingMajorEvent[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): PublicEndingMajorEvent[] => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Record<string, unknown>;
    const summary = asString(candidate.summary);
    if (!summary) return [];
    return [{ summary }];
  });
}

function asStatSnapshot(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const entries = Object.entries(value as Record<string, unknown>).filter(([, item]) => typeof item === "number" && Number.isFinite(item));
  return Object.fromEntries(entries) as Record<string, number>;
}

export function normalizePublicEndingDto(value: unknown): PublicEndingDto {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return createEmptyPublicEndingDto();
  }

  const candidate = value as Record<string, unknown>;
  return {
    id: asString(candidate.id),
    title: asString(candidate.title),
    summary: asString(candidate.summary),
    longNarrative: asString(candidate.longNarrative),
    careerPath: asString(candidate.careerPath),
    jobRole: asNonEmptyString(candidate.jobRole),
    destinationName: asNonEmptyString(candidate.destinationName),
    salaryBand: asNonEmptyString(candidate.salaryBand),
    workplaceTone: asStringArray(candidate.workplaceTone),
    satisfaction: asFiniteNumber(candidate.satisfaction),
    growthPotential: asFiniteNumber(candidate.growthPotential),
    workLifeBalance: asFiniteNumber(candidate.workLifeBalance),
    healthState: asString(candidate.healthState),
    relationshipState: asString(candidate.relationshipState),
    tags: asStringArray(candidate.tags),
    statSnapshot: asStatSnapshot(candidate.statSnapshot),
    keyRelationships: asRelationships(candidate.keyRelationships),
    majorEvents: asMajorEvents(candidate.majorEvents),
  };
}

export function parseRouteIntent(value: string | URL): RouteIntent {
  if (typeof value !== "string" && !(value instanceof URL)) {
    return { kind: "play" };
  }

  const raw = typeof value === "string" ? value : value.pathname;
  const path = raw.includes("://") ? safePathnameFromUrl(raw) : raw;
  const normalized = path.replace(/^\/+/, "");
  const match = normalized.match(/^share\/([^/?#]+)$/);
  if (!match) return { kind: "play" };

  const recordId = safeDecodeURIComponent(match[1]);
  if (!recordId || /[\/?#\\]/.test(recordId)) {
    return { kind: "play" };
  }

  return { kind: "share", recordId };
}

function safePathnameFromUrl(value: string): string {
  try {
    return new URL(value).pathname;
  } catch {
    return value;
  }
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return "";
  }
}
