import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
    // the demo's service worker would serve /fixtures from cache and hide them
    // from page.route(); no e2e depends on the SW.
    serviceWorkers: 'block',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, grepInvert: /@mobile/ },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] }, grepInvert: /@mobile/ },
    { name: 'webkit', use: { ...devices['Desktop Safari'] }, grepInvert: /@mobile/ },
    // touch + a phone viewport; runs only the @mobile-tagged specs
    { name: 'mobile', use: { ...devices['Pixel 7'] }, grep: /@mobile/ },
  ],
  webServer: {
    command: 'pnpm build && pnpm preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
