import { useEffect, useRef, useState } from 'react'
import { BUILDINGS, COLS, ROWS, T } from '../game/layout.js'

// Keep shader compilation and quality selection inside the existing loading flow.
export default function TownPreparing({ layout, name }) {
  const canvas = useRef(null), [progress, setProgress] = useState(96)
  useEffect(() => {
    const g = canvas.current.getContext('2d'), scale = 5
    const colors = {[T.GRASS]:'#a9d58f',[T.PATH]:'#ecd8ba',[T.PLAZA]:'#efd2c8',[T.WATER]:'#7ec0dc',[T.BRIDGE]:'#c9a074'}
    for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) {g.fillStyle=colors[layout.grid[r][c]];g.fillRect(c*scale,r*scale,scale,scale)}
    for (const t of layout.trees) {g.fillStyle=t.pink?'#eea9be':'#648f61';g.beginPath();g.arc((t.c+.5)*scale,(t.r+.5)*scale,2,0,7);g.fill()}
    for (const b of BUILDINGS) {g.fillStyle='#c6837b';g.fillRect(b.col*scale,b.row*scale,b.w*scale,b.h*scale)}
    const timer = setInterval(()=>setProgress(p=>Math.min(99,p+.25)),700)
    return ()=>clearInterval(timer)
  },[layout])
  return <div className="loading" role="status" aria-label="Preparing the town">
    <div className="polaroid-map"><i className="tape"/><canvas ref={canvas} width={COLS*5} height={ROWS*5}/></div>
    <div className="load-info"><p className="kicker">Our town</p><h1 className="script">{name}'s Town</h1>
      <p className="sub">A little world, made for you.</p><div className="bar" aria-hidden><b style={{width:`${progress}%`}}/></div>
      <div className="bar-row"><span>Lighting the town</span><span>{Math.round(progress)}%</span></div>
    </div>
  </div>
}
