import { Suspense } from "react"
import { MarketingMotion } from "@/components/marketing/motion"
import { SiteFooter } from "@/components/marketing/site-footer"
import { SiteHeader, SiteHeaderWithPath } from "@/components/marketing/site-header"
import { ForceDark } from "@/components/signal/force-dark"

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <MarketingMotion>
      {/* The marketing site is always the dark instrument theme, whatever the app theme is. */}
      <ForceDark />
      <div className="dark flex min-h-screen flex-col overflow-x-clip bg-background text-foreground">
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
