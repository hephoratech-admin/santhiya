import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

const LINES = (name) => [`Dear ${name},`, 'I drew you a little town.', 'Every street holds a memory of us.', "Come, let's walk through it together."]

// step: 0 = sealed envelope, 1 = flap opening, 2 = letter out and reading, 3 = done
export default function Intro({ name = 'you', onDone }) {
  const [step, setStep] = useState(0)
  const lines = LINES(name)

  useEffect(() => {
    if (step === 1) { const t = setTimeout(() => setStep(2), 1100); return () => clearTimeout(t) }
    if (step === 2) { const t = setTimeout(() => setStep(3), 1200 + lines.length * 1100 + 1600); return () => clearTimeout(t) }
    if (step === 3) onDone()
  }, [step, onDone, lines.length])

  return (
    <motion.div className="intro" exit={{ opacity: 0 }} transition={{ duration: 1.2, ease: 'easeInOut' }}>
      <div className="grain" />
      <div className="intro-vignette" />

      <motion.div
        className={`envelope s${step}`}
        initial={{ opacity: 0, y: 40, rotate: -4 }}
        animate={{ opacity: 1, y: step >= 2 ? 120 : 0, rotate: step >= 2 ? 0 : -2, scale: step >= 2 ? 0.9 : 1 }}
        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        onClick={() => step === 0 && setStep(1)}
      >
        <div className="env-back" />
        <motion.div
          className="letter-card"
          initial={false}
          animate={step >= 2 ? { y: -250, scale: 1.18, zIndex: 5 } : { y: 0, scale: 1, zIndex: 1 }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        >
          {step >= 2 && lines.map((l, i) => (
            <motion.p key={i} className={i === 0 ? 'salute' : ''} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.1 + i * 1.1, duration: 0.8 }}>
              {l}
            </motion.p>
          ))}
          {step >= 2 && (
            <svg className="drawn-heart" viewBox="0 0 60 54" aria-hidden>
              <motion.path
                d="M30 50 C8 34 2 22 8 12 C14 2 26 4 30 14 C34 4 46 2 52 12 C58 22 52 34 30 50 Z"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ delay: 1.1 + lines.length * 1.1, duration: 1.2, ease: 'easeInOut' }}
              />
            </svg>
          )}
        </motion.div>
        <div className="env-front" />
        <div className="env-flap" />
        {step === 0 && (
          <motion.button className="seal" animate={{ scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 1.8 }} aria-label="Open the letter">♥</motion.button>
        )}
      </motion.div>

      {step === 0 && (
        <motion.p className="tap-hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
          a letter for {name} · tap the seal
        </motion.p>
      )}
      {step >= 1 && <button className="skip" onClick={onDone}>skip</button>}
    </motion.div>
  )
}
