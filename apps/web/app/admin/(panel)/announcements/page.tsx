import type { Metadata } from "next"
import { AdminAnnouncements } from "@/components/admin/pages/communications"

export const metadata: Metadata = { title: "Announcements" }

export default function Page() {
  return <AdminAnnouncements />
}
