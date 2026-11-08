"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import { Field } from "@/components/forms/auth-fields"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { api, ApiError, errorMessage } from "@/lib/api"
import { COUNTRIES, INDUSTRIES } from "@/lib/site"
import { projectSchema, type ProjectValues } from "@/lib/validation"
import type { Project } from "@/types/api"

const EMPTY: ProjectValues = { name: "", business_name: "", description: "", industry: "", country: "", city: "", website: "", data_source: "csv" }

export function ProjectDialog({ open, onOpenChange, project, onSaved }: {
  open: boolean
  onOpenChange: (o: boolean) => void
  project?: Project | null
  onSaved?: (p: Project) => void
}) {
  const qc = useQueryClient()
  const router = useRouter()
  const form = useForm<ProjectValues>({ resolver: zodResolver(projectSchema), defaultValues: EMPTY })
  const { errors } = form.formState

  useEffect(() => {
    if (!open) return
    form.reset(
      project
        ? {
            name: project.name, business_name: project.business_name || "", description: project.description || "",
            industry: project.industry || "", country: project.country || "", city: project.city || "",
            website: project.website || "", data_source: (project.data_source as ProjectValues["data_source"]) || "csv",
          }
        : EMPTY,
    )
  }, [open, project, form])

  const save = useMutation({
    mutationFn: (v: ProjectValues) => {
      const body = Object.fromEntries(Object.entries(v).map(([k, val]) => [k, val === "" ? null : val]))
      return project
        ? api<Project>(`/projects/${project.id}`, { method: "PATCH", body })
        : api<Project>("/projects", { method: "POST", body })
    },
    onSuccess: (p) => {
      toast.success(project ? "Project updated" : "Project created")
      qc.invalidateQueries({ queryKey: ["projects"] })
      qc.invalidateQueries({ queryKey: ["project", p.id] })
      onOpenChange(false)
      onSaved?.(p)
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 402) toast.error(e.message, { action: { label: "Upgrade", onClick: () => router.push("/app/billing") } })
      else toast.error(errorMessage(e))
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{project ? "Edit project" : "New project"}</DialogTitle>
          <DialogDescription>A project groups reviews for one business, location or product — plus its competitors.</DialogDescription>
        </DialogHeader>
        <form id="project-form" onSubmit={form.handleSubmit((v) => save.mutate(v))} className="grid gap-3.5 sm:grid-cols-2" noValidate>
          <Field id="p-name" label="Project name" error={errors.name?.message} className="sm:col-span-2">
            <Input id="p-name" {...form.register("name")} aria-invalid={!!errors.name} />
          </Field>
          <Field id="p-biz" label="Business / product name" error={errors.business_name?.message} className="sm:col-span-2">
            <Input id="p-biz" placeholder="Used to match reviews to your business" {...form.register("business_name")} />
          </Field>
          <Field id="p-industry" label="Industry">
            <Controller control={form.control} name="industry" render={({ field }) => (
              <Select value={field.value || undefined} onValueChange={field.onChange}>
                <SelectTrigger id="p-industry" className="w-full"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{INDUSTRIES.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
              </Select>
            )} />
          </Field>
          <Field id="p-source" label="Data source">
            <Controller control={form.control} name="data_source" render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="p-source" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV upload</SelectItem>
                  <SelectItem value="excel">Excel upload</SelectItem>
                  <SelectItem value="manual">Manual entry</SelectItem>
                  <SelectItem value="api">Reviews API</SelectItem>
                  <SelectItem value="integration">Integration</SelectItem>
                </SelectContent>
              </Select>
            )} />
          </Field>
          <Field id="p-country" label="Country">
            <Controller control={form.control} name="country" render={({ field }) => (
              <Select value={field.value || undefined} onValueChange={field.onChange}>
                <SelectTrigger id="p-country" className="w-full"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            )} />
          </Field>
          <Field id="p-city" label="City">
            <Input id="p-city" {...form.register("city")} />
          </Field>
          <Field id="p-web" label="Website" error={errors.website?.message} className="sm:col-span-2">
            <Input id="p-web" placeholder="https://" {...form.register("website")} />
          </Field>
          <Field id="p-desc" label="Description" className="sm:col-span-2">
            <Textarea id="p-desc" rows={3} {...form.register("description")} />
          </Field>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="project-form" disabled={save.isPending}>
            {save.isPending && <Loader2 className="animate-spin" />} {project ? "Save changes" : "Create project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
