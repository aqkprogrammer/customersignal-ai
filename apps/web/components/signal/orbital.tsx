/**
 * OrbitalSignalSystem — tilted orbital rings with small satellite nodes.
 *
 * Rendered as an SVG <g>, in two layers so it can wrap a sphere with correct depth:
 *   layer="back"  → full faint orbit + satellites (drawn *before* the sphere, so the sphere hides them)
 *   layer="front" → near half of each orbit + satellites clipped to that half (drawn *after* the sphere)
 * Both layers share SMIL timing, so the two satellite copies stay in lock-step. `layer="all"` draws a
 * self-contained system (no occluder). No React re-renders; reduced motion places satellites statically.
 */
import * as React from "react"

export type Orbit = {
  rx: number
  ry: number
  /** In-plane rotation of the orbit, degrees. */
  rotate: number
  /** Seconds per revolution. */
  dur: number
  satellites: { phase: number; r: number; tone?: "signal" | "ice" | "mint" | "ember" }[]
  dashed?: boolean
}

export const DEFAULT_ORBITS: Orbit[] = [
  { rx: 200, ry: 46, rotate: -14, dur: 26, satellites: [{ phase: 0.08, r: 6.5 }, { phase: 0.58, r: 3.2, tone: "ice" }] },
  { rx: 176, ry: 58, rotate: 21, dur: 38, satellites: [{ phase: 0.33, r: 4.8, tone: "mint" }], dashed: true },
  { rx: 222, ry: 30, rotate: 4, dur: 54, satellites: [{ phase: 0.74, r: 3.6, tone: "ice" }] },
]

const TONE = { signal: "var(--signal)", ice: "var(--ice)", mint: "var(--mint)", ember: "var(--ember)" }
const ellipseD = (rx: number, ry: number) => `M ${rx} 0 A ${rx} ${ry} 0 1 1 ${-rx} 0 A ${rx} ${ry} 0 1 1 ${rx} 0`

function Satellite({ r, tone, gid }: { r: number; tone: string; gid: string }) {
  return (
    <>
      <circle r={r * 2.4} fill={tone} opacity="0.1" />
      <circle r={r} fill={`url(#${gid})`} />
      <circle r={r} fill="none" stroke={tone} strokeOpacity="0.7" strokeWidth="0.6" />
    </>
  )
}

export function OrbitalSignalSystem({
  orbits = DEFAULT_ORBITS,
  layer = "all",
  animate = true,
  idPrefix,
}: {
  orbits?: Orbit[]
  layer?: "back" | "front" | "all"
  animate?: boolean
  /** Shared between the back and front layers of one core so gradients/clips resolve once. */
  idPrefix: string
}) {
  const gid = `${idPrefix}-sat`
  return (
    <g aria-hidden>
      {layer !== "front" && (
        <defs>
          <radialGradient id={gid} cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="35%" stopColor="#bfeff3" />
            <stop offset="75%" stopColor="#2b5f69" />
            <stop offset="100%" stopColor="#0a1a20" />
          </radialGradient>
          {orbits.map((o, i) => (
            <clipPath key={i} id={`${idPrefix}-near-${i}`} clipPathUnits="userSpaceOnUse">
              <rect x={-o.rx - 20} y={0} width={o.rx * 2 + 40} height={o.ry + 20} />
            </clipPath>
          ))}
        </defs>
      )}
      {orbits.map((o, i) => {
        const d = ellipseD(o.rx, o.ry)
        const near = layer === "front"
        return (
          <g key={i} transform={`rotate(${o.rotate})`}>
            {near ? (
              <path d={`M ${o.rx} 0 A ${o.rx} ${o.ry} 0 0 1 ${-o.rx} 0`} fill="none" stroke="var(--signal)" strokeOpacity="0.42" strokeWidth="0.9" strokeDasharray={o.dashed ? "2 5" : undefined} />
            ) : (
              <path d={d} fill="none" stroke="var(--foreground)" strokeOpacity={layer === "back" ? 0.1 : 0.16} strokeWidth="0.8" strokeDasharray={o.dashed ? "2 5" : undefined} />
            )}
            <g clipPath={near ? `url(#${idPrefix}-near-${i})` : undefined}>
              {o.satellites.map((s, k) => {
                const tone = TONE[s.tone ?? "signal"]
                if (!animate) {
                  const a = s.phase * Math.PI * 2
                  return (
                    <g key={k} transform={`translate(${(o.rx * Math.cos(a)).toFixed(1)} ${(o.ry * Math.sin(a)).toFixed(1)})`}>
                      <Satellite r={s.r} tone={tone} gid={gid} />
                    </g>
                  )
                }
                return (
                  <g key={k}>
                    <Satellite r={s.r} tone={tone} gid={gid} />
                    <animateMotion dur={`${o.dur}s`} begin={`${-s.phase * o.dur}s`} repeatCount="indefinite" path={d} />
                  </g>
                )
              })}
            </g>
          </g>
        )
      })}
    </g>
  )
}
