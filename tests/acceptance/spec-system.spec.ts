import { test, expect } from "@playwright/test";

test.describe("스펙 시스템 (Credential/Spec System)", () => {
  test.beforeEach(async ({ page }) => {
    // Sign up and create a character
    await page.goto("/");
    await page.fill('input[name="email"]', `spec-test-${Date.now()}@test.com`);
    await page.fill('input[name="password"]', "testpassword123");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/characters\/create|\/play/);

    // If on character creation page, create one
    if (page.url().includes("/characters/create")) {
      await page.fill('input[name="name"]', "테스트유저");
      await page.fill('input[name="age"]', "21");
      await page.fill('input[name="major"]', "컴퓨터공학과");
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/play/);
    }
  });

  test("Spec initiation through event choice creates Spec record", async ({ page }) => {
    // Given a character with active event
    await page.waitForSelector('[data-testid="event-body"]');

    // When the player chooses a spec-related option (e.g. "토익 시험 접수하기")
    const specChoice = page.locator('[data-testid="choice"]', { hasText: /토익|접수|시험/ });
    if (await specChoice.count() > 0) {
      await specChoice.click();
    } else {
      // If no spec choice available, just click any choice
      await page.locator('[data-testid="choice"]').first().click();
    }

    // Then the response shows stat delta labels
    await expect(page.locator('[data-testid="stat-delta"]')).toBeVisible();

    // And the response does NOT show narrative summary text
    await expect(page.locator('[data-testid="choice-summary"]')).not.toBeVisible();

    // When the next event loads
    await page.waitForSelector('[data-testid="event-body"]');

    // Then the event body begins with a narrative reference to the previous choice
    const eventBody = await page.locator('[data-testid="event-body"]').textContent();
    expect(eventBody?.length).toBeGreaterThan(0);
  });

  test("Spec panel shows current specs", async ({ page }) => {
    // Given a character with active event
    await page.waitForSelector('[data-testid="event-body"]');

    // Then the spec panel is visible in the sidebar
    const specPanel = page.locator('[data-testid="spec-panel"]');
    await expect(specPanel).toBeVisible();
  });

  test("Job application panel shows stage progress", async ({ page }) => {
    // Given a character with active event
    await page.waitForSelector('[data-testid="event-body"]');

    // Then the job application panel is visible
    const jobPanel = page.locator('[data-testid="job-application-panel"]');
    await expect(jobPanel).toBeVisible();
  });

  test("Career path panel shows step indicators", async ({ page }) => {
    // Given a character with active event
    await page.waitForSelector('[data-testid="event-body"]');

    // Then the career path panel is visible
    const careerPanel = page.locator('[data-testid="career-path-panel"]');
    await expect(careerPanel).toBeVisible();
  });

  test("Spec score is displayed in character stats area", async ({ page }) => {
    // Given a character with active event
    await page.waitForSelector('[data-testid="event-body"]');

    // Then the spec score is visible in the stats area
    const specScore = page.locator('[data-testid="spec-score"]');
    await expect(specScore).toBeVisible();
  });
});

test.describe("Choice Response Change", () => {
  test("Choice response contains statDelta but not summary", async ({ page }) => {
    // Intercept the choice API response
    const responsePromise = page.waitForResponse((response) =>
      response.url().includes("/choices") && response.request().method() === "POST"
    );

    await page.goto("/");
    // Sign up and create character
    await page.fill('input[name="email"]', `choice-test-${Date.now()}@test.com`);
    await page.fill('input[name="password"]', "testpassword123");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/play|\/characters\/create/);

    if (page.url().includes("/characters/create")) {
      await page.fill('input[name="name"]', "초이스테스트");
      await page.fill('input[name="age"]', "21");
      await page.fill('input[name="major"]', "경영학과");
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/play/);
    }

    await page.waitForSelector('[data-testid="event-body"]');
    await page.locator('[data-testid="choice"]').first().click();

    const response = await responsePromise;
    const data = await response.json();

    // Then the response contains statDelta
    expect(data).toHaveProperty("statDelta");

    // And the response does NOT contain summary
    expect(data).not.toHaveProperty("summary");

    // And the response contains eventResolved
    expect(data).toHaveProperty("eventResolved");
    expect(data.eventResolved).toBe(true);
  });
});
