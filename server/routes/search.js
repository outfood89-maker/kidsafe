import express from 'express'
import axios from 'axios'
import dotenv from 'dotenv'

dotenv.config({ path: '../.env' })

const router = express.Router()

// 나이별 추천 키워드
const AGE_KEYWORDS = {
  3: ['동요', '뽀로로', '자장가', '율동', '타요'],
  5: ['동화', '유아 애니메이션', '키즈 캐릭터', '동물원', '인형놀이'],
  7: ['공룡', '에그박사', '곤충', '과학 실험', '키즈 다큐'],
  10: ['다큐멘터리', '과학 상식', '역사', '우주 탐험', '수학'],
}

// 게임 관련 차단 키워드
const GAME_KEYWORDS = ['로블록스', '마인크래프트', '브롤스타즈', '게임', '롤', '배그', '포트나이트']

// 게임 키워드 포함 여부 체크
const isGameContent = (title) => {
  return GAME_KEYWORDS.some(keyword => title.toLowerCase().includes(keyword.toLowerCase()))
}

// ISO 8601 duration → 초 변환
const parseDuration = (duration) => {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return 0
  const hours = parseInt(match[1] || 0)
  const minutes = parseInt(match[2] || 0)
  const seconds = parseInt(match[3] || 0)
  return hours * 3600 + minutes * 60 + seconds
}

// 영상 ID 배열로 실제 길이 가져오기
const getVideoDurations = async (videoIds) => {
  try {
    const response = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
      params: {
        key: process.env.YOUTUBE_API_KEY,
        id: videoIds.join(','),
        part: 'contentDetails',
      }
    })
    const durationMap = {}
    response.data.items.forEach(item => {
      durationMap[item.id] = parseDuration(item.contentDetails.duration)
    })
    return durationMap
  } catch (error) {
    console.error('영상 길이 조회 실패:', error)
    return {}
  }
}

// 공통 영상 검색 함수 (쇼츠/게임 차단)
const searchYouTube = async (keyword, maxResults = 10) => {
  const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
    params: {
      key: process.env.YOUTUBE_API_KEY,
      q: keyword,
      part: 'snippet',
      type: 'video',
      maxResults: maxResults + 5,
      relevanceLanguage: 'ko',
      videoDuration: 'short',
      safeSearch: 'strict',
      order: 'relevance',
    }
  })

  const filteredItems = response.data.items
    .filter(item => !isGameContent(item.snippet.title))

  const videoIds = filteredItems.map(item => item.id.videoId)
  const durationMap = await getVideoDurations(videoIds)

  return filteredItems
    .filter(item => {
      const duration = durationMap[item.id.videoId] || 999
      return duration > 60
    })
    .map(item => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      description: item.snippet.description,
      thumbnail: item.snippet.thumbnails.medium.url,
      channelTitle: item.snippet.channelTitle,
    }))
    .slice(0, maxResults)
}

// 키워드로 YouTube 영상 검색
router.get('/', async (req, res) => {
  const { keyword } = req.query
  if (!keyword) {
    return res.status(400).json({ error: '키워드를 입력해주세요' })
  }
  try {
    const videos = await searchYouTube(keyword, 10)
    res.json({ videos })
  } catch (error) {
    res.status(500).json({ error: '영상 검색 중 오류가 발생했어요' })
  }
})

// 나이별 추천 콘텐츠 검색
router.get('/recommend', async (req, res) => {
  const { age } = req.query
  if (!age) {
    return res.status(400).json({ error: '나이를 입력해주세요' })
  }
  const ageNum = Number(age)
  const keywords = AGE_KEYWORDS[ageNum] || AGE_KEYWORDS[7]
  const randomKeyword = keywords[Math.floor(Math.random() * keywords.length)]

  try {
    const videos = await searchYouTube(randomKeyword, 6)
    res.json({ videos, keyword: randomKeyword })
  } catch (error) {
    res.status(500).json({ error: '추천 영상 검색 중 오류가 발생했어요' })
  }
})

// 시청 기록 기반 추천 (신규)
// 프론트에서 많이 본 키워드를 보내주면, 그 키워드로 검색해서 추천
router.get('/history-recommend', async (req, res) => {
  const { keyword } = req.query

  if (!keyword) {
    return res.status(400).json({ error: '키워드를 입력해주세요' })
  }

  try {
    const videos = await searchYouTube(keyword, 6)
    res.json({ videos, keyword })
  } catch (error) {
    res.status(500).json({ error: '시청 기록 기반 추천 중 오류가 발생했어요' })
  }
})

export default router