import type { Metadata } from "next"
import { OnboardingWizard } from "./wizard"

export const metadata: Metadata = { title: "Set up your workspace", robots: { index: false } }

export default function OnboardingPage() {
  return <OnboardingWizard />
}
