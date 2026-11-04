import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

const N = 3 // sliding puzzle is N x N

function shuffled(n) {
  // start solved and make random legal moves, so the puzzle is always solvable
  const tiles = [...Array(n * n).keys()]
  let empty = n * n - 1
  let prev = -1
  for (let i = 0; i < 160; i++) {
    const r = Math.floor(empty / n), c = empty % n
    const opts = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].filter(([y, x]) => y >= 0 && y < n && x >= 0 && x < n).map(([y, x]) => y * n + x).filter((k) => k !== prev)
    const k = opts[Math.floor(Math.random() * opts.length)]
    ;[tiles[empty], tiles[k]] = [tiles[k], tiles[empty]]
    prev = empty
    empty = k
  }
  return tiles
}

function SlidePuzzle({ photo, onWin }) {
  const [tiles, setTiles] = useState(() => shuffled(N))
  const [moves, setMoves] = useState(0)
  const [peek, setPeek] = useState(false)
  const solved = tiles.every((t, i) => t === i)
  const empty = tiles.indexOf(N * N - 1)

  useEffect(() => { if (solved && moves > 0) onWin() }, [solved, moves, onWin])

  const tap = (i) => {
    if (solved) return
    const r = Math.floor(i / N), c = i % N, er = Math.floor(empty / N), ec = empty % N
    if (Math.abs(r - er) + Math.abs(c - ec) !== 1) return
    const next = [...tiles]
    ;[next[i], next[empty]] = [next[empty], next[i]]
    setTiles(next)
    setMoves((m) => m + 1)
  }

  return (
    <div className="game-box">
      <h3 className="script">Slide the Memory</h3>
      <p className="hint">Tap a tile next to the gap to slide it. Put the photo back together.</p>
      <div className={`slide-board ${solved ? 'solved' : ''}`}>
        {tiles.map((t, i) => (
          <motion.button
            layout
            key={t}
            className={`tile ${t === N * N - 1 && !solved ? 'gap' : ''}`}
            onClick={() => tap(i)}
            style={{ backgroundImage: `url(${photo})`, backgroundPosition: `${(t % N) * 50}% ${Math.floor(t / N) * 50}%` }}
            transition={{ type: 'spring', stiffness: 500, damping: 40 }}
          />
        ))}
        {peek && <img className="peek" src={photo} alt="" />}
      </div>
      <div className="game-row">
        <span>{moves} moves</span>
        <button onPointerDown={() => setPeek(true)} onPointerUp={() => setPeek(false)} onPointerLeave={() => setPeek(false)}>hold to peek</button>
        <button onClick={() => { setTiles(shuffled(N)); setMoves(0) }}>shuffle</button>
      </div>
      {solved && moves > 0 && <p className="win">Solved in {moves} moves ♥</p>}
    </div>
  )
}

function MemoryMatch({ photos, onWin }) {
  const deck = useMemo(() => {
    const pick = photos.slice(0, 6)
    return [...pick, ...pick].map((p, i) => ({ id: i, src: p.src })).sort(() => Math.random() - 0.5)
  }, [photos])
  const [up, setUp] = useState([])
  const [found, setFound] = useState([])
  const [moves, setMoves] = useState(0)
  const done = found.length === deck.length

  useEffect(() => { if (done) onWin() }, [done, onWin])

  const flip = (i) => {
    if (up.length === 2 || up.includes(i) || found.includes(i)) return
    const next = [...up, i]
    setUp(next)
    if (next.length === 2) {
      setMoves((m) => m + 1)
      const [a, b] = next
      if (deck[a].src === deck[b].src) { setFound((f) => [...f, a, b]); setUp([]) }
      else setTimeout(() => setUp([]), 850)
    }
  }

  return (
    <div className="game-box">
      <h3 className="script">Match Our Moments</h3>
      <p className="hint">Flip two cards at a time and find every matching pair.</p>
      <div className="match-grid">
        {deck.map((card, i) => {
          const shown = up.includes(i) || found.includes(i)
          return (
            <button key={card.id} className={`card ${shown ? 'shown' : ''} ${found.includes(i) ? 'found' : ''}`} onClick={() => flip(i)}>
              <span className="back">♥</span>
              <span className="front" style={{ backgroundImage: `url(${card.src})` }} />
            </button>
          )
        })}
      </div>
      <div className="game-row"><span>{moves} tries · {found.length / 2} / {deck.length / 2} pairs</span></div>
      {done && <p className="win">All pairs found in {moves} tries ♥</p>}
    </div>
  )
}

