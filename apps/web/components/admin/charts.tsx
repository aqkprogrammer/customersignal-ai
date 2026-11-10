"use client"

import { useId } from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { shortPeriod } from "@/lib/admin-api"
import { cn, formatCompact, titleCase } from "@/lib/utils"

export const CHART_COLORS = ["#4169F5", "#FF8757", "#8FCB3F", "#5FA8F0", "#FFB48F", "#101B35", "#E5534B", "#929AAA"]

const GRID = "rgba(23,32,51,0.08)"
const AXIS = { fontSize: 11, fill: "#929AAA" }

const tooltipProps = {
  contentStyle: {
    background: "rgba(255,255,255,0.96)",
    border: "1px solid rgba(23,32,51,0.18)",
    borderRadius: 10,
    boxShadow: "0 12px 32px -12px rgba(0,0,0,0.7)",
    fontSize: 12,
    padding: "8px 10px",
  },
  labelStyle: { color: "#F7F6F2", fontWeight: 600, marginBottom: 4 },
  itemStyle: { color: "#657084", padding: 0 },
  cursor: { fill: "rgba(65,105,245,0.08)", stroke: "rgba(65,105,245,0.25)" },
}

export type Series = { key: string; label: string; color?: string }
type Fmt = (n: number) => string

function ChartFrame({ height, children, className }: { height: number; children: React.ReactElement; className?: string }) {
  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  )
}

export function ChartEmpty({ height = 220, label = "No data yet" }: { height?: number; label?: string }) {
  return (
    <div className="flex items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground" style={{ height }}>
      {label}
    </div>
  )
}

export function TrendChart({
  data,
  xKey,
  series,
  format = formatCompact,
  height = 240,
  type = "area",
  periodLabels = true,
  stacked,
}: {
  data: Record<string, unknown>[]
  xKey: string
  series: Series[]
  format?: Fmt
  height?: number
  type?: "area" | "line"
  periodLabels?: boolean
  stacked?: boolean
}) {
  const uid = useId().replace(/:/g, "")
  if (!data.length) return <ChartEmpty height={height} />
  const xf = (v: unknown) => (periodLabels ? shortPeriod(String(v)) : String(v))
  const common = (
    <>
      <CartesianGrid stroke={GRID} vertical={false} />
      <XAxis dataKey={xKey} tick={AXIS} tickLine={false} axisLine={false} tickFormatter={xf} minTickGap={16} />
      <YAxis tick={AXIS} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => format(Number(v))} />
      <Tooltip {...tooltipProps} labelFormatter={(l) => xf(l)} formatter={(v, n) => [format(Number(v)), n]} />
      {series.length > 1 && <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11, color: "#657084" }} />}
    </>
  )
  if (type === "line") {
    return (
      <ChartFrame height={height}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          {common}
          {series.map((s, i) => (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color || CHART_COLORS[i]} strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
          ))}
        </LineChart>
      </ChartFrame>
    )
  }
  return (
    <ChartFrame height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          {series.map((s, i) => (
            <linearGradient key={s.key} id={`g-${uid}-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color || CHART_COLORS[i]} stopOpacity={0.35} />
              <stop offset="100%" stopColor={s.color || CHART_COLORS[i]} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        {common}
        {series.map((s, i) => (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stackId={stacked ? "a" : undefined}
            stroke={s.color || CHART_COLORS[i]}
            strokeWidth={2}
            fill={`url(#g-${uid}-${i})`}
            activeDot={{ r: 3 }}
          />
        ))}
      </AreaChart>
    </ChartFrame>
  )
}

export function BarsChart({
  data,
  xKey,
  series,
  format = formatCompact,
  height = 240,
  periodLabels = true,
  horizontal,
  stacked,
  labelFormat,
}: {
  data: Record<string, unknown>[]
  xKey: string
  series: Series[]
  format?: Fmt
  height?: number
  periodLabels?: boolean
  horizontal?: boolean
  stacked?: boolean
  labelFormat?: (v: string) => string
}) {
  if (!data.length) return <ChartEmpty height={height} />
  const xf = (v: unknown) => (labelFormat ? labelFormat(String(v)) : periodLabels ? shortPeriod(String(v)) : String(v))
  return (
    <ChartFrame height={height}>
      <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={!!horizontal} horizontal={!horizontal} />
        {horizontal ? (
          <>
            <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(v) => format(Number(v))} />
            <YAxis type="category" dataKey={xKey} tick={AXIS} tickLine={false} axisLine={false} width={96} tickFormatter={xf} />
          </>
        ) : (
          <>
            <XAxis dataKey={xKey} tick={AXIS} tickLine={false} axisLine={false} tickFormatter={xf} minTickGap={8} />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => format(Number(v))} />
          </>
        )}
        <Tooltip {...tooltipProps} labelFormatter={(l) => xf(l)} formatter={(v, n) => [format(Number(v)), n]} />
        {series.length > 1 && <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11, color: "#657084" }} />}
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            stackId={stacked ? "a" : undefined}
            fill={s.color || CHART_COLORS[i]}
            radius={stacked ? 0 : horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
            maxBarSize={36}
          />
        ))}
      </BarChart>
    </ChartFrame>
  )
}

export function DonutChart({
  data,
  format = formatCompact,
  height = 220,
  labelize = true,
}: {
  data: { name: string; value: number }[]
  format?: Fmt
  height?: number
  labelize?: boolean
}) {
  const rows = data.filter((d) => d.value > 0)
  if (!rows.length) return <ChartEmpty height={height} />
  const total = rows.reduce((s, d) => s + d.value, 0)
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative w-full sm:w-1/2" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip {...tooltipProps} formatter={(v, n) => [format(Number(v)), labelize ? titleCase(String(n)) : n]} />
            <Pie data={rows} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="88%" paddingAngle={2} stroke="none">
              {rows.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-semibold text-foreground tabular-nums">{format(total)}</span>
          <span className="text-[10px] tracking-wide text-muted-foreground uppercase">Total</span>
        </div>
      </div>
      <ul className="w-full space-y-1.5 text-xs sm:w-1/2">
        {rows.map((d, i) => (
          <li key={d.name} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2">
              <span className="size-2 shrink-0 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
              <span className="truncate text-foreground/90">{labelize ? titleCase(d.name) : d.name}</span>
            </span>
            <span className="shrink-0 text-muted-foreground tabular-nums">
              {format(d.value)} · {Math.round((100 * d.value) / total)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function Sparkline({ data, color = "#4169F5", className }: { data: number[]; color?: string; className?: string }) {
  const uid = useId().replace(/:/g, "")
  const rows = data.map((v, i) => ({ i, v }))
  return (
    <div className={cn("h-8 w-20", className)} aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
          <defs>
            <linearGradient id={`s-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.4} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={`url(#s-${uid})`} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
