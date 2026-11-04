import { PAD, benchSprite, buildingSprite, fountainSprite, lampSprite, treeSprite } from './sprites.js'

export const TS = 32
export const COLS = 72
export const ROWS = 48
export const WORLD_W = COLS * TS
export const WORLD_H = ROWS * TS
const GRES = 2 // ground canvas resolution
export const T = { GRASS: 0, PATH: 1, PLAZA: 2, WATER: 3, BRIDGE: 4 }
const { GRASS, PATH, PLAZA, WATER, BRIDGE } = T
const INK = '#4a3340'

// Roads: main street rows 22-23, south street rows 36-37, avenue cols 35-36.
// North buildings face the main street; south buildings face the south street.
export const BUILDINGS = [
  { id: 'home',    kind: 'home',    col: 4,  row: 8,  w: 6,  h: 5, label: 'Home' },
  { id: 'college', kind: 'college', col: 18, row: 3,  w: 10, h: 8, label: 'Sri Ramakrishna College' },
  { id: 'pg',      kind: 'pg',      col: 29, row: 6,  w: 6,  h: 7, label: 'Bangalore PG' },
  { id: 'cafe',    kind: 'cafe',    col: 39, row: 8,  w: 6,  h: 5, label: 'Our Café' },
  { id: 'museum',  kind: 'museum',  col: 47, row: 4,  w: 10, h: 8, label: 'Our Museum' },
  { id: 'stage',   kind: 'stage',   col: 60, row: 7,  w: 6,  h: 6, label: 'Little Stage' },
  { id: 'cinema',  kind: 'cinema',  col: 40, row: 26, w: 8,  h: 6, label: 'Movie Nights' },
  { id: 'arcade',  kind: 'arcade',  col: 51, row: 27, w: 6,  h: 5, label: 'Puzzle House' },
  { id: 'post',    kind: 'post',    col: 60, row: 26, w: 6,  h: 5, label: 'Love Letters' },
]
export const MAIN_ROW = 22
export const SOUTH_ROW = 36
export const SPAWN = { c: 35.5, r: 27.5 }

