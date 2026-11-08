import type { Metadata } from "next"
import { AdminRevenue } from "@/components/admin/pages/billing"

export const metadata: Metadata = { title: "Revenue" }

export default function Page() {
  return <AdminRevenue />
}
