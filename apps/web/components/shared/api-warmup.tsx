"use client"

import { useEffect } from "react"

/**
 * Starts waking the API (free tier, sleeps when idle) as soon as someone lands on the site, so it is ready by
 * the time they sign in. One cheap public GET per browser session, sent when the page is idle; failures ignored.
 */
export function ApiWarmup() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem("cs_api_warm")) return
      sessionStorage.setItem("cs_api_warm", "1")
    } catch {
      /* storage unavailable — still warm once per page load */
    }
    const ping = () => void fetch("/api/v1/auth/providers", { cache: "no-store", credentials: "same-origin" }).catch(() => null)
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number }
    if (w.requestIdleCallback) w.requestIdleCallback(ping)
    else setTimeout(ping, 1200)
  }, [])
  return null
}
