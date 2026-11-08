import type { Metadata } from "next"
import { AdminEmailTemplates } from "@/components/admin/pages/communications"

export const metadata: Metadata = { title: "Email Templates" }

export default function Page() {
  return <AdminEmailTemplates />
}
