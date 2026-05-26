import express from 'express'
import Anthropic from '@anthropic-ai/sdk'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
dotenv.config({ path: join(__dirname, '../.env') })

const router = express.Router()
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
console.log('API 키 확인:', process.env.ANTHROPIC_API_KEY)

// 영상 안전도 검수
router.post('/', async (req, res) => {
  const { title, description } = req.body

  // 제목이 없으면 에러 반환
  if (!title) {
    return res.status(400).json({ error: '영상 제목을 입력해주세요' })
  }

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `
당신은 어린이 콘텐츠 안전 검수 전문가입니다.
아래 영상 정보를 분석해서 어린이에게 적합한지 검수해주세요.

영상 제목: ${title}
영상 설명: ${description || '없음'}

아래 JSON 형식으로만 응답해주세요. 다른 텍스트는 절대 포함하지 마세요.
{
  "violence": 점수(0-100),
  "language": 점수(0-100),
  "sexual": 점수(0-100),
  "educational": 점수(0-100),
  "totalScore": 점수(0-100),
  "summary": "한 줄 요약"
}

점수 기준:
- violence(폭력성): 100 = 매우 안전, 0 = 매우 위험
- language(언어): 100 = 매우 안전, 0 = 매우 위험
- sexual(선정성): 100 = 매우 안전, 0 = 매우 위험
- educational(교육성): 100 = 매우 교육적, 0 = 교육적 가치 없음
- totalScore: 위 4개 항목의 평균
          `
        }
      ]
    })

    // AI 응답을 JSON으로 파싱
    const text = message.content[0].text.replace(/```json|```/g, '').trim()
    const result = JSON.parse(text)
    res.json(result)

  } catch (error) {
    console.error('에러 내용:', error.message)
    res.status(500).json({ error: error.message })
  }
})

export default router