import { useEffect, useRef } from 'react'

// Soft bokeh lights, drifting petals, rising hearts and twinkling stars behind every screen,
// plus a sparkle trail that follows the finger / mouse and a heart burst on every tap.
// Anything can ask for a burst with: window.dispatchEvent(new CustomEvent('lp-burst', { detail: { x, y, n } }))
export function heartBurst(x, y, n = 28) {
  window.dispatchEvent(new CustomEvent('lp-burst', { detail: { x, y, n } }))
}
export function burstAt(el, n) {
  if (!el) return
  const r = el.getBoundingClientRect()
  heartBurst(r.left + r.width / 2, r.top + r.height / 2, n)
}

const HEART_COLORS = ['#e8627c', '#f490a8', '#ffb3c7', '#ff7a9c', '#ffd27a', '#d98bd8']

export default function Ambient() {
  const ref = useRef(null)
  const top = useRef(null)
  useEffect(() => {
    const c = ref.current
    const g = c.getContext('2d')
    const c2 = top.current
    const g2 = c2.getContext('2d')
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    let W = 0, H = 0
    const size = () => { W = window.innerWidth; H = window.innerHeight; c.width = c2.width = W * dpr; c.height = c2.height = H * dpr }
    size()
    window.addEventListener('resize', size)
    const bokeh = Array.from({ length: 18 }, () => ({ x: Math.random(), y: Math.random(), r: 30 + Math.random() * 90, v: 0.004 + Math.random() * 0.01, ph: Math.random() * 6, hue: Math.random() < 0.5 ? '255,190,205' : '255,226,190' }))
    const petals = Array.from({ length: 16 }, () => ({ x: Math.random(), y: Math.random(), s: 6 + Math.random() * 8, v: 0.02 + Math.random() * 0.03, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 1.5, sw: Math.random() * 6 }))
    const sparks = []
    const small = () => W < 600
    // soft hearts that float up from the bottom
    const floaters = Array.from({ length: small() ? 9 : 16 }, () => ({ x: Math.random(), y: 0.2 + Math.random() * 1.1, s: 10 + Math.random() * 22, v: 0.025 + Math.random() * 0.035, ph: Math.random() * 6, col: HEART_COLORS[(Math.random() * 4) | 0], a: 0.18 + Math.random() * 0.25 }))
    // little four-point glints that twinkle in place
    const stars = Array.from({ length: small() ? 14 : 26 }, () => ({ x: Math.random(), y: Math.random(), s: 3 + Math.random() * 6, ph: Math.random() * 6, sp: 0.6 + Math.random() * 1.4 }))
    const pops = []
    const onBurst = (e) => {
      const { x, y, n = 28 } = e.detail || {}
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.3, sp = 90 + Math.random() * 220
        pops.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, life: 1, s: 8 + Math.random() * 14, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 6, col: HEART_COLORS[(Math.random() * HEART_COLORS.length) | 0], heart: Math.random() < 0.75 })
      }
      if (pops.length > 400) pops.splice(0, pops.length - 400)
    }
    const onDown = (e) => { if (e.isPrimary !== false) onBurst({ detail: { x: e.clientX, y: e.clientY, n: 10 } }) }
    window.addEventListener('lp-burst', onBurst)
    window.addEventListener('pointerdown', onDown)
    const heartPath = (s, ctx = g) => {
      ctx.beginPath()
      ctx.moveTo(0, s * 0.3)
      ctx.bezierCurveTo(-s * 0.9, -s * 0.3, -s * 0.45, -s, 0, -s * 0.45)
      ctx.bezierCurveTo(s * 0.45, -s, s * 0.9, -s * 0.3, 0, s * 0.3)
      ctx.closePath()
    }
    const onMove = (e) => {
      const p = e.touches ? e.touches[0] : e
      if (!p) return
      for (let i = 0; i < 2; i++) sparks.push({ x: p.clientX, y: p.clientY, vx: (Math.random() - 0.5) * 40, vy: -20 - Math.random() * 40, life: 1, s: 4 + Math.random() * 6, heart: Math.random() < 0.35 })
      if (sparks.length > 120) sparks.splice(0, sparks.length - 120)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('touchmove', onMove, { passive: true })
    let raf, last = performance.now()
    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const t = now / 1000
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, W, H)
      for (const b of bokeh) {
        b.y -= b.v * dt
        if (b.y < -0.2) { b.y = 1.2; b.x = Math.random() }
        const x = b.x * W + Math.sin(t * 0.3 + b.ph) * 30, y = b.y * H
        const a = 0.18 + Math.sin(t * 0.8 + b.ph) * 0.08
        const gr = g.createRadialGradient(x, y, 0, x, y, b.r)
        gr.addColorStop(0, `rgba(${b.hue},${a})`); gr.addColorStop(1, `rgba(${b.hue},0)`)
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, b.r, 0, 7); g.fill()
      }
      for (const p of petals) {
        p.y += p.v * dt; p.rot += p.vr * dt
        if (p.y > 1.1) { p.y = -0.1; p.x = Math.random() }
        g.save()
        g.translate(p.x * W + Math.sin(t * 0.7 + p.sw) * 40, p.y * H)
        g.rotate(p.rot)
        g.fillStyle = 'rgba(244,160,185,.55)'
        g.beginPath(); g.ellipse(0, 0, p.s, p.s * 0.55, 0, 0, 7); g.fill()
        g.fillStyle = 'rgba(255,255,255,.35)'
        g.beginPath(); g.ellipse(-p.s * 0.25, -p.s * 0.1, p.s * 0.35, p.s * 0.18, 0, 0, 7); g.fill()
        g.restore()
      }
      for (const f of floaters) {
        f.y -= f.v * dt
        if (f.y < -0.08) { f.y = 1.08; f.x = Math.random() }
        g.save()
        g.translate(f.x * W + Math.sin(t * 0.9 + f.ph) * 22, f.y * H)
        g.rotate(Math.sin(t * 1.2 + f.ph) * 0.25)
        g.globalAlpha = f.a * Math.min(1, (1.08 - f.y) * 4)
        g.fillStyle = f.col
        heartPath(f.s); g.fill()
        g.globalAlpha *= 0.6
        g.fillStyle = '#fff'
        g.beginPath(); g.ellipse(-f.s * 0.28, -f.s * 0.5, f.s * 0.14, f.s * 0.08, -0.6, 0, 7); g.fill()
        g.restore()
      }
      for (const st of stars) {
        const tw = Math.max(0, Math.sin(t * st.sp + st.ph))
        if (tw < 0.05) continue
        const x = st.x * W, y = st.y * H, r = st.s * tw
        g.globalAlpha = tw * 0.85
        g.fillStyle = '#fff6e0'
        g.beginPath()
        g.moveTo(x, y - r * 2); g.quadraticCurveTo(x, y, x + r * 2, y); g.quadraticCurveTo(x, y, x, y + r * 2); g.quadraticCurveTo(x, y, x - r * 2, y); g.quadraticCurveTo(x, y, x, y - r * 2)
        g.fill()
        g.globalAlpha = 1
      }
      g2.setTransform(dpr, 0, 0, dpr, 0, 0)
      g2.clearRect(0, 0, W, H)
      for (let i = pops.length - 1; i >= 0; i--) {
        const p = pops[i]
        p.life -= dt * 0.9
        if (p.life <= 0) { pops.splice(i, 1); continue }
        p.vx *= 0.96; p.vy = p.vy * 0.96 + 260 * dt
        p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt
        g2.save()
        g2.translate(p.x, p.y); g2.rotate(p.rot * 0.2)
        g2.globalAlpha = Math.min(1, p.life * 1.6)
        g2.fillStyle = p.col
        if (p.heart) { heartPath(p.s * (0.6 + p.life * 0.4), g2); g2.fill() }
        else { g2.rotate(p.rot); g2.fillRect(-p.s * 0.3, -p.s * 0.15, p.s * 0.6, p.s * 0.3) }
        g2.restore()
      }
      g2.globalAlpha = 1
      g.globalAlpha = 1
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i]
        s.life -= dt * 1.4
        if (s.life <= 0) { sparks.splice(i, 1); continue }
        s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 30 * dt
        g.globalAlpha = s.life
        if (s.heart) { g.fillStyle = '#e8627c'; g.font = `${s.s * 2}px serif`; g.textAlign = 'center'; g.fillText('♥', s.x, s.y) }
        else {
          const gr = g.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.s)
          gr.addColorStop(0, 'rgba(255,236,190,1)'); gr.addColorStop(1, 'rgba(255,200,160,0)')
          g.fillStyle = gr; g.beginPath(); g.arc(s.x, s.y, s.s, 0, 7); g.fill()
        }
        g.globalAlpha = 1
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', size)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('lp-burst', onBurst)
      window.removeEventListener('pointerdown', onDown)
    }
  }, [])
  return (
    <>
      <canvas ref={ref} className="lp-ambient" aria-hidden />
      <canvas ref={top} className="lp-pops" aria-hidden />
    </>
  )
}
