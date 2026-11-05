import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, useMotionValue, useTransform } from 'framer-motion'
import FlowerBurst, { FallingFlowers } from './FlowerBurst.jsx'
import { flowerUrl } from './flowers.js'
import Ambient from './Ambient.jsx'
import Fireworks from './Fireworks.jsx'
import { drawAvatarInked } from '../game/avatar.js'
import './love.css'

const SCREENS = ['blossom', 'pass', 'hello', 'quote', 'fromme', 'memories', 'wall', 'letter', 'final']
const fade = { initial: { opacity: 0, y: 22, filter: 'blur(10px)' }, animate: { opacity: 1, y: 0, filter: 'blur(0px)' }, transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] } }

function Next({ onClick, label = 'Next' }) {
  return (
    <motion.button className="lp-next" onClick={onClick} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }} aria-label={label}>
      <span>{label}</span> <b>→</b>
    </motion.button>
  )
}

// ---------- 1. touch the blossom ----------
function Blossom({ onTouch }) {
  const btn = useRef(null)
  const touch = () => { const r = btn.current.getBoundingClientRect(); onTouch({ x: r.left + r.width / 2, y: r.top + r.height / 2 }) }
  return (
    <motion.div className="lp-screen lp-blossom" {...fade}>
      <motion.button ref={btn} className="lp-bloom" onClick={touch} animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 18, ease: 'linear' }} aria-label="Touch the blossom">
        <img src={flowerUrl('anemone', '#f29bb5', 220)} alt="" />
      </motion.button>
      <motion.p className="lp-script lp-touch" animate={{ opacity: [0.55, 1, 0.55] }} transition={{ repeat: Infinity, duration: 2.6 }}>Touch the blossom</motion.p>
    </motion.div>
  )
}

// ---------- 2. passcode ----------
function Passcode({ code, hint, onOpen }) {
  const [val, setVal] = useState('')
  const [bad, setBad] = useState(0)
  const [ok, setOk] = useState(false)
  const press = (d) => {
    if (ok) return
    const next = (val + d).slice(0, code.length)
    setVal(next)
    if (next.length === code.length) {
      if (next === code) { setOk(true); setTimeout(onOpen, 1900) }
      else setTimeout(() => { setBad((b) => b + 1); setVal('') }, 250)
    }
  }
  useEffect(() => {
    const k = (e) => { if (/^\d$/.test(e.key)) press(e.key); if (e.key === 'Backspace') setVal((v) => v.slice(0, -1)) }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  })
  return (
    <motion.div className="lp-screen lp-pass" {...fade}>
      {!ok ? (
        <div className="lp-glass">
          <motion.img className="lp-icon" src={flowerUrl('anemone', '#ee8fa6', 120)} alt="" animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 14, ease: 'linear' }} />
          <h2 className="lp-script">For you, my love</h2>
          <p className="lp-sub">enter our special day to open it</p>
          <motion.div className="lp-dots" key={bad} animate={bad ? { x: [0, -12, 12, -8, 8, 0] } : {}} transition={{ duration: 0.45 }}>
            {[...code].map((_, i) => <i key={i} className={i < val.length ? 'on' : ''} />)}
          </motion.div>
          <div className="lp-keys">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => <button key={d} onClick={() => press(d)}>{d}</button>)}
            <span />
            <button onClick={() => press('0')}>0</button>
            <button onClick={() => setVal((v) => v.slice(0, -1))} aria-label="Delete">⌫</button>
          </div>
          <p className="lp-hint">{bad >= 2 ? hint : bad === 1 ? 'Not quite, try again ♥' : ''}</p>
        </div>
      ) : (
        <motion.div className="lp-wreath" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1, rotate: 360 }} transition={{ rotate: { repeat: Infinity, duration: 3, ease: 'linear' }, duration: 0.6 }}>
          {Array.from({ length: 10 }, (_, i) => (
            <img key={i} src={flowerUrl(i % 2 ? 'rose' : 'anemone', ['#ee8fa6', '#f3f1ec', '#e2876a', '#f29bb5', '#c94f7c'][i % 5], 96)} alt="" style={{ transform: `rotate(${i * 36}deg) translateY(-62px) rotate(${-i * 36}deg)` }} />
          ))}
        </motion.div>
      )}
    </motion.div>
  )
}

