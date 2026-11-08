import { Suspense } from "react"
import { OverviewPage } from "./overview"

export const metadata = { title: "Overview" }

export default function Page() {
  return (
    <Suspense>
      <OverviewPage />
    </Suspense>
  )
}
