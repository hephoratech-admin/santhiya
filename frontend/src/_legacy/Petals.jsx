import { useMemo } from 'react'

// Soft petals drifting down the whole page (pure CSS animation, very light on the GPU).
export default function Petals({ count = 16 }) {
  const petals = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        size: 10 + Math.random() * 16,
        delay: -Math.random() * 22,
        dur: 16 + Math.random() * 14,
        sway: 40 + Math.random() * 90,
        hue: Math.random() > 0.5 ? 'var(--petal-a)' : 'var(--petal-b)',
      })),
    [count],
  )

  return (
    <div className="petals" aria-hidden>
      {petals.map((p) => (
        <span
          key={p.id}
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 1.3,
            background: p.hue,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.dur}s`,
            '--sway': `${p.sway}px`,
          }}
        />
      ))}
    </div>
  )
}
