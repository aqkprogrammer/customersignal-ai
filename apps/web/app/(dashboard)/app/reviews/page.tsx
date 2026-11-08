import { Suspense } from "react"
import { ReviewsPage } from "./reviews"

export const metadata = { title: "Review Intelligence" }

export default function Page() {
  return (
    <Suspense>
      <ReviewsPage />
    </Suspense>
  )
}
