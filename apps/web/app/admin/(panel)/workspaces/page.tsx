import type { Metadata } from "next"
import { AdminWorkspaces } from "@/components/admin/pages/workspaces"

export const metadata: Metadata = { title: "Workspaces" }

export default function Page() {
  return <AdminWorkspaces />
}
