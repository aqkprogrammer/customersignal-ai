import { expect, test } from "@playwright/test"

test("homepage shows the hero and CTAs", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Your customers are telling you what to build next.")
  await expect(page.getByRole("link", { name: /Start Free/i }).first()).toBeVisible()
  await expect(page.getByText(/Illustrative · sample data/i).first()).toBeVisible()
})

test("pricing loads plans from the API", async ({ page }) => {
  await page.goto("/pricing")
  for (const name of ["Free", "Starter", "Pro", "Business", "Enterprise"]) {
    await expect(page.getByText(name, { exact: true }).first()).toBeVisible()
  }
})

test("protected app routes redirect to login", async ({ page }) => {
  await page.goto("/app/reviews")
  await expect(page).toHaveURL(/\/login\?next=%2Fapp%2Freviews/)
})

test("admin routes redirect to the admin login", async ({ page }) => {
  await page.goto("/admin/users")
  await expect(page).toHaveURL(/\/admin\/login/)
})

test("signup validates fields client-side", async ({ page }) => {
  await page.goto("/signup")
  // Section 01 — account identity is validated before moving on.
  await page.getByRole("button", { name: "Continue" }).click()
  await expect(page.getByText("Enter your full name")).toBeVisible()
  await expect(page.getByText("Enter a valid work email")).toBeVisible()
  await expect(page.getByText("Use at least 10 characters")).toBeVisible()
})

test("login rejects wrong credentials without revealing accounts", async ({ page }) => {
  await page.goto("/login")
  await page.getByLabel("Email").fill("nobody@example.com")
  await page.getByLabel("Password", { exact: true }).fill("WrongPassword123")
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page.getByText("Incorrect email or password.")).toBeVisible()
})

test("sitemap and robots are served", async ({ request }) => {
  const robots = await request.get("/robots.txt")
  expect(await robots.text()).toContain("Disallow: /admin")
  const sitemap = await request.get("/sitemap.xml")
  expect(await sitemap.text()).toContain("/pricing")
})
