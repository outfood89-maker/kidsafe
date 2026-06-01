import express from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const BADGES_PATH = path.join(__dirname, '../data/badges.json')
const HISTORY_PATH = path.join(__dirname, '../data/history.json')

const router = express.Router()

const readBadges = () => JSON.parse(fs.readFileSync(BADGES_PATH, 'utf-8'))
const writeBadges = (data) => fs.writeFileSync(BADGES_PATH, JSON.stringify(data, null, 2), 'utf-8')
const readHistory = () => JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf-8'))

// 배지 정의 목록
const BADGE_DEFINITIONS = [
  {
    id: 'first_step',
    name: '첫 발걸음',
    emoji: '🌟',
    description: '첫 번째 영상을 시청했어요!',
    check: (history, profileId) => {
      return history.filter(v => v.profileId === profileId).length >= 1
    }
  },
  {
    id: 'sprout_explorer',
    name: '새싹 탐험가',
    emoji: '🌱',
    description: '영상 5개를 시청했어요!',
    check: (history, profileId) => {
      return history.filter(v => v.profileId === profileId).length >= 5
    }
  },
  {
    id: 'watch_master',
    name: '시청 대장',
    emoji: '⭐',
    description: '영상 20개를 시청했어요!',
    check: (history, profileId) => {
      return history.filter(v => v.profileId === profileId).length >= 20
    }
  },
  {
    id: 'safety_guard',
    name: '안전 보안관',
    emoji: '🌈',
    description: '안전도 95점 이상 영상을 10개 시청했어요!',
    check: (history, profileId) => {
      return history.filter(v => v.profileId === profileId && v.totalScore >= 95).length >= 10
    }
  },
  {
    id: 'brain_power',
    name: '브레인 파워',
    emoji: '🧠',
    description: '교육성 80점 이상 영상을 10개 시청했어요!',
    check: (history, profileId) => {
      return history.filter(v => v.profileId === profileId && v.educational >= 80).length >= 10
    }
  },
  {
    id: 'perfectionist',
    name: '완벽주의자',
    emoji: '💯',
    description: '안전도 100점 영상을 5개 시청했어요!',
    check: (history, profileId) => {
      return history.filter(v => v.profileId === profileId && v.totalScore === 100).length >= 5
    }
  },
  {
    id: 'safety_expert',
    name: '안전 전문가',
    emoji: '🎯',
    description: '폭력성, 언어, 선정성 모두 90점 이상인 영상을 10개 시청했어요!',
    check: (history, profileId) => {
      return history.filter(v =>
        v.profileId === profileId &&
        v.violence >= 90 &&
        v.language >= 90 &&
        v.sexual >= 90
      ).length >= 10
    }
  },
  {
    id: 'attendance_king',
    name: '개근왕',
    emoji: '📅',
    description: '7일 연속으로 영상을 시청했어요!',
    check: (history, profileId) => {
      // 이 프로필의 시청 날짜 목록 추출 (중복 제거)
      const dates = [...new Set(
        history
          .filter(v => v.profileId === profileId)
          .map(v => new Date(v.watchedAt).toDateString())
      )]

      if (dates.length < 7) return false

      // 날짜 정렬 후 7일 연속 체크
      const sorted = dates.map(d => new Date(d)).sort((a, b) => a - b)
      let consecutive = 1
      for (let i = 1; i < sorted.length; i++) {
        const diff = (sorted[i] - sorted[i - 1]) / (1000 * 60 * 60 * 24)
        if (diff === 1) {
          consecutive++
          if (consecutive >= 7) return true
        } else {
          consecutive = 1
        }
      }
      return false
    }
  },
  {
    id: 'early_bird',
    name: '얼리버드',
    emoji: '🌙',
    description: '오전 시간대에 영상을 5번 시청했어요!',
    check: (history, profileId) => {
      return history.filter(v => {
        if (v.profileId !== profileId) return false
        const hour = new Date(v.watchedAt).getHours()
        return hour >= 6 && hour < 12
      }).length >= 5
    }
  },
  {
    id: 'kidsafe_master',
    name: 'KidSafe 마스터',
    emoji: '🏆',
    description: '배지를 5개 이상 획득했어요!',
    check: (history, profileId, earnedBadges) => {
      // 현재까지 획득한 배지 수 체크 (kidsafe_master 제외)
      return earnedBadges.filter(b =>
        b.profileId === profileId && b.badgeId !== 'kidsafe_master'
      ).length >= 5
    }
  },
]

// 프로필 배지 조회 (GET /badges/:profileId)
router.get('/:profileId', (req, res) => {
  const { profileId } = req.params

  try {
    const badges = readBadges()
    const profileBadges = badges.filter(b => b.profileId === profileId)
    res.json({ badges: profileBadges })
  } catch (error) {
    res.status(500).json({ error: '배지를 불러오는 중 오류가 발생했어요' })
  }
})

// 배지 체크 및 신규 배지 부여 (POST /badges/check/:profileId)
router.post('/check/:profileId', (req, res) => {
  const { profileId } = req.params

  try {
    const history = readHistory()
    const badges = readBadges()
    const earnedBadges = badges.filter(b => b.profileId === profileId)
    const earnedBadgeIds = earnedBadges.map(b => b.badgeId)

    const newBadges = []

    for (const badge of BADGE_DEFINITIONS) {
      // 이미 획득한 배지는 스킵
      if (earnedBadgeIds.includes(badge.id)) continue

      // 조건 체크
      const earned = badge.check(history, profileId, badges)

      if (earned) {
        const newBadge = {
          profileId,
          badgeId: badge.id,
          name: badge.name,
          emoji: badge.emoji,
          description: badge.description,
          earnedAt: new Date().toISOString(),
        }
        newBadges.push(newBadge)
      }
    }

    // 신규 배지 저장
    if (newBadges.length > 0) {
      badges.push(...newBadges)
      writeBadges(badges)
    }

    res.json({
      newBadges,
      allBadges: badges.filter(b => b.profileId === profileId),
    })
  } catch (error) {
    res.status(500).json({ error: '배지 체크 중 오류가 발생했어요' })
  }
})

export default router
