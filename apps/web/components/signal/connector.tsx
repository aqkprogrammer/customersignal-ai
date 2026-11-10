"use client"
import * as React from "react"

type Pt = [number, number]

/** Orthogonal route (H → V → H) between two points with rounded corners — reads like circuit routing. */
export function route(from: Pt, to: Pt, viaX: number, radius = 10): string {
  const [x0, y0] = from
  const [x1, y1] = to
  const dy = y1 - y0
  if (Math.abs(dy) < 1) return `M ${x0} ${y0} H ${x1}`
  const r = Math.min(radius, Math.abs(dy) / 2, Math.abs(viaX - x0), Math.abs(x1 - viaX))
  const sx1 = Math.sign(viaX - x0) || 1
  const sx2 = Math.sign(x1 - viaX) || 1
  const sy = Math.sign(dy)
  return [
    `M ${x0} ${y0}`,
    `H ${viaX - sx1 * r}`,
    `Q ${viaX} ${y0} ${viaX} ${y0 + sy * r}`,
    `V ${y1 - sy * r}`,
    `Q ${viaX} ${y1} ${viaX + sx2 * r} ${y1}`,
    `H ${x1}`,
  ].join(" ")
}

/**
 * A routed connector with a signal packet. Each change of `fire` (a non-zero counter) sends one packet
 * along the path via SMIL — no React re-renders while it travels. `active` brightens the line.
 */
export function SignalConnector({
  d,
  fire,
  active,
  color = "var(--signal)",
  dur = 1.1,
  animate = true,
}: {
  d: string
  fire?: number
  active?: boolean
  color?: string
  dur?: number
  animate?: boolean
}) {
  const motion = React.useRef<SVGAnimateMotionElement>(null)
  const fade = React.useRef<SVGAnimateElement>(null)
  React.useEffect(() => {
    if (!animate || !fire) return
    try {
      motion.current?.beginElement()
      fade.current?.beginElement()
    } catch {
      /* SMIL unavailable — the line still renders */
    }
  }, [fire, animate])

  return (
    <g>
      <path d={d} fill="none" stroke={color} strokeOpacity={active ? 0.32 : 0.13} strokeWidth="1.1" style={{ transition: "stroke-opacity .5s" }} />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeOpacity={active ? 0.85 : 0.32}
        strokeWidth="1"
        strokeDasharray="2 7"
        style={{ transition: "stroke-opacity .5s", animation: animate && active ? "cs-dash 14s linear infinite" : undefined }}
      />
      {animate && (
        <g opacity="0">
          <circle r="7" fill={color} opacity="0.2" />
          <circle r="2.6" fill="#ffffff" />
          <animateMotion ref={motion} begin="indefinite" dur={`${dur}s`} fill="freeze" path={d} keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines="0.45 0 0.2 1" />
          <animate ref={fade} attributeName="opacity" values="0;1;1;0" keyTimes="0;0.08;0.86;1" dur={`${dur}s`} begin="indefinite" fill="freeze" />
        </g>
      )}
    </g>
  )
}
