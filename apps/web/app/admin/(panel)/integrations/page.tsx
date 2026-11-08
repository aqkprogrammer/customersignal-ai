import type { Metadata } from "next"
import { AdminIntegrations } from "@/components/admin/pages/operations"

export const metadata: Metadata = { title: "Integrations" }

export default function Page() {
  return <AdminIntegrations />
}
