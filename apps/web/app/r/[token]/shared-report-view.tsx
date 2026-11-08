"use client"

import { useQuery } from "@tanstack/react-query"
import { Download, Loader2 } from "lucide-react"
import { useParams } from "next/navigation"
import { Logo } from "@/components/brand/logo"
import { ReportView } from "@/components/dashboard/report-view"
import { ErrorState } from "@/components/shared/states"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import { formatDate } from "@/lib/utils"
import type { Report } from "@/types/api"

export function SharedReportPage() {
  const { token } = useParams<{ token: string }>()
  const { data, error, isLoading } = useQuery({
    queryKey: ["shared-report", token],
    queryFn: () => api<Report & { workspace_name: string; expires_at: string | null }>(`/public/reports/${token}`, { noWorkspace: true }),
  })
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Logo />
          {data && (
            <Button asChild variant="outline" size="sm">
              <a href={`/api/v1/public/reports/${token}/pdf`} target="_blank" rel="noopener noreferrer"><Download /> PDF</a>
            </Button>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        {isLoading ? <Loader2 className="mx-auto size-6 animate-spin text-primary" /> : error ? <ErrorState error={error} /> : data && (
          <>
            <p className="text-sm text-muted-foreground">Shared by {data.workspace_name}{data.expires_at ? ` · link expires ${formatDate(data.expires_at)}` : ""}</p>
            <h1 className="mt-1 mb-6 text-2xl font-semibold">{data.title}</h1>
            <ReportView content={data.content || {}} />
          </>
        )}
      </main>
    </div>
  )
}
