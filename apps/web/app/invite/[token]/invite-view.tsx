"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2, Users } from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import { Logo } from "@/components/brand/logo"
import { ErrorState } from "@/components/shared/states"
import { Button } from "@/components/ui/button"
import { api, errorMessage, setActiveWorkspaceId } from "@/lib/api"
import { titleCase } from "@/lib/utils"
import type { Session } from "@/types/api"

export function InvitePage() {
  const { token } = useParams<{ token: string }>()
  const router = useRouter()
  const qc = useQueryClient()
  const preview = useQuery({
    queryKey: ["invite", token],
    queryFn: () => api<{ workspace_name: string; email: string; role: string }>(`/team/invitations/preview/${token}`, { noWorkspace: true }),
  })
  const session = useQuery({
    queryKey: ["session"],
    queryFn: () => api<Session>("/auth/me", { noWorkspace: true }),
    retry: false,
  })
  const accept = useMutation({
    mutationFn: () => api<{ workspace_id: string }>("/team/invitations/accept", { method: "POST", body: { token }, noWorkspace: true }),
    onSuccess: async (r) => {
      setActiveWorkspaceId(r.workspace_id)
      await qc.invalidateQueries({ queryKey: ["session"] })
      toast.success("You've joined the workspace.")
      router.replace("/app")
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const next = encodeURIComponent(`/invite/${token}`)

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#EFEEE9] px-4 dark:bg-background">
      <Logo className="mb-8" />
      <div className="surface w-full max-w-md p-8 text-center">
        {preview.isLoading ? (
          <Loader2 className="mx-auto size-6 animate-spin text-primary" />
        ) : preview.error ? (
          <ErrorState error={preview.error} />
        ) : (
          <>
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-accent text-primary">
              <Users className="size-5" />
            </div>
            <h1 className="mt-5 text-xl font-semibold">Join {preview.data?.workspace_name}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              You&apos;ve been invited as <strong>{titleCase(preview.data?.role)}</strong> ({preview.data?.email}).
            </p>
            {session.data ? (
              <Button className="mt-6 w-full" onClick={() => accept.mutate()} disabled={accept.isPending}>
                {accept.isPending && <Loader2 className="animate-spin" />} Accept invitation as {session.data.user.email}
              </Button>
            ) : (
              <div className="mt-6 grid gap-2">
                <Button asChild><Link href={`/login?next=${next}`}>Sign in to accept</Link></Button>
                <Button variant="outline" asChild><Link href={`/signup?next=${next}`}>Create an account</Link></Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
