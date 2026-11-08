import type { Metadata } from "next"
import { Suspense } from "react"
import { DynamicMarker } from "@/components/shared/dynamic-marker"
import { LeadPage } from "./lead-detail"

export const metadata: Metadata = { title: "Lead", robots: { index: false } }

export default function Page() {
  return (
    <>
      <Suspense>
        <LeadPage />
      </Suspense>
      <DynamicMarker />
    </>
  )
}
