"use client"

import { useEffect } from "react"

/**
 * Forces the dark token set for the admin area. The wrapper div covers in-tree content; dialogs, sheets, selects and
 * toasts are portalled to <body>, so the `dark` class is also mirrored onto <html> while the admin area is mounted
 * (and restored on unmount so the customer app keeps the user's theme).
 */
export function AdminThemeRoot({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const html = document.documentElement
    const hadDark = html.classList.contains("dark")
    const prevScheme = html.style.colorScheme
    const apply = () => {
      if (!html.classList.contains("dark")) html.classList.add("dark")
      if (html.style.colorScheme !== "dark") html.style.colorScheme = "dark"
    }
    apply()
    // next-themes may rewrite the class (e.g. on a system theme change); keep dark while the admin is open.
    const observer = new MutationObserver(apply)
    observer.observe(html, { attributes: true, attributeFilter: ["class", "style"] })
    return () => {
      observer.disconnect()
      if (!hadDark) html.classList.remove("dark")
      html.style.colorScheme = prevScheme
    }
  }, [])

  return (
    <div className="dark min-h-svh bg-background text-foreground [background-image:radial-gradient(1200px_600px_at_80%_-10%,rgba(99,102,241,0.12),transparent_60%),radial-gradient(900px_500px_at_-10%_10%,rgba(124,58,237,0.08),transparent_60%)]">
      {children}
    </div>
  )
}
