import { useState } from 'react'
import { setMusic } from '../audio.js'

export default function MusicToggle() {
  const [on, setOn] = useState(true)
  const toggle = () => { setMusic(!on); setOn(!on) }
  return (
    <button className="music" onClick={toggle} aria-label="Toggle music">
      <span className={on ? 'eq on' : 'eq'}><i /><i /><i /></span>
      {on ? 'music on' : 'music off'}
    </button>
  )
}
