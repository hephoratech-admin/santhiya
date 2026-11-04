import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

export default function Notes({ name }) {
  const [notes, setNotes] = useState([])
  const [text, setText] = useState('')
  const [hearts, setHearts] = useState([])

  useEffect(() => {
    fetch('/api/notes')
      .then((r) => r.json())
      .then(setNotes)
      .catch(() => {})
  }, [])

  const burst = () => {
    const batch = Array.from({ length: 18 }, (_, k) => ({
      id: Date.now() + k,
      x: (Math.random() - 0.5) * 360,
      d: 0.9 + Math.random() * 1.2,
      s: 14 + Math.random() * 22,
    }))
    setHearts((h) => [...h, ...batch])
    setTimeout(() => setHearts((h) => h.filter((x) => !batch.includes(x))), 2600)
  }

  const send = async (e) => {
    e.preventDefault()
    if (!text.trim()) return
    const note = { name, text: text.trim(), at: new Date().toISOString() }
    try {
      const r = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, text: note.text }),
      })
      const saved = r.ok ? await r.json() : note
      setNotes((n) => [saved, ...n])
    } catch {
      setNotes((n) => [note, ...n]) // backend offline: keep it on screen for this visit
    }
    setText('')
    burst()
  }

  return (
    <footer className="section notes">
      <motion.h2 className="script big" initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 1 }}>
        Write back to me
      </motion.h2>

      <form onSubmit={send}>
        <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder="Tell me what you're feeling…" rows={3} />
        <button type="submit" className="heart-btn">
          Send with love <span>♥</span>
        </button>
        <div className="burst">
          {hearts.map((h) => (
            <i key={h.id} style={{ '--x': `${h.x}px`, '--d': `${h.d + 1}s`, fontSize: h.s }}>♥</i>
          ))}
        </div>
      </form>

      <ul>
        {notes.map((n, i) => (
          <motion.li key={n.at + i} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
            “{n.text}”
          </motion.li>
        ))}
      </ul>

      <p className="end script">Forever &amp; always ♥</p>
    </footer>
  )
}
