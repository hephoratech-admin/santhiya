import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { DEFAULT_LOOK, OPTIONS, drawAvatarInked } from '../game/avatar.js'

const DIRS = ['down', 'right', 'up', 'left']

function Swatches({ label, value, options, onPick }) {
  return (
    <div className="opt">
      <span>{label}</span>
      <div className="swatches">
        {options.map((c) => (
          <button key={c} className={c === value ? 'on' : ''} style={{ background: c }} onClick={() => onPick(c)} aria-label={`${label} ${c}`} />
        ))}
      </div>
    </div>
  )
}

function Chips({ label, value, options, onPick }) {
  return (
    <div className="opt">
      <span>{label}</span>
      <div className="chips">
        {options.map(([v, text]) => (
          <button key={v} className={v === value ? 'on' : ''} onClick={() => onPick(v)}>{text}</button>
        ))}
      </div>
    </div>
  )
}

export default function Creator({ initial, onDone }) {
  const [look, setLook] = useState(initial.look ?? DEFAULT_LOOK)
  const [name, setName] = useState(initial.name)
  const canvas = useRef(null)
  const lookRef = useRef(look)
  lookRef.current = look
  const set = (k) => (v) => setLook((l) => ({ ...l, [k]: v }))

  useEffect(() => {
    let raf
    const t0 = performance.now()
    const loop = (now) => {
      const c = canvas.current
      if (!c) return
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const w = 240, h = 300
      if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr) }
      const ctx = c.getContext('2d')
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      const t = (now - t0) / 1000
      const dir = DIRS[Math.floor(t / 1.8) % 4]
      drawAvatarInked(ctx, lookRef.current, w / 2, 262, dir, (t * 1.6) % 1, true, 5)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <motion.div className="creator" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.2 }}>
      <div className="creator-card">
        <div className="stage">
          <p className="eyebrow">your avatar</p>
          <canvas ref={canvas} />
          <input className="name" value={name} maxLength={16} onChange={(e) => setName(e.target.value)} placeholder="Your name" aria-label="Name" />
        </div>

        <div className="opts">
          <h2 className="script">Make it you</h2>
          <Chips label="Hair" value={look.hair} options={OPTIONS.hair} onPick={set('hair')} />
          <Swatches label="Hair colour" value={look.hairColor} options={OPTIONS.hairColor} onPick={set('hairColor')} />
          <Swatches label="Skin" value={look.skin} options={OPTIONS.skin} onPick={set('skin')} />
          <Swatches label="Top" value={look.top} options={OPTIONS.top} onPick={set('top')} />
          <Swatches label="Bottoms" value={look.bottom} options={OPTIONS.bottom} onPick={set('bottom')} />
          <Chips label="Extra" value={look.extra} options={OPTIONS.extra} onPick={set('extra')} />
          <button className="heart-btn" onClick={() => onDone({ look, name: name.trim() || 'You' })}>
            Enter our town <span>♥</span>
          </button>
        </div>
      </div>
    </motion.div>
  )
}
