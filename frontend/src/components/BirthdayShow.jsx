import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { SHOW } from '../town3d/birthday.js'

// Words on screen while the town sings, then a birthday card once the candles are out.
export default function BirthdayShow({ name, message, from, onClose }) {
  const [e, setE] = useState(0)
  useEffect(() => {
    const t0 = performance.now()
    const id = setInterval(() => setE((performance.now() - t0) / 1000), 100)
    return () => clearInterval(id)
  }, [])
  const song = ['Happy birthday to you ♪', 'Happy birthday to you ♫', `Happy birthday dear ${name} ♪`, 'Happy birthday to you! ♥']
  const line = e < SHOW.wish ? SHOW.song.filter((s) => e >= s).length - 1 : -1
  const wishing = e >= SHOW.wish && e < SHOW.blow
  const card = e >= SHOW.end

  return (
    <motion.div className="bd-show" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="bd-bars top" /><div className="bd-bars bottom" />
      <AnimatePresence>
        {line >= 0 && (
          <motion.p key={line} className="bd-line" initial={{ opacity: 0, y: 16, scale: 0.92 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.5 }}>
            {song[line]}
          </motion.p>
        )}
        {e >= SHOW.blow && !card && (
          <motion.p key="yay" className="bd-line yay" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: [0.6, 1.15, 1] }} exit={{ opacity: 0 }} transition={{ duration: 0.7 }}>
            🎉 Happy Birthday, {name}! 🎉
          </motion.p>
        )}
        {wishing && (
          <motion.p key="wish" className="bd-line wish" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.1 }}>
            Close your eyes and make a wish… ✨
          </motion.p>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {card && (
          <motion.div className="bd-card" initial={{ opacity: 0, y: 40, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', damping: 16 }}>
            <div className="bd-cake" aria-hidden>🎂</div>
            <h2>Happy Birthday, {name}!</h2>
            <p>{message || 'Today the whole town is celebrating you, and so am I. ♥'}</p>
            {from && <p className="bd-from">{from}</p>}
            <button onClick={onClose}>Thank you ♥</button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
