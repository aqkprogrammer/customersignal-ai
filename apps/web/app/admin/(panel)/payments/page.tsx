import type { Metadata } from "next"
import { AdminPayments } from "@/components/admin/pages/billing"

export const metadata: Metadata = { title: "Payments" }

export default function Page() {
  return <AdminPayments />
}
