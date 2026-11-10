"use client"
/**
 * CustomerSignalMap — CustomerSignal's signature visualization.
 *
 * An asymmetric intelligence network read left → right: review SOURCES emit sentiment-coloured signals
 * that flow into REVIEW CLUSTERS (bubble size = share of voice, dots = individual reviews coloured by
 * sentiment), which resolve into OPPORTUNITY nodes ranked by score. Clusters are interactive: hover, click
 * or keyboard-select one to trace its sources and outcome; when idle the map tours the clusters itself.
 *
 * SVG + CSS + Motion. Flowing signals use SMIL along the link paths (no React re-renders, no DOM particle
 * systems); the tour pauses off-screen; reduced motion renders a still, fully readable map.
 */
import * as React from "react"
import { motion, useInView, useReducedMotion } from "motion/react"
import { cn } from "@/lib/utils"
import { CLUSTERS, OPPORTUNITIES, SOURCES, TONE_HEX, type ClusterNode, type OpportunityNode, type SourceNode } from "./data"

const W = 760
const H = 540
const SENT = ["#9BD24A", "#92C9FF", "#FF8757"] // positive, neutral, negative

const curve = (x1: number, y1: number, x2: number, y2: number) => {
  const mx = (x1 + x2) / 2
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`
}
const r1 = (n: number) => Math.round(n * 10) / 10

/** Deterministic phyllotaxis packing of review dots inside a cluster. */
function clusterDots(c: ClusterNode) {
  const n = Math.round(c.r * 0.62)
  const total = c.mix[0] + c.mix[1] + c.mix[2]
  const ga = Math.PI * (3 - Math.sqrt(5))
  return Array.from({ length: n }, (_, i) => {
    const rr = (c.r - 8) * Math.sqrt((i + 0.5) / n)
    const a = i * ga
    const t = ((i * 37) % 100) / 100
    const s = t < c.mix[0] / total ? 0 : t < (c.mix[0] + c.mix[1]) / total ? 1 : 2
    return { x: r1(c.x + rr * Math.cos(a)), y: r1(c.y + rr * Math.sin(a)), s }
  })
}

/* ------------------------------------------------------------------ nodes */

export function SignalNode({ node, active, dim }: { node: SourceNode; active?: boolean; dim?: boolean }) {
  return (
    <g style={{ opacity: dim ? 0.62 : 1, transition: "opacity .4s" }}>
      <rect x={node.x - 62} y={node.y - 25} width="124" height="50" rx="25" fill="var(--card)" stroke={active ? "#4169F5" : "var(--border-strong)"} strokeWidth={active ? 1.6 : 1} style={{ transition: "stroke .3s" }} />
      <circle cx={node.x - 42} cy={node.y} r="6.5" fill={active ? "#4169F5" : "#C7CEDB"} style={{ transition: "fill .3s" }} />
      <text x={node.x - 28} y={node.y - 3} fontSize="14" fontWeight="600" fill="var(--foreground)">{node.label}</text>
      <text x={node.x - 28} y={node.y + 13} fontSize="11.5" fill="var(--muted-foreground)">{node.detail}</text>
    </g>
  )
}

export function ReviewCluster({
  cluster,
  active,
  dim,
  onSelect,
  breathe = true,
}: {
  cluster: ClusterNode
  active?: boolean
  dim?: boolean
  onSelect?: () => void
  breathe?: boolean
}) {
  const reduce = useReducedMotion()
  const dots = React.useMemo(() => clusterDots(cluster), [cluster])
  const color = TONE_HEX[cluster.tone]
  const labelBelow = cluster.y + cluster.r + 36 < 540
  return (
    <motion.g
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      aria-label={`${cluster.name}: ${cluster.share}% of reviews, ${cluster.trend.toLowerCase()}`}
      aria-pressed={onSelect ? !!active : undefined}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (onSelect && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault()
          onSelect()
        }
      }}
      onMouseEnter={onSelect}
      className={cn(onSelect && "cursor-pointer outline-none [&:focus-visible>circle:first-child]:stroke-[#4169F5]")}
      style={{ opacity: dim ? 0.6 : 1, transition: "opacity .45s", transformBox: "fill-box", transformOrigin: "center" }}
      animate={!reduce && breathe && active ? { scale: [1, 1.035, 1] } : { scale: 1 }}
      transition={{ duration: 2.4, repeat: active && !reduce ? Infinity : 0, ease: "easeInOut" }}
    >
      <circle cx={cluster.x} cy={cluster.y} r={cluster.r} fill={color} fillOpacity={active ? 0.16 : 0.1} stroke={color} strokeOpacity={active ? 0.9 : 0.4} strokeWidth={active ? 1.8 : 1} style={{ transition: "all .4s" }} />
      <circle cx={cluster.x} cy={cluster.y} r={cluster.r + 7} fill="none" stroke={color} strokeOpacity={active ? 0.35 : 0} strokeDasharray="2 5" style={{ transition: "stroke-opacity .4s" }} />
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={2.6} fill={SENT[d.s]} />
      ))}
      <g transform={`translate(${cluster.x} ${labelBelow ? cluster.y + cluster.r + 18 : cluster.y - cluster.r - 26})`}>
        <text textAnchor="middle" fontSize="14.5" fontWeight="600" fill="var(--foreground)">{cluster.name}</text>
        <text textAnchor="middle" y="17" fontSize="12.5" fill="var(--muted-foreground)">
          {cluster.share}% · {cluster.trend}
        </text>
      </g>
    </motion.g>
  )
}

function OpportunityNodeView({ node, active, dim }: { node: OpportunityNode; active?: boolean; dim?: boolean }) {
  const color = TONE_HEX[node.tone]
  return (
    <g style={{ opacity: dim ? 0.62 : 1, transition: "opacity .4s" }}>
      <rect x={node.x - 76} y={node.y - 28} width="168" height="56" rx="16" fill="var(--card)" stroke={active ? color : "var(--border-strong)"} strokeWidth={active ? 1.8 : 1} style={{ transition: "stroke .3s" }} />
      <circle cx={node.x - 52} cy={node.y} r="16" fill={color} fillOpacity="0.14" />
      <text x={node.x - 52} y={node.y + 4.5} textAnchor="middle" fontSize="13" fontWeight="700" fill={color}>{node.score}</text>
      <text x={node.x - 30} y={node.y - 3} fontSize="13" fontWeight="600" fill="var(--foreground)">{node.title}</text>
      <text x={node.x - 30} y={node.y + 14} fontSize="11.5" fill="var(--muted-foreground)">{node.kind}</text>
    </g>
  )
}

/* ------------------------------------------------------------------ map */

export function CustomerSignalMap({
  className,
  selected: controlled,
  onSelect,
  autoTour = true,
  compact,
}: {
  className?: string
  selected?: string
  onSelect?: (id: string) => void
  autoTour?: boolean
  /** Fewer labels/nodes for small spaces. */
  compact?: boolean
}) {
  const reduce = useReducedMotion() ?? false
  const ref = React.useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { margin: "-40px" })
  const [internal, setInternal] = React.useState(CLUSTERS[1].id)
  const [hovering, setHovering] = React.useState(false)
  const selected = controlled ?? internal
  const select = React.useCallback(
    (id: string) => {
      setInternal(id)
      onSelect?.(id)
    },
    [onSelect],
  )

  // Idle tour: step through clusters while visible and not being explored.
  React.useEffect(() => {
    if (!autoTour || reduce || !inView || hovering) return
    const t = setInterval(() => {
      const i = CLUSTERS.findIndex((c) => c.id === selected)
      select(CLUSTERS[(i + 1) % CLUSTERS.length].id)
    }, 4200)
    return () => clearInterval(t)
  }, [autoTour, reduce, inView, hovering, selected, select])

  const active = CLUSTERS.find((c) => c.id === selected)!
  const sources = compact ? SOURCES.filter((s) => s.id !== "api") : SOURCES
  const opps = compact ? OPPORTUNITIES.slice(0, 3) : OPPORTUNITIES

  const sourceLinks = CLUSTERS.flatMap((c) =>
    c.sources
      .map((sid) => sources.find((s) => s.id === sid))
      .filter(Boolean)
      .map((s) => ({ id: `${s!.id}-${c.id}`, d: curve(s!.x + 62, s!.y, c.x - c.r, c.y), cluster: c, source: s!.id })),
  )
  const oppLinks = opps.map((o) => {
    const c = CLUSTERS.find((x) => x.id === o.from)!
    return { id: `${c.id}-${o.id}`, d: curve(c.x + c.r, c.y, o.x - 76, o.y), cluster: c, opp: o }
  })
  const peerLinks = [
    ["wait", "delivery"],
    ["staff", "value"],
    ["wait", "booking"],
    ["staff", "wait"],
  ].map(([a, b]) => {
    const A = CLUSTERS.find((c) => c.id === a)!
    const B = CLUSTERS.find((c) => c.id === b)!
    return { id: `${a}-${b}`, A, B }
  })

  return (
    <div
      ref={ref}
      className={cn("relative w-full", className)}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocus={() => setHovering(true)}
      onBlur={() => setHovering(false)}
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full overflow-visible" role="group" aria-label="Customer signal map: review sources flowing into theme clusters and opportunities (sample data)">
        {/* peer relationships between themes */}
        {peerLinks.map((l) => (
          <line key={l.id} x1={l.A.x} y1={l.A.y} x2={l.B.x} y2={l.B.y} stroke="var(--foreground)" strokeOpacity="0.07" strokeDasharray="3 6" />
        ))}

        {/* source → cluster links with flowing signals */}
        {sourceLinks.map((l, i) => {
          const on = l.cluster.id === selected
          const color = SENT[l.cluster.mix[0] > l.cluster.mix[2] ? 0 : 2]
          return (
            <g key={l.id}>
              <path d={l.d} fill="none" stroke={on ? "#4169F5" : "var(--foreground)"} strokeOpacity={on ? 0.6 : 0.13} strokeWidth={on ? 1.6 : 1} style={{ transition: "all .45s" }} />
              {!reduce && inView && (
                <circle r={on ? 4 : 2.8} fill={color} opacity={on ? 1 : 0.55}>
                  <animateMotion dur={`${2.6 + (i % 3) * 0.7}s`} begin={`${-(i * 0.53)}s`} repeatCount="indefinite" path={l.d} />
                </circle>
              )}
            </g>
          )
        })}

        {/* cluster → opportunity links */}
        {oppLinks.map((l) => {
          const on = l.cluster.id === selected
          return (
            <g key={l.id}>
              <path d={l.d} fill="none" stroke={TONE_HEX[l.opp.tone]} strokeOpacity={on ? 0.8 : 0.18} strokeWidth={on ? 1.8 : 1} strokeDasharray={on ? undefined : "4 5"} style={{ transition: "all .45s" }} />
              {on && !reduce && inView && (
                <circle r="4" fill={TONE_HEX[l.opp.tone]}>
                  <animateMotion dur="1.8s" repeatCount="indefinite" path={l.d} />
                </circle>
              )}
            </g>
          )
        })}

        {sources.map((s) => (
          <SignalNode key={s.id} node={s} active={active.sources.includes(s.id)} dim={!active.sources.includes(s.id)} />
        ))}
        {CLUSTERS.map((c) => (
          <ReviewCluster key={c.id} cluster={c} active={c.id === selected} dim={c.id !== selected} onSelect={() => select(c.id)} />
        ))}
        {opps.map((o) => (
          <OpportunityNodeView key={o.id} node={o} active={o.from === selected} dim={o.from !== selected} />
        ))}

        {/* column captions */}
        {!compact && (
          <g fontSize="11.5" letterSpacing="1.2" fill="var(--subtle-foreground)" className="font-mono">
            <text x="8" y="44">SOURCES</text>
            <text x="262" y="44">REVIEW CLUSTERS</text>
            <text x="596" y="44">OPPORTUNITIES</text>
          </g>
        )}
      </svg>
    </div>
  )
}
