import type { Metadata } from "next"
import { AdminAuditLogs } from "@/components/admin/pages/governance"

export const metadata: Metadata = { title: "Audit Logs" }

export default function Page() {
  return <AdminAuditLogs />
}
