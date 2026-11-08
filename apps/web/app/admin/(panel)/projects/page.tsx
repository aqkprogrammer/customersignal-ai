import type { Metadata } from "next"
import { AdminProjects } from "@/components/admin/pages/content"

export const metadata: Metadata = { title: "Projects" }

export default function Page() {
  return <AdminProjects />
}
