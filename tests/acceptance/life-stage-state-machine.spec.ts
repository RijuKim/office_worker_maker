import { expect, type Page, test } from '@playwright/test';

const password = 'Password123!';

async function signUpAndCreateCharacter(page: Page) {
  const email = `life-stage-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;

  await page.goto('/');
  await page.getByPlaceholder('이메일').fill(email);
  await page.getByPlaceholder(/비밀번호/).fill(password);
  await page.getByRole('button', { name: '회원가입' }).click();
  await page.getByRole('button', { name: '회원가입' }).click();

  await page.getByPlaceholder('한서윤').fill('한서윤');
  await page.locator('select').selectOption('21');
  await page.getByRole('button', { name: '눈을 뜬다' }).click();

  await expect(page.getByText('한서윤')).toBeVisible();
}

test('play progress is shown as a semester or life-stage, not fixed 15-event progress', async ({ page }) => {
  await signUpAndCreateCharacter(page);

  await expect(page.getByText(/\d+\s*\/\s*15/)).toHaveCount(0);
  await expect(page.getByText(/\d학년\s*[12]학기|휴학|자퇴|졸업|추가학기|졸업 유예/)).toBeVisible();
});

test('low health or mental state can route to leave before normal career finalization', async ({ page }) => {
  await signUpAndCreateCharacter(page);

  const response = await page.evaluate(async () => {
    return fetch('/api/test/characters/current/hidden-state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        burnoutRisk: 85,
        stats: { health: 2, mental: 2 },
        eventFlags: { stageEventCount: 1, lifeStage: { id: 'college_mid' } },
      }),
    }).then((res) => res.status);
  });
  expect(response).toBeLessThan(300);

  await page.reload();
  await expect(page.getByText(/휴학|번아웃|회복|상담|병원/)).toBeVisible();
  await expect(page.getByText(/\d+\s*\/\s*15/)).toHaveCount(0);
});

test('career and graduation gate choices are strategies, not direct pass or fail commands', async ({ page }) => {
  await signUpAndCreateCharacter(page);

  const response = await page.evaluate(async () => {
    return fetch('/api/test/characters/current/progression', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentGradeYear: 4,
        coreEventCount: 12,
        eventFlags: {
          lifeStage: { id: 'college_late', term: { gradeYear: 4, semester: 2 } },
          graduation: { state: 'gate_ready' },
          stageEventCount: 2,
        },
      }),
    }).then((res) => res.status);
  });
  expect(response).toBeLessThan(300);

  await page.goto('/');
  await expect(page.getByRole('button', { name: /통과한다|합격한다|탈락한다|떨어진다|다음 회차/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /포트폴리오|추천서|면접|연구|프로젝트|회복|정리|협상/ }).first()).toBeVisible();
});

test('records and final result UI do not expose route grades', async ({ page }) => {
  await signUpAndCreateCharacter(page);
  await page.getByRole('button', { name: '기록' }).click();

  await expect(page.getByText(/\bA\b|\bB\b|\bC\b|GOOD ROUTE|MIXED ROUTE|HARD ROUTE|A등급|B등급|C등급/)).toHaveCount(0);
});
