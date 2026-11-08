import type { Metadata } from "next"
import { AdminThemeRoot } from "@/components/admin/admin-theme"

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin · CustomerSignal AI" },
  robots: { index: false, follow: false },
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminThemeRoot>{children}</AdminThemeRoot>
}
