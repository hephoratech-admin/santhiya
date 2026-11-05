import { useEffect, useRef } from 'react'

// Heart-shaped fireworks plus glowing sky-lanterns, drawn on one canvas behind the final message.
const COLORS = ['#ff5f86', '#ffb3c7', '#ffd27a', '#ff8fa3', '#f4a9ff', '#fff1f4']
const heart = (t) => ({ x: 16 * Math.sin(t) ** 3, y: -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) })

export default function Fireworks() {
  const ref = useRef(null)
  useEffect(() => {
    const c = ref.current
    const g = c.getContext('2d')
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    let W, H
    const size = () => { W = c.clientWidth; H = c.clientHeight; c.width = W * dpr; c.height = H * dpr }
    size()
    window.addEventListener('resize', size)

    const rockets = [], sparks = []
    // lanterns keep to the sides so they never cover the message in the middle
    const sideX = () => { const r = Math.random() * 0.26; return Math.random() < 0.5 ? 0.02 + r : 0.72 + r }
    const lanterns = Array.from({ length: W < 600 ? 8 : 14 }, () => ({ x: sideX(), y: 0.4 + Math.random() * 0.8, v: 0.018 + Math.random() * 0.02, s: 0.7 + Math.random() * 0.6, ph: Math.random() * 6 }))
    let nextLaunch = 0.6, raf, last = performance.now(), time = 0

    const launch = () => {
      rockets.push({ x: W * (0.12 + Math.random() * 0.76), y: H, vy: -(H * (0.75 + Math.random() * 0.3)), ty: H * (0.1 + Math.random() * 0.22), color: COLORS[(Math.random() * COLORS.length) | 0] })
    }
    const explode = (r) => {
      const n = 70, scale = Math.min(W, H) * (0.011 + Math.random() * 0.006), isHeart = Math.random() < 0.7
      for (let i = 0; i < n; i++) {
        const t = (i / n) * Math.PI * 2
        let vx, vy
        if (isHeart) { const h = heart(t); vx = h.x * scale; vy = h.y * scale }
        else { const sp = 12 * scale * (0.6 + Math.random() * 0.4); vx = Math.cos(t) * sp; vy = Math.sin(t) * sp }
        sparks.push({ x: r.x, y: r.y, vx, vy, life: 1, color: i % 9 === 0 ? '#fff' : r.color })
      }
    }

    const drawLantern = (l) => {
      const x = l.x * W + Math.sin(time * 0.5 + l.ph) * 14, y = l.y * H, s = l.s * Math.min(26, W / 30)
      const halo = g.createRadialGradient(x, y, 0, x, y, s * 2.4)
      halo.addColorStop(0, 'rgba(255,190,120,.45)'); halo.addColorStop(1, 'rgba(255,160,120,0)')
      g.fillStyle = halo; g.beginPath(); g.arc(x, y, s * 2.4, 0, 7); g.fill()
      g.fillStyle = '#ffc583'
      g.beginPath(); g.moveTo(x - s * 0.55, y - s * 0.8); g.lineTo(x + s * 0.55, y - s * 0.8); g.quadraticCurveTo(x + s * 0.8, y, x + s * 0.5, y + s * 0.8); g.lineTo(x - s * 0.5, y + s * 0.8); g.quadraticCurveTo(x - s * 0.8, y, x - s * 0.55, y - s * 0.8); g.fill()
      g.fillStyle = 'rgba(232,70,110,.8)'; g.font = `${s * 0.8}px serif`; g.textAlign = 'center'; g.textBaseline = 'middle'
      g.fillText('♥', x, y + s * 0.05)
    }

    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now; time += dt
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, W, H)

      for (const l of lanterns) {
        l.y -= l.v * dt
        if (l.y < -0.1) { l.y = 1.1; l.x = sideX() }
        drawLantern(l)
      }

      if (!reduce) {
        nextLaunch -= dt
        if (nextLaunch <= 0) { launch(); nextLaunch = 0.9 + Math.random() * 1.1 }
      }
      g.globalCompositeOperation = 'lighter'
      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i]
        r.y += r.vy * dt
        g.fillStyle = r.color; g.beginPath(); g.arc(r.x, r.y, 2.2, 0, 7); g.fill()
        g.fillStyle = 'rgba(255,220,200,.35)'; g.beginPath(); g.arc(r.x, r.y + 8, 1.5, 0, 7); g.fill()
        if (r.y <= r.ty) { explode(r); rockets.splice(i, 1) }
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const p = sparks[i]
        p.life -= dt * 0.55
        if (p.life <= 0) { sparks.splice(i, 1); continue }
        p.vx *= 0.985; p.vy = p.vy * 0.985 + 30 * dt
        p.x += p.vx * dt; p.y += p.vy * dt
        g.globalAlpha = p.life
        g.fillStyle = p.color; g.beginPath(); g.arc(p.x, p.y, 1.4 + p.life * 1.6, 0, 7); g.fill()
      }
      g.globalAlpha = 1
      g.globalCompositeOperation = 'source-over'
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', size) }
  }, [])
  return <canvas ref={ref} className="lp-fireworks" aria-hidden />
}
