"use client"

import { useEffect } from "react"

/**
 * The marketing site, auth and admin are designed for the light Aurora theme. The customer app lets people
 * choose dark mode, and next-themes applies that choice to <html> everywhere — so while these surfaces are
 * mounted we keep <html> light (portalled menus, dialogs and toasts included) and restore the user's choice
 * when they go back to the app. In-tree content is also wrapped in `.light`, so the first paint is correct
 * before this effect runs.
 */
export function ForceLight() {
  useEffect(() => {
    const html = document.documentElement
    const hadDark = html.classList.contains("dark")
    const prevScheme = html.style.colorScheme
    const apply = () => {
      if (html.classList.contains("dark")) html.classList.remove("dark")
      if (html.style.colorScheme !== "light") html.style.colorScheme = "light"
    }
    apply()
    const observer = new MutationObserver(apply)
    observer.observe(html, { attributes: true, attributeFilter: ["class", "style"] })
    return () => {
      observer.disconnect()
      if (hadDark) html.classList.add("dark")
      html.style.colorScheme = prevScheme
    }
  }, [])
  return null
}
