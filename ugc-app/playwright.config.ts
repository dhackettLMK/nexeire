import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_PORT ?? process.env.PORT ?? 3100);
const adminEmails =
  process.env.ADMIN_EMAILS ??
  process.env.E2E_ADMIN_EMAIL ??
  process.env.E2E_AUTH_EMAIL ??
  "test@example.com";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: `pnpm dev --hostname 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer:
      process.env.PLAYWRIGHT_REUSE_SERVER === "1" && !process.env.CI,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
      ADMIN_EMAILS: adminEmails,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? "",
      APP_BASE_URL: process.env.APP_BASE_URL ?? `http://127.0.0.1:${port}`,
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ?? "",
      STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET ?? "",
      STRIPE_CREDIT_BUNDLE_CREDITS:
        process.env.STRIPE_CREDIT_BUNDLE_CREDITS ?? "10",
      STRIPE_CREDIT_BUNDLE_AMOUNT_CENTS:
        process.env.STRIPE_CREDIT_BUNDLE_AMOUNT_CENTS ?? "4900",
      NEXT_PUBLIC_ENABLE_AGENTATION: "false",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
