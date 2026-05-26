import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

dotenv.config()

const app = express()
const PORT = 3000

app.use(cors())
app.use(express.json())

app.get('/', (req, res) => {
  res.json({ message: 'KidSafe 서버 작동 중! 🛡️' })
})

app.get('/test-env', (req, res) => {
  res.json({
    anthropic: process.env.ANTHROPIC_API_KEY ? '✅ 연결됨' : '❌ 없음',
    youtube: process.env.YOUTUBE_API_KEY ? '✅ 연결됨' : '❌ 없음',
  })
})

app.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`)
})