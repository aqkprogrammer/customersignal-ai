import type { Metadata } from "next"
import { Suspense } from "react"
import { DynamicMarker } from "@/components/shared/dynamic-marker"
import { ReportDetailPage } from "./report-detail"

export const metadata: Metadata = { title: "Report", robots: { index: false } }

export default function Page() {
  return (
    <>
      <Suspense>
        <ReportDetailPage />
      </Suspense>
      <DynamicMarker />
    </>
  )
}
