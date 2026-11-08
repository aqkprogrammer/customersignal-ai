import { Suspense } from "react"
import { AdminShell, AdminShellFallback } from "@/components/admin/shell"
import { DynamicMarker } from "@/components/shared/dynamic-marker"

export default function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={<AdminShellFallback />}>
        <AdminShell>{children}</AdminShell>
      </Suspense>
      {/* Admin pages are authenticated, request-time views (dynamic [id] params included). */}
      <DynamicMarker />
    </>
  )
}
