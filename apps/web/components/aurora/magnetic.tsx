"use client"
import * as React from "react"
import { motion, useMotionValue, useReducedMotion, useSpring } from "motion/react"

/** Sparing magnetic pull for a primary CTA: follows the pointer by a few pixels, springs back on leave. */
export function Magnetic({ children, strength = 6, className }: { children: React.ReactNode; strength?: number; className?: string }) {
  const reduce = useReducedMotion()
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const sx = useSpring(x, { stiffness: 260, damping: 20, mass: 0.4 })
  const sy = useSpring(y, { stiffness: 260, damping: 20, mass: 0.4 })
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reduce || e.pointerType !== "mouse") return
    const r = e.currentTarget.getBoundingClientRect()
    x.set(((e.clientX - r.left) / r.width - 0.5) * strength * 2)
    y.set(((e.clientY - r.top) / r.height - 0.5) * strength * 2)
  }
  const reset = () => {
    x.set(0)
    y.set(0)
  }
  return (
    <motion.div className={className} style={{ x: sx, y: sy }} onPointerMove={onMove} onPointerLeave={reset}>
      {children}
    </motion.div>
  )
}
