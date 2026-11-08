import type { Metadata } from "next"
import { AdminSupport } from "@/components/admin/pages/support"

export const metadata: Metadata = { title: "Support Tickets" }

export default function Page() {
  return <AdminSupport />
}
