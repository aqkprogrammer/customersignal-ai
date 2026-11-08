import type { Metadata } from "next"
import { AdminReviewAnalytics } from "@/components/admin/pages/content"

export const metadata: Metadata = { title: "Review Analytics" }

export default function Page() {
  return <AdminReviewAnalytics />
}
