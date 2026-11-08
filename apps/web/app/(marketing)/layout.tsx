import { Suspense } from "react"
import { MarketingMotion } from "@/components/marketing/motion"
import { SiteFooter } from "@/components/marketing/site-footer"
import { SiteHeader, SiteHeaderWithPath } from "@/components/marketing/site-header"

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <MarketingMotion>
      <div className="flex min-h-screen flex-col bg-background">
        {/* usePathname can suspend on unlisted dynamic params under cacheComponents; the fallback is the same header without active state. */}
        <Suspense fallback={<SiteHeader />}>
          <SiteHeaderWithPath />
        </Suspense>
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </div>
    </MarketingMotion>
  )
}
