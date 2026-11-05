// Vercel serverless port of GET /api/story from backend/Server.java
const story = require('../backend/story.json')

module.exports = (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({})
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate')
  res.status(200).json(story)
}
