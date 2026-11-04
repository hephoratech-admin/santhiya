import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { getAC, getOut, chordBar, pluck, CHORDS, EIGHTH, BAR, suspendMusic, resumeMusic } from '../audio.js'

const W = 400
const H = 600
const LANES = 4
const HIT_Y = 510
const FALL = 2.0 // seconds a heart takes to fall to the line
const LEAD = 2.4 // count-in
const WINDOW = 0.22
const FREQ = [523.25, 587.33, 659.25, 783.99] // C D E G: whatever you hit sounds good
const KEYS = ['d', 'f', 'j', 'k']
const ARROWS = ['ArrowLeft', 'ArrowDown', 'ArrowUp', 'ArrowRight']
// one string per bar (8 eighth-notes each); digit = lane, '.' = rest. Chords: C - Am - F - G
const BARS = [
  '0.2.3.2.', '2.1.0.1.', '0.1.2.1.', '3.2.1.0.',
  '0.23.2.0', '2.1.0.12', '0.12.3.2', '3.2.1.0.',
  '23.32.1.', '1.0.1.2.', '0.2.32.1', '0.1.2.3.',
  '3.23.2.1', '2.1.01.2', '3.2.1.0.', '0.......',
]
const LAST = LEAD + BARS.length * 8 * EIGHTH

const buildNotes = () =>
  BARS.flatMap((bar, b) =>
    bar.padEnd(8, '.').split('').flatMap((c, i) => (c === '.' ? [] : [{ t: LEAD + (b * 8 + i) * EIGHTH, lane: +c, state: 0 }])),
  )

function cover(ctx, img, alpha) {
  if (!img || !img.complete || !img.naturalWidth) return
  const s = Math.max(W / img.naturalWidth, H / img.naturalHeight)
  const w = img.naturalWidth * s
  const h = img.naturalHeight * s
  ctx.globalAlpha = alpha
  ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h)
  ctx.globalAlpha = 1
}