function rng(seed) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}
export const hash = (x, y, s = 0) => {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
const smooth = (t) => t * t * (3 - 2 * t)
export function vnoise(x, y, s = 0) {
  const x0 = Math.floor(x), y0 = Math.floor(y)
  const fx = smooth(x - x0), fy = smooth(y - y0)
  const a = hash(x0, y0, s), b = hash(x0 + 1, y0, s), c = hash(x0, y0 + 1, s), d = hash(x0 + 1, y0 + 1, s)
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy
}
const tick = (ms = 260) => new Promise((r) => setTimeout(r, ms))
const riverX = (r) => 14 + 1.0 * Math.sin(r * 0.25) + 0.4 * Math.sin(r * 0.11 + 1)
const RIVER_HALF = 1.25

/**
 * Generates the town. Reports progress so the loading screen can draw the map while it forms.
 * onTerrain(snapshot) gets the grid + forest mask as soon as they exist.
 */
export async function buildWorld({ onProgress = () => {}, onTerrain = () => {} } = {}) {
  const rand = rng(7)
  const grid = Array.from({ length: ROWS }, () => new Array(COLS).fill(GRASS))
  const solid = Array.from({ length: ROWS }, () => new Array(COLS).fill(false))
  const forest = Array.from({ length: ROWS }, () => new Array(COLS).fill(false))
  const fill = (c0, r0, c1, r1, t) => { for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) grid[r][c] = t }
  const block = (c0, r0, c1, r1) => { for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) solid[r][c] = true }
  const at = (c, r) => (c < 0 || r < 0 || c >= COLS || r >= ROWS ? GRASS : grid[r][c])
  const inRiver = (c, r) => Math.abs(c + 0.5 - riverX(r)) < RIVER_HALF

  onProgress(0.04, 'Sharpening pencils')
  await tick(300)

  // ---- 1. river, lake, roads ----
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (inRiver(c, r) || ((c - 60) / 8) ** 2 + ((r - 42.5) / 3.2) ** 2 < 1) { grid[r][c] = WATER; solid[r][c] = true }
  }
  fill(2, MAIN_ROW, COLS - 3, MAIN_ROW + 1, PATH)
  fill(2, SOUTH_ROW, COLS - 3, SOUTH_ROW + 1, PATH)
  fill(35, 2, 36, ROWS - 3, PATH)
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if ((c - 35.5) ** 2 + (r - 22.5) ** 2 <= 22) grid[r][c] = PLAZA
  // both streets cross the river on bridges
  for (const r0 of [MAIN_ROW, SOUTH_ROW]) for (let r = r0; r <= r0 + 1; r++) for (let c = 0; c < COLS; c++) if (inRiver(c, r)) { grid[r][c] = BRIDGE; solid[r][c] = false }
  onProgress(0.2, 'Drawing the river')
  await tick()

  // ---- 2. buildings, park ----
  const keepClear = []
  for (const b of BUILDINGS) {
    const doorC = b.col + b.w / 2 - 1
    const toRow = b.row < MAIN_ROW ? MAIN_ROW - 1 : SOUTH_ROW - 1
    fill(doorC, b.row + b.h, doorC + 1, toRow, PATH)
    block(b.col, b.row, b.col + b.w - 1, b.row + b.h - 1)
    keepClear.push([b.col - 1, b.row - 1, b.col + b.w, b.row + b.h + 1])
  }
  // park between the river and the avenue
  fill(25, MAIN_ROW + 2, 26, SOUTH_ROW - 1, PATH)
  fill(19, 29, 34, 30, PATH)
  block(28, 31, 29, 31) // bench
  block(35, 22, 36, 23) // fountain
  const inPark = (c, r) => c >= 18 && c <= 33 && r >= 25 && r <= 34

  // ---- 3. forests (value-noise clumps), kept away from roads and buildings ----
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
  await tick()

  // ---- 4. sprites ----
  const sprites = []
  const places = []
  const lights = []
  const put = (spr, x, y, baseY) => sprites.push({ img: spr.canvas, x: x - PAD, y: y - PAD, w: spr.W + PAD * 2, h: spr.H + PAD * 2, baseY })
  for (const b of BUILDINGS) {
    const doorC = b.col + b.w / 2 - 1
    put(buildingSprite(b.kind, b.w, b.h, b.label), b.col * TS - 8, b.row * TS - 20, (b.row + b.h) * TS)
    const p = { id: b.id, x: (doorC + 1) * TS, y: (b.row + b.h) * TS + 12 }
    places.push(p)
    lights.push({ x: p.x, y: p.y - 18, r: 70 })
    lights.push({ x: (b.col + b.w / 2) * TS, y: (b.row + b.h * 0.55) * TS, r: 30 + b.w * 6 })
  }
  put(benchSprite(), 29 * TS - 36, 32 * TS - 36, 32 * TS - 4)
  places.push({ id: 'park', x: 29 * TS, y: 30.7 * TS })
  put(fountainSprite(), 36 * TS - 52, 24 * TS - 72, 24 * TS + 4)
  lights.push({ x: 36 * TS, y: 23 * TS, r: 90 })
  const lamp = lampSprite()
  for (const [row, cols] of [[MAIN_ROW - 1, [3, 9, 19, 28, 33, 38, 46, 50, 58, 67]], [SOUTH_ROW - 1, [4, 20, 30, 39, 49, 58, 67]]]) {
    for (const c of cols) {
      put(lamp, c * TS + 16 - 10, (row + 1) * TS - 46, (row + 1) * TS - 2)
      lights.push({ x: c * TS + 16, y: (row + 1) * TS - 38, r: 105, lamp: true })
    }
  }
  onProgress(0.56, 'Painting the houses')
  await tick()

  // ---- 5. trees ----
  const pink = treeSprite('pink')
  const green = treeSprite('green')
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
    const t = rand() < (forest[r][c] ? 0.22 : 0.6) ? pink : green
    put(t, c * TS + 16 - 30, (r + 1) * TS - 72, (r + 1) * TS - 2)
  }
  sprites.sort((a, b) => a.baseY - b.baseY)
  onProgress(0.72, 'Hiding little hearts')
  await tick()

  const isSolidTile = (c, r) => c < 0 || r < 0 || c >= COLS || r >= ROWS || solid[r][c]
  const walkable = (c, r) => !isSolidTile(c, r)
  const wanted = [[6, 17], [22, 16], [31, 17], [41, 16], [51, 17], [62, 16], [35, 8], [35, 32], [22, 33], [9, 22],
    [8, 31], [44, 34], [58, 34], [66, 30], [30, 41], [6, 40]]
  const hearts = wanted.map(([c, r], id) => {
    for (let d = 0; d < 6; d++) for (let dr = -d; dr <= d; dr++) for (let dc = -d; dc <= d; dc++) {
      if (walkable(c + dc, r + dr)) return { id, x: (c + dc + 0.5) * TS, y: (r + dr + 0.5) * TS }
    }
    return { id, x: SPAWN.c * TS, y: SPAWN.r * TS }
  })

  // ---- 6. the paper ground ----
  const ground = document.createElement('canvas')
  ground.width = WORLD_W * GRES
  ground.height = WORLD_H * GRES
  const g = ground.getContext('2d')
  g.scale(GRES, GRES)
  g.lineCap = 'round'
  const wob = (x1, y1, x2, y2, a = 1.3) => {
    g.beginPath()
    g.moveTo(x1 + (rand() - 0.5) * a, y1 + (rand() - 0.5) * a)
    g.quadraticCurveTo((x1 + x2) / 2 + (rand() - 0.5) * a * 2, (y1 + y2) / 2 + (rand() - 0.5) * a * 2, x2 + (rand() - 0.5) * a, y2 + (rand() - 0.5) * a)
    g.stroke()
  }
  g.fillStyle = '#f4ecd8'
  g.fillRect(0, 0, WORLD_W, WORLD_H)
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (grid[r][c] !== GRASS) continue
    const n = vnoise(c / 3, r / 3, 5)
    g.fillStyle = `rgb(${Math.round(207 - 17 * n)},${Math.round(228 - 9 * n)},${Math.round(177 - 20 * n)})`
    g.fillRect(c * TS - 0.5, r * TS - 0.5, TS + 1, TS + 1)
  }
  for (let i = 0; i < 700; i++) {
    const x = rand() * WORLD_W, y = rand() * WORLD_H, rad = 14 + rand() * 40
    if (at(Math.floor(x / TS), Math.floor(y / TS)) !== GRASS) continue
    g.fillStyle = ['rgba(150,200,120,.09)', 'rgba(210,225,150,.1)', 'rgba(120,180,130,.07)'][i % 3]
    g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill()
  }
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const t = grid[r][c]
    const x = c * TS, y = r * TS
    if (t === GRASS) {
      if (forest[r][c]) {
        g.fillStyle = 'rgba(96,150,100,.14)'; g.beginPath(); g.arc(x + TS / 2, y + TS / 2, TS * 0.8, 0, 7); g.fill()
        g.fillStyle = 'rgba(52,96,64,.45)'
        for (let i = 0; i < 7; i++) { g.beginPath(); g.arc(x + rand() * TS, y + rand() * TS, 0.7 + rand() * 0.7, 0, 7); g.fill() }
      }
      g.strokeStyle = 'rgba(80,130,80,.5)'; g.lineWidth = 1
      for (let i = 0; i < 3; i++) { const px = x + 4 + rand() * 24, py = y + 6 + rand() * 22; wob(px, py, px - 1, py - 4, 0.8); wob(px + 2, py, px + 3, py - 3, 0.8) }
      if (!solid[r][c] && rand() < (inPark(c, r) ? 0.3 : 0.06)) {
        const px = x + 6 + rand() * 20, py = y + 8 + rand() * 18
        g.fillStyle = ['#f490a8', '#fff', '#ffe27a', '#d9b8f4'][Math.floor(rand() * 4)]
        for (let i = 0; i < 4; i++) { const a = (i / 4) * 6.283; g.beginPath(); g.arc(px + Math.cos(a) * 2, py + Math.sin(a) * 2, 1.6, 0, 7); g.fill() }
        g.fillStyle = '#ffd24a'; g.beginPath(); g.arc(px, py, 1.1, 0, 7); g.fill()
      }
    } else if (t === PATH || t === PLAZA) {
      g.fillStyle = t === PLAZA ? '#f2dcc6' : '#f1ddbd'
      g.fillRect(x - 0.5, y - 0.5, TS + 1, TS + 1)
      g.strokeStyle = 'rgba(122,86,64,.3)'; g.lineWidth = 1.1
      for (let i = 0; i < 5; i++) { const px = x + 3 + rand() * 24, py = y + 3 + rand() * 24; wob(px, py, px + 4 + rand() * 4, py + (rand() - 0.5) * 2, 0.9) }
      g.strokeStyle = 'rgba(107,74,60,.6)'; g.lineWidth = 1.5
      if (at(c, r - 1) === GRASS) wob(x, y + 1, x + TS, y + 1)
      if (at(c, r + 1) === GRASS) wob(x, y + TS - 1, x + TS, y + TS - 1)
      if (at(c - 1, r) === GRASS) wob(x + 1, y, x + 1, y + TS)
      if (at(c + 1, r) === GRASS) wob(x + TS - 1, y, x + TS - 1, y + TS)
    } else {
      g.fillStyle = '#c2dfec'
      g.fillRect(x - 0.5, y - 0.5, TS + 1, TS + 1)
      if (t === WATER) {
        g.strokeStyle = 'rgba(80,130,160,.7)'; g.lineWidth = 1.2
        for (let i = 0; i < 2; i++) { const px = x + 4 + rand() * 18, py = y + 8 + i * 14 + rand() * 4; g.beginPath(); g.moveTo(px, py); g.quadraticCurveTo(px + 4, py - 3, px + 8, py); g.quadraticCurveTo(px + 12, py + 3, px + 16, py); g.stroke() }
        g.strokeStyle = 'rgba(60,100,130,.8)'; g.lineWidth = 1.6
        const wet = (cc, rr) => at(cc, rr) === WATER || at(cc, rr) === BRIDGE
        if (!wet(c, r - 1)) wob(x, y + 1, x + TS, y + 1)
        if (!wet(c, r + 1)) wob(x, y + TS - 1, x + TS, y + TS - 1)
        if (!wet(c - 1, r)) wob(x + 1, y, x + 1, y + TS)
        if (!wet(c + 1, r)) wob(x + TS - 1, y, x + TS - 1, y + TS)
      } else {
        g.fillStyle = '#dcb88a'; g.fillRect(x, y, TS, TS)
        g.strokeStyle = 'rgba(90,60,40,.5)'; g.lineWidth = 1.2
        for (let i = 1; i < 4; i++) wob(x + i * 8, y, x + i * 8, y + TS, 0.6)
        g.strokeStyle = '#6e4a32'; g.lineWidth = 2.2
        if (at(c, r - 1) !== BRIDGE) wob(x, y + 1, x + TS, y + 1, 0.8)
        if (at(c, r + 1) !== BRIDGE) wob(x, y + TS - 1, x + TS, y + TS - 1, 0.8)
      }
    }
  }
  // picnic blanket in the park
  g.fillStyle = '#f6b8c4'; g.beginPath(); g.roundRect(20 * TS, 31 * TS, 3 * TS, 2 * TS, 4); g.fill()
  g.fillStyle = 'rgba(255,255,255,.65)'
  for (let i = 0; i < 6; i++) g.fillRect(20 * TS + i * 16, 31 * TS, 8, 2 * TS)
  g.strokeStyle = INK; g.lineWidth = 1.4; g.beginPath(); g.roundRect(20 * TS, 31 * TS, 3 * TS, 2 * TS, 4); g.stroke()
  g.fillStyle = '#e8627c'; g.font = '18px serif'; g.textAlign = 'center'; g.fillText('♥', 21.5 * TS, 32.2 * TS)
  onProgress(0.9, 'Lighting the lamps')
  await tick()

  // ---- 7. a small pre-drawn map for the corner mini-map ----
  const MS = 1 / 8
  const mini = document.createElement('canvas')
  mini.width = WORLD_W * MS * 2
  mini.height = WORLD_H * MS * 2
  const m = mini.getContext('2d')
  m.scale(MS * 2, MS * 2)
  m.drawImage(ground, 0, 0, WORLD_W, WORLD_H)
  for (const sp of sprites) m.drawImage(sp.img, sp.x, sp.y, sp.w, sp.h)

  const waterTiles = []
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (grid[r][c] === WATER) waterTiles.push([c, r])
  const parkSpots = []
  for (let r = 25; r <= 34; r++) for (let c = 18; c <= 33; c++) if (grid[r][c] === GRASS && !solid[r][c]) parkSpots.push({ x: (c + 0.5) * TS, y: (r + 0.5) * TS })

  onProgress(1, 'Opening the doors')
  await tick(200)

  const free = (x, y) => {
    const hw = 7
    return ![[x - hw, y - 5], [x + hw, y - 5], [x - hw, y], [x + hw, y]].some(([px, py]) => isSolidTile(Math.floor(px / TS), Math.floor(py / TS)))
  }
  const clearLine = (a, b) => {
    const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 6)
    for (let k = 1; k <= steps; k++) if (!free(a.x + ((b.x - a.x) * k) / steps, a.y + ((b.y - a.y) * k) / steps)) return false
    return true
  }

  /** A* over the tile grid (8 directions, no corner cutting), then string-pulled into a few smooth waypoints. */
  const findPath = (x0, y0, x1, y1) => {
    const sc = Math.floor(x0 / TS), sr = Math.floor(y0 / TS)
    let tc = Math.floor(x1 / TS), tr = Math.floor(y1 / TS)
    if (isSolidTile(tc, tr)) {
      // tapped on a tree / house / water: walk to the nearest open tile instead
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
    const heap = [] // binary min-heap of [f, index]
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

  return {
    ground, sprites, places, hearts, waterTiles, lights, mini, parkSpots, free, findPath,
    spawn: { x: SPAWN.c * TS, y: SPAWN.r * TS },
  }
}
