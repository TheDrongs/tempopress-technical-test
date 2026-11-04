import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  // Full workflows acknowledge seven modal actions and switch between three users.
  timeout: 60_000,
  workers: 3,
  fullyParallel: true,
  use: {
    baseURL: 'http://127.0.0.1:5174',
    channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome',
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5174',
    url: 'http://127.0.0.1:5174',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
})
