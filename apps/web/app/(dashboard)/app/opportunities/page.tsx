import { Suspense } from "react"
import { OpportunitiesPage } from "./opportunities"

export const metadata = { title: "Product Opportunities" }

export default function Page() {
  return (
    <Suspense>
      <OpportunitiesPage />
    </Suspense>
  )
}
