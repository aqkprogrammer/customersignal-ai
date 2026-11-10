/**
 * Geometry for the intelligence core globe — computed once per detail level, projected per frame.
 *
 * Everything lives on the unit sphere. A smooth "terrain" field (a few gaussian bumps plus a little
 * ripple) is contoured with marching squares on a lon/lat grid, giving organic topographic lines that
 * merge and split like a real survey map. A frequency-2 icosphere provides the geodesic shell.
 */

export type V3 = [number, number, number]

const DEG = Math.PI / 180

function fromLonLat(lon: number, lat: number): V3 {
  const cl = Math.cos(lat)
  return [cl * Math.sin(lon), Math.sin(lat), cl * Math.cos(lon)]
}

const BUMPS: { c: V3; a: number; w: number }[] = [
  [-40, 22, 1.0, 0.36],
  [32, -12, 0.85, 0.3],
  [112, 34, 0.92, 0.4],
  [-122, -28, 0.8, 0.32],
  [168, 6, 0.7, 0.26],
  [62, 52, 0.6, 0.24],
  [-78, -56, 0.55, 0.26],
  [-8, -40, 0.5, 0.22],
].map(([lon, lat, a, w]) => ({ c: fromLonLat(lon * DEG, lat * DEG), a, w }))

export function terrain(p: V3) {
  let f = 0
  for (const b of BUMPS) {
    const d = 1 - (p[0] * b.c[0] + p[1] * b.c[1] + p[2] * b.c[2])
    f += b.a * Math.exp(-d / (1.5 * b.w * b.w))
  }
  f += 0.08 * Math.sin(5 * p[0] + 1.3) * Math.sin(4 * p[1] + 0.7) * Math.cos(3 * p[2] + 2.1)
  return f
}

/** Marching-squares contours on a lon/lat grid, chained into polylines. */
function contours(levels: number[], nLon: number, nLat: number): V3[][] {
  const latMin = -82 * DEG
  const latMax = 82 * DEG
  const lonAt = (i: number) => (i / nLon) * Math.PI * 2 - Math.PI
  const latAt = (j: number) => latMin + (j / nLat) * (latMax - latMin)
  const grid: number[][] = []
  for (let i = 0; i < nLon; i++) {
    grid[i] = []
    for (let j = 0; j <= nLat; j++) grid[i][j] = terrain(fromLonLat(lonAt(i), latAt(j)))
  }
  const g = (i: number, j: number) => grid[((i % nLon) + nLon) % nLon][j]

  const lines: V3[][] = []
  for (const L of levels) {
    // Edge ids: h(i,j) joins (i,j)-(i+1,j); v(i,j) joins (i,j)-(i,j+1). Longitude wraps.
    const point = new Map<string, V3>()
    const adj = new Map<string, string[]>()
    const link = (a: string, b: string) => {
      ;(adj.get(a) ?? adj.set(a, []).get(a)!).push(b)
      ;(adj.get(b) ?? adj.set(b, []).get(b)!).push(a)
    }
    const edgePoint = (id: string, i0: number, j0: number, i1: number, j1: number) => {
      if (!point.has(id)) {
        const a = g(i0, j0)
        const b = g(i1, j1)
        const t = (L - a) / (b - a)
        point.set(id, fromLonLat(lonAt(i0 + (i1 - i0) * t), latAt(j0 + (j1 - j0) * t)))
      }
      return id
    }
    for (let i = 0; i < nLon; i++) {
      const ii = (i + 1) % nLon
      for (let j = 0; j < nLat; j++) {
        const a = g(i, j) > L ? 1 : 0
        const b = g(i + 1, j) > L ? 2 : 0
        const c = g(i + 1, j + 1) > L ? 4 : 0
        const d = g(i, j + 1) > L ? 8 : 0
        const k = a | b | c | d
        if (k === 0 || k === 15) continue
        const E = [
          () => edgePoint(`h${i},${j}`, i, j, i + 1, j),
          () => edgePoint(`v${ii},${j}`, i + 1, j, i + 1, j + 1),
          () => edgePoint(`h${i},${j + 1}`, i, j + 1, i + 1, j + 1),
          () => edgePoint(`v${i},${j}`, i, j, i, j + 1),
        ]
        const pairs: [number, number][] = (
          {
            1: [[3, 0]], 2: [[0, 1]], 3: [[3, 1]], 4: [[1, 2]], 5: [[3, 0], [1, 2]], 6: [[0, 2]], 7: [[3, 2]],
            8: [[2, 3]], 9: [[0, 2]], 10: [[0, 1], [2, 3]], 11: [[1, 2]], 12: [[1, 3]], 13: [[0, 1]], 14: [[0, 3]],
          } as Record<number, [number, number][]>
        )[k]
        for (const [e1, e2] of pairs) link(E[e1](), E[e2]())
      }
    }
    // Walk chains.
    const seen = new Set<string>()
    const walk = (start: string) => {
      const line: V3[] = [point.get(start)!]
      seen.add(start)
      let cur = start
      for (;;) {
        const next = (adj.get(cur) ?? []).find((n) => !seen.has(n))
        if (!next) {
          const first = adj.get(cur)?.includes(start) && line.length > 2
          if (first) line.push(point.get(start)!)
          break
        }
        seen.add(next)
        line.push(point.get(next)!)
        cur = next
      }
      if (line.length > 1) lines.push(line)
    }
    for (const [id, n] of adj) if (n.length === 1 && !seen.has(id)) walk(id)
    for (const id of adj.keys()) if (!seen.has(id)) walk(id)
  }
  return lines
}

