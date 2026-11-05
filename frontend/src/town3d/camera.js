import { COLS, ROWS } from '../game/layout.js'

// Fit the complete town in portrait as well as landscape, including tall roofs.
export function townMapDistance(aspect, fov = 50, pitch = 1.25) {
  const tanV = Math.tan(fov * Math.PI / 360), tanH = tanV * Math.max(.1, aspect)
  const depth = ROWS + 6, forwardOffset = depth * Math.cos(pitch)
  return Math.max(150, (COLS + 8) / tanH + forwardOffset, (depth * Math.sin(pitch) + 18) / tanV + forwardOffset)
}
