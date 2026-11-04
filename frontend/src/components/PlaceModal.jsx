import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

function ReplyBox({ name }) {
  const [text, setText] = useState('')
  const [notes, setNotes] = useState([])
  useEffect(() => {
    fetch('/api/notes').then((r) => r.json()).then(setNotes).catch(() => {})
  }, [])
  const send = (e) => {
    e.preventDefault()
    if (!text.trim()) return
    const note = { name, text: text.trim() }
    // keep it on screen even if the backend is offline
    setNotes((n) => [note, ...n])
    setText('')
    fetch('/api/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(note) }).catch(() => {})
  }
  return (
    <form className="reply" onSubmit={send}>
      <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={500} rows={2} placeholder="Write back to me…" />
      <button type="submit" className="heart-btn">Send with love <span>♥</span></button>
      <ul>{notes.map((n, i) => <li key={i}>“{n.text}”</li>)}</ul>
    </form>
  )
}
export default function PlaceModal({ place, story, onClose }) {
  const [i, setI] = useState(0)
  const photos = place.photos
  const step = (d) => setI((n) => (n + d + photos.length) % photos.length)

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') step(1)
      if (e.key === 'ArrowLeft') step(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const isPost = place.id === 'post'
  const cur = photos[i]

  return (
    <motion.div className="modal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="panel" initial={{ opacity: 0, y: 40, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 30 }} transition={{ type: 'spring', damping: 24, stiffness: 220 }} onClick={(e) => e.stopPropagation()}>
        <button className="x" onClick={onClose} aria-label="Close">×</button>

        <div className="shots">
          <div className="polaroid">
            <motion.img key={cur.src} src={cur.src} alt={cur.caption} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} />
            <p className="script">{cur.caption}</p>
          </div>
          {photos.length > 1 && (
            <div className="nav">
              <button onClick={() => step(-1)} aria-label="Previous photo">‹</button>
              <span>{i + 1} / {photos.length}</span>
              <button onClick={() => step(1)} aria-label="Next photo">›</button>
            </div>
          )}
        </div>

        <div className="story">
          <p className="eyebrow">{place.caption}</p>
          <h2 className="script">{place.name}</h2>
          <p>{place.text}</p>
          {isPost && (
            <div className="letter">
              {story.letter.map((l, n) => <p key={n} className={n === 0 ? 'script salute' : n === story.letter.length - 1 ? 'script sign' : ''}>{l}</p>)}
              <p className="from">— {story.from}</p>
              <ReplyBox name={story.name} />
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
