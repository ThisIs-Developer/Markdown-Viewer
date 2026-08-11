const { defineConfig, devices } = require('@playwright/test');

const PORT = Number(process.env.MARKDOWN_VIEWER_TEST_PORT || 4173);
const HOST = '127.0.0.1';
const isCI = Boolean(process.env.CI);
const browserChannel = process.env.PLAYWRIGHT_CHANNEL || undefined;

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  globalTimeout: isCI ? 30 * 60_000 : undefined,
  expect: {
    timeout: 15_000
  },
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  webServer: {
    command: 'node tests/helpers/static-server.mjs',
    url: `http://${HOST}:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe'
  },
  use: {
    baseURL: `http://${HOST}:${PORT}`,
    serviceWorkers: 'block',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: browserChannel
      }
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] }
    }
  ]
});
