import type { Metadata } from "next"
import { AdminPlans } from "@/components/admin/pages/plans"

export const metadata: Metadata = { title: "Plans & Pricing" }

export default function Page() {
  return <AdminPlans />
}
