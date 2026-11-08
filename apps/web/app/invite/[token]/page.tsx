import type { Metadata } from "next"
import { Suspense } from "react"
import { DynamicMarker } from "@/components/shared/dynamic-marker"
import { InvitePage } from "./invite-view"

export const metadata: Metadata = { title: "Accept invitation", robots: { index: false } }

export default function Page() {
  return (
    <>
      <Suspense>
        <InvitePage />
      </Suspense>
      <DynamicMarker />
    </>
  )
}
