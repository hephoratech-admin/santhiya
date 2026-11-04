import { useEffect, useRef } from 'react'
import { flowerSet } from './flowers.js'

const easeOut = (t) => 1 - (1 - t) ** 3
const easeBack = (t) => { const c = 1.6; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2 }

/**
 * Flowers spiral out from `origin`, spinning as they grow, until they cover the whole screen.
 * Calls onCovered() when the screen is full (swap the page underneath), then blows away and calls onDone().
 */
export default function FlowerBurst({ origin, onCovered, onDone, density = 6 }) {
  const ref = useRef(null)
  const cbs = useRef({ onCovered, onDone })
  cbs.current = { onCovered, onDone }

  useEffect(() => {
    const c = ref.current
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const W = window.innerWidth, H = window.innerHeight
    c.width = W * dpr; c.height = H * dpr
    const g = c.getContext('2d')
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    const sprites = flowerSet()
    const ox = origin?.x ?? W / 2, oy = origin?.y ?? H / 2

    // a jittered grid of resting spots, so the flowers really cover everything
    const cell = Math.min(W, H) / density
    const cols = Math.ceil(W / cell) + 1, rows = Math.ceil(H / cell) + 1
    const flowers = []
    for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
      for (let k = 0; k < 2; k++) {
        const tx = (q + Math.random()) * cell - cell * 0.3
        const ty = (r + Math.random()) * cell - cell * 0.3
        flowers.push({ tx, ty, size: cell * (1.15 + Math.random() * 0.6), img: sprites[(Math.random() * sprites.length) | 0], rot: Math.random() * 6.28, spin: (Math.random() < 0.5 ? -1 : 1) * (3 + Math.random() * 4), drift: (Math.random() - 0.5) * 0.3, side: Math.random() < 0.5 ? -1 : 1 })
      }
    }
    const maxD = Math.max(...flowers.map((f) => Math.hypot(f.tx - ox, f.ty - oy)))
    for (const f of flowers) f.delay = (Math.hypot(f.tx - ox, f.ty - oy) / maxD) * 1.5 + Math.random() * 0.25
    flowers.sort((a, b) => a.delay - b.delay)
    const GROW = 1.15
    const fullAt = Math.max(...flowers.map((f) => f.delay)) + GROW
    const HOLD = 0.9, OUT = 1.1

    let raf, covered = false
    const t0 = performance.now()
    const frame = (now) => {
      const t = (now - t0) / 1000
      g.clearRect(0, 0, W, H)
      const outT = t - fullAt - HOLD
      if (outT >= 0 && !covered) { covered = true; cbs.current.onCovered?.() }
      for (const f of flowers) {
        const lt = Math.min(1, Math.max(0, (t - f.delay) / GROW))
        if (lt <= 0) continue
        const e = easeOut(lt)
        const dx = f.tx - ox, dy = f.ty - oy, d = Math.hypot(dx, dy) || 1
        // curve sideways while travelling, so the burst swirls instead of shooting straight
        const swirl = Math.sin(Math.PI * e) * d * 0.28 * f.side
        let x = ox + dx * e + (-dy / d) * swirl
        let y = oy + dy * e + (dx / d) * swirl
        let sc = easeBack(lt)
        let alpha = 1
        const rot = f.rot + f.spin * (1 - e) + f.drift * t
        if (outT > 0) {
          const k = Math.min(1, Math.max(0, (outT - (f.delay / 1.8) * 0.45) / OUT))
          sc *= 1 + k * 0.5
          alpha = 1 - k
          y -= k * 60
          if (alpha <= 0) continue
        }
        const s = f.size * sc
        g.save()
        g.globalAlpha = alpha
        g.translate(x, y)
        g.rotate(rot)
        g.drawImage(f.img, -s / 2, -s / 2, s, s)
        g.restore()
      }
      if (outT > OUT + 0.5) { cbs.current.onDone?.(); return }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
    // the burst runs once per mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <canvas ref={ref} className="flower-burst" />
}

/** Gently falling, turning flowers for the final screen. */
export function FallingFlowers({ count = 26 }) {
  const ref = useRef(null)
  useEffect(() => {
    const c = ref.current
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    let W, H
    const size = () => { W = c.clientWidth; H = c.clientHeight; c.width = W * dpr; c.height = H * dpr }
    size()
    window.addEventListener('resize', size)
    const g = c.getContext('2d')
    const sprites = flowerSet()
    const items = Array.from({ length: count }, () => ({ x: Math.random(), y: Math.random() * -1.2, s: 28 + Math.random() * 46, v: 0.04 + Math.random() * 0.05, r: Math.random() * 6, vr: (Math.random() - 0.5) * 1.4, sway: Math.random() * 6, img: sprites[(Math.random() * sprites.length) | 0] }))
    let raf, last = performance.now()
    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, W, H)
      for (const f of items) {
        f.y += f.v * dt; f.r += f.vr * dt
        if (f.y > 1.15) { f.y = -0.15; f.x = Math.random() }
        g.save()
        g.globalAlpha = 0.9
        g.translate(f.x * W + Math.sin(now / 1400 + f.sway) * 24, f.y * H)
        g.rotate(f.r)
        g.drawImage(f.img, -f.s / 2, -f.s / 2, f.s, f.s)
        g.restore()
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', size) }
  }, [count])
  return <canvas ref={ref} className="falling-flowers" />
}
