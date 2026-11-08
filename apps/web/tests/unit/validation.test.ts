import { describe, expect, it } from "vitest"
import { loginSchema, projectSchema, resetSchema, signupSchema } from "@/lib/validation"

const validSignup = {
  full_name: "Aisha Khan",
  email: "aisha@clinic.ae",
  password: "StrongPass123",
  confirm_password: "StrongPass123",
  company_name: "",
  accept_terms: true,
}

describe("signupSchema", () => {
  it("accepts a valid signup", () => {
    expect(signupSchema.safeParse(validSignup).success).toBe(true)
  })

  it("requires matching passwords", () => {
    const r = signupSchema.safeParse({ ...validSignup, confirm_password: "Different123" })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0].path).toEqual(["confirm_password"])
  })

  it.each([
    ["short1", "at least 10"],
    ["onlyletterspassword", "number"],
    ["1234567890123", "letter"],
  ])("rejects weak password %s", (password, hint) => {
    const r = signupSchema.safeParse({ ...validSignup, password, confirm_password: password })
    expect(r.success).toBe(false)
    expect(r.error?.issues.map((i) => i.message).join(" ").toLowerCase()).toContain(hint)
  })

  it("requires accepting the terms", () => {
    expect(signupSchema.safeParse({ ...validSignup, accept_terms: false }).success).toBe(false)
  })

  it("rejects invalid emails", () => {
    expect(signupSchema.safeParse({ ...validSignup, email: "not-an-email" }).success).toBe(false)
  })
})

describe("loginSchema", () => {
  it("requires email and password", () => {
    expect(loginSchema.safeParse({ email: "", password: "", remember: true }).success).toBe(false)
    expect(loginSchema.safeParse({ email: "a@b.co", password: "x", remember: false }).success).toBe(true)
  })
})

describe("resetSchema", () => {
  it("validates strength and confirmation", () => {
    expect(resetSchema.safeParse({ password: "GoodPass2026", confirm: "GoodPass2026" }).success).toBe(true)
    expect(resetSchema.safeParse({ password: "GoodPass2026", confirm: "nope" }).success).toBe(false)
  })
})

describe("projectSchema", () => {
  it("requires a name and a valid website when present", () => {
    expect(projectSchema.safeParse({ name: "", data_source: "csv" }).success).toBe(false)
    expect(projectSchema.safeParse({ name: "Branch", website: "example.com", data_source: "csv" }).success).toBe(false)
    expect(projectSchema.safeParse({ name: "Branch", website: "https://example.com", data_source: "csv" }).success).toBe(true)
    expect(projectSchema.safeParse({ name: "Branch", website: "", data_source: "excel" }).success).toBe(true)
  })
})
