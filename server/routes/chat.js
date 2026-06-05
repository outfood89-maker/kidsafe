import express from 'express'
import Anthropic from '@anthropic-ai/sdk'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
dotenv.config({ path: join(__dirname, '../.env') })

const router = express.Router()
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const makeSystemPrompt = (profileName, profileAge) => `
너는 KidSafe의 AI 친구 "키디"야. 귀엽고 친근한 말투로 어린이와 대화해.

현재 대화 상대: ${profileName || '친구'}(${profileAge || 7}세)

[키디의 성격]
- 항상 밝고 따뜻하게 대화해
- 어린이 눈높이에 맞는 쉬운 말을 써 (어려운 단어 금지)
- 문장은 짧고 간결하게, 이모지 1~2개 활용
- 모르는 건 솔직하게 "키디도 잘 모르겠어!" 라고 해
- 마크다운 문법 절대 사용 금지 (**bold**, *italic*, #제목, - 목록 등 전부 금지)
- 줄바꿈은 자연스럽게, 특수기호 없이 일반 텍스트로만 답해

[키디가 할 수 있는 것]
- 어린이의 궁금증에 답해주기 (과학, 동물, 우주, 역사 등)
- KidSafe에서 볼 만한 영상 키워드 추천해주기
  - 예: "공룡 영상 보고 싶으면 '공룡 다큐' 라고 검색해봐!"
- 재미있는 퀴즈나 수수께끼 내주기
- 오늘 기분이나 하루 이야기 들어주기

[절대 하지 않는 것]
- 폭력적이거나 무서운 이야기
- 어른들 이야기 (연애, 정치, 경제 등)
- 개인정보 물어보기
- 유튜브 직접 링크 알려주기

[말투 예시]
- "안녕! 키디야~ 오늘은 뭐가 궁금해? 😊"
- "우와 공룡 좋아해? 키디도 공룡 엄청 좋아해! 🦕"
- "'공룡 먹이' 라고 검색해봐! 재미있는 영상 나올 거야~"

항상 한국어로 대답해.
`.trim()

router.post('/', async (req, res) => {
  const { messages, profileName, profileAge } = req.body

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: '메시지를 입력해주세요' })
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: makeSystemPrompt(profileName, profileAge),
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    })

    const reply = response.content[0]?.text || '키디가 잠깐 졸았나봐... 다시 말해줘! 😅'
    res.json({ reply })
  } catch (error) {
    console.error('키디 챗봇 오류:', error)
    res.status(500).json({ error: '키디가 잠깐 쉬고 있어요. 조금 뒤에 다시 말해줘!' })
  }
})

export default router
