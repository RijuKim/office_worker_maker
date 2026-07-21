import { spawn, type ChildProcess } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test, type Page, type Route } from "@playwright/test";
import { forbiddenProvenance, preRefreshOracle as oracle } from "./fixtures/toss-pre-refresh-oracle";

const baseUrl = "http://127.0.0.1:5174";
const artifactDir = resolve("artifacts/toss-restoration-review");

const firstEvent = {
  id: "event-1", title: "첫 면접 제안", body: "예상보다 이른 시간에 면접 제안이 도착했습니다.", source: "AI 사건",
  choices: [
    { id: "choice-1", label: "담당자에게 가능한 시간을 묻는다", statDelta: { practical: 2 } },
    { id: "choice-2", label: "기업 정보를 먼저 정리한다", statDelta: { academic: 1 } },
    { id: "choice-3", label: "친구에게 모의 면접을 부탁한다", statDelta: { mental: 1 } },
  ],
};
const nextEvent = {
  id: "event-2", title: "면접 준비의 밤", body: "답장을 보낸 뒤 준비할 항목을 차분히 펼쳐 봅니다.", source: "FALLBACK",
  choices: [
    { id: "choice-4", label: "경험을 직무와 연결해 본다", statDelta: { practical: 1 } },
    { id: "choice-5", label: "충분히 쉬고 내일 이어간다", statDelta: { health: 1 } },
  ],
};
const character = {
  id: "run-1", name: "한서윤", age: 24, startGradeYear: 4, currentGradeYear: 4, major: "경영학", academicStatus: "enrolled",
  stats: { academic: 4, practical: 5, health: 3, mental: 4 }, relationships: [], eventHistory: [], currentEventId: firstEvent.id,
  coreEventCount: 3, progressLabel: "4학년 1학기", events: [firstEvent],
};
const records = [
  { id: "record-1", title: "첫 학기를 마쳤습니다", summary: "작은 선택들이 한 학기의 기록으로 남았습니다.", satisfaction: 74 },
  { id: "record-2", title: "인턴 생활을 마쳤습니다", summary: "낯선 업무를 끝까지 배워 냈습니다.", satisfaction: 82 },
];

async function waitForToss() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try { if ((await fetch(baseUrl)).ok) return; } catch { /* starting */ }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 200));
  }
  throw new Error("Toss Vite server did not become ready");
}

async function installApi(page: Page) {
  let recordPayload = records;
  let restorationState: "empty" | "populated" = "empty";
  let resolveEmptyRestoration!: () => void;
  const emptyRestoration = new Promise<void>((resolvePromise) => {
    resolveEmptyRestoration = resolvePromise;
  });
  const requests: Array<{ path: string; method: string; body: unknown }> = [];
  await page.route("**/api/**", async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const body = request.postData() ? JSON.parse(request.postData()!) : undefined;
    requests.push({ path, method: request.method(), body });
    const json = path === "/api/toss/session" ? { token: "deterministic-session" }
      : path === "/api/characters" && request.method() === "POST" ? { character }
      : path === "/api/characters" ? { characters: restorationState === "populated" ? [character] : [] }
      : path === "/api/characters/run-1" ? { character, currentEvent: firstEvent }
      : path === "/api/characters/run-1/choices" ? { result: { stats: { ...character.stats, practical: 7 }, statDelta: { practical: 2 }, relationshipDelta: [], summary: "차분한 답장으로 준비할 시간을 확보했습니다.", endingTriggered: false } }
      : path === "/api/characters/run-1/events/next" ? { event: nextEvent }
      : path === "/api/records" ? { records: recordPayload }
      : {};
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(json) });
    if (path === "/api/characters" && request.method() === "GET" && restorationState === "empty") {
      resolveEmptyRestoration();
    }
  });
  return {
    requests,
    waitForEmptyRestoration() { return emptyRestoration; },
    restorePopulatedCharacter() { restorationState = "populated"; },
    setRecords(value: typeof records) { recordPayload = value; },
  };
}

async function createDeterministicRun(page: Page) {
  await page.getByRole("button", { name: "시작하기", exact: true }).click();
  await page.getByLabel("당신의 이름은 무엇인가요?").fill("한서윤");
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await page.getByLabel("당신의 나이는 몇 살인가요?").selectOption("24");
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await page.getByRole("button", { name: /자취방/ }).click();
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await page.getByRole("button", { name: "실무", exact: true }).click();
  await page.getByRole("button", { name: "멘탈", exact: true }).click();
  await page.getByRole("button", { name: "눈을 뜬다", exact: true }).click();
}

async function assertHeaderAndMenu(page: Page, width: number) {
  expect(await page.locator(".app-title > span").allTextContents()).toEqual(["일어나보니", "대한민국 취준생"]);
  await page.getByRole("button", { name: "메뉴", exact: true }).click();
  const geometry = await page.evaluate(() => {
    const root = document.documentElement;
    const row = document.querySelector(".title-row")!.getBoundingClientRect();
    const menu = document.querySelector(".menu-popover")!.getBoundingClientRect();
    const items = [...document.querySelectorAll<HTMLElement>(".menu-popover > button, .menu-popover > .menu-row")].map((node) => {
      const style = getComputedStyle(node); return { size: style.fontSize, weight: style.fontWeight, height: node.getBoundingClientRect().height };
    });
    return { clientWidth: root.clientWidth, scrollWidth: root.scrollWidth, row: { left: row.left, right: row.right, width: row.width }, menu: { left: menu.left, right: menu.right, width: menu.width }, items };
  });
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth);
  expect(geometry.items.every((item) => item.size === "14px" && item.weight === "800" && item.height >= 44)).toBe(true);
  if (width <= 720) {
    expect(Math.abs(geometry.menu.left - geometry.row.left)).toBeLessThanOrEqual(1);
    expect(Math.abs(geometry.menu.width - geometry.row.width)).toBeLessThanOrEqual(1);
  } else {
    expect(Math.abs(geometry.menu.right - geometry.row.right)).toBeLessThanOrEqual(1);
  }
  const visible = await page.locator("body").innerText();
  expect(visible).not.toMatch(/취준 생활 시뮬레이션|취준 \/|새 이야기|스펙, 멘탈, 통장잔고|AI 사건|FALLBACK|provider|source/i);
  expect(await page.locator('[aria-label="설정"]').count()).toBe(0);
  await page.getByRole("button", { name: "메뉴", exact: true }).click();
}

