"use client"

import { ArrowRight, FileText, LayoutDashboard, MessageSquareText, Radar, Target } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

const STEPS = [
  { icon: LayoutDashboard, title: "Your overview", body: "KPIs, sentiment trends, top complaints and opportunities — all computed from the reviews you analyze.", href: "/app" },
  { icon: MessageSquareText, title: "Review Intelligence", body: "Upload CSV/Excel exports, then explore sentiment, recurring themes and every review's AI explanation.", href: "/app/reviews" },
  { icon: Target, title: "1-Star Cold Pitch", body: "Turn a prospect's recurring complaints into an evidence-backed report and outreach pack.", href: "/app/opportunity-finder" },
  { icon: Radar, title: "3-Star Gap Finder", body: "Mine honest mid-rating reviews for unmet needs, missing features and positioning angles.", href: "/app/gap-finder" },
  { icon: FileText, title: "AI Reports", body: "Generate branded PDF reports with charts, evidence quotes and recommendations — and share them securely.", href: "/app/reports" },
]

export function ProductTour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [i, setI] = useState(0)
  const step = STEPS[i]
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-2 flex size-11 items-center justify-center rounded-xl bg-accent text-primary">
            <step.icon className="size-5" />
          </div>
          <DialogTitle>{step.title}</DialogTitle>
          <DialogDescription>{step.body}</DialogDescription>
        </DialogHeader>
        <div className="flex gap-1.5" aria-label={`Step ${i + 1} of ${STEPS.length}`}>
          {STEPS.map((s, idx) => <span key={s.title} className={cn("h-1 flex-1 rounded-full bg-muted", idx <= i && "bg-primary")} />)}
        </div>
        <DialogFooter className="sm:justify-between">
          <Button variant="ghost" onClick={onClose}>Skip tour</Button>
          <div className="flex gap-2">
            <Button variant="outline" asChild onClick={onClose}><Link href={step.href}>Open</Link></Button>
            {i < STEPS.length - 1 ? (
              <Button onClick={() => setI(i + 1)}>Next <ArrowRight /></Button>
            ) : (
              <Button onClick={onClose}>Finish</Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
