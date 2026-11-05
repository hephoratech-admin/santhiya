import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { BUILDINGS, COLS, MAIN_ROW, ROWS, SOUTH_ROW, T, hash } from '../game/world.js'
import { isBirthday } from '../birthday-date.js'
import { buildLayout } from '../game/layout.js'

const TIPS = [
  'Hearts are hiding all over town. Find 6 to open the letter box.',
  'Walk up to a door and press E to step inside a memory.',
  'Hold Shift to run. Click anywhere on the ground to walk there.',
  'Bridges cross the river at the roads, so nobody gets wet.',
  'Scroll or pinch to zoom out and see the whole town like a map.',
  'Solve both puzzles in the Puzzle House. A surprise is waiting.',
  'Stay a while: the sun sets and the lamps light up at night.',
  'Every building holds a little story, and a few photos of you.',
]
const ROOF = { home: '#d9715f', pg: '#7d87b0', cafe: '#e0954f', stage: '#b088d0', post: '#df5a58', college: '#a34a3c', museum: '#8e9bb0', cinema: '#6d5a9c', arcade: '#5fb3a0' }
const INK = '#4a3340'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Draws the generated map as a pen-and-wash sketch on the polaroid.
function drawMini(canvas, snap, withBuildings) {
  const ctx = canvas.getContext('2d')
  const W = canvas.width, H = canvas.height
  const sx = W / COLS, sy = H / ROWS
  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = '#d4e6b6'
  ctx.fillRect(0, 0, W, H)
  const { grid, forest } = snap
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const t = grid[r][c]
    const x = c * sx, y = r * sy
    if (t === T.WATER || t === T.BRIDGE) { ctx.fillStyle = '#a9d0e6'; ctx.fillRect(x - 0.4, y - 0.4, sx + 0.8, sy + 0.8) }
    else if (t === T.PATH || t === T.PLAZA) { ctx.fillStyle = '#f1ddbd'; ctx.fillRect(x - 0.4, y - 0.4, sx + 0.8, sy + 0.8) }
    else if (forest[r][c]) {
      ctx.fillStyle = 'rgba(110,160,110,.35)'; ctx.fillRect(x, y, sx, sy)
      ctx.fillStyle = 'rgba(46,92,58,.85)'
      for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.arc(x + hash(c, r, i) * sx, y + hash(c, r, i + 9) * sy, 0.9, 0, 7); ctx.fill() }
    }
    if (t === T.BRIDGE) { ctx.fillStyle = '#c9a074'; ctx.fillRect(x, y, sx, sy) }
  }
  // soft ink edge on the water
  ctx.strokeStyle = 'rgba(60,100,130,.7)'; ctx.lineWidth = 1
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (grid[r][c] !== T.WATER) continue
    const x = c * sx, y = r * sy
    if (c + 1 >= COLS || grid[r][c + 1] !== T.WATER) { ctx.beginPath(); ctx.moveTo(x + sx, y); ctx.lineTo(x + sx, y + sy); ctx.stroke() }
    if (c - 1 < 0 || grid[r][c - 1] !== T.WATER) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + sy); ctx.stroke() }
  }
  if (withBuildings) {
    for (const b of BUILDINGS) {
      const x = b.col * sx, y = b.row * sy, w = b.w * sx, h = b.h * sy
      ctx.fillStyle = '#fbe9dc'; ctx.fillRect(x, y + h * 0.35, w, h * 0.65)
      ctx.fillStyle = ROOF[b.kind]; ctx.beginPath(); ctx.moveTo(x - 1, y + h * 0.4); ctx.lineTo(x + w + 1, y + h * 0.4); ctx.lineTo(x + w * 0.85, y); ctx.lineTo(x + w * 0.15, y); ctx.fill()
      ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.strokeRect(x, y + h * 0.35, w, h * 0.65)
    }
    // star where she starts, arrows where the road leaves the map
    ctx.font = `${sy * 2.4}px serif`; ctx.textAlign = 'center'; ctx.fillStyle = '#f2b830'; ctx.strokeStyle = INK; ctx.lineWidth = 1.2
    ctx.strokeText('★', snap.spawn.c * sx, snap.spawn.r * sy + sy); ctx.fillText('★', snap.spawn.c * sx, snap.spawn.r * sy + sy)
    ctx.strokeStyle = '#d0584a'; ctx.fillStyle = '#d0584a'; ctx.lineWidth = 2
    for (const [x0, x1, row] of [[0, 5 * sx, MAIN_ROW], [W, W - 5 * sx, SOUTH_ROW]]) {
      const y = (row + 1) * sy
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke()
      const d = x1 > x0 ? 1 : -1
      ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x1 - d * 7, y - 5); ctx.lineTo(x1 - d * 7, y + 5); ctx.fill()
    }
  }
  // pen frame, inset like a map border
  ctx.strokeStyle = INK; ctx.lineWidth = 2.2
  ctx.strokeRect(W * 0.04, H * 0.05, W * 0.92, H * 0.9)
}

export default function Loading({ story, onReady }) {
  const mini = useRef(null)
  const snap = useRef(null)
  const [prog, setProg] = useState({ p: 0, label: 'Sharpening pencils' })
  const [tip, setTip] = useState(0)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try { await Promise.race([document.fonts.load('600 11px Inter'), sleep(1500)]) } catch { /* fonts are optional */ }
      const world = await buildLayout({
        onProgress: (p, label) => {
          if (!alive) return
          setProg({ p, label })
          if (snap.current && mini.current) drawMini(mini.current, snap.current, p >= 0.56)
        },
        onTerrain: (s) => { snap.current = s; if (mini.current) drawMini(mini.current, s, false) },
      })
      if (alive) setProg({ p: 0.92, label: 'Growing leaves and shaping the ground' })
      await import('./Town3D.jsx')
      if (alive && isBirthday(story)) {
        setProg({ p: .94, label: 'Tuning the birthday music' })
        const music = await import('../town3d/birthdayMusic.js')
        await music.prepareBirthdayMusic()
      }
      if (alive) setProg({ p: .96, label: 'Lighting the town' })
      await sleep(200)
      if (alive) onReady(world)
    })()
    const t = setInterval(() => setTip((n) => (n + 1) % TIPS.length), 2600)
    return () => { alive = false; clearInterval(t) }
  }, [onReady])

  return (
    <motion.div className="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.8 }}>
      <div className="polaroid-map">
        <i className="tape" />
        <canvas ref={mini} width={480} height={320} />
      </div>
      <div className="load-info">
        <p className="kicker">Our town</p>
        <h1 className="script">{story.name}'s Town</h1>
        <p className="sub">Blossom Valley, big map, {COLS}×{ROWS}, one river, {BUILDINGS.length + 1} places</p>
        <div className="bar" aria-hidden><b style={{ width: `${Math.round(prog.p * 100)}%` }} /></div>
        <div className="bar-row"><span>{prog.label}</span><span>{Math.round(prog.p * 100)}%</span></div>
        <div className="tip">
          <strong>Tip</strong>
          <motion.p key={tip} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}>{TIPS[tip]}</motion.p>
        </div>
      </div>
    </motion.div>
  )
}