// ---------- 3. hello lines ----------
function Hello({ lines, onNext }) {
  const [shown, setShown] = useState(0)
  useEffect(() => { if (shown < lines.length) { const t = setTimeout(() => setShown((n) => n + 1), shown === 0 ? 500 : 1500); return () => clearTimeout(t) } }, [shown, lines.length])
  return (
    <motion.div className="lp-screen lp-hello" {...fade}>
      <motion.img className="lp-icon" src={flowerUrl('rose', '#ee8fa6', 120)} alt="" animate={{ rotate: [0, 10, -10, 0] }} transition={{ repeat: Infinity, duration: 5 }} />
      <div className="lp-lines lp-glass">
        {lines.slice(0, shown).map((l, i) => <motion.p key={i} className={i === 0 ? 'lp-script big' : ''} initial={{ opacity: 0, y: 12, filter: 'blur(6px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ duration: 0.9 }}>{l}</motion.p>)}
      </div>
      {shown >= lines.length && <Next onClick={onNext} />}
    </motion.div>
  )
}

// ---------- 4. quote card with marker highlights ----------
function Quote({ lines, onNext }) {
  const render = (l) => l.split(/(\*[^*]+\*)/).map((part, i) => part.startsWith('*')
    ? <motion.mark key={i} initial={{ backgroundSize: '0% 42%' }} animate={{ backgroundSize: '100% 42%' }} transition={{ delay: 1 + i * 0.5, duration: 0.8 }}>{part.slice(1, -1)}</motion.mark>
    : part)
  return (
    <motion.div className="lp-screen lp-quote" {...fade}>
      <motion.div className="lp-card" initial={{ rotate: -4, scale: 0.9 }} animate={{ rotate: -1.5, scale: 1 }} transition={{ type: 'spring', damping: 14 }}>
        <i className="tape t1" /><i className="tape t2" />
        {lines.map((l, i) => <p key={i}>{render(l)}</p>)}
      </motion.div>
      <Next onClick={onNext} />
    </motion.div>
  )
}

// ---------- 5. from me to you (us, drawn as our avatars) ----------
function FromMe({ title, sub, herLook, hisLook, onNext }) {
  const cv = useRef(null)
  useEffect(() => {
    const c = cv.current
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    c.width = 300 * dpr; c.height = 260 * dpr
    const g = c.getContext('2d')
    let raf
    const frame = (now) => {
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, 300, 260)
      const bob = Math.sin(now / 500) * 3
      drawAvatarInked(g, herLook, 118, 238 + bob * 0.3, 'down', 0, false, 3.2)
      if (hisLook) drawAvatarInked(g, hisLook, 188, 238 - bob * 0.3, 'down', 0, false, 3.3)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [herLook, hisLook])
  return (
    <motion.div className="lp-screen lp-fromme" {...fade}>
      <motion.img className="lp-corner" src={flowerUrl('rose', '#c94f7c', 200)} alt="" animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 30, ease: 'linear' }} />
      <h2 className="lp-script huge">{title}</h2>
      <p className="lp-sub">{sub}</p>
      <div className="lp-us">
        <canvas ref={cv} />
        <motion.span className="lp-heart" animate={{ y: [0, -10, 0], scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 1.6 }}>♥</motion.span>
        {['#f29bb5', '#f3f1ec', '#7fd1b9'].map((col, i) => (
          <motion.img key={col} className={`lp-sprig s${i}`} src={flowerUrl('anemone', col, 90)} alt="" animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 12 + i * 4, ease: 'linear' }} />
        ))}
      </div>
      <Next onClick={onNext} />
    </motion.div>
  )
}

// ---------- 6. beautiful memories: a swipeable card stack ----------
function Memories({ photos, onNext }) {
  const deck = useMemo(() => photos.slice(0, 12), [photos])
  const [order, setOrder] = useState(() => deck.map((_, i) => i))
  const [leaving, setLeaving] = useState(0) // -1 / 1 while the top card flies off
  const x = useMotionValue(0)
  const rot = useTransform(x, [-220, 220], [-20, 20])
  const toss = (dir) => { if (!leaving) setLeaving(dir) }
  const landed = () => {
    if (!leaving) return
    setOrder((o) => [...o.slice(1), o[0]])
    x.set(0)
    setLeaving(0)
  }
  const top = order[0]
  return (
    <motion.div className="lp-screen lp-memories" {...fade}>
      <h2 className="lp-serif">Beautiful Memories</h2>
      <p className="lp-sub">swipe through our moments ♥</p>
      <div className="lp-stack">
        {order.slice(1, 4).reverse().map((idx, k, arr) => {
          const depth = arr.length - k
          return (
            <div key={idx} className="lp-mem back" style={{ transform: `translateY(${depth * 10}px) scale(${1 - depth * 0.05}) rotate(${(depth % 2 ? 1 : -1) * depth * 2.5}deg)` }}>
              <img src={deck[idx].src} alt="" />
            </div>
          )
        })}
        <motion.div key={top} className="lp-mem" style={{ x, rotate: rot }} drag={leaving ? false : 'x'} dragSnapToOrigin={!leaving}
          initial={{ scale: 0.94, opacity: 0 }}
          animate={leaving ? { x: leaving * 520, opacity: 0 } : { scale: 1, opacity: 1 }}
          transition={{ duration: leaving ? 0.35 : 0.3 }}
          onAnimationComplete={landed}
          onDragEnd={(e, info) => { if (Math.abs(info.offset.x) > 90 || Math.abs(info.velocity.x) > 500) toss(Math.sign(info.offset.x || 1)) }}>
          <img src={deck[top].src} alt={deck[top].caption} draggable={false} />
          <p className="lp-script">{deck[top].caption}</p>
        </motion.div>
      </div>
      <div className="lp-row">
        <button className="lp-round" onClick={() => toss(-1)} aria-label="Previous">‹</button>
        <span>{((deck.length - order.indexOf(0)) % deck.length) + 1} / {deck.length}</span>
        <button className="lp-round" onClick={() => toss(1)} aria-label="Next photo">›</button>
      </div>
      <Next onClick={onNext} />
    </motion.div>
  )
}

// ---------- 7. a wall of polaroids she can drag around ----------
function Wall({ photos, onNext }) {
  const box = useRef(null)
  const [z, setZ] = useState({})
  const top = useRef(10)
  const items = useMemo(() => photos.slice(0, 14).map((p, i) => ({
    ...p, left: 4 + ((i * 37) % 78), top: 6 + ((i * 53) % 62), rot: ((i * 47) % 24) - 12,
  })), [photos])
  return (
    <motion.div className="lp-screen lp-wall" {...fade}>
      <div className="lp-wall-box" ref={box}>
        {items.map((p, i) => (
          <motion.div key={p.src} className="lp-pol" drag dragConstraints={box} dragMomentum={false} dragElastic={0.1}
            style={{ left: `${p.left}%`, top: `${p.top}%`, rotate: p.rot, zIndex: z[i] || i }}
            initial={{ opacity: 0, y: -260, scale: 0.6, rotate: p.rot * 3 }} animate={{ opacity: 1, y: 0, scale: 1, rotate: p.rot }}
            transition={{ delay: 0.15 * i, type: 'spring', damping: 16, stiffness: 120 }}
            whileDrag={{ scale: 1.08, rotate: 0 }} onPointerDown={() => setZ((m) => ({ ...m, [i]: ++top.current }))}>
            <img src={p.src} alt={p.caption} draggable={false} />
            <span className="lp-script">{p.caption}</span>
          </motion.div>
        ))}
      </div>
      <motion.div className="lp-wall-note" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.2 }}>
        <p className="lp-script">our little gallery</p>
        <small>drag the photos around ♥</small>
      </motion.div>
      <Next onClick={onNext} label="Read my letter" />
    </motion.div>
  )
}

