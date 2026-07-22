import { expect, type Page, type Route } from "@playwright/test";

export const sharedEvent = {
  id: "event-1",
  title: "첫 면접 제안",
  body: "예상보다 이른 시간에 면접 제안이 도착했습니다.",
  source: "STATIC",
  choices: [
    { id: "choice-1", label: "포트폴리오를 정리한다", statDelta: { practical: 2 } },
    { id: "choice-2", label: "친구에게 상담을 부탁한다", statDelta: { mental: 1 } },
  ],
};

export const sharedCharacter = {
  id: "run-1", name: "한서윤", age: 21, startGradeYear: 2, currentGradeYear: 2,
  major: "사회학과", academicStatus: "ENROLLED", currentEventId: sharedEvent.id,
  progressLabel: "2학년 1학기", relationships: [], eventHistory: [], coreEventCount: 1,
  stats: { academic: 5, practical: 5, communication: 4, creativity: 4, health: 5, mental: 5, network: 3, wealth: 120, reputation: 3, charm: 4 },
  events: [sharedEvent],
};

export const sharedRecord = {
  id: "record-1", title: "첫 기록", summary: "작은 선택이 첫 기록으로 남았습니다.",
  longNarrative: "한서윤은 차분하게 준비해 첫 면접을 마쳤습니다.", careerPath: "서비스 기획",
  jobRole: "서비스 기획자", destinationName: "가상 기업", salaryBand: "4,500만원",
  workplaceTone: ["차분함"], satisfaction: 84, growthPotential: 91, workLifeBalance: 73,
  healthState: "양호", relationshipState: "안정", tags: ["첫 도전"], statSnapshot: { academic: 5 },
  keyRelationships: [], majorEvents: [],
};

export async function installSharedUiApi(page: Page, options: { restored?: boolean; records?: boolean } = {}) {
  let restored = options.restored ?? false;
  const requests: Array<{ method: string; path: string; body?: unknown }> = [];
  await page.route("**/api/**", async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const body = request.postData() ? JSON.parse(request.postData()!) : undefined;
    requests.push({ method: request.method(), path, body });

    if (path.endsWith("/events/next/stream")) {
      await route.fulfill({ status: 200, contentType: "text/event-stream", body: `event: event\ndata: ${JSON.stringify({ event: sharedEvent })}\n\n` });
      return;
    }
    const json = path === "/api/characters" && request.method() === "POST"
      ? { character: sharedCharacter }
      : path === "/api/characters"
        ? { characters: restored ? [sharedCharacter] : [] }
        : path === "/api/characters/run-1"
          ? { character: sharedCharacter, currentEvent: sharedEvent }
          : path === "/api/characters/run-1/choices"
            ? { result: { stats: { ...sharedCharacter.stats, practical: 7 }, statDelta: { practical: 2 }, relationshipDelta: [], summary: "준비가 기록되었습니다.", endingTriggered: false } }
            : path === "/api/records"
              ? { records: options.records ? [sharedRecord] : [] }
              : path.includes("/specs") ? { specs: [] }
              : path.includes("/job-applications") ? { applications: [] }
              : path.includes("/career-paths") ? { paths: [] }
              : {};
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(json) });
  });
  return { requests, restore() { restored = true; } };
}

export async function completeSharedOnboarding(page: Page, name = "한서윤") {
  await expect(page.getByRole("button", { name: "시작하기", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "시작하기", exact: true }).click();
  await page.getByLabel("당신의 이름은 무엇인가요?").fill(name);
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await page.getByLabel("당신의 나이는 몇 살인가요?").selectOption("21");
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await page.getByRole("button", { name: /^자취방/ }).click();
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await page.getByRole("button", { name: "실무", exact: true }).click();
  await page.getByRole("button", { name: "멘탈", exact: true }).click();
  await page.getByRole("button", { name: "눈을 뜬다", exact: true }).click();
  await expect(page.getByRole("heading", { name: sharedEvent.title })).toBeVisible();
}
