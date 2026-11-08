import type { Metadata } from "next"
import { Suspense } from "react"
import { DynamicMarker } from "@/components/shared/dynamic-marker"
import { GapDetailPage } from "./gap-detail"

export const metadata: Metadata = { title: "Gap analysis", robots: { index: false } }

export default function Page() {
  return (
    <>
      <Suspense>
        <GapDetailPage />
      </Suspense>
      <DynamicMarker />
    </>
  )
}
