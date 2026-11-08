import type { Metadata } from "next"
import { Suspense } from "react"
import { DynamicMarker } from "@/components/shared/dynamic-marker"
import { SharedReportPage } from "./shared-report-view"

export const metadata: Metadata = { title: "Shared report", robots: { index: false } }

export default function Page() {
  return (
    <>
      <Suspense>
        <SharedReportPage />
      </Suspense>
      <DynamicMarker />
    </>
  )
}