// ---------- 8. the letter ----------
function Letter({ lines, signature, onFinish }) {
  const [open, setOpen] = useState(false)
  const end = useRef(null)
  return (
    <motion.div className="lp-screen lp-letter" {...fade}>
      {!open ? (
        <>
          <h2 className="lp-serif">A Letter, Just For You</h2>
          <p className="lp-sub">tap the seal to open</p>
          <motion.button className="lp-env" onClick={() => setOpen(true)} animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 3 }}>
            <span className="flap" />
            <motion.span className="seal" animate={{ scale: [1, 1.12, 1] }} transition={{ repeat: Infinity, duration: 1.6 }}>♥</motion.span>
          </motion.button>
        </>
      ) : (
        <motion.div className="lp-paper" initial={{ y: 200, scale: 0.7, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} transition={{ type: 'spring', damping: 18, stiffness: 120 }}>
          <div className="lp-paper-scroll">
            {lines.map((l, i) => (
              <motion.p key={i} className={i === 0 ? 'salute' : i === lines.length - 1 ? 'sign' : ''} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 + i * 0.6 }}>{l}</motion.p>
            ))}
            <p className="from">— {signature}</p>
            <motion.button ref={end} className="lp-love-btn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 + lines.length * 0.6 }}
              onClick={() => { const r = end.current.getBoundingClientRect(); onFinish({ x: r.left + r.width / 2, y: r.top + r.height / 2 }) }}>
              I love you too ♥
            </motion.button>
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}

