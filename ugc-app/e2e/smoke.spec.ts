import { expect, test } from "@playwright/test";

test("public landing page links to sign in", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Nexeire" })).toBeVisible();
  await expect(page.getByText("Run UGC marketing on autopilot")).toBeVisible();

  await page.getByRole("link", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("protected app redirects unauthenticated visitors to login", async ({ page }) => {
  await page.goto("/app");

  await expect(page).toHaveURL(/\/login\?(?:setup=required&)?next=%2Fapp$/);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
});

test("login page is safe when Supabase env vars are missing", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByText("Supabase env vars are not configured yet")).toBeVisible();
  await expect(page.getByLabel("Email")).toBeDisabled();
  await expect(page.getByLabel("Password")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeDisabled();
});
