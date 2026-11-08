import { pageMetadata } from "@/components/marketing/seo"
import { SolutionPage } from "@/components/marketing/solution-page"
import { SOLUTION_CONTENT } from "@/components/marketing/solutions-data"

const content = SOLUTION_CONTENT["restaurants"]

export const metadata = pageMetadata({
  title: content.metaTitle,
  description: content.metaDescription,
  path: "/solutions/restaurants",
})

export default function Page() {
  return <SolutionPage slug="restaurants" />
}
