import express from 'express'
import axios from 'axios'
import dotenv from 'dotenv'

dotenv.config({ path: '../.env' })

const router = express.Router()

const AGE_KEYWORDS = {
  3: ['동요', '뽀로로', '자장가', '율동', '타요'],
  5: ['동화', '유아 애니메이션', '키즈 캐릭터', '동물원', '인형놀이'],
  7: ['공룡', '에그박사', '곤충', '과학 실험', '키즈 다큐'],
  10: ['다큐멘터리', '과학 상식', '역사', '우주 탐험', '수학'],
}

const GAME_KEYWORDS = ['로블록스', '마인크래프트', '브롤스타즈', '게임', '롤', '배그', '포트나이트']

const isGameContent = (title) => {
  return GAME_KEYWORDS.some(keyword => title.toLowerCase().includes(keyword.toLowerCase()))
}

const parseDuration = (duration) => {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return 0
  const hours = parseInt(match[1] || 0)
  const minutes = parseInt(match[2] || 0)
  const seconds = parseInt(match[3] || 0)
  return hours * 3600 + minutes * 60 + seconds
}

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

const searchYouTubePlaylists = async (keyword, maxResults = 6) => {
  try {
    const searchResponse = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        key: process.env.YOUTUBE_API_KEY,
        q: keyword,
        part: 'snippet',
        type: 'playlist',
        maxResults,
        relevanceLanguage: 'ko',
        safeSearch: 'strict',
        order: 'relevance',
      }
    })

    const playlists = searchResponse.data.items.filter(
      item => !isGameContent(item.snippet.title)
    )

    if (playlists.length === 0) return []

    const playlistIds = playlists.map(item => item.id.playlistId).join(',')
    const detailResponse = await axios.get('https://www.googleapis.com/youtube/v3/playlists', {
      params: {
        key: process.env.YOUTUBE_API_KEY,
        id: playlistIds,
        part: 'contentDetails,snippet',
      }
    })

    const countMap = {}
    detailResponse.data.items.forEach(item => {
      countMap[item.id] = item.contentDetails.itemCount
    })

    const results = await Promise.all(
      playlists.map(async (item) => {
        const playlistId = item.id.playlistId
        let thumbnails = []
        let firstVideoTitle = '' // 첫 번째 영상 제목

        try {
          const itemsResponse = await axios.get('https://www.googleapis.com/youtube/v3/playlistItems', {
            params: {
              key: process.env.YOUTUBE_API_KEY,
              playlistId,
              part: 'snippet',
              maxResults: 3,
            }
          })

          thumbnails = itemsResponse.data.items.map(
            v => v.snippet.thumbnails?.medium?.url || ''
          ).filter(Boolean)

          // 첫 번째 영상 제목 저장
          if (itemsResponse.data.items.length > 0) {
            firstVideoTitle = itemsResponse.data.items[0].snippet.title || ''
          }
        } catch (err) {
          thumbnails = [item.snippet.thumbnails?.medium?.url || '']
        }

        return {
          playlistId,
          title: item.snippet.title,
          channelTitle: item.snippet.channelTitle,
          thumbnail: item.snippet.thumbnails?.medium?.url || '',
          thumbnails,
          firstVideoTitle, // 안전도 검수에 활용
          videoCount: countMap[playlistId] || 0,
          type: 'playlist',
        }
      })
    )

    return results
  } catch (error) {
    console.error('재생목록 검색 실패:', error)
    return []
  }
}

router.get('/', async (req, res) => {
  const { keyword } = req.query
  if (!keyword) {
    return res.status(400).json({ error: '키워드를 입력해주세요' })
  }
  try {
    const [videos, playlists] = await Promise.all([
      searchYouTube(keyword, 20),
      searchYouTubePlaylists(keyword, 6),
    ])
    res.json({ videos, playlists })
  } catch (error) {
    console.error('검색 오류:', error)
    res.status(500).json({ error: '영상 검색 중 오류가 발생했어요' })
  }
})

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
