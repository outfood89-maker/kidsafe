import express from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { v4 as uuidv4 } from 'uuid'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const ALERTS_PATH = path.join(__dirname, '../data/alerts.json')
const SETTINGS_PATH = path.join(__dirname, '../data/alert-settings.json')

const router = express.Router()

const readAlerts = () => JSON.parse(fs.readFileSync(ALERTS_PATH, 'utf-8'))
const writeAlerts = (data) => fs.writeFileSync(ALERTS_PATH, JSON.stringify(data, null, 2), 'utf-8')
const readSettings = () => JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'))
const writeSettings = (data) => fs.writeFileSync(SETTINGS_PATH, JSON.stringify(data, null, 2), 'utf-8')

// 심각도 계산
const getSeverity = (totalScore, threshold) => {
  if (totalScore < threshold - 10) return 'danger'   // 위험 🔴
  if (totalScore < threshold) return 'warning'        // 주의 🟡
  return null
}

// 알림 생성 (history.js에서 호출)
export const createAlertIfNeeded = (record) => {
  try {
    const settings = readSettings()
    const alerts = readAlerts()
    const { totalScore, violence, language, sexual, title, channelTitle, thumbnail, videoId, profileId, watchedAt } = record

    const reasons = []
    const threshold = settings.threshold

    if (totalScore < threshold) reasons.push(`종합 점수 ${totalScore}점`)
    if (violence !== undefined && violence < threshold) reasons.push(`폭력성 ${violence}점`)
    if (language !== undefined && language < threshold) reasons.push(`언어 ${language}점`)
    if (sexual !== undefined && sexual < threshold) reasons.push(`선정성 ${sexual}점`)

    // 늦은 시간 감지
    const hour = new Date(watchedAt).getHours()
    const isLateNight = settings.lateNightAlert && hour >= settings.lateNightHour
    if (isLateNight) reasons.push(`늦은 시간(${hour}시) 시청`)

    if (reasons.length === 0) return null

    const severity = isLateNight && totalScore >= threshold ? 'warning' : getSeverity(totalScore, threshold)

    // 같은 영상 + 프로필 알림이 이미 있으면 반복 시청으로 업데이트
    const existing = alerts.find(a => a.videoId === videoId && a.profileId === profileId)
    if (existing) {
      existing.watchCount = (existing.watchCount || 1) + 1
      existing.repeated = true
      existing.updatedAt = watchedAt
      writeAlerts(alerts)
      return existing
    }

    const newAlert = {
      id: uuidv4(),
      profileId,
      videoId,
      title,
      channelTitle,
      thumbnail,
      totalScore,
      violence,
      language,
      sexual,
      reasons,
      severity: severity || 'warning',
      watchedAt,
      watchCount: 1,
      repeated: false,
      read: false,
    }

    alerts.unshift(newAlert)
    writeAlerts(alerts)
    return newAlert
  } catch (err) {
    console.error('알림 생성 실패:', err)
    return null
  }
}

// 알림 전체 조회
router.get('/', (req, res) => {
  try {
    const alerts = readAlerts()
    res.json({ alerts })
  } catch {
    res.status(500).json({ error: '알림을 불러오는 중 오류가 발생했어요' })
  }
})

// 알림 읽음 처리 (단건)
router.patch('/:id/read', (req, res) => {
  try {
    const alerts = readAlerts()
    const alert = alerts.find(a => a.id === req.params.id)
    if (!alert) return res.status(404).json({ error: '알림을 찾을 수 없어요' })
    alert.read = true
    writeAlerts(alerts)
    res.json({ success: true })
  } catch {
    res.status(500).json({ error: '읽음 처리 중 오류가 발생했어요' })
  }
})

// 알림 전체 읽음 처리
router.patch('/read-all', (req, res) => {
  try {
    const alerts = readAlerts()
    alerts.forEach(a => { a.read = true })
    writeAlerts(alerts)
    res.json({ success: true })
  } catch {
    res.status(500).json({ error: '전체 읽음 처리 중 오류가 발생했어요' })
  }
})

// 알림 설정 조회
router.get('/settings', (req, res) => {
  try {
    res.json(readSettings())
  } catch {
    res.status(500).json({ error: '설정을 불러오는 중 오류가 발생했어요' })
  }
})

// 알림 설정 저장
router.put('/settings', (req, res) => {
  try {
    const { threshold, lateNightAlert, lateNightHour } = req.body
    const current = readSettings()
    const updated = {
      threshold: threshold ?? current.threshold,
      lateNightAlert: lateNightAlert ?? current.lateNightAlert,
      lateNightHour: lateNightHour ?? current.lateNightHour,
    }
    writeSettings(updated)
    res.json({ success: true, settings: updated })
  } catch {
    res.status(500).json({ error: '설정 저장 중 오류가 발생했어요' })
  }
})

export default router
