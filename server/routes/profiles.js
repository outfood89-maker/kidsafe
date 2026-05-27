import express from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// profiles.json 파일 경로
const DATA_PATH = path.join(__dirname, '../data/profiles.json')

const router = express.Router()

// JSON 파일에서 프로필 읽기
const readProfiles = () => {
  const raw = fs.readFileSync(DATA_PATH, 'utf-8')
  return JSON.parse(raw)
}

// JSON 파일에 프로필 쓰기
const writeProfiles = (data) => {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf-8')
}

// 프로필 전체 조회 (GET /profiles)
router.get('/', (req, res) => {
  try {
    const profiles = readProfiles()
    res.json({ profiles })
  } catch (error) {
    res.status(500).json({ error: '프로필을 불러오는 중 오류가 발생했어요' })
  }
})

// 프로필 생성 (POST /profiles)
router.post('/', (req, res) => {
  const { name, age, gender, avatarSeed } = req.body

  if (!name || !age || !gender || !avatarSeed) {
    return res.status(400).json({ error: '모든 항목을 입력해주세요' })
  }

  try {
    const profiles = readProfiles()

    // 최대 4명 제한
    if (profiles.length >= 4) {
      return res.status(400).json({ error: '프로필은 최대 4개까지 만들 수 있어요' })
    }

    const newProfile = {
      id: Date.now().toString(), // 고유 ID
      name,
      age: Number(age),
      gender,
      avatarSeed, // DiceBear 아바타 시드값 (이름 기반)
      createdAt: new Date().toISOString(),
    }

    profiles.push(newProfile)
    writeProfiles(profiles)

    res.json({ success: true, profile: newProfile })
  } catch (error) {
    res.status(500).json({ error: '프로필 생성 중 오류가 발생했어요' })
  }
})

// 프로필 수정 (PUT /profiles/:id)
router.put('/:id', (req, res) => {
  const { id } = req.params
  const { name, age, gender, avatarSeed } = req.body

  try {
    const profiles = readProfiles()
    const index = profiles.findIndex((p) => p.id === id)

    if (index === -1) {
      return res.status(404).json({ error: '프로필을 찾을 수 없어요' })
    }

    // 기존 데이터에 수정된 내용 덮어쓰기
    profiles[index] = {
      ...profiles[index],
      name: name || profiles[index].name,
      age: age ? Number(age) : profiles[index].age,
      gender: gender || profiles[index].gender,
      avatarSeed: avatarSeed || profiles[index].avatarSeed,
    }

    writeProfiles(profiles)
    res.json({ success: true, profile: profiles[index] })
  } catch (error) {
    res.status(500).json({ error: '프로필 수정 중 오류가 발생했어요' })
  }
})

// 프로필 삭제 (DELETE /profiles/:id)
router.delete('/:id', (req, res) => {
  const { id } = req.params

  try {
    const profiles = readProfiles()
    const filtered = profiles.filter((p) => p.id !== id)

    if (filtered.length === profiles.length) {
      return res.status(404).json({ error: '프로필을 찾을 수 없어요' })
    }

    writeProfiles(filtered)
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: '프로필 삭제 중 오류가 발생했어요' })
  }
})

export default router
