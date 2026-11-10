"use client"
import { motion, useReducedMotion } from "motion/react"

/** "what to build" in cobalt, "next." in orange — revealed word by word with a soft rise. */
export function HeroWords() {
  const reduce = useReducedMotion()
  const words = [
    { w: "what", c: "text-[#4169F5]" },
    { w: "to", c: "text-[#4169F5]" },
    { w: "build", c: "text-[#4169F5]" },
    { w: "next.", c: "text-[#FF8757]" },
  ]
  return (
    <>
      {words.map((x, i) => (
        <span key={x.w}>
          <motion.span
            className={`relative inline-block ${x.c}`}
            initial={reduce ? false : { opacity: 0, y: "0.35em" }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 + i * 0.09, ease: [0.22, 1, 0.36, 1] }}
          >
            {x.w}
            {x.w === "next." && (
              <svg aria-hidden viewBox="0 0 200 20" preserveAspectRatio="none" className="absolute -bottom-[0.08em] left-0 h-[0.18em] w-[92%] text-[#FF8757]">
                <motion.path
                  d="M2 14 C 50 4, 120 4, 198 10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="5"
                  strokeLinecap="round"
                  initial={reduce ? false : { pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.8, delay: 0.7, ease: [0.22, 1, 0.36, 1] }}
                />
              </svg>
            )}
          </motion.span>
          {i < words.length - 1 ? " " : null}
        </span>
      ))}
    </>
  )
}
