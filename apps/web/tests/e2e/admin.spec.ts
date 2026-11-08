import { expect, test } from "@playwright/test"

/** Requires an existing super-admin: set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD (no MFA on that account). */
const email = process.env.E2E_ADMIN_EMAIL
const password = process.env.E2E_ADMIN_PASSWORD
test.skip(!email || !password, "Set E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD")

test("admin can sign in, browse users and see the audit trail", async ({ page }) => {
  await page.goto("/admin/login")
  await page.getByLabel("Email").fill(email!)
  await page.getByLabel("Password").fill(password!)
  await page.keyboard.press("Enter")
  await expect(page).toHaveURL(/\/admin\/dashboard/)
  await expect(page.getByText("Platform overview")).toBeVisible()

  await page.goto("/admin/users")
  await expect(page.getByRole("heading", { name: "Users" })).toBeVisible()

  await page.goto("/admin/audit-logs")
  await expect(page.getByText("admin.login").first()).toBeVisible()
})
