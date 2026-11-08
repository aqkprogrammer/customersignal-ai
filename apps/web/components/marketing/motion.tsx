"use client"

import { MotionConfig, motion, type HTMLMotionProps } from "motion/react"

/** Honors the user's reduced-motion preference for every animation in the marketing site. */
export function MarketingMotion({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}

type RevealProps = HTMLMotionProps<"div"> & { delay?: number; y?: number }

/** Subtle fade + slide-in when the element scrolls into view. */
export function Reveal({ delay = 0, y = 14, children, ...props }: RevealProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -60px 0px" }}
      transition={{ duration: 0.55, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
      {...props}
    >
      {children}
    </motion.div>
  )
}

type RevealItemProps = HTMLMotionProps<"li"> & { delay?: number; y?: number }

/** List-item variant of Reveal, so lists keep valid <ul>/<li> structure. */
export function RevealItem({ delay = 0, y = 14, children, ...props }: RevealItemProps) {
  return (
    <motion.li
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -60px 0px" }}
      transition={{ duration: 0.55, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
      {...props}
    >
      {children}
    </motion.li>
  )
}
