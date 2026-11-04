import { motion } from 'framer-motion'

export default function Letter({ lines, signature }) {
  return (
    <section className="section letter-wrap">
      <motion.div
        className="letter"
        initial={{ opacity: 0, y: 50, rotate: -1 }}
        whileInView={{ opacity: 1, y: 0, rotate: 0 }}
        viewport={{ once: true, margin: '-10% 0px' }}
        transition={{ duration: 1.2 }}
      >
        <span className="seal">♥</span>
        {lines.map((l, n) => (
          <motion.p
            key={n}
            className={n === 0 ? 'script salute' : n === lines.length - 1 ? 'script sign' : ''}
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5 + n * 0.55, duration: 1 }}
          >
            {l}
          </motion.p>
        ))}
        <motion.p className="from" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.5 + lines.length * 0.55 }}>
          — {signature}
        </motion.p>
      </motion.div>
    </section>
  )
}