async function assertOracleVisuals(page: Page) {
  const measured = await page.evaluate(() => {
    const style = (selector: string) => getComputedStyle(document.querySelector<HTMLElement>(selector)!);
    const choice = document.querySelector<HTMLElement>(".choice-stack button")!;
    const event = style(".event-panel");
    return {
      shellBackground: style(".app-shell").backgroundColor, panelBackground: event.backgroundColor,
      controlBackground: style(".choice-stack button").backgroundColor, text: event.color,
      muted: style(".event-panel p").color, border: event.borderColor, radius: event.borderRadius,
      panelPadding: event.padding, stackGap: style(".screen-stack").gap, choiceHeight: choice.getBoundingClientRect().height,
      panelWidth: document.querySelector<HTMLElement>(".event-panel")!.getBoundingClientRect().width,
    };
  });
  expect(measured).toMatchObject(oracle.tokens);
  expect(measured.panelWidth).toBeLessThanOrEqual(720);
}

test("restored Toss gameplay, feedback, next-event and records match the pre-refresh oracle", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "exact viewports are covered in one deterministic Chromium flow");
  let server: ChildProcess | undefined;
  try {
    try { if (!(await fetch(baseUrl)).ok) throw new Error(); } catch {
      server = spawn("npm", ["run", "toss:dev", "--", "--host", "127.0.0.1", "--port", "5174", "--strictPort"], {
        cwd: process.cwd(), stdio: "ignore", detached: true,
        env: { ...process.env, VITE_TOSS_DEV_USER_KEY: "deterministic-browser-user" },
      });
      await waitForToss();
    }
    await mkdir(artifactDir, { recursive: true });
    const api = await installApi(page);
    await page.addInitScript(() => sessionStorage.clear());

    for (const [index, viewport] of [{ width: 636, height: 1048 }, { width: 1504, height: 741 }].entries()) {
      await page.setViewportSize(viewport);
      await page.goto(baseUrl);
      if (index === 0) {
        await api.waitForEmptyRestoration();
        await expect(page.getByRole("button", { name: "시작하기", exact: true })).toBeVisible();
        await createDeterministicRun(page);
        api.restorePopulatedCharacter();
      }
      await expect(page.locator(".event-panel h2")).toHaveText(firstEvent.title);
      await expect(page.locator(".choice-stack button")).toHaveCount(3);
      for (const selector of oracle.structures.gameplay) await expect(page.locator(selector)).toHaveCount(1);
      await assertHeaderAndMenu(page, viewport.width);
      await assertOracleVisuals(page);
      expect(await page.locator("body").innerText()).not.toMatch(forbiddenProvenance);
      await page.screenshot({ path: resolve(artifactDir, `gameplay-${viewport.width}x${viewport.height}.png`), fullPage: true });
    }

    await page.getByRole("button", { name: firstEvent.choices[0].label }).click();
    await expect(page.locator(".feedback-panel strong")).toHaveText("실무 +2");
    await expect(page.locator(".feedback-panel p")).toHaveText("차분한 답장으로 준비할 시간을 확보했습니다.");
    await expect(page.locator(".stats-grid span").filter({ hasText: "실무" })).toContainText("7");
    await expect(page.locator(".event-panel h2")).toHaveText(nextEvent.title);
    await expect(page.locator(".choice-stack button")).toHaveCount(2);
    for (const selector of oracle.structures.feedback) await expect(page.locator(selector)).toHaveCount(1);
    expect(api.requests.find((request) => request.path.endsWith("/choices"))).toEqual({ path: "/api/characters/run-1/choices", method: "POST", body: { choiceIndex: 0 } });
    expect(api.requests.some((request) => request.path.endsWith("/events/next") && request.method === "POST")).toBe(true);
    expect(await page.locator("body").innerText()).not.toMatch(forbiddenProvenance);
    await page.screenshot({ path: resolve(artifactDir, "feedback-next-1504x741.png"), fullPage: true });

    await page.getByRole("button", { name: "메뉴", exact: true }).click();
    await page.getByRole("button", { name: "기록", exact: true }).click();
    await expect(page.locator("article.record-panel")).toHaveCount(2);
    for (const selector of oracle.structures.records) await expect(page.locator(selector).first()).toBeVisible();
    expect(await page.locator("body").innerText()).not.toMatch(forbiddenProvenance);
    await page.screenshot({ path: resolve(artifactDir, "records-populated-1504x741.png"), fullPage: true });

    api.setRecords([]);
    await page.getByRole("button", { name: "새로고침", exact: true }).click();
    await expect(page.getByText("아직 남겨진 기록이 없습니다.")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.screenshot({ path: resolve(artifactDir, "records-empty-1504x741.png"), fullPage: true });
    await page.getByRole("button", { name: "진행으로", exact: true }).click();
    await expect(page.locator(".event-panel h2")).toHaveText(nextEvent.title);
  } finally {
    if (server?.pid) process.kill(-server.pid, "SIGTERM");
  }
});
