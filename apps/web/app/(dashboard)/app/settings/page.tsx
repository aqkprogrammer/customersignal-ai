import { Suspense } from "react"
import { SettingsPage } from "./settings"

export const metadata = { title: "Settings" }

export default function Page() {
  return (
    <Suspense>
      <SettingsPage />
    </Suspense>
  )
}
