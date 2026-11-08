"use client"

import { create } from "zustand"
import { getActiveWorkspaceId } from "@/lib/api"

interface WorkspaceState {
  workspaceId: string | null
  setWorkspaceId: (id: string | null) => void
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  commandOpen: boolean
  setCommandOpen: (open: boolean) => void
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  workspaceId: typeof window !== "undefined" ? getActiveWorkspaceId() : null,
  setWorkspaceId: (workspaceId) => set({ workspaceId }),
  sidebarCollapsed: false,
  toggleSidebar: () =>
    set((s) => {
      try {
        window.localStorage.setItem("cs_sidebar_collapsed", s.sidebarCollapsed ? "0" : "1")
      } catch {
        /* ignore */
      }
      return { sidebarCollapsed: !s.sidebarCollapsed }
    }),
  commandOpen: false,
  setCommandOpen: (commandOpen) => set({ commandOpen }),
}))
