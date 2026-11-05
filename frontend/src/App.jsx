import { Suspense, lazy, useCallback, useEffect, useState } from 'react'
import fallback from '../../backend/story.json'
import { DEFAULT_LOOK } from './game/avatar.js'
import LovePage from './love/LovePage.jsx'
// the town (three.js) is split into its own download so the love page opens fast;
// it starts downloading in the background as soon as the love page is showing
const loadTown = () => import('./components/Town3D.jsx')
const Town3D = lazy(loadTown)
const Loading = lazy(() => import('./components/Loading.jsx'))
const Creator = lazy(() => import('./components/Creator.jsx'))

const KEY = 'love-town-avatar'
const load = () => {
  try { return JSON.parse(localStorage.getItem(KEY)) } catch { return null }
}

export default function App() {
  // The Java backend serves story.json; if it's not running we use the same file bundled in.
  const [story, setStory] = useState(fallback)
  // love page -> loading -> 3D town (add ?town to the address to jump straight in)
  const [stage, setStage] = useState(() => (new URLSearchParams(window.location.search).has('town') ? 'loading' : 'love'))
  const [avatar, setAvatar] = useState(() => load() ?? { look: DEFAULT_LOOK, name: fallback.name })
  const [world, setWorld] = useState(null)
  // the love page's last button goes straight into the town (the avatar can be changed from there)
  const begin = useCallback(() => setStage((w) => (w === 'love' ? 'loading' : w)), [])
  const ready = useCallback((w) => { setWorld(w); setStage('town') }, [])

  useEffect(() => {
    const id = setTimeout(() => { loadTown().catch(() => {}); import('./components/Loading.jsx').catch(() => {}) }, 2500)
    return () => clearTimeout(id)
  }, [])

  useEffect(() => {
    fetch('/api/story')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setStory)
      .catch(() => {})
  }, [])

  const done = (a) => {
    setAvatar(a)
    try { localStorage.setItem(KEY, JSON.stringify(a)) } catch { /* private mode: fine */ }
    setStage(world ? 'town' : 'loading') // the map is only generated once
  }

  return (
    <Suspense fallback={<div className="lp" aria-busy="true" />}>
      {stage === 'love' && <LovePage story={story} herLook={avatar.look} onDone={begin} />}
      {stage === 'creator' && <Creator initial={avatar} onDone={done} />}
      {stage === 'loading' && <Loading story={story} onReady={ready} />}
      {stage === 'town' && <Town3D look={avatar.look} name={avatar.name} story={story} world={world} onEditAvatar={() => setStage('creator')} />}
    </Suspense>
  )
}
