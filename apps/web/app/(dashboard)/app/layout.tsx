import type { Metadata } from "next"
import { AppShell } from "@/components/dashboard/app-shell"
import { DynamicMarker } from "@/components/shared/dynamic-marker"

export const metadata: Metadata = { title: { default: "Dashboard", template: "%s · CustomerSignal AI" }, robots: { index: false } }

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppShell>{children}</AppShell>
      {/* Authenticated, request-time views (including dynamic [id] routes). */}
      <DynamicMarker />
    </>
  )
}
