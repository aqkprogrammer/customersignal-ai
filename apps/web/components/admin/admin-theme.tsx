import { ForceLight } from "@/components/shared/force-light"

/**
 * Admin console canvas: the light Aurora surface (the sidebar sets its own navy scope). The admin stays light
 * regardless of the customer app's theme choice so operators always get the same dense, legible view.
 */
export function AdminThemeRoot({ children }: { children: React.ReactNode }) {
  return (
    <div className="light min-h-svh bg-background text-foreground">
      <ForceLight />
      {children}
    </div>
  )
}