// ---------- 9. finale ----------
function Final({ title, signature, photos, onTown, onReplay }) {
  return (
    <motion.div className="lp-screen lp-final" {...fade}>
      <div className="lp-collage">{photos.slice(0, 12).map((p, i) => <img key={p.src} src={p.src} alt="" style={{ rotate: `${((i * 41) % 18) - 9}deg` }} />)}</div>
      <Fireworks />
      <FallingFlowers />
      <div className="lp-final-text">
        <motion.h1 className="lp-script huge" initial={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }} animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }} transition={{ duration: 1.4, delay: 0.3 }}>{title}</motion.h1>
        <motion.p className="lp-sub" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }}>{signature}</motion.p>
        <motion.div className="lp-final-btns" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.4 }}>
          <button className="lp-next solid" onClick={onTown}>Enter our little town <b>→</b></button>
          <button className="lp-ghost" onClick={onReplay}>↺ watch again</button>
        </motion.div>
      </div>
    </motion.div>
  )
}

export default function LovePage({ story, herLook, onDone }) {
  const page = story.page ?? {}
  const [screen, setScreen] = useState('blossom')
  const [burst, setBurst] = useState(null) // { origin, then }
  const go = (s) => setScreen(s)
  const back = () => { const i = SCREENS.indexOf(screen); if (i > 1) setScreen(SCREENS[i - 1]) }
  const flowersTo = (origin, then) => setBurst({ origin, then, id: Date.now() })

  return (
    <div className={`lp lp-${screen}-bg`}>
      <Ambient />
      <div className="lp-grain" aria-hidden />
      <div className="lp-vignette" aria-hidden />
      {SCREENS.indexOf(screen) > 0 && screen !== 'final' && (
        <div className="lp-progress" aria-hidden>
          {SCREENS.slice(1, -1).map((k) => <i key={k} className={k === screen ? 'on' : SCREENS.indexOf(k) < SCREENS.indexOf(screen) ? 'done' : ''} />)}
        </div>
      )}
      {SCREENS.indexOf(screen) > 1 && screen !== 'final' && <button className="lp-back" onClick={back} aria-label="Back">‹</button>}
      {/* each screen fades in on mount; no exit-waiting, which could hang with draggable children */}
      <>
        {screen === 'blossom' && <Blossom key="b" onTouch={(o) => flowersTo(o, 'pass')} />}
        {screen === 'pass' && <Passcode key="p" code={String(page.passcode ?? '1311')} hint={page.passHint ?? ''} onOpen={() => go('hello')} />}
        {screen === 'hello' && <Hello key="h" lines={page.opening ?? []} onNext={() => go('quote')} />}
        {screen === 'quote' && <Quote key="q" lines={page.quote ?? []} onNext={() => go('fromme')} />}
        {screen === 'fromme' && <FromMe key="f" title={page.fromMe ?? 'From me to you.'} sub={page.fromMeSub ?? ''} herLook={herLook} hisLook={story.partner?.look} onNext={() => go('memories')} />}
        {screen === 'memories' && <Memories key="m" photos={story.gallery} onNext={() => go('wall')} />}
        {screen === 'wall' && <Wall key="w" photos={story.gallery} onNext={() => go('letter')} />}
        {screen === 'letter' && <Letter key="l" lines={story.letter} signature={story.from} onFinish={(o) => flowersTo(o, 'final')} />}
        {screen === 'final' && <Final key="z" title={page.closing ?? 'I will always love you'} signature={page.signature ?? story.from} photos={story.gallery} onTown={onDone} onReplay={() => go('blossom')} />}
      </>
      {burst && <FlowerBurst key={burst.id} origin={burst.origin} onCovered={() => go(burst.then)} onDone={() => setBurst(null)} />}
    </div>
  )
}
