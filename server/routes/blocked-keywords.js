import express from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const DATA_PATH = path.join(__dirname, '../data/blocked-keywords.json')

const router = express.Router()

const readData = () => JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'))
const writeData = (data) => fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf-8')

// 전체 차단 키워드 조회 (시스템 + 커스텀)
router.get('/', (req, res) => {
  try {
    const data = readData()
    res.json(data)
  } catch {
    res.status(500).json({ error: '차단 키워드를 불러오는 중 오류가 발생했어요' })
  }
})

// 검색어가 차단됐는지 확인
router.get('/check', (req, res) => {
  const { keyword } = req.query
  if (!keyword) return res.status(400).json({ error: '키워드를 입력해주세요' })

  try {
    const data = readData()
    const all = [...data.system, ...data.custom]
    const lower = keyword.toLowerCase()
    const blocked = all.find(k => lower.includes(k.toLowerCase()))
    res.json({ blocked: !!blocked, keyword: blocked || null })
  } catch {
    res.status(500).json({ error: '차단 키워드 확인 중 오류가 발생했어요' })
  }
})

// 커스텀 키워드 추가
router.post('/custom', (req, res) => {
  const { keyword } = req.body
  if (!keyword?.trim()) return res.status(400).json({ error: '키워드를 입력해주세요' })

  try {
    const data = readData()
    const trimmed = keyword.trim().toLowerCase()
    if (data.custom.includes(trimmed) || data.system.includes(trimmed)) {
      return res.status(400).json({ error: '이미 등록된 키워드예요' })
    }
    data.custom.push(trimmed)
    writeData(data)
    res.json({ success: true, custom: data.custom })
  } catch {
    res.status(500).json({ error: '키워드 추가 중 오류가 발생했어요' })
  }
})

// 커스텀 키워드 삭제
router.delete('/custom/:keyword', (req, res) => {
  const keyword = decodeURIComponent(req.params.keyword)

  try {
    const data = readData()
    data.custom = data.custom.filter(k => k !== keyword.toLowerCase())
    writeData(data)
    res.json({ success: true, custom: data.custom })
  } catch {
    res.status(500).json({ error: '키워드 삭제 중 오류가 발생했어요' })
  }
})

export default router
