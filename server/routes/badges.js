import express from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const BADGES_PATH = path.join(__dirname, '../data/badges.json')
const HISTORY_PATH = path.join(__dirname, '../data/history.json')
const FAVORITES_PATH = path.join(__dirname, '../data/favorites.json')
const SEARCHES_PATH = path.join(__dirname, '../data/searches.json')

const router = express.Router()

const readBadges = () => JSON.parse(fs.readFileSync(BADGES_PATH, 'utf-8'))
const writeBadges = (data) => fs.writeFileSync(BADGES_PATH, JSON.stringify(data, null, 2), 'utf-8')
const readHistory = () => JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf-8'))
const readFavorites = () => { try { return JSON.parse(fs.readFileSync(FAVORITES_PATH, 'utf-8')) } catch { return [] } }
const readSearches = () => { try { return JSON.parse(fs.readFileSync(SEARCHES_PATH, 'utf-8')) } catch { return [] } }

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
      return earnedBadges.filter(b =>
        b.profileId === profileId && b.badgeId !== 'kidsafe_master'
      ).length >= 5
    }
  },

  // ── 찜 기반 배지 ──────────────────────────────
  {
    id: 'fav_collector',
    name: '찜 수집가',
    emoji: '💝',
    description: '영상이나 재생목록을 3개 이상 찜했어요!',
    check: (history, profileId) => {
      const favs = readFavorites()
      return favs.filter(f => f.profileId === profileId).length >= 3
    }
  },
  {
    id: 'fav_master',
    name: '찜 마스터',
    emoji: '💖',
    description: '영상이나 재생목록을 10개 이상 찜했어요!',
    check: (history, profileId) => {
      const favs = readFavorites()
      return favs.filter(f => f.profileId === profileId).length >= 10
    }
  },
  {
    id: 'playlist_fan',
    name: '재생목록 팬',
    emoji: '🎬',
    description: '재생목록을 3개 이상 찜했어요!',
    check: (history, profileId) => {
      const favs = readFavorites()
      return favs.filter(f => f.profileId === profileId && f.type === 'playlist').length >= 3
    }
  },

  // ── 검색 기반 배지 ──────────────────────────────
  {
    id: 'curious_explorer',
    name: '호기심 탐험가',
    emoji: '🔍',
    description: '검색을 10번 이상 해봤어요!',
    check: (history, profileId) => {
      const searches = readSearches()
      return searches.filter(s => s.profileId === profileId).length >= 10
    }
  },
  {
    id: 'genre_pioneer',
    name: '장르 개척자',
    emoji: '🗺️',
    description: '5가지 이상 다양한 키워드로 검색했어요!',
    check: (history, profileId) => {
      const searches = readSearches()
      const keywords = new Set(
        searches.filter(s => s.profileId === profileId).map(s => s.keyword.trim().toLowerCase())
      )
      return keywords.size >= 5
    }
  },

  // ── 시청 패턴 기반 배지 ──────────────────────────
  {
    id: 'channel_regular',
    name: '단골손님',
    emoji: '📺',
    description: '같은 채널 영상을 3개 이상 시청했어요!',
    check: (history, profileId) => {
      const myHistory = history.filter(v => v.profileId === profileId)
      const channelCount = {}
      myHistory.forEach(v => {
        if (v.channelTitle) channelCount[v.channelTitle] = (channelCount[v.channelTitle] || 0) + 1
      })
      return Object.values(channelCount).some(count => count >= 3)
    }
  },
  {
    id: 'evening_explorer',
    name: '저녁 탐험가',
    emoji: '🌙',
    description: '저녁 6시~10시 사이에 영상을 5번 시청했어요!',
    check: (history, profileId) => {
      return history.filter(v => {
        if (v.profileId !== profileId) return false
        const hour = new Date(v.watchedAt).getHours()
        return hour >= 18 && hour < 22
      }).length >= 5
    }
  },
  {
    id: 'fairy_tale_lover',
    name: '동화 왕국',
    emoji: '📚',
    description: '동화/동요 영상을 3개 이상 시청했어요!',
    check: (history, profileId) => {
      const keywords = ['동화', '동요', '자장가', '옛날이야기', '그림책']
      return history.filter(v => {
        if (v.profileId !== profileId) return false
        return keywords.some(k => v.title?.includes(k))
      }).length >= 3
    }
  },
  {
    id: 'dino_expert',
    name: '공룡 박사',
    emoji: '🦕',
    description: '공룡 영상을 3개 이상 시청했어요!',
    check: (history, profileId) => {
      return history.filter(v =>
        v.profileId === profileId && v.title?.includes('공룡')
      ).length >= 3
    }
  },
  {
    id: 'science_sprout',
    name: '과학 꿈나무',
    emoji: '🔬',
    description: '과학/실험 영상을 3개 이상 시청했어요!',
    check: (history, profileId) => {
      const keywords = ['과학', '실험', '탐구', '발견', '우주', '자연']
      return history.filter(v => {
        if (v.profileId !== profileId) return false
        return keywords.some(k => v.title?.includes(k))
      }).length >= 3
    }
  },
  {
    id: 'all_star',
    name: '올스타',
    emoji: '🌠',
    description: '배지를 10개 이상 획득했어요!',
    check: (history, profileId, earnedBadges) => {
      return earnedBadges.filter(b =>
        b.profileId === profileId && b.badgeId !== 'all_star'
      ).length >= 10
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
      if (earnedBadgeIds.includes(badge.id)) continue

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
