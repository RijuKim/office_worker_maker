import { getAnonymousKey } from "@apps-in-toss/web-framework";

const DEV_USER_KEY = import.meta.env.VITE_TOSS_DEV_USER_KEY;

type AnonymousKeyResult =
  | { type: "HASH"; hash: string }
  | "INVALID_CATEGORY"
  | "ERROR"
  | undefined;

export async function getTossAnonymousKey() {
  if (import.meta.env.DEV && DEV_USER_KEY) return DEV_USER_KEY;

  const result = await getAnonymousKey() as AnonymousKeyResult;
  if (!result) throw new Error("토스 앱을 최신 버전으로 업데이트해 주세요.");
  if (result === "INVALID_CATEGORY") throw new Error("비게임 미니앱 설정을 확인해 주세요.");
  if (result === "ERROR") throw new Error("토스 사용자 정보를 불러오지 못했습니다.");
  if (result.type !== "HASH") throw new Error("토스 사용자 정보를 확인하지 못했습니다.");

  return result.hash;
}
