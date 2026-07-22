import { normalizePublicEndingDto, type PublicEndingDto } from "./types";

export const PUBLIC_ENDING_NOT_FOUND_MESSAGE = "기록을 찾을 수 없습니다";

export interface PublicEndingLoaderOptions {
  baseUrl: string | URL;
  fetchImpl?: typeof fetch;
}

function buildPublicEndingUrl(recordId: string, baseUrl: string | URL) {
  return new URL(`/api/share/${encodeURIComponent(recordId)}`, String(baseUrl));
}

export async function loadPublicEnding(
  recordId: string,
  options: PublicEndingLoaderOptions,
): Promise<PublicEndingDto | null> {
  const response = await (options.fetchImpl ?? fetch)(buildPublicEndingUrl(recordId, options.baseUrl), {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`public ending request failed: ${response.status}`);
  }

  const payload: unknown = await response.json().catch(() => null);
  return normalizePublicEndingDto(payload);
}
