"use client"
/**
 * ReputationIntelligenceCore — CustomerSignal's signature visual.
 *
 * A holographic survey globe on a machined pedestal: a real 3D-projected sphere with topographic
 * contour lines, an amber terrain texture, a lat/long grid and a counter-rotating geodesic shell,
 * wrapped in orbital rings with satellite nodes, a radial tick ring, a scanning beam and slow energy
 * waves. `pulseKey` changes make the core respond (a signal has arrived).
 *
 * Performance: one requestAnimationFrame loop (≈30 fps, paused off-screen and in hidden tabs) rewrites a
 * handful of path `d` attributes — no React re-renders, no DOM particles, no animated filters. Rings and
 * beams are CSS transforms; satellites/waves are SMIL. Reduced motion renders a single still frame.
 */
import * as React from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { cn } from "@/lib/utils"
import { coreGeometry, polylinePaths, project, view } from "./geometry"
import { OrbitalSignalSystem, type Orbit } from "./orbital"

type Detail = "full" | "lite"

const R = 100 // sphere radius (viewBox units)
const SHELL = 1.27 // geodesic shell radius, in sphere radii
const TILT = 0.34 // view elevation (rad)

const LITE_ORBITS: Orbit[] = [{ rx: 190, ry: 44, rotate: -12, dur: 30, satellites: [{ phase: 0.1, r: 6 }] }]

function spin(seconds: number, reverse = false): React.CSSProperties {
  return {
    transformBox: "view-box",
    transformOrigin: "0 0",
    animation: `${reverse ? "cs-rotate-rev" : "cs-rotate"} ${seconds}s linear infinite`,
  }
}
const r1 = (n: number) => Math.round(n * 10) / 10

