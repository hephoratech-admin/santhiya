import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

export default function Gallery({ items }) {
  const [open, setOpen] = useState(null)

  const step = useCallback((d) => setOpen((o) => (o === null ? o : (o + d + items.length) % items.length)), [items.length])

  useEffect(() => {
    if (open === null) return
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(null)
      if (e.key === 'ArrowRight') step(1)
      if (e.key === 'ArrowLeft') step(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, step])

  return (
    <section className="section gallery">
      <motion.p className="eyebrow" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}>
        moments I keep replaying
      </motion.p>
      <motion.h2 className="script big" initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 1 }}>
        Our Memories
      </motion.h2>

      <div className="masonry">
        {items.map((it, n) => (
          <motion.figure
            key={it.src + n}
            initial={{ opacity: 0, y: 50, scale: 0.97 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: '-8% 0px' }}
            transition={{ duration: 1, delay: (n % 3) * 0.1 }}
            onClick={() => setOpen(n)}
          >
            <img src={it.src} alt={it.caption} loading="lazy" />
            <figcaption>{it.caption}</figcaption>
          </motion.figure>
        ))}
      </div>

      <AnimatePresence>
        {open !== null && (
          <motion.div className="lightbox" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(null)}>
            <motion.img
              key={open}
              src={items[open].src}
              alt={items[open].caption}
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              onClick={(e) => e.stopPropagation()}
            />
            <p onClick={(e) => e.stopPropagation()}>{items[open].caption}</p>
            <button className="nav prev" onClick={(e) => { e.stopPropagation(); step(-1) }} aria-label="Previous">‹</button>
            <button className="nav next" onClick={(e) => { e.stopPropagation(); step(1) }} aria-label="Next">›</button>
            <button className="close" onClick={() => setOpen(null)} aria-label="Close">×</button>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
