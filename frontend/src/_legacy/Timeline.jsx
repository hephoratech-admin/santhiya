import { motion } from 'framer-motion'

export default function Timeline({ chapters }) {
  return (
    <section className="section timeline">
      <motion.h2 className="script big" initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 1 }}>
        Our Story
      </motion.h2>

      <div className="thread">
        {chapters.map((c, n) => (
          <motion.article
            key={c.title}
            className={`chapter ${n % 2 ? 'flip' : ''}`}
            initial={{ opacity: 0, y: 60 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-12% 0px' }}
            transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="frame">
              <img src={c.photo} alt={c.title} loading="lazy" />
            </div>
            <div className="words">
              <span className="date">{c.date}</span>
              <h3>{c.title}</h3>
              <p>{c.text}</p>
            </div>
            <span className="dot" />
          </motion.article>
        ))}
      </div>
    </section>
  )
}
