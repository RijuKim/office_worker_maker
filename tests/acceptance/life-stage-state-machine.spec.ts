import { expect, test } from "@playwright/test";
import { completeRealOnboarding, openRecords, seedFixture } from "./helpers/real-ui";

test.beforeEach(({ viewport }) => test.skip((viewport?.width ?? 0) < 800, "database integration runs once in the desktop project"));

test("play progress is a life-stage label rather than fixed event progress", async ({ page }) => {
  await completeRealOnboarding(page);
  await expect(page.locator(".progress-label").or(page.getByText(/^\d학년\s*[12]학기$/)).first()).toBeVisible();
  await expect(page.getByText(/\d+\s*\/\s*15/)).toHaveCount(0);
});

test("low health transition persists the leave state after reload", async ({ page }) => {
  const { character } = await completeRealOnboarding(page);
  await seedFixture(page, "life-stage-leave", character.id);
  await seedFixture(page, "forced-event", character.id);
  await page.reload();
  const restored = await page.request.get(`/api/characters/${character.id}`);
  await expect(restored.json()).resolves.toMatchObject({ character: { academicStatus: "LEAVE", stats: { health: 2, mental: 2 } } });
  await expect(page.getByRole("heading", { name: "번아웃 경고" })).toBeVisible();
  await expect(page.getByRole("button", { name: /쉬고 상담/ })).toBeVisible();
});

test("forced events return agency without direct pass or fail commands", async ({ page }) => {
  const { character } = await completeRealOnboarding(page);
  await seedFixture(page, "forced-event", character.id);
  await page.reload();
  await expect(page.getByRole("button", { name: /통과한다|합격한다|탈락한다|떨어진다|다음 회차/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "충분히 쉬고 상담을 받는다" })).toBeVisible();
});

test("records never expose internal route grades", async ({ page }) => {
  await completeRealOnboarding(page);
  await openRecords(page);
  await expect(page.getByText(/GOOD ROUTE|MIXED ROUTE|HARD ROUTE|A등급|B등급|C등급/)).toHaveCount(0);
});
