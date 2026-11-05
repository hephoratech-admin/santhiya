// The town plan with no drawing: roads, river, forests, trees, lamps, places, hearts,
// collision and A* pathfinding. Used by the 3D town (and the loading screen's map).
// Units are "pixels" (32 per tile) to match the 2D town; the 3D scene converts to metres.
import { BUILDINGS, COLS, MAIN_ROW, ROWS, SOUTH_ROW, SPAWN, T, TS, vnoise } from './world.js'

export { BUILDINGS, COLS, ROWS, TS, T, MAIN_ROW, SOUTH_ROW, SPAWN }
const { GRASS, PATH, PLAZA, WATER, BRIDGE } = T

function rng(seed) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}
const riverX = (r) => 14 + 1.0 * Math.sin(r * 0.25) + 0.4 * Math.sin(r * 0.11 + 1)
const RIVER_HALF = 1.25
const tick = (ms) => new Promise((r) => setTimeout(r, ms))

export async function buildLayout({ onProgress = () => {}, onTerrain = () => {}, pace = 260 } = {}) {
  const rand = rng(7)
  const grid = Array.from({ length: ROWS }, () => new Array(COLS).fill(GRASS))
  const solid = Array.from({ length: ROWS }, () => new Array(COLS).fill(false))
  const forest = Array.from({ length: ROWS }, () => new Array(COLS).fill(false))
  const fill = (c0, r0, c1, r1, t) => { for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) grid[r][c] = t }
  const block = (c0, r0, c1, r1) => { for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) solid[r][c] = true }
  const at = (c, r) => (c < 0 || r < 0 || c >= COLS || r >= ROWS ? GRASS : grid[r][c])
  const inRiver = (c, r) => Math.abs(c + 0.5 - riverX(r)) < RIVER_HALF

  onProgress(0.04, 'Sharpening pencils')
  await tick(pace)

  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (inRiver(c, r) || ((c - 60) / 8) ** 2 + ((r - 42.5) / 3.2) ** 2 < 1) { grid[r][c] = WATER; solid[r][c] = true }
  }
  fill(2, MAIN_ROW, COLS - 3, MAIN_ROW + 1, PATH)
  fill(2, SOUTH_ROW, COLS - 3, SOUTH_ROW + 1, PATH)
  fill(35, 2, 36, ROWS - 3, PATH)
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if ((c - 35.5) ** 2 + (r - 22.5) ** 2 <= 22) grid[r][c] = PLAZA
  for (const r0 of [MAIN_ROW, SOUTH_ROW]) for (let r = r0; r <= r0 + 1; r++) for (let c = 0; c < COLS; c++) if (inRiver(c, r)) { grid[r][c] = BRIDGE; solid[r][c] = false }
  onProgress(0.2, 'Drawing the river')
  await tick(pace)

  const keepClear = []
  const places = []
  for (const b of BUILDINGS) {
    const doorC = b.col + b.w / 2 - 1
    const toRow = b.row < MAIN_ROW ? MAIN_ROW - 1 : SOUTH_ROW - 1
    fill(doorC, b.row + b.h, doorC + 1, toRow, PATH)
    block(b.col, b.row, b.col + b.w - 1, b.row + b.h - 1)
    keepClear.push([b.col - 1, b.row - 1, b.col + b.w, b.row + b.h + 1])
    places.push({ id: b.id, x: (doorC + 1) * TS, y: (b.row + b.h) * TS + 12 })
  }
  fill(25, MAIN_ROW + 2, 26, SOUTH_ROW - 1, PATH)
  fill(19, 29, 34, 30, PATH)
  block(28, 31, 29, 31) // bench
  block(35, 22, 36, 23) // fountain
  places.push({ id: 'park', x: 29 * TS, y: 30.7 * TS })
  const inPark = (c, r) => c >= 18 && c <= 33 && r >= 25 && r <= 34

  const nearInfra = (c, r) => {
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (at(c + dc, r + dr) !== GRASS) return true
    return false
  }
  const inKeepClear = (c, r) => keepClear.some(([c0, r0, c1, r1]) => c >= c0 && c <= c1 && r >= r0 && r <= r1)
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (grid[r][c] !== GRASS || solid[r][c] || nearInfra(c, r) || inKeepClear(c, r) || inPark(c, r)) continue
    const bias = (c < 11 && r > 14 ? 0.16 : 0) + (r > 38 ? 0.08 : 0)
    if (vnoise(c / 5.5, r / 5.5, 3) + bias > 0.6) forest[r][c] = true
  }
  onTerrain({ grid, forest, spawn: SPAWN })
  onProgress(0.36, 'Planting blossom trees')
  await tick(pace)

  const lamps = []
  for (const [row, cols] of [[MAIN_ROW - 1, [3, 9, 19, 28, 33, 38, 46, 50, 58, 67]], [SOUTH_ROW - 1, [4, 20, 30, 39, 49, 58, 67]]]) {
    for (const c of cols) lamps.push({ x: c * TS + 16, y: (row + 1) * TS - 4 })
  }
  onProgress(0.56, 'Raising the houses')
  await tick(pace)

  const trees = []
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (grid[r][c] !== GRASS || solid[r][c]) continue
    const border = c < 2 || r < 2 || c >= COLS - 2 || r >= ROWS - 2
    let p
    if (border) p = 0.92
    else if (forest[r][c]) p = 0.7
    else if (nearInfra(c, r) || inKeepClear(c, r)) p = 0
    else p = inPark(c, r) ? 0.1 : 0.022
    if (rand() >= p) continue
    solid[r][c] = true
    trees.push({ c, r, pink: rand() < (forest[r][c] ? 0.22 : 0.6), s: 0.8 + rand() * 0.5, rot: rand() * 6.28, jx: rand() - 0.5, jy: rand() - 0.5 })
  }
  // little flowers on open grass
  const flowers = []
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (grid[r][c] !== GRASS || solid[r][c]) continue
    const n = inPark(c, r) ? 5 : rand() < 0.18 ? 2 : 0
    for (let i = 0; i < n; i++) flowers.push({ x: (c + rand()) * TS, y: (r + rand()) * TS, k: (rand() * 5) | 0 })
  }
  onProgress(0.72, 'Hiding little hearts')
  await tick(pace)

  const isSolidTile = (c, r) => c < 0 || r < 0 || c >= COLS || r >= ROWS || solid[r][c]
  const walkable = (c, r) => !isSolidTile(c, r)
  // Trees can surround an otherwise free tile. Collectibles must belong to the
  // spawn's connected component, with the same corner rule as tap-to-walk.
  const reachable = new Uint8Array(COLS * ROWS), queue = new Int32Array(COLS * ROWS)
  let head = 0, tail = 0
  const start = Math.floor(SPAWN.r) * COLS + Math.floor(SPAWN.c)
  reachable[start] = 1; queue[tail++] = start
  while (head < tail) {
    const tile = queue[head++], c = tile % COLS, r = Math.floor(tile / COLS)
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if ((!dc && !dr) || !walkable(c + dc, r + dr)) continue
      if (dc && dr && (!walkable(c + dc, r) || !walkable(c, r + dr))) continue
      const next = (r + dr) * COLS + c + dc
      if (!reachable[next]) { reachable[next] = 1; queue[tail++] = next }
    }
  }
  const wanted = [[6, 17], [22, 16], [31, 17], [41, 16], [51, 17], [62, 16], [35, 8], [35, 32], [22, 33], [9, 22],
    [8, 31], [44, 34], [58, 34], [66, 30], [30, 41], [6, 40]]
  const hearts = wanted.map(([c, r], id) => {
    for (let d = 0; d < 6; d++) for (let dr = -d; dr <= d; dr++) for (let dc = -d; dc <= d; dc++) {
      if (walkable(c + dc, r + dr) && reachable[(r + dr) * COLS + c + dc]) return { id, x: (c + dc + 0.5) * TS, y: (r + dr + 0.5) * TS }
    }
    return { id, x: SPAWN.c * TS, y: SPAWN.r * TS }
  })

  const free = (x, y) => {
    const hw = 7
    return ![[x - hw, y - 5], [x + hw, y - 5], [x - hw, y], [x + hw, y]].some(([px, py]) => isSolidTile(Math.floor(px / TS), Math.floor(py / TS)))
  }
  const clearLine = (a, b) => {
    const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 6)
    for (let k = 1; k <= steps; k++) if (!free(a.x + ((b.x - a.x) * k) / steps, a.y + ((b.y - a.y) * k) / steps)) return false
    return true
  }
  // A* over the tile grid (8 directions, no corner cutting), string-pulled into a few waypoints
  const findPath = (x0, y0, x1, y1) => {
    const sc = Math.floor(x0 / TS), sr = Math.floor(y0 / TS)
    let tc = Math.floor(x1 / TS), tr = Math.floor(y1 / TS)
    if (isSolidTile(tc, tr)) {
      let best = null, bd = Infinity
      for (let d = 1; d < 8 && !best; d++) for (let dr = -d; dr <= d; dr++) for (let dc = -d; dc <= d; dc++) {
        if (!isSolidTile(tc + dc, tr + dr) && dc * dc + dr * dr < bd) { bd = dc * dc + dr * dr; best = [tc + dc, tr + dr] }
      }
      if (!best) return null
      ;[tc, tr] = best
      x1 = (tc + 0.5) * TS; y1 = (tr + 0.5) * TS
    }
    const N = COLS * ROWS
    const gScore = new Float32Array(N).fill(Infinity)
    const came = new Int32Array(N).fill(-1)
    const closed = new Uint8Array(N)
    const h = (c, r) => { const dx = Math.abs(c - tc), dy = Math.abs(r - tr); return dx + dy - 0.586 * Math.min(dx, dy) }
    const heap = []
    const push = (f, i) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p } }
    const pop = () => {
      const top = heap[0], last = heap.pop()
      if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m } }
      return top
    }
    const start = sr * COLS + sc, goal = tr * COLS + tc
    gScore[start] = 0
    push(h(sc, sr), start)
    while (heap.length) {
      const [, cur] = pop()
      if (cur === goal) break
      if (closed[cur]) continue
      closed[cur] = 1
      const c = cur % COLS, r = (cur / COLS) | 0
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (!dc && !dr) continue
        const nc = c + dc, nr = r + dr
        if (isSolidTile(nc, nr)) continue
        if (dc && dr && (isSolidTile(c + dc, r) || isSolidTile(c, r + dr))) continue
        const ni = nr * COLS + nc
        const ng = gScore[cur] + (dc && dr ? 1.414 : 1)
        if (ng < gScore[ni]) { gScore[ni] = ng; came[ni] = cur; push(ng + h(nc, nr), ni) }
      }
    }
    if (came[goal] === -1 && goal !== start) return null
    const tiles = []
    for (let i = goal; i !== start && i !== -1; i = came[i]) tiles.unshift({ x: (i % COLS + 0.5) * TS, y: (((i / COLS) | 0) + 0.5) * TS })
    if (tiles.length) tiles[tiles.length - 1] = { x: x1, y: y1 }
    const pts = [{ x: x0, y: y0 }, ...tiles]
    const out = []
    for (let i = 0; i < pts.length - 1;) {
      let j = pts.length - 1
      while (j > i + 1 && !clearLine(pts[i], pts[j])) j--
      out.push(pts[j])
      i = j
    }
    return out
  }

  const parkSpots = []
  for (let r = 25; r <= 34; r++) for (let c = 18; c <= 33; c++) if (grid[r][c] === GRASS && !solid[r][c] && reachable[r * COLS + c]) parkSpots.push({ x: (c + 0.5) * TS, y: (r + 0.5) * TS })

  onProgress(0.9, 'Lighting the lamps')
  await tick(pace)

  return {
    grid, solid, forest, trees, flowers, lamps, places, hearts, parkSpots, free, findPath, inPark,
    spawn: { x: SPAWN.c * TS, y: SPAWN.r * TS },
  }
}
