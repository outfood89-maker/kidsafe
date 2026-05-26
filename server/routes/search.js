import express from 'express'
import axios from 'axios'
import dotenv from 'dotenv'

dotenv.config({ path: '../.env' })

const router = express.Router()

// 키워드로 YouTube 영상 검색
router.get('/', async (req, res) => {
  const { keyword } = req.query

  // 키워드가 없으면 에러 반환
  if (!keyword) {
    return res.status(400).json({ error: '키워드를 입력해주세요' })
  }

  try {
    const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        key: process.env.YOUTUBE_API_KEY,
        q: keyword,
        part: 'snippet',
        type: 'video',
        maxResults: 10,
        relevanceLanguage: 'ko',
      }
    })

    // 필요한 데이터만 추출
    const videos = response.data.items.map(item => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      description: item.snippet.description,
      thumbnail: item.snippet.thumbnails.medium.url,
      channelTitle: item.snippet.channelTitle,
    }))

    res.json({ videos })

  } catch (error) {
    res.status(500).json({ error: '영상 검색 중 오류가 발생했어요' })
  }
})

export default router