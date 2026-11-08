import type { Metadata } from "next"
import { AdminAdmins } from "@/components/admin/pages/admins"

export const metadata: Metadata = { title: "Admins & Security" }

export default function Page() {
  return <AdminAdmins />
}