export function GiftReveal({ gift, onClose }) {
  const [opened, setOpened] = useState(false)
  const hearts = useMemo(() => Array.from({ length: 26 }, (_, i) => ({ id: i, x: (Math.random() - 0.5) * 520, d: 1.2 + Math.random() * 1.4, s: 14 + Math.random() * 22, delay: Math.random() * 0.4 })), [])
  return (
    <motion.div className="gift" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      {!opened ? (
        <motion.button className="gift-box" onClick={() => setOpened(true)} initial={{ scale: 0.6, y: 40 }} animate={{ scale: 1, y: 0, rotate: [0, -3, 3, -2, 0] }} transition={{ rotate: { repeat: Infinity, duration: 2.2 } }}>
          <span className="lid" /><span className="body" /><span className="ribbon" />
          <em>You solved them all. Tap to unwrap ♥</em>
        </motion.button>
      ) : (
        <div className="gift-open">
          <div className="burst">{hearts.map((h) => <i key={h.id} style={{ '--x': `${h.x}px`, '--d': `${h.d}s`, '--delay': `${h.delay}s`, fontSize: h.s }}>♥</i>)}</div>
          <motion.div className="gift-photo" initial={{ y: 80, scale: 0.7, opacity: 0, rotate: -6 }} animate={{ y: 0, scale: 1, opacity: 1, rotate: -2 }} transition={{ type: 'spring', damping: 14, stiffness: 120 }}>
            <img src={gift.photo} alt={gift.name} />
            <p className="script">{gift.name}</p>
          </motion.div>
          <motion.div className="gift-text" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
            <h2 className="script">{gift.title}</h2>
            <p>{gift.text}</p>
            <div className="track"><span className="on">Ordered</span><i /><span className="on">Packed with love</span><i /><span>On the way to you</span></div>
            <button className="heart-btn" onClick={onClose}>Back to our town <span>♥</span></button>
          </motion.div>
        </div>
      )}
    </motion.div>
  )
}

export default function Arcade({ photos, gift, done, onWin, onClose }) {
  const [view, setView] = useState('menu')
  const allDone = done.includes('slide') && done.includes('match')
  const giftShown = useRef(false)
  const winSlide = useMemo(() => () => onWin('slide'), [onWin])
  const winMatch = useMemo(() => () => onWin('match'), [onWin])

  // the moment the second puzzle is solved, the gift appears
  useEffect(() => {
    if (!allDone || view === 'menu' || view === 'gift' || giftShown.current) return
    const t = setTimeout(() => { giftShown.current = true; setView('gift') }, 1400)
    return () => clearTimeout(t)
  }, [allDone, view])

  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') view === 'menu' ? onClose() : setView('menu') }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [view, onClose])

  return (
    <motion.div className="modal arcade" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="panel arcade-panel" initial={{ y: 30, scale: 0.97 }} animate={{ y: 0, scale: 1 }}>
        <button className="x" onClick={view === 'menu' ? onClose : () => setView('menu')} aria-label="Close">×</button>
        {view === 'menu' && (
          <div className="arcade-menu">
            <p className="eyebrow">Puzzle House</p>
            <h2 className="script">Two puzzles, one surprise</h2>
            <p>Finish both puzzles and something special unlocks just for you.</p>
            <div className="arcade-cards">
              <button className="a-card" onClick={() => setView('slide')}>
                <span className="a-thumb" style={{ backgroundImage: `url(${photos[1].src})` }} />
                <b>Slide the Memory</b><small>{done.includes('slide') ? 'Solved ✓' : '3 × 3 sliding photo puzzle'}</small>
              </button>
              <button className="a-card" onClick={() => setView('match')}>
                <span className="a-thumb" style={{ backgroundImage: `url(${photos[5].src})` }} />
                <b>Match Our Moments</b><small>{done.includes('match') ? 'Solved ✓' : 'find the 6 photo pairs'}</small>
              </button>
              <button className={`a-card gift-card ${allDone ? '' : 'locked'}`} onClick={() => allDone && setView('gift')}>
                <span className="a-thumb gift-thumb">{allDone ? '🎁' : '🔒'}</span>
                <b>Your gift</b><small>{allDone ? 'Unlocked! Open it' : `solve both to unlock (${done.length}/2)`}</small>
              </button>
            </div>
          </div>
        )}
        {view === 'slide' && <SlidePuzzle photo={photos[1].src} onWin={winSlide} />}
        {view === 'match' && <MemoryMatch photos={photos} onWin={winMatch} />}
      </motion.div>
      <AnimatePresence>{view === 'gift' && <GiftReveal gift={gift} onClose={onClose} />}</AnimatePresence>
    </motion.div>
  )
}
