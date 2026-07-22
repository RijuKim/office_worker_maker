import { expect, test } from "@playwright/test";
import { completeRealOnboarding } from "./helpers/real-ui";

test.beforeEach(({ viewport }) => test.skip((viewport?.width ?? 0) < 800, "database integration runs once in the desktop project"));

test("a spec can be initiated and completed through production routes and its score survives reload", async ({ page }, testInfo) => {
  const { character } = await completeRealOnboarding(page);
  const created = await page.evaluate(async (id) => fetch(`/api/characters/${id}/specs`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ specType: "PORTFOLIO", specName: "서비스 기획 포트폴리오" }) }).then((r) => r.json()), character.id);
  const completed = await page.evaluate(async ({ id, specId }) => fetch(`/api/characters/${id}/specs/${specId}/complete`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "COMPLETED", score: "우수" }) }).then((r) => r.json()), { id: character.id, specId: created.spec.id });
  expect(completed.specScore).toBeGreaterThan(0);
  await page.reload();

  await expect(page.getByTestId("spec-panel")).toContainText("서비스 기획 포트폴리오");
  await expect(page.getByTestId("spec-panel")).toContainText("COMPLETED");
  await expect(page.getByTestId("spec-score")).toContainText(String(completed.specScore));
  await testInfo.attach("persisted-career-panels", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
});

test("choice request posts its index and produces persisted event history", async ({ page }) => {
  const { character } = await completeRealOnboarding(page);
  const choice = page.locator(".choice-stack button").first();
  const responsePromise = page.waitForResponse((response) => response.url().endsWith(`/api/characters/${character.id}/choices`) && response.request().method() === "POST");
  await choice.click();
  const response = await responsePromise;
  expect(response.request().postDataJSON()).toEqual({ choiceIndex: 0 });
  expect(response.status()).toBe(200);
  const responseBody = await response.json();
  expect(responseBody.result.statDelta).toBeDefined();
  expect(responseBody.result).not.toHaveProperty("summary");
  await expect(page.locator(".feedback-panel")).toBeVisible();
  await page.reload();
  const restored = await page.request.get(`/api/characters/${character.id}`);
  const restoredBody = await restored.json();
  expect(restoredBody.character.eventHistory.length).toBeGreaterThan(0);
  expect(restoredBody.character.eventHistory[0].summary).toBeTruthy();
});
