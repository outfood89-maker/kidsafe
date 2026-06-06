import chatRouter from './routes/chat.js'
import blockedKeywordsRouter from './routes/blocked-keywords.js'
import alertsRouter from './routes/alerts.js'
import searchRouter from './routes/search.js'
import searchHistoryRouter from './routes/search-history.js'
import historyRouter from './routes/history.js'
import profilesRouter from './routes/profiles.js'
import analyzeRouter from './routes/analyze.js'
import favoritesRouter from './routes/favorites.js'
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import badgesRouter from './routes/badges.js'
dotenv.config()

const app = express()
const PORT = 3000

app.use(cors())
app.use(express.json())
app.use('/search', searchRouter)
app.use('/analyze', analyzeRouter)
app.use('/history', historyRouter)
app.use('/profiles', profilesRouter)
app.get('/', (req, res) => {
  res.json({ message: 'KidSafe 서버 작동 중! 🛡️' })
})
app.use('/badges', badgesRouter)
app.use('/search-history', searchHistoryRouter)
app.use('/favorites', favoritesRouter)
app.use('/chat', chatRouter)
app.use('/blocked-keywords', blockedKeywordsRouter)
app.use('/alerts', alertsRouter)

app.get('/test-env', (req, res) => {
  res.json({
    anthropic: process.env.ANTHROPIC_API_KEY ? '✅ 연결됨' : '❌ 없음',
    youtube: process.env.YOUTUBE_API_KEY ? '✅ 연결됨' : '❌ 없음',
  })
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`)
})