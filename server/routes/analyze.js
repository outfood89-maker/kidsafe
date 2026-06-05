import express from 'express'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
dotenv.config({ path: join(__dirname, '../.env') })

const router = express.Router()

// 위험 키워드 목록
const VIOLENCE_KEYWORDS = ['전쟁', '폭력', '살인', '격투', '싸움', '학살', '피', '고문', '총격', '폭탄', '테러', 'war', 'kill', 'fight', 'blood', 'murder', 'violence', 'attack', 'horror']
const LANGUAGE_KEYWORDS = ['욕설', '비속어', '저주', '성인', '19금', 'f**k', 'shit', 'damn', '씨발', '개새', '병신', '지랄', '미친놈']
const SEXUAL_KEYWORDS = ['성인', '19금', '야동', '섹스', '포르노', 'sexy', 'adult', 'nude', 'porn', '선정', '노출', '에로']
const EDUCATIONAL_KEYWORDS = ['교육', '학습', '과학', '수학', '역사', '영어', '동화', '동요', '자연', '우주', '공룡', '실험', '탐구', '퀴즈', 'learn', 'education', 'science', 'math', 'history', '지식', '탐험', '다큐']

const countKeywords = (text, keywords) => {
  if (!text) return 0
  const lower = text.toLowerCase()
  return keywords.filter(k => lower.includes(k.toLowerCase())).length
}

const calcSafetyScore = (hitCount) => Math.max(0, 100 - hitCount * 15)
const calcEduScore = (hitCount) => Math.min(100, hitCount * 20 + 40)

const makeSummary = (title, totalScore) => {
  if (totalScore >= 85) return `"${title}"은(는) 어린이에게 안전한 콘텐츠예요.`
  if (totalScore >= 65) return `"${title}"은(는) 대체로 안전하지만 일부 내용을 확인해보세요.`
  return `"${title}"은(는) 어린이에게 적합하지 않을 수 있어요.`
}

// 영상 안전도 검수 (키워드 기반 — Anthropic 크레딧 충전 시 AI 버전으로 교체 가능)
router.post('/', (req, res) => {
  const { title, description } = req.body

  if (!title) {
    return res.status(400).json({ error: '영상 제목을 입력해주세요' })
  }

  const text = `${title} ${description || ''}`

  const violence    = calcSafetyScore(countKeywords(text, VIOLENCE_KEYWORDS))
  const language    = calcSafetyScore(countKeywords(text, LANGUAGE_KEYWORDS))
  const sexual      = calcSafetyScore(countKeywords(text, SEXUAL_KEYWORDS))
  const educational = calcEduScore(countKeywords(text, EDUCATIONAL_KEYWORDS))
  const totalScore  = Math.round((violence + language + sexual + educational) / 4)
  const summary     = makeSummary(title, totalScore)

  res.json({ violence, language, sexual, educational, totalScore, summary })
})

export default router
