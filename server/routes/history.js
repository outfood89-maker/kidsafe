import express from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { createAlertIfNeeded } from './alerts.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// history.json 파일 경로
const DATA_PATH = path.join(__dirname, '../data/history.json')

const router = express.Router()

// JSON 파일에서 기록 읽기
const readHistory = () => {
  const raw = fs.readFileSync(DATA_PATH, 'utf-8')
  return JSON.parse(raw)
}

// JSON 파일에 기록 쓰기
const writeHistory = (data) => {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf-8')
}

// 시청 기록 불러오기 (GET /history)
router.get('/', (req, res) => {
  try {
    const history = readHistory()
    res.json({ history })
  } catch (error) {
    res.status(500).json({ error: '기록을 불러오는 중 오류가 발생했어요' })
  }
})

// 시청 기록 저장 (POST /history)
router.post('/', (req, res) => {
  const { videoId, title, channelTitle, thumbnail, totalScore, summary, profileId, violence, language, sexual, educational, watchSeconds } = req.body

  if (!videoId || !title) {
    return res.status(400).json({ error: '영상 정보가 부족해요' })
  }

  try {
    const history = readHistory()

    // 새 기록 추가
    const newRecord = {
      videoId,
      title,
      channelTitle,
      thumbnail,
      totalScore,
      summary,
      violence,
      language,
      sexual,
      educational,
      profileId: profileId || null,
      watchSeconds: watchSeconds || 0,
      watchedAt: new Date().toISOString(),
    }

    history.unshift(newRecord)
    const trimmed = history.slice(0, 50)
    writeHistory(trimmed)

    // 위험 영상 알림 생성
    createAlertIfNeeded(newRecord)

    res.json({ success: true, record: newRecord })
  } catch (error) {
    res.status(500).json({ error: '기록 저장 중 오류가 발생했어요' })
  }
})

// 특정 시청 기록 삭제 (DELETE /history/item?watchedAt=&profileId=)
router.delete('/item', (req, res) => {
  const { watchedAt, profileId } = req.query
  if (!watchedAt) return res.status(400).json({ error: '삭제할 기록 정보가 없어요' })

  try {
    const history = readHistory()
    const filtered = history.filter(
      item => !(item.watchedAt === watchedAt && item.profileId === profileId)
    )
    writeHistory(filtered)
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: '기록 삭제 중 오류가 발생했어요' })
  }
})

// 전체 시청 기록 삭제 (DELETE /history/all?profileId=)
router.delete('/all', (req, res) => {
  const { profileId } = req.query

  try {
    const history = readHistory()
    const filtered = profileId
      ? history.filter(item => item.profileId !== profileId)
      : []
    writeHistory(filtered)
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: '기록 삭제 중 오류가 발생했어요' })
  }
})

export default router
