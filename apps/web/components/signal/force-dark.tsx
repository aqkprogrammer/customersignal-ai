"use client"

import { useEffect } from "react"

/**
 * Keeps the dark token set on <html> while mounted (portalled dialogs, selects and toasts render under
 * <body>, outside any wrapper), restoring the user's own theme on unmount.
 */
export function ForceDark() {
  useEffect(() => {
    const html = document.documentElement
    const hadDark = html.classList.contains("dark")
    const prevScheme = html.style.colorScheme
    const apply = () => {
      if (!html.classList.contains("dark")) html.classList.add("dark")
      if (html.style.colorScheme !== "dark") html.style.colorScheme = "dark"
    }
    apply()
    const observer = new MutationObserver(apply)
    observer.observe(html, { attributes: true, attributeFilter: ["class", "style"] })
    return () => {
      observer.disconnect()
      if (!hadDark) html.classList.remove("dark")
      html.style.colorScheme = prevScheme
    }
  }, [])
  return null
}
