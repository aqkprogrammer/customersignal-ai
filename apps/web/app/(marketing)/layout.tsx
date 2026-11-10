import { Suspense } from "react"
import { MarketingMotion } from "@/components/marketing/motion"
import { SiteFooter } from "@/components/marketing/site-footer"
import { SiteHeader, SiteHeaderWithPath } from "@/components/marketing/site-header"
import { ApiWarmup } from "@/components/shared/api-warmup"
import { ForceLight } from "@/components/shared/force-light"

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <MarketingMotion>
      <ApiWarmup />
      <ForceLight />
      <div className="light flex min-h-screen flex-col overflow-x-clip bg-background text-foreground">
        {/* usePathname can suspend on unlisted dynamic params under cacheComponents; the fallback is the same header without active state. */}
        <Suspense fallback={<SiteHeader />}>
          <SiteHeaderWithPath />
        </Suspense>
        <main id="main" className="-mt-[68px] flex-1">
          {children}
        </main>
        <SiteFooter />
      </div>
    </MarketingMotion>
  )
}