export default function Game({ photos }) {
  const canvas = useRef(null)
  const g = useRef(null)
  const imgs = useRef([])
  const [phase, setPhase] = useState('idle')
  const [result, setResult] = useState(null)

  useEffect(() => {
    imgs.current = photos.map((src) => Object.assign(new Image(), { src }))
  }, [photos])

  const stop = useCallback(() => {
    const s = g.current
    if (!s) return
    cancelAnimationFrame(s.raf)
    s.out.gain.setTargetAtTime(0, s.ac.currentTime, 0.1) // silences any accompaniment already scheduled
    setTimeout(() => s.out.disconnect(), 800)
    g.current = null
  }, [])

  useEffect(() => () => { stop(); resumeMusic() }, [stop])

  const draw = (s, now) => {
    const c = canvas.current
    if (!c) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    if (c.width !== W * dpr) { c.width = W * dpr; c.height = H * dpr }
    const ctx = c.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, W, H)

    // photo that slowly clears as you hit notes
    const list = imgs.current
    const prog = s.notes.length ? s.hits / s.notes.length : 0
    const pos = Math.min(0.999, Math.max(0, (now - LEAD) / (LAST - LEAD))) * list.length
    const idx = Math.floor(pos)
    const f = pos - idx
    ctx.fillStyle = '#fff8f3'
    ctx.fillRect(0, 0, W, H)
    cover(ctx, list[idx], 1)
    if (f > 0.85 && list[idx + 1]) cover(ctx, list[idx + 1], (f - 0.85) / 0.15)
    ctx.fillStyle = `rgba(255,248,243,${0.88 - 0.72 * prog})`
    ctx.fillRect(0, 0, W, H)

    // lanes
    const lw = W / LANES
    for (let i = 0; i < LANES; i++) {
      if (s.flash[i] > 0) {
        const grad = ctx.createLinearGradient(0, HIT_Y - 260, 0, HIT_Y + 40)
        grad.addColorStop(0, 'rgba(217,138,155,0)')
        grad.addColorStop(1, `rgba(217,138,155,${s.flash[i] * 0.45})`)
        ctx.fillStyle = grad
        ctx.fillRect(i * lw, HIT_Y - 260, lw, 300)
        s.flash[i] = Math.max(0, s.flash[i] - 0.06)
      }
      if (i) { ctx.strokeStyle = 'rgba(184,89,111,.18)'; ctx.beginPath(); ctx.moveTo(i * lw, 0); ctx.lineTo(i * lw, H); ctx.stroke() }
      ctx.strokeStyle = 'rgba(184,89,111,.75)'
      ctx.lineWidth = 2
      ctx.beginPath(); ctx.arc((i + 0.5) * lw, HIT_Y, 32, 0, Math.PI * 2); ctx.stroke()
      ctx.fillStyle = 'rgba(184,89,111,.7)'
      ctx.font = '600 13px Jost, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(KEYS[i].toUpperCase(), (i + 0.5) * lw, HIT_Y + 56)
    }

    // falling hearts
    ctx.font = '46px serif'
    ctx.textBaseline = 'middle'
    for (const n of s.notes) {
      if (n.state === 1) continue
      const y = HIT_Y - (n.t - now) * ((HIT_Y + 50) / FALL)
      if (y < -50 || y > H + 50) continue
      ctx.globalAlpha = n.state === 2 ? 0.25 : 1
      ctx.shadowColor = 'rgba(255,150,180,.9)'
      ctx.shadowBlur = n.state === 2 ? 0 : 16
      ctx.fillStyle = '#d9607f'
      ctx.fillText('♥', (n.lane + 0.5) * lw, y)
    }
    ctx.globalAlpha = 1
    ctx.shadowBlur = 0

    // hit rings
    s.fx = s.fx.filter((e) => now - e.born < 0.5)
    for (const e of s.fx) {
      const k = (now - e.born) / 0.5
      ctx.strokeStyle = `rgba(217,96,127,${1 - k})`
      ctx.lineWidth = 3
      ctx.beginPath(); ctx.arc(e.x, HIT_Y, 32 + k * 44, 0, Math.PI * 2); ctx.stroke()
    }

    // labels + HUD
    ctx.textBaseline = 'alphabetic'
    ctx.textAlign = 'center'
    if (s.label && now - s.label.born < 0.7) {
      ctx.globalAlpha = 1 - (now - s.label.born) / 0.7
      ctx.fillStyle = '#b8596f'
      ctx.font = '38px "Great Vibes", cursive'
      ctx.fillText(s.label.text, W / 2, 430 - (now - s.label.born) * 30)
      ctx.globalAlpha = 1
    }
    if (now < LEAD - 0.5) {
      ctx.fillStyle = '#5b2c3f'
      ctx.font = '40px "Great Vibes", cursive'
      ctx.fillText('Get ready…', W / 2, 280)
    }
    ctx.fillStyle = 'rgba(184,89,111,.2)'
    ctx.fillRect(0, 0, W, 5)
    ctx.fillStyle = '#d9607f'
    ctx.fillRect(0, 0, W * Math.min(1, Math.max(0, (now - LEAD) / (LAST - LEAD))), 5)
    ctx.textAlign = 'left'
    ctx.fillStyle = '#5b2c3f'
    ctx.font = '600 16px Jost, sans-serif'
    ctx.fillText(`♥ ${s.score}`, 16, 34)
    if (s.combo > 1) { ctx.textAlign = 'right'; ctx.fillText(`${s.combo} combo`, W - 16, 34) }
  }

  const finish = (s) => {
    const total = s.notes.length
    setResult({ score: s.score, hits: s.hits, total, best: s.best, pct: total ? s.hits / total : 0 })
    draw(s, LAST + 1)
    stop()
    resumeMusic()
    setPhase('done')
  }

  const loop = () => {
    const s = g.current
    if (!s) return
    const now = s.ac.currentTime - s.t0
    for (const n of s.notes) {
      if (n.state === 0 && now > n.t + WINDOW) { n.state = 2; s.combo = 0; s.label = { text: 'oops', born: now } }
    }
    draw(s, now)
    if (now > LAST + 1.2) finish(s)
    else s.raf = requestAnimationFrame(loop)
  }

  const start = () => {
    stop()
    const ac = getAC()
    suspendMusic()
    const out = ac.createGain()
    out.connect(getOut())
    const t0 = ac.currentTime + 0.2
    chordBar(CHORDS[0], t0, out, 0, 0.05) // count-in pad
    BARS.forEach((_, b) => chordBar(CHORDS[b % 4], t0 + LEAD + b * BAR, out, 0.035, 0.05))
    g.current = { ac, out, t0, notes: buildNotes(), score: 0, combo: 0, best: 0, hits: 0, flash: [0, 0, 0, 0], fx: [], label: null, raf: 0 }
    setResult(null)
    setPhase('playing')
    loop()
  }

  const press = useCallback((lane) => {
    const s = g.current
    if (!s) return
    const now = s.ac.currentTime - s.t0
    s.flash[lane] = 1
    let best = null
    for (const n of s.notes) {
      if (n.state === 0 && n.lane === lane && Math.abs(n.t - now) <= WINDOW && (!best || Math.abs(n.t - now) < Math.abs(best.t - now))) best = n
    }
    if (!best) return
    const perfect = Math.abs(best.t - now) < 0.09
    best.state = 1
    s.hits++
    s.combo++
    s.best = Math.max(s.best, s.combo)
    s.score += (perfect ? 100 : 60) + Math.min(s.combo, 20) * 2
    s.label = { text: perfect ? 'Perfect' : 'Lovely', born: now }
    s.fx.push({ x: (lane + 0.5) * (W / LANES), born: now })
    pluck(FREQ[lane], s.ac.currentTime, 0.28)
  }, [])

  useEffect(() => {
    if (phase !== 'playing') return
    const onKey = (e) => {
      if (e.repeat) return
      const k = KEYS.indexOf(e.key.toLowerCase())
      const a = ARROWS.indexOf(e.key)
      if (k >= 0 || a >= 0) { e.preventDefault(); press(k >= 0 ? k : a) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, press])

  const onPointer = (e) => {
    e.preventDefault()
    const r = e.currentTarget.getBoundingClientRect()
    press(Math.min(LANES - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * LANES))))
  }

  const stars = result ? (result.pct >= 0.85 ? 3 : result.pct >= 0.55 ? 2 : 1) : 0
  const msg = ['Every note counts, and so do you.', 'Our song sounds beautiful with you.', 'You played us perfectly.']

  return (
    <section className="section game">
      <motion.p className="eyebrow" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}>
        a little game for you
      </motion.p>
      <motion.h2 className="script big" initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 1 }}>
        Play Our Song
      </motion.h2>
      <p className="game-hint">Tap the hearts as they reach the rings. Every note you hit plays the melody and lifts the mist from our memories.</p>

      <motion.div className="game-wrap" initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 1 }}>
        <canvas ref={canvas} width={W} height={H} onPointerDown={onPointer} />
        {phase !== 'playing' && (
          <div className="game-overlay" style={{ backgroundImage: `url(${photos[0]})` }}>
            <div className="game-card">
              {phase === 'idle' ? (
                <>
                  <h3 className="script">Ready, my love?</h3>
                  <p>Keys <b>D F J K</b> or tap the four lanes.</p>
                  <button className="heart-btn" onClick={start}>Play <span>♥</span></button>
                </>
              ) : (
                <>
                  <div className="stars">{[0, 1, 2].map((n) => <span key={n} className={n < stars ? 'on' : ''}>♥</span>)}</div>
                  <h3 className="script">{msg[stars - 1]}</h3>
                  <p>{result.hits} of {result.total} notes · best combo {result.best} · {result.score} points</p>
                  <button className="heart-btn" onClick={start}>Play again <span>♥</span></button>
                </>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </section>
  )
}
