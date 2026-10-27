import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  snapshotDir: "./tests/__screenshots__",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  timeout: 45000,
  expect: {
    timeout: 10000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.05,
    },
  },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    locale: "id-ID",
    timezoneId: "Asia/Jakarta",
    reducedMotion: "reduce",
    colorScheme: "light",
  },
  projects: [
    {
      name: "desktop-1280x800",
      use: {
        viewport: { width: 1280, height: 800 },
        browserName: "chromium",
        colorScheme: "light",
      },
    },
    {
      name: "tablet-768x1024",
      use: {
        viewport: { width: 768, height: 1024 },
        browserName: "chromium",
        colorScheme: "light",
      },
    },
    {
      name: "mobile-390x844",
      use: {
        viewport: { width: 390, height: 844 },
        browserName: "chromium",
        isMobile: true,
        colorScheme: "light",
      },
    },
    {
      name: "desktop-dark-1280x800",
      use: {
        viewport: { width: 1280, height: 800 },
        browserName: "chromium",
        colorScheme: "dark",
      },
    },
  ],
  webServer: {
    command: "npm run build && npm start",
    port: 3000,
    reuseExistingServer: true,
    timeout: 120000,
  },
});
