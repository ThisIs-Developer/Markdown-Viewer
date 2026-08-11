const { defineConfig, devices } = require('@playwright/test');

const PORT = Number(process.env.MARKDOWN_VIEWER_TEST_PORT || 4173);
const HOST = '127.0.0.1';
const browserChannel = process.env.PLAYWRIGHT_CHANNEL || undefined;

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: {
    timeout: 15_000
  },
  fullyParallel: false,
  reporter: [['list'], ['html', { open: 'never' }]],
  webServer: {
    command: 'node tests/helpers/static-server.mjs',
    url: `http://${HOST}:${PORT}/`,
    reuseExistingServer: true,
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
