import type { Metadata } from "next"
import { Suspense } from "react"
import { DynamicMarker } from "@/components/shared/dynamic-marker"
import { AdminTicketDetail } from "@/components/admin/pages/support"
import { CardSkeleton } from "@/components/shared/states"

export const metadata: Metadata = { title: "Support Ticket" }

// The client view reads the dynamic [id] param via useParams, which suspends under cacheComponents.
export default function Page() {
  return (
    <>
      <Suspense fallback={<CardSkeleton rows={8} />}>
        <AdminTicketDetail />
      </Suspense>
      <DynamicMarker />
    </>
  )
}
