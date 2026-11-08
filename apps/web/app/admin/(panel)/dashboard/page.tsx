import type { Metadata } from "next"
import { AdminDashboard } from "@/components/admin/pages/dashboard"

export const metadata: Metadata = { title: "Overview" }

export default function Page() {
  return <AdminDashboard />
}
