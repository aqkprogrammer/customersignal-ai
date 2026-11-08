import type { Metadata } from "next"
import { Suspense } from "react"
import { DynamicMarker } from "@/components/shared/dynamic-marker"
import { ProjectDetailPage } from "./project-detail"

export const metadata: Metadata = { title: "Project", robots: { index: false } }

export default function Page() {
  return (
    <>
      <Suspense>
        <ProjectDetailPage />
      </Suspense>
      <DynamicMarker />
    </>
  )
}
