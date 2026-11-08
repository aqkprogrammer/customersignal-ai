import type { Metadata } from "next"
import { AdminSubscriptions } from "@/components/admin/pages/subscriptions"

export const metadata: Metadata = { title: "Subscriptions" }

export default function Page() {
  return <AdminSubscriptions />
}
