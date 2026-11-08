import type { Metadata } from "next"
import { Suspense } from "react"
import { DynamicMarker } from "@/components/shared/dynamic-marker"
import { AdminUserDetailPage } from "@/components/admin/pages/user-detail"
import { CardSkeleton } from "@/components/shared/states"

export const metadata: Metadata = { title: "User" }

// The client view reads the dynamic [id] param via useParams, which suspends under cacheComponents.
export default function Page() {
  return (
    <>
      <Suspense fallback={<CardSkeleton rows={8} />}>
        <AdminUserDetailPage />
      </Suspense>
      <DynamicMarker />
    </>
  )
}
