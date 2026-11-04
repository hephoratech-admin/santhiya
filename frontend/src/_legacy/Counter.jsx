import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

function parts(since) {
  const diff = Math.max(0, Date.now() - new Date(since).getTime())
  const s = Math.floor(diff / 1000)
  return [
    ['days', Math.floor(s / 86400)],
    ['hours', Math.floor(s / 3600) % 24],
    ['minutes', Math.floor(s / 60) % 60],
    ['seconds', s % 60],
  ]
}

export default function Counter({ since }) {
  const [t, setT] = useState(() => parts(since))
  useEffect(() => {
    const id = setInterval(() => setT(parts(since)), 1000)
    return () => clearInterval(id)
  }, [since])

  return (
    <section id="counter" className="section counter">
      <motion.p className="eyebrow" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}>
        every heartbeat since we began
      </motion.p>
      <motion.h2 initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 1 }}>
        We've been writing our story for
      </motion.h2>
      <div className="tiles">
        {t.map(([label, v], n) => (
          <motion.div
            key={label}
            className="tile"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: n * 0.12, duration: 0.9 }}
          >
            <b>{String(v).padStart(2, '0')}</b>
            <span>{label}</span>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
