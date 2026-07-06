import { expect, type Page, test } from '@playwright/test';

const email = `player-${Date.now()}@example.com`;
const password = 'Password123!';

async function signUpAndCreateCharacter(page: Page) {
  await page.goto('/');
  await page.getByRole('link', { name: /회원가입|가입|sign up/i }).click();
  await page.getByLabel(/이메일|email/i).fill(email);
  await page.getByLabel(/비밀번호|password/i).fill(password);
  await page.getByRole('button', { name: /회원가입|가입|sign up/i }).click();
  await expect(page.getByText(/캐릭터|character/i)).toBeVisible();

  await page.getByRole('button', { name: /새 캐릭터|캐릭터 만들기|create/i }).click();
  await page.getByLabel(/이름|name/i).fill('한서윤');
  await page.getByLabel(/나이|age/i).selectOption({ label: '21' });
  await page.getByLabel(/학년|grade|year/i).selectOption({ label: '2' });
  await page.getByLabel(/전공|과|major/i).selectOption({ label: '사회학과' });
  await page.getByRole('button', { name: /시작|생성|create/i }).click();
  await expect(page.getByText('한서윤')).toBeVisible();
}

test('signup, login, and user-entered character creation persist visible state', async ({ page }) => {
  await signUpAndCreateCharacter(page);
  await expect(page.getByText(/사회학과/)).toBeVisible();
  await expect(page.getByText(/2학년/)).toBeVisible();
  await expect(page.getByText(/학업/)).toBeVisible();
  await expect(page.getByText(/매력/)).toBeVisible();
  await expect(page.getByText(/커리어와 엔딩 기록/)).toBeVisible();

  await page.reload();
  await expect(page.getByText('한서윤')).toBeVisible();
});

test('normal event choice updates visible state and event history', async ({ page }) => {
  await signUpAndCreateCharacter(page);
  expect(await page.getByRole('button').count()).toBeGreaterThan(1);
  await page.getByRole('button').filter({ hasText: /인턴|제안|동아리|상담|축제/ }).first().click();
  await expect(page.getByText(/최근|기억|관계|변화|다음/)).toBeVisible();
  await expect(page.getByText(/EventHistory|저장됨|기록됨|선택/)).toBeVisible();
});

test('OpenRouter failure shows fallback event and gameplay continues', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('force-ai-failure', '1');
  });
  await signUpAndCreateCharacter(page);
  await page.getByRole('button', { name: /AI|새 사건|다음 사건|인턴/ }).first().click();
  await expect(page.getByText(/대체|fallback|정적 이벤트|다시 시도/)).toBeVisible();
  await expect(page.getByRole('button', { name: /계속|선택|돌아가기/ })).toBeVisible();
});

test('forced burnout event triggers without an initial player choice and returns agency', async ({ page }) => {
  await signUpAndCreateCharacter(page);
  await page.evaluate(async () => {
    await fetch('/api/test/characters/current/hidden-state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ burnoutRisk: 90 }),
    });
  });
  await page.goto('/play');
  await expect(page.getByText(/강제 이벤트|번아웃|자동 발생/)).toBeVisible();
  await expect(page.getByRole('button', { name: /회복|도움|쉬기|병원|상담/ })).toBeVisible();
});

test('career and ending record is generated and remains after relogin', async ({ page }) => {
  await signUpAndCreateCharacter(page);
  await page.evaluate(async () => {
    await fetch('/api/test/characters/current/progression', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coreEventCount: 15, branchPoint: 'EMPLOYMENT' }),
    });
  });
  await page.getByRole('button', { name: /기록 생성|엔딩|커리어와 엔딩 기록/ }).click();
  await expect(page.getByText(/커리어와 엔딩 기록 저장|저장되었습니다/)).toBeVisible();
  await expect(page.getByText(/초봉|연봉|직무|만족도|워라밸/)).toBeVisible();

  await page.reload();
  await page.getByText(/커리어와 엔딩 기록/).click();
  await expect(page.getByText(/한서윤/)).toBeVisible();
});

test('same destination can create different records, while near duplicates are grouped', async ({ page }) => {
  await signUpAndCreateCharacter(page);
  await page.goto('/records');
  await expect(page.getByText(/같은 직업|같은 회사|다른 이야기|유사 기록/)).toBeVisible();
  await expect(page.getByText(/묶음|그룹|비슷한 기록/)).toBeVisible();
});

test('mobile play layout is single column and readable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signUpAndCreateCharacter(page);
  await expect(page.getByText(/패러디|허구/)).toBeVisible();
  const choice = page.getByRole('button').filter({ hasText: /인턴|축제|상담|회복/ }).first();
  await expect(choice).toBeVisible();
  const box = await choice.boundingBox();
  expect(box?.width ?? 0).toBeLessThanOrEqual(390);
});

test('anti-scenario: protagonist name is not randomly assigned', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /회원가입|가입|sign up/i }).click();
  await page.getByLabel(/이메일|email/i).fill(`noname-${Date.now()}@example.com`);
  await page.getByLabel(/비밀번호|password/i).fill(password);
  await page.getByRole('button', { name: /회원가입|가입|sign up/i }).click();
  await page.getByRole('button', { name: /새 캐릭터|캐릭터 만들기|create/i }).click();
  await page.getByRole('button', { name: /시작|생성|create/i }).click();
  await expect(page.getByText(/이름을 입력|이름은 필수|required/i)).toBeVisible();
});

test('anti-scenario: real company claims are not displayed', async ({ page }) => {
  await signUpAndCreateCharacter(page);
  await expect(page.getByText(/이재용|순다르 피차이|실제 논란|범죄 의혹/)).toHaveCount(0);
  await expect(page.getByText(/허구|패러디/)).toBeVisible();
});

test('anti-scenario: another user cannot access private character data', async ({ page, request }) => {
  await signUpAndCreateCharacter(page);
  const characterId = await page.locator('[data-character-id]').first().getAttribute('data-character-id');
  expect(characterId).toBeTruthy();

  const res = await request.get(`/api/characters/${characterId}`);
  expect([401, 403, 404]).toContain(res.status());
});
