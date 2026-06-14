import express from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const GAME_BONUS_PATH = path.join(__dirname, '../data/game-bonus.json')
const PROFILES_PATH = path.join(__dirname, '../data/profiles.json')

const router = express.Router()

const readBonus = () => {
  try { return JSON.parse(fs.readFileSync(GAME_BONUS_PATH, 'utf-8')) }
  catch { return [] }
}
const writeBonus = (data) => fs.writeFileSync(GAME_BONUS_PATH, JSON.stringify(data, null, 2), 'utf-8')
const readProfiles = () => {
  try { return JSON.parse(fs.readFileSync(PROFILES_PATH, 'utf-8')) }
  catch { return [] }
}

// 오늘 보너스 조회
router.get('/', (req, res) => {
  try {
    const { profileId } = req.query
    if (!profileId) return res.status(400).json({ error: 'profileId 필요' })

    const today = new Date().toISOString().slice(0, 10)
    const all = readBonus()
    const todayRecords = all.filter((r) => r.profileId === profileId && r.date === today)
    const bonusMinutes = todayRecords.reduce((sum, r) => sum + r.bonusMinutes, 0)
    const alreadyPlayed = todayRecords.length > 0

    res.json({ bonusMinutes, alreadyPlayed, records: todayRecords })
  } catch (err) {
    res.status(500).json({ error: '보너스 조회 실패', detail: err.message })
  }
})

// 보너스 저장
router.post('/', (req, res) => {
  try {
    const { profileId, game, correctCount } = req.body
    if (!profileId || !game || correctCount == null)
      return res.status(400).json({ error: 'profileId, game, correctCount 필요' })

    // 게임별 보너스 기준
    const THRESHOLDS = {
      'ox-quiz':     { full: 8,  partial: 0,  fullBonus: 3, partialBonus: 0 },
      'word-match':  { full: 10, partial: 6,  fullBonus: 7, partialBonus: 3 },
      'puzzle':      { full: 1,  partial: 0,  fullBonus: 7, partialBonus: 0 },
      'memory-card': { full: 1,  partial: 0,  fullBonus: 7, partialBonus: 0 },
    }
    const { full, partial, fullBonus = 7, partialBonus = 3 } = THRESHOLDS[game] || { full: 5, partial: 3, fullBonus: 7, partialBonus: 3 }
    let bonusMinutes = 0
    if (correctCount >= full) bonusMinutes = fullBonus
    else if (correctCount >= partial) bonusMinutes = partialBonus

    const today = new Date().toISOString().slice(0, 10)
    const all = readBonus()
    const todayRecords = all.filter((r) => r.profileId === profileId && r.date === today)
    const todayTotal = todayRecords.reduce((sum, r) => sum + r.bonusMinutes, 0)

    const profiles = readProfiles()
    const profile = profiles.find((p) => p.id === profileId)
    const maxBonus = profile?.maxBonusMinutes ?? 20

    // 오늘 누적 한도(maxBonus) 내에서만 지급
    const remaining = Math.max(0, maxBonus - todayTotal)
    const actualBonus = Math.min(bonusMinutes, remaining)
    const alreadyPlayed = todayRecords.length > 0

    const record = {
      id: `bonus_${Date.now()}`,
      profileId,
      date: today,
      game,
      correctCount,
      bonusMinutes: actualBonus,
      createdAt: new Date().toISOString(),
    }
    all.push(record)
    writeBonus(all)

    res.json({ bonusMinutes: actualBonus, todayTotal: todayTotal + actualBonus, maxBonus, record })
  } catch (err) {
    res.status(500).json({ error: '보너스 저장 실패', detail: err.message })
  }
})

export default router
