import { useEffect, useRef, useState } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'

const origins = ['20% 30%', '80% 40%', '50% 70%']
const open = [0.76, 0, 0.24, 1]

// `started` flips to true when the intro overlay finishes; everything here waits for it.
export default function Hero({ story, started }) {
  const [i, setI] = useState(0)
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const y = useTransform(scrollYProgress, [0, 1], ['0%', '25%'])
  const fade = useTransform(scrollYProgress, [0, 0.7], [1, 0])

  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % story.hero.length), 7000)
    return () => clearInterval(t)
  }, [story.hero.length])

  const letters = Array.from(story.name)
  const on = (a) => (started ? a : undefined)

  return (
    <header className="hero" ref={ref}>
      <motion.div className="bar top" initial={{ height: '20vh' }} animate={{ height: started ? 0 : '20vh' }} transition={{ duration: 2.6, delay: 0.4, ease: open }} />
      <motion.div className="bar bottom" initial={{ height: '20vh' }} animate={{ height: started ? 0 : '20vh' }} transition={{ duration: 2.6, delay: 0.4, ease: open }} />

      <motion.div className="hero-bg" style={{ y }} initial={{ scale: 1.25, opacity: 0 }} animate={on({ scale: 1, opacity: 1 })} transition={{ duration: 3.2, ease: [0.22, 1, 0.36, 1] }}>
        {story.hero.map((src, n) => (
          <div
            key={src}
            className={`slide ${n === i ? 'active' : ''}`}
            style={{ backgroundImage: `url(${src})`, transformOrigin: origins[n % origins.length] }}
          />
        ))}
      </motion.div>
      <div className="hero-veil" />
      <div className="leak" />
      <div className="grain" />

      <motion.div className="hero-copy" style={{ opacity: fade }} initial={{ scale: 1.12 }} animate={on({ scale: 1 })} transition={{ duration: 6, ease: 'easeOut' }}>
        <motion.p className="eyebrow" initial={{ opacity: 0, y: 10 }} animate={on({ opacity: 1, y: 0 })} transition={{ delay: 1.8, duration: 1.2 }}>
          a little film, made just for
        </motion.p>
        <h1 className="script" aria-label={story.name}>
          {letters.map((c, n) => (
            <motion.span
              key={n}
              initial={{ opacity: 0, filter: 'blur(16px)', y: 24 }}
              animate={on({ opacity: 1, filter: 'blur(0px)', y: 0 })}
              transition={{ delay: 2.3 + n * 0.14, duration: 1.3 }}
            >
              {c}
            </motion.span>
          ))}
        </h1>
        <motion.p className="tagline" initial={{ opacity: 0 }} animate={on({ opacity: 1 })} transition={{ delay: 4, duration: 1.8 }}>
          {story.tagline}
        </motion.p>
      </motion.div>

      <motion.a href="#counter" className="scroll-hint" initial={{ opacity: 0 }} animate={on({ opacity: 1 })} transition={{ delay: 5 }}>
        <span>scroll gently</span>
        <i />
      </motion.a>
    </header>
  )
}
