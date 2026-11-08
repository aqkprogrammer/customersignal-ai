import { Suspense } from "react"
import { BillingPage } from "./billing"

export const metadata = { title: "Billing" }

export default function Page() {
  return (
    <Suspense>
      <BillingPage />
    </Suspense>
  )
}