export function ReputationIntelligenceCore({
  className,
  detail = "full",
  pedestal = true,
  pulseKey,
  centerValue,
  centerLabel,
  title = "CustomerSignal intelligence core",
}: {
  className?: string
  detail?: Detail
  pedestal?: boolean
  pulseKey?: number | string
  centerValue?: React.ReactNode
  centerLabel?: string
  title?: string
}) {
  const reduce = useReducedMotion() ?? false
  const animate = !reduce
  const full = detail === "full"
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, "")
  const id = (n: string) => `cs${uid}-${n}`

  const root = React.useRef<HTMLDivElement>(null)
  const contourFrontRef = React.useRef<SVGPathElement>(null)
  const contourBackRef = React.useRef<SVGPathElement>(null)
  const gridRef = React.useRef<SVGPathElement>(null)
  const landRef = React.useRef<SVGPathElement>(null)
  const sitesRef = React.useRef<SVGPathElement>(null)
  const shellFrontRef = React.useRef<SVGPathElement>(null)
  const shellBackRef = React.useRef<SVGPathElement>(null)
  const shellNodesRef = React.useRef<SVGPathElement>(null)
  const liveRef = React.useRef<SVGGElement>(null)

  React.useEffect(() => {
    const geo = coreGeometry(detail)
    const p: [number, number, number] = [0, 0, 0]
    const q: [number, number, number] = [0, 0, 0]
    const set = (r: React.RefObject<SVGPathElement | null>, d: string) => r.current?.setAttribute("d", d)

    const render = (t: number) => {
      const v = view(0.7 + t * ((Math.PI * 2) / 80), TILT, R)
      const c = polylinePaths(geo.contours, v)
      set(contourFrontRef, c.front)
      set(contourBackRef, c.back)
      set(gridRef, polylinePaths(geo.grid, v).front)

      let land = ""
      for (const pt of geo.land) {
        project(pt, v, p)
        if (p[2] > 0.08) land += `M${r1(p[0])} ${r1(p[1])}h0`
      }
      set(landRef, land)

      let sites = ""
      for (const pt of geo.sites) {
        project(pt, v, p)
        if (p[2] < 0.15) continue
        const s = 3.2 + 2.2 * p[2]
        sites += `M${r1(p[0] + s)} ${r1(p[1])}`
        for (let k = 1; k <= 6; k++) {
          const a = (k / 6) * Math.PI * 2
          sites += `L${r1(p[0] + s * Math.cos(a))} ${r1(p[1] + s * Math.sin(a) * 0.86)}`
        }
      }
      set(sitesRef, sites)

      if (geo.shell) {
        const sv = view(-0.4 - t * ((Math.PI * 2) / 140), TILT, R * SHELL)
        let front = ""
        let back = ""
        let nodes = ""
        const pts = geo.shell.verts.map((vert) => {
          project(vert, sv, q)
          return [q[0], q[1], q[2]] as const
        })
        for (const [a, b] of geo.shell.edges) {
          const A = pts[a]
          const B = pts[b]
          const seg = `M${r1(A[0])} ${r1(A[1])}L${r1(B[0])} ${r1(B[1])}`
          if (A[2] + B[2] >= 0) front += seg
          else back += seg
        }
        for (const P of pts) if (P[2] > 0) nodes += `M${r1(P[0])} ${r1(P[1])}h0`
        set(shellFrontRef, front)
        set(shellBackRef, back)
        set(shellNodesRef, nodes)
      }
      liveRef.current?.setAttribute("data-ready", "true")
    }

    render(0)
    if (reduce) return

    const interval = 1000 / (full ? 30 : 24)
    let raf = 0
    let last = 0
    let start = 0
    let visible = true
    const frame = (now: number) => {
      raf = 0
      if (!visible) return
      raf = requestAnimationFrame(frame)
      if (!start) start = now
      if (now - last < interval) return
      last = now
      render((now - start) / 1000)
    }
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting
      if (visible && !raf) raf = requestAnimationFrame(frame)
    })
    if (root.current) io.observe(root.current)
    raf = requestAnimationFrame(frame)
    return () => {
      io.disconnect()
      if (raf) cancelAnimationFrame(raf)
    }
  }, [detail, reduce, full])

  const ticks = React.useMemo(() => {
    const n = full ? 144 : 72
    return Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2
      const major = i % (n / 12) === 0
      const ra = 152
      const rb = major ? 164 : 157
      return { x1: r1(Math.cos(a) * ra), y1: r1(Math.sin(a) * ra), x2: r1(Math.cos(a) * rb), y2: r1(Math.sin(a) * rb), major }
    })
  }, [full])

  const tiers = [
    { rx: 206, y: 214, h: 12 },
    { rx: 166, y: 198, h: 10 },
    { rx: 128, y: 185, h: 9 },
    { rx: 92, y: 174, h: 8 },
    { rx: 58, y: 165, h: 7 },
  ]
  const ry = (rx: number) => rx * 0.22
  const viewBox = pedestal ? "-232 -212 464 482" : "-232 -232 464 464"

  return (
    <div ref={root} className={cn("relative w-full [container-type:inline-size]", pedestal ? "aspect-[464/482]" : "aspect-square", className)}>
      <svg viewBox={viewBox} className="absolute inset-0 size-full overflow-visible" role="img" aria-label={title}>
        <defs>
          <radialGradient id={id("halo")}>
            <stop offset="0%" stopColor="var(--signal)" stopOpacity="0.32" />
            <stop offset="42%" stopColor="var(--signal)" stopOpacity="0.08" />
            <stop offset="100%" stopColor="var(--signal)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={id("body")} cx="42%" cy="36%" r="72%">
            <stop offset="0%" stopColor="#2b6f79" stopOpacity="0.95" />
            <stop offset="42%" stopColor="#123b46" stopOpacity="0.92" />
            <stop offset="82%" stopColor="#081a21" stopOpacity="0.92" />
            <stop offset="100%" stopColor="#15505a" stopOpacity="0.95" />
          </radialGradient>
          <radialGradient id={id("inner")} cx="50%" cy="100%" r="80%">
            <stop offset="0%" stopColor="var(--signal)" stopOpacity="0.55" />
            <stop offset="55%" stopColor="var(--signal)" stopOpacity="0.08" />
            <stop offset="100%" stopColor="var(--signal)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={id("spec")} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={id("under")} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="22%" stopColor="var(--signal)" stopOpacity="0.8" />
            <stop offset="100%" stopColor="var(--signal)" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={id("rim")} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--signal)" stopOpacity="0.9" />
            <stop offset="50%" stopColor="var(--ice)" stopOpacity="0.15" />
            <stop offset="100%" stopColor="var(--signal)" stopOpacity="0.55" />
          </linearGradient>
          <linearGradient id={id("beam")} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--signal)" stopOpacity="0.26" />
            <stop offset="100%" stopColor="var(--signal)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={id("cone")} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="var(--signal)" stopOpacity="0.42" />
            <stop offset="100%" stopColor="var(--signal)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={id("tierSide")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1a2832" />
            <stop offset="100%" stopColor="#070c10" />
          </linearGradient>
          <linearGradient id={id("tierTop")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0c141b" />
            <stop offset="100%" stopColor="#15222c" />
          </linearGradient>
          <clipPath id={id("disc")}>
            <circle r={R} />
          </clipPath>
        </defs>

        {/* ambient volumetric light */}
        <circle r="232" fill={`url(#${id("halo")})`} />

        {/* HUD corner brackets */}
        <g stroke="var(--signal)" strokeOpacity="0.35" strokeWidth="1" fill="none">
          {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sy]) => {
            const cx = sx * 214
            const cy = sy < 0 ? -206 : pedestal ? 138 : 206
            return <path key={`${sx}${sy}`} d={`M ${cx} ${cy - sy * 16} V ${cy} H ${cx - sx * 16}`} />
          })}
        </g>

        {/* outward energy waves */}
        {animate &&
          [0, 2.6].map((b) => (
            <circle key={b} r={R} fill="none" stroke="var(--signal)" strokeWidth="0.8" opacity="0">
              <animate attributeName="r" values={`${R};${R * 2}`} dur="5.2s" begin={`${b}s`} repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.38;0" dur="5.2s" begin={`${b}s`} repeatCount="indefinite" />
            </circle>
          ))}

        {/* radial ticks */}
        <g style={animate ? spin(160, true) : undefined}>
          {ticks.map(({ major, ...t }, i) => (
            <line key={i} {...t} stroke={major ? "var(--signal)" : "var(--foreground)"} strokeOpacity={major ? 0.75 : 0.2} strokeWidth={major ? 1.1 : 0.55} />
          ))}
        </g>

        {/* segmented arc ring */}
        <g style={animate ? spin(44) : undefined}>
          <circle r="140" fill="none" stroke="var(--signal)" strokeOpacity="0.55" strokeWidth="1.2" strokeDasharray="64 22 8 22 140 48 18 24" strokeLinecap="round" />
          {full && <circle r="145" fill="none" stroke="var(--ice)" strokeOpacity="0.18" strokeWidth="0.6" />}
        </g>

        {/* scanning beam */}
        <g style={animate ? spin(9) : { transform: "rotate(-38deg)" }}>
          <path d="M0 0 L 168 -34 A 172 172 0 0 1 168 34 Z" fill={`url(#${id("beam")})`} />
          <line x1={R} y1="0" x2="170" y2="0" stroke="var(--signal)" strokeOpacity="0.45" strokeWidth="0.7" />
        </g>

        {/* machined pedestal */}
        {pedestal && (
          <g>
            {tiers.map((t, i) => {
              const r = ry(t.rx)
              return (
                <g key={i}>
                  <path
                    d={`M ${-t.rx} ${t.y} L ${-t.rx} ${t.y + t.h} A ${t.rx} ${r} 0 0 0 ${t.rx} ${t.y + t.h} L ${t.rx} ${t.y} A ${t.rx} ${r} 0 0 1 ${-t.rx} ${t.y} Z`}
                    fill={`url(#${id("tierSide")})`}
                    stroke="var(--foreground)"
                    strokeOpacity="0.1"
                    strokeWidth="0.6"
                  />
                  <ellipse cy={t.y} rx={t.rx} ry={r} fill={`url(#${id("tierTop")})`} stroke="var(--signal)" strokeOpacity={0.16 + i * 0.06} strokeWidth="0.8" />
                  <ellipse
                    cy={t.y}
                    rx={t.rx - 9}
                    ry={r - 2}
                    fill="none"
                    stroke={i % 2 ? "var(--ice)" : "var(--signal)"}
                    strokeOpacity="0.35"
                    strokeWidth="1.4"
                    strokeDasharray={i % 2 ? "3 9" : "26 7 4 7"}
                    style={animate ? { animation: `cs-dash ${60 + i * 14}s linear infinite ${i % 2 ? "reverse" : ""}` } : undefined}
                  />
                </g>
              )
            })}
            {/* emitter + light column */}
            <path d="M -30 160 L 30 160 L 74 62 L -74 62 Z" fill={`url(#${id("cone")})`} />
            <ellipse cy="160" rx="34" ry="7.5" fill={`url(#${id("under")})`} style={animate ? { animation: "cs-breathe 4s ease-in-out infinite" } : undefined} />
            <ellipse cy="160" rx="14" ry="3" fill="#ffffff" opacity="0.9" />
          </g>
        )}

        {/* orbits behind the globe */}
        <OrbitalSignalSystem idPrefix={id("orb")} layer="back" animate={animate} orbits={full ? undefined : LITE_ORBITS} />

        <g ref={liveRef} className="opacity-0 transition-opacity duration-700 data-[ready=true]:opacity-100">
          {/* geodesic shell — far side */}
          {full && <path ref={shellBackRef} fill="none" stroke="var(--signal)" strokeOpacity="0.07" strokeWidth="0.6" />}

          {/* globe body */}
          <circle r={R + 7} fill="none" stroke="var(--signal)" strokeOpacity="0.1" strokeWidth="6" />
          <circle r={R} fill={`url(#${id("body")})`} />
          <g clipPath={`url(#${id("disc")})`}>
            {pedestal && <rect x={-R} y={-R * 0.2} width={R * 2} height={R * 1.2} fill={`url(#${id("inner")})`} />}
            <path ref={contourBackRef} fill="none" stroke="var(--signal)" strokeOpacity="0.16" strokeWidth="0.6" />
            <path ref={gridRef} fill="none" stroke="var(--ice)" strokeOpacity="0.16" strokeWidth="0.5" />
            <path ref={landRef} fill="none" stroke="var(--ember)" strokeOpacity="0.62" strokeWidth={full ? 1.9 : 2.4} strokeLinecap="round" />
            <path ref={contourFrontRef} fill="none" stroke="#d6fdfe" strokeOpacity="0.88" strokeWidth="0.8" strokeLinejoin="round" />
            <path ref={sitesRef} fill="none" stroke="var(--signal)" strokeOpacity="0.95" strokeWidth="0.9" />
            <ellipse cx={-30} cy={-38} rx={46} ry={30} fill={`url(#${id("spec")})`} />
          </g>
          <circle r={R} fill="none" stroke={`url(#${id("rim")})`} strokeWidth="1.3" />

          {/* geodesic shell — near side */}
          {full && (
            <>
              <path ref={shellFrontRef} fill="none" stroke="var(--signal)" strokeOpacity="0.24" strokeWidth="0.6" />
              <path ref={shellNodesRef} fill="none" stroke="#d9fdfe" strokeOpacity="0.75" strokeWidth="2" strokeLinecap="round" />
            </>
          )}
        </g>

        {/* orbits in front of the globe */}
        <OrbitalSignalSystem idPrefix={id("orb")} layer="front" animate={animate} orbits={full ? undefined : LITE_ORBITS} />

        {/* signal arrival response */}
        <AnimatePresence>
          {pulseKey !== undefined && animate && (
            <motion.circle
              key={String(pulseKey)}
              r={R}
              fill="none"
              stroke="var(--signal)"
              strokeWidth={1.6}
              initial={{ opacity: 0.9, scale: 1 }}
              animate={{ opacity: 0, scale: 1.5 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
              style={{ transformBox: "view-box", transformOrigin: "0 0" }}
            />
          )}
        </AnimatePresence>
      </svg>

      {(centerValue != null || centerLabel) && (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center justify-center text-center"
          style={{ height: pedestal ? `${(464 / 482) * 100}%` : "100%" }}
        >
          {centerValue != null && (
            <span className="text-[clamp(18px,8cqw,34px)] leading-none font-semibold tracking-[-0.03em] text-white tabular drop-shadow-[0_0_14px_rgb(0_0_0/0.9)]">{centerValue}</span>
          )}
          {centerLabel && (
            <span className="mt-1.5 rounded-sm bg-black/40 px-1.5 py-0.5 font-mono text-[9px] tracking-[0.18em] text-[#d6fbfc] uppercase">{centerLabel}</span>
          )}
        </div>
      )}
    </div>
  )
}
