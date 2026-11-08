import { z } from "zod"

/** Mirrors backend password policy (app/core/security.py: >=10 chars, letters + numbers). */
export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters")
  .regex(/[A-Za-z]/, "Include at least one letter")
  .regex(/\d/, "Include at least one number")

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
  remember: z.boolean(),
})

export const signupSchema = z
  .object({
    full_name: z.string().trim().min(1, "Enter your full name").max(200),
    email: z.string().trim().email("Enter a valid work email"),
    password: passwordSchema,
    confirm_password: z.string(),
    company_name: z.string().trim().max(200).optional(),
    accept_terms: z.boolean().refine((v) => v, "You must accept the terms to continue"),
  })
  .refine((v) => v.password === v.confirm_password, { path: ["confirm_password"], message: "Passwords don't match" })
export type SignupValues = z.infer<typeof signupSchema>

export const resetSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match" })

export const projectSchema = z.object({
  name: z.string().trim().min(1, "Give the project a name").max(200),
  business_name: z.string().trim().max(200).optional().or(z.literal("")),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  industry: z.string().max(120).optional().or(z.literal("")),
  country: z.string().max(80).optional().or(z.literal("")),
  city: z.string().max(120).optional().or(z.literal("")),
  website: z.string().trim().url("Enter a full URL, e.g. https://example.com").optional().or(z.literal("")),
  data_source: z.enum(["csv", "excel", "manual", "api", "integration"]),
})
export type ProjectValues = z.infer<typeof projectSchema>
