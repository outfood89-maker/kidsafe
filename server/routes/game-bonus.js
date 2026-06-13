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

    res.json({ bonusMinutes, records: todayRecords })
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

    // 보너스 분 계산 (3문제: +3분, 5문제: +7분)
    let bonusMinutes = 0
    if (correctCount >= 5) bonusMinutes = 7
    else if (correctCount >= 3) bonusMinutes = 3

    // 오늘 누적 보너스 확인 (상한선 체크)
    const today = new Date().toISOString().slice(0, 10)
    const all = readBonus()
    const todayTotal = all
      .filter((r) => r.profileId === profileId && r.date === today)
      .reduce((sum, r) => sum + r.bonusMinutes, 0)

    // 프로필 maxBonusMinutes 조회 (기본 20분)
    const profiles = readProfiles()
    const profile = profiles.find((p) => p.id === profileId)
    const maxBonus = profile?.maxBonusMinutes ?? 20

    // 상한 초과분 잘라내기
    const actualBonus = Math.max(0, Math.min(bonusMinutes, maxBonus - todayTotal))

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
