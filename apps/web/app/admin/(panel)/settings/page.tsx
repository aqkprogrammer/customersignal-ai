import type { Metadata } from "next"
import { AdminSettings } from "@/components/admin/pages/governance"

export const metadata: Metadata = { title: "System Settings" }

export default function Page() {
  return <AdminSettings />
}
