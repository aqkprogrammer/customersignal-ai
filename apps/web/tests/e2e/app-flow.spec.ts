import { expect, test } from "@playwright/test"

/**
 * Full user journey: signup → onboarding → project → CSV upload → analysis → report → logout → login.
 * Requires the API to run with EMAIL_VERIFICATION_REQUIRED=false and a worker (or JOBS_INLINE=true).
 * Enable with E2E_FULL_FLOW=1.
 */
test.skip(!process.env.E2E_FULL_FLOW, "Set E2E_FULL_FLOW=1 (API with EMAIL_VERIFICATION_REQUIRED=false)")

const CSV = [
  "review_text,rating,date,reviewer",
  "We waited over an hour past our appointment.,1,2026-10-01,R1",
  "The receptionist was rude and dismissive.,2,2026-10-03,R2",
  "Excellent results and very clean clinic.,5,2026-10-05,R3",
  "The bill was much higher than quoted.,2,2026-10-07,R4",
  "Friendly staff and professional doctor.,5,2026-10-09,R5",
  "Nobody called me back about my results.,1,2026-10-11,R6",
].join("\n")

test("signup through first report", async ({ page }) => {
  const email = `e2e+${Date.now()}@example.com`
  const password = `E2ePass${Date.now()}`

  await page.goto("/signup")
  await page.getByLabel("Full name").fill("E2E Tester")
  await page.getByLabel("Work email").fill(email)
  await page.getByLabel("Password", { exact: true }).fill(password)
  await page.getByLabel("Confirm password").fill(password)
  // Three sections: 01 account identity → 02 business profile → 03 workspace configuration.
  await page.getByRole("button", { name: "Continue" }).click()
  await page.getByRole("button", { name: "Continue" }).click()
  await page.getByRole("checkbox").first().click()
  await page.getByRole("button", { name: "Create account" }).click()

  await expect(page).toHaveURL(/\/onboarding/)
  await page.getByRole("button", { name: /Get started/ }).click()
  await page.getByRole("button", { name: /Beauty & wellness/ }).click()
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: /^Continue/ }).click()
  await page.getByRole("button", { name: /^Continue/ }).click()
  await page.getByLabel("Project name").fill("E2E Clinic")
  await page.getByRole("button", { name: "Create project" }).click()
  await page.getByRole("button", { name: /Upload your first reviews/ }).click()

  await expect(page.getByRole("dialog")).toContainText("Upload reviews")
  await page.locator('input[type="file"]').setInputFiles({ name: "reviews.csv", mimeType: "text/csv", buffer: Buffer.from(CSV) })
  await page.getByRole("button", { name: "Upload & import" }).click()
  await expect(page.getByRole("dialog")).toContainText("Analysis complete", { timeout: 45_000 }).catch(async () => {
    await expect(page.getByRole("dialog")).toContainText("Completed", { timeout: 45_000 })
  })
  await page.getByRole("button", { name: "Done" }).click()
  await expect(page.getByText("Reviews", { exact: true }).first()).toBeVisible()

  await page.goto("/app/reports?new=1")
  await page.getByRole("button", { name: "Generate", exact: true }).click()
  await expect(page.getByRole("button", { name: /Download PDF/ })).toBeEnabled({ timeout: 45_000 })

  await page.getByRole("button", { name: "Account menu" }).click()
  await page.getByRole("menuitem", { name: /Sign out/ }).click()
  await expect(page).toHaveURL(/\/login/)
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password", { exact: true }).fill(password)
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page).toHaveURL(/\/app/)
})
