import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/acceptance',
  testMatch: '**/*.spec.ts',
  // Several acceptance specs own auxiliary Vite servers on fixed ports. Running
  // those specs concurrently lets one worker tear down a server another worker
  // is still using, which can strand the run without a useful final report.
  workers: 1,
  fullyParallel: false,
  // The full matrix is intentionally serialized because a few specs own fixed
  // auxiliary Vite ports. Give both browser projects enough time to finish;
  // the previous ten-minute cap interrupted the suite before cleanup/reporting.
  globalTimeout: 30 * 60_000,
  reporter: 'line',
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  webServer: {
    // Keep server startup independent from the availability of the remote
    // development database. Database-backed specs should report connectivity or
    // schema failures as test results instead of preventing every browser and
    // smoke test from reaching Next.js.
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 5'] },
    },
  ],
});
