// Vercel serverless port of /api/notes from backend/Server.java.
// Like the Java server, notes live in memory only: they reset whenever the
// function cold-starts. Plug in Vercel KV / a database to keep them for good.
const NOTES = []

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'GET') return res.status(200).json(NOTES)
  if (req.method === 'POST') {
    const body = typeof req.body === 'string' ? safeParse(req.body) : req.body || {}
    const text = typeof body.text === 'string' ? body.text : ''
    if (!text.trim() || text.length > 500) return res.status(400).json({ error: 'text required (max 500)' })
    const name = typeof body.name === 'string' && body.name.trim() ? body.name.slice(0, 100) : 'Someone who loves you'
    const note = { name, text, at: new Date().toISOString() }
    NOTES.unshift(note)
    if (NOTES.length > 200) NOTES.length = 200
    return res.status(201).json(note)
  }
  res.status(405).json({})
}

function safeParse(s) {
  try { return JSON.parse(s) } catch { return {} }
}
