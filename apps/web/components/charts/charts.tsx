"use client"

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
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { categoryLabel } from "@/lib/site"
import { formatDate, titleCase } from "@/lib/utils"
import type { TimePoint } from "@/types/api"

export const COLORS = {
  positive: "var(--positive)",
  neutral: "var(--neutral-sentiment)",
  negative: "var(--negative)",
  series: ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"],
}

const axis = { fontSize: 11, fill: "var(--muted-foreground)" }
const tooltipStyle = {
  contentStyle: {
    background: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    fontSize: 12,
    color: "var(--popover-foreground)",
    boxShadow: "0 8px 24px -12px rgba(11,16,51,.25)",
  },
  labelStyle: { color: "var(--muted-foreground)", marginBottom: 4 },
  cursor: { fill: "var(--muted)", opacity: 0.5 },
}

function NoData({ height, label = "No data yet" }: { height: number; label?: string }) {
  return (
    <div className="flex items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground" style={{ height }}>
      {label}
    </div>
  )
}

const periodLabel = (p: TimePoint) => formatDate(p.period, p.unit === "month" ? { month: "short", year: "2-digit" } : { month: "short", day: "numeric" })

export function SentimentTrendChart({ data, height = 260 }: { data: TimePoint[]; height?: number }) {
  if (!data.length) return <NoData height={height} />
  const rows = data.map((d) => ({ ...d, label: periodLabel(d) }))
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={rows} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <defs>
          {(["positive", "neutral", "negative"] as const).map((k) => (
            <linearGradient key={k} id={`g-${k}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORS[k]} stopOpacity={0.35} />
              <stop offset="100%" stopColor={COLORS[k]} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} minTickGap={18} />
        <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip {...tooltipStyle} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
        <Area type="monotone" dataKey="positive" name="Positive" stackId="1" stroke={COLORS.positive} fill="url(#g-positive)" strokeWidth={2} />
        <Area type="monotone" dataKey="neutral" name="Neutral" stackId="1" stroke={COLORS.neutral} fill="url(#g-neutral)" strokeWidth={2} />
        <Area type="monotone" dataKey="negative" name="Negative" stackId="1" stroke={COLORS.negative} fill="url(#g-negative)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function RatingTrendChart({ data, height = 220 }: { data: TimePoint[]; height?: number }) {
  const rows = data.filter((d) => d.avg_rating !== null).map((d) => ({ label: periodLabel(d), rating: d.avg_rating, total: d.total }))
  if (!rows.length) return <NoData height={height} />
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={rows} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} minTickGap={18} />
        <YAxis domain={[1, 5]} tick={axis} tickLine={false} axisLine={false} />
        <Tooltip {...tooltipStyle} />
        <Line type="monotone" dataKey="rating" name="Avg rating" stroke="var(--chart-1)" strokeWidth={2.5} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function SentimentDonut({ positive, neutral, negative, height = 200 }: { positive: number; neutral: number; negative: number; height?: number }) {
  const total = positive + neutral + negative
  if (!total) return <NoData height={height} label="No analyzed reviews" />
  const data = [
    { name: "Positive", value: positive, color: COLORS.positive },
    { name: "Neutral", value: neutral, color: COLORS.neutral },
    { name: "Negative", value: negative, color: COLORS.negative },
  ]
  return (
    <div className="flex items-center gap-6">
      <div className="relative" style={{ width: height, height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" innerRadius="66%" outerRadius="100%" paddingAngle={2} stroke="none">
              {data.map((d) => <Cell key={d.name} fill={d.color} />)}
            </Pie>
            <Tooltip {...tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tabular-nums">{Math.round((100 * positive) / total)}%</span>
          <span className="text-[11px] text-muted-foreground">positive</span>
        </div>
      </div>
      <ul className="space-y-2.5 text-sm">
        {data.map((d) => (
          <li key={d.name} className="flex items-center gap-2">
            <span className="size-2.5 rounded-full" style={{ background: d.color }} />
            <span className="w-16 text-muted-foreground">{d.name}</span>
            <span className="font-medium tabular-nums">{d.value}</span>
            <span className="text-xs text-muted-foreground">({Math.round((100 * d.value) / total)}%)</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function RatingBars({ data, height = 200 }: { data: { rating: number; count: number }[]; height?: number }) {
  if (!data.some((d) => d.count)) return <NoData height={height} label="No ratings" />
  const rows = data.map((d) => ({ label: `${d.rating}★`, count: d.count, rating: d.rating }))
  const color = (r: number) => (r <= 2 ? COLORS.negative : r === 3 ? "var(--warning)" : COLORS.positive)
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} />
        <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip {...tooltipStyle} />
        <Bar dataKey="count" name="Reviews" radius={[6, 6, 0, 0]}>
          {rows.map((r) => <Cell key={r.label} fill={color(r.rating)} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export function CategoryBars({ data, height, color = "var(--chart-1)", onSelect }: {
  data: { category: string; count: number }[]
  height?: number
  color?: string
  onSelect?: (category: string) => void
}) {
  const h = height ?? Math.max(160, data.slice(0, 10).length * 30)
  if (!data.length) return <NoData height={h} label="Nothing detected yet" />
  const rows = data.slice(0, 10).map((d) => ({ ...d, label: categoryLabel(d.category) }))
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis type="category" dataKey="label" tick={axis} tickLine={false} axisLine={false} width={120} />
        <Tooltip {...tooltipStyle} />
        <Bar dataKey="count" name="Reviews" fill={color} radius={[0, 6, 6, 0]} barSize={16}
          onClick={onSelect ? (d) => onSelect((d as unknown as { category: string }).category) : undefined}
          className={onSelect ? "cursor-pointer" : undefined} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function EmotionRadar({ data, height = 240 }: { data: { emotion: string; count: number }[]; height?: number }) {
  if (!data.length) return <NoData height={height} />
  const rows = data.map((d) => ({ emotion: titleCase(d.emotion), count: d.count }))
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={rows} outerRadius="72%">
        <PolarGrid stroke="var(--border)" />
        <PolarAngleAxis dataKey="emotion" tick={axis} />
        <Radar dataKey="count" name="Reviews" stroke="var(--chart-2)" fill="var(--chart-2)" fillOpacity={0.3} />
        <Tooltip {...tooltipStyle} />
      </RadarChart>
    </ResponsiveContainer>
  )
}

export function CompetitorBars({ data, height = 240 }: { data: { name: string; positive_pct: number; negative_pct: number; is_primary: boolean }[]; height?: number }) {
  if (!data.length) return <NoData height={height} label="Add competitors to compare" />
  const rows = data.map((d) => ({ name: d.name.replace(" (demo)", ""), Positive: d.positive_pct, Negative: d.negative_pct }))
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="name" tick={axis} tickLine={false} axisLine={false} interval={0} />
        <YAxis tick={axis} tickLine={false} axisLine={false} unit="%" />
        <Tooltip {...tooltipStyle} formatter={(v) => `${v}%`} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="Positive" fill={COLORS.positive} radius={[6, 6, 0, 0]} barSize={22} />
        <Bar dataKey="Negative" fill={COLORS.negative} radius={[6, 6, 0, 0]} barSize={22} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function MultiLineChart({ series, height = 240, yUnit, domain }: {
  series: { name: string; points: { period: string; value: number | null }[] }[]
  height?: number
  yUnit?: string
  domain?: [number, number]
}) {
  const periods = [...new Set(series.flatMap((s) => s.points.map((p) => p.period)))].sort()
  if (!periods.length) return <NoData height={height} />
  const rows = periods.map((period) => {
    const row: Record<string, string | number | null> = { label: formatDate(period, { month: "short", day: "numeric" }) }
    series.forEach((s) => (row[s.name] = s.points.find((p) => p.period === period)?.value ?? null))
    return row
  })
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={rows} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} minTickGap={18} />
        <YAxis tick={axis} tickLine={false} axisLine={false} unit={yUnit} domain={domain} />
        <Tooltip {...tooltipStyle} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
        {series.map((s, i) => (
          <Line key={s.name} type="monotone" dataKey={s.name} stroke={COLORS.series[i % COLORS.series.length]} strokeWidth={2} dot={false} connectNulls />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
