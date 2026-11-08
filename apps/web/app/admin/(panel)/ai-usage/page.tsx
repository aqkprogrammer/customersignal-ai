import type { Metadata } from "next"
import { AdminAIUsage } from "@/components/admin/pages/ai-usage"

export const metadata: Metadata = { title: "AI Usage" }

export default function Page() {
  return <AdminAIUsage />
}
