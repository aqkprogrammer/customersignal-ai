import type { Metadata } from "next"
import { AdminFeatureFlags } from "@/components/admin/pages/governance"

export const metadata: Metadata = { title: "Feature Flags" }

export default function Page() {
  return <AdminFeatureFlags />
}
