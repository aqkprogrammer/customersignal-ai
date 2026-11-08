import type { Metadata } from "next"
import { AdminJobs } from "@/components/admin/pages/operations"

export const metadata: Metadata = { title: "Background Jobs" }

export default function Page() {
  return <AdminJobs />
}
