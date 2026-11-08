import { Suspense } from "react"
import { CompetitorsPage } from "./competitors"

export const metadata = { title: "Competitor Analysis" }

export default function Page() {
  return (
    <Suspense>
      <CompetitorsPage />
    </Suspense>
  )
}