function circle(lat: number, n: number): V3[] {
  return Array.from({ length: n + 1 }, (_, i) => fromLonLat((i / n) * Math.PI * 2, lat))
}
function meridian(lon: number, n: number): V3[] {
  return Array.from({ length: n + 1 }, (_, i) => fromLonLat(lon, -Math.PI / 2 + (i / n) * Math.PI))
}

/** Frequency-2 icosphere: 42 vertices, 120 edges. */
function icosphere(): { verts: V3[]; edges: [number, number][] } {
  const t = (1 + Math.sqrt(5)) / 2
  const base: V3[] = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t],
    [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
  ]
  const norm = (v: V3): V3 => {
    const l = Math.hypot(v[0], v[1], v[2])
    return [v[0] / l, v[1] / l, v[2] / l]
  }
  const verts = base.map(norm)
  const faces = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ]
  const mid = new Map<string, number>()
  const midpoint = (a: number, b: number) => {
    const key = a < b ? `${a}-${b}` : `${b}-${a}`
    if (!mid.has(key)) {
      const va = verts[a]
      const vb = verts[b]
      verts.push(norm([(va[0] + vb[0]) / 2, (va[1] + vb[1]) / 2, (va[2] + vb[2]) / 2]))
      mid.set(key, verts.length - 1)
    }
    return mid.get(key)!
  }
  const edgeSet = new Set<string>()
  const edges: [number, number][] = []
  const addEdge = (a: number, b: number) => {
    const key = a < b ? `${a}-${b}` : `${b}-${a}`
    if (!edgeSet.has(key)) {
      edgeSet.add(key)
      edges.push([a, b])
    }
  }
  for (const [a, b, c] of faces) {
    const ab = midpoint(a, b)
    const bc = midpoint(b, c)
    const ca = midpoint(c, a)
    for (const [x, y, z] of [[a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]]) {
      addEdge(x, y)
      addEdge(y, z)
      addEdge(z, x)
    }
  }
  return { verts, edges }
}

/** Fibonacci-lattice points where the terrain is "high" — rendered as an amber survey texture. */
function landPoints(n: number, threshold: number): V3[] {
  const pts: V3[] = []
  const ga = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2
    const r = Math.sqrt(1 - y * y)
    const p: V3 = [Math.cos(i * ga) * r, y, Math.sin(i * ga) * r]
    if (terrain(p) > threshold) pts.push(p)
  }
  return pts
}

export type CoreGeometry = {
  contours: V3[][]
  grid: V3[][]
  land: V3[]
  shell: { verts: V3[]; edges: [number, number][] } | null
  sites: V3[]
}

const cache = new Map<string, CoreGeometry>()

export function coreGeometry(detail: "full" | "lite"): CoreGeometry {
  const hit = cache.get(detail)
  if (hit) return hit
  const full = detail === "full"
  const geo: CoreGeometry = {
    contours: contours(full ? [0.14, 0.28, 0.42, 0.56, 0.7, 0.84] : [0.2, 0.45, 0.7], full ? 84 : 56, full ? 42 : 28),
    grid: [
      ...[-60, -30, 0, 30, 60].map((l) => circle(l * DEG, 56)),
      ...Array.from({ length: full ? 12 : 6 }, (_, i) => meridian((i / (full ? 12 : 6)) * Math.PI * 2, 28)),
    ],
    land: landPoints(full ? 1100 : 520, 0.34),
    shell: full ? icosphere() : null,
    // A handful of surface sites that light up as signal locations.
    sites: [
      [-40, 22], [32, -12], [112, 34], [-122, -28], [168, 6],
    ].map(([lon, lat]) => fromLonLat(lon * DEG, lat * DEG)),
  }
  cache.set(detail, geo)
  return geo
}

/* ------------------------------------------------------------------ projection */

export type View = { cy: number; sy: number; ct: number; st: number; scale: number }

export function view(yaw: number, tilt: number, scale: number): View {
  return { cy: Math.cos(yaw), sy: Math.sin(yaw), ct: Math.cos(tilt), st: Math.sin(tilt), scale }
}

/** Returns screen x, screen y (SVG, y down) and depth z (>0 faces the viewer). */
export function project(p: V3, v: View, out: [number, number, number]) {
  const x1 = p[0] * v.cy + p[2] * v.sy
  const z1 = -p[0] * v.sy + p[2] * v.cy
  const y2 = p[1] * v.ct - z1 * v.st
  const z2 = p[1] * v.st + z1 * v.ct
  out[0] = x1 * v.scale
  out[1] = -y2 * v.scale
  out[2] = z2
  return out
}

const f1 = (n: number) => (Math.round(n * 10) / 10).toString()

/** Projects polylines and splits each segment into the front or back path by depth. */
export function polylinePaths(lines: V3[][], v: View): { front: string; back: string } {
  const front: string[] = []
  const back: string[] = []
  const a: [number, number, number] = [0, 0, 0]
  const b: [number, number, number] = [0, 0, 0]
  for (const line of lines) {
    let lastF = -2
    let lastB = -2
    project(line[0], v, a)
    for (let i = 1; i < line.length; i++) {
      project(line[i], v, b)
      const isFront = a[2] + b[2] >= 0
      const target = isFront ? front : back
      const last = isFront ? lastF : lastB
      if (last !== i - 1) target.push(`M${f1(a[0])} ${f1(a[1])}`)
      target.push(`L${f1(b[0])} ${f1(b[1])}`)
      if (isFront) lastF = i
      else lastB = i
      a[0] = b[0]
      a[1] = b[1]
      a[2] = b[2]
    }
  }
  return { front: front.join(""), back: back.join("") }
}
