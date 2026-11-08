import type { Metadata } from "next"
import { AdminUsers } from "@/components/admin/pages/users"

export const metadata: Metadata = { title: "Users" }

export default function Page() {
  return <AdminUsers />
}
