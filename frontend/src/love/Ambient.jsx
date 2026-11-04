import { useEffect, useRef } from 'react'

// Soft bokeh lights and drifting petals behind every screen, plus a sparkle trail that follows the finger / mouse.
export default function Ambient() {
  const ref = useRef(null)
  useEffect(() => {
    const c = ref.current
    const g = c.getContext('2d')
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    let W = 0, H = 0
    const size = () => { W = window.innerWidth; H = window.innerHeight; c.width = W * dpr; c.height = H * dpr }
    size()
    window.addEventListener('resize', size)
    const bokeh = Array.from({ length: 18 }, () => ({ x: Math.random(), y: Math.random(), r: 30 + Math.random() * 90, v: 0.004 + Math.random() * 0.01, ph: Math.random() * 6, hue: Math.random() < 0.5 ? '255,190,205' : '255,226,190' }))
    const petals = Array.from({ length: 16 }, () => ({ x: Math.random(), y: Math.random(), s: 6 + Math.random() * 8, v: 0.02 + Math.random() * 0.03, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 1.5, sw: Math.random() * 6 }))
    const sparks = []
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
    }
  }, [])
  return <canvas ref={ref} className="lp-ambient" aria-hidden />
}
