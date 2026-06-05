import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

const DATA_PATH = path.join(__dirname, '../data/favorites.json');

const readData = () => {
  const raw = fs.readFileSync(DATA_PATH, 'utf-8');
  return JSON.parse(raw);
};

const writeData = (data) => {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf-8');
};

// GET /favorites?profileId=xxx — 프로필의 찜 목록 조회 (최신순)
router.get('/', (req, res) => {
  try {
    const { profileId } = req.query;
    if (!profileId) return res.status(400).json({ error: 'profileId가 필요합니다.' });

    const all = readData();
    const filtered = all
      .filter((f) => f.profileId === profileId)
      .sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));

    res.json(filtered);
  } catch (err) {
    console.error('찜 목록 조회 에러:', err);
    res.status(500).json({ error: '서버 오류' });
  }
});

// POST /favorites — 찜 추가
// body: { profileId, type, itemId, title, thumbnail, channelTitle, totalScore }
router.post('/', (req, res) => {
  try {
    const { profileId, type, itemId, title, thumbnail, channelTitle, totalScore } = req.body;

    if (!profileId || !type || !itemId) {
      return res.status(400).json({ error: '필수 항목이 누락되었습니다.' });
    }

    const all = readData();

    // 같은 프로필에 동일 항목이 이미 있으면 그대로 반환
    const existing = all.find((f) => f.profileId === profileId && f.itemId === itemId);
    if (existing) return res.status(409).json({ error: '이미 찜한 항목입니다.', favorite: existing });

    const newFav = {
      id: uuidv4(),
      profileId,
      type,
      itemId,
      title,
      thumbnail,
      channelTitle,
      totalScore: totalScore ?? null,
      savedAt: new Date().toISOString(),
    };

    all.push(newFav);
    writeData(all);

    res.status(201).json(newFav);
  } catch (err) {
    console.error('찜 추가 에러:', err);
    res.status(500).json({ error: '서버 오류' });
  }
});

// DELETE /favorites/:id — 찜 해제
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const all = readData();

    const index = all.findIndex((f) => f.id === id);
    if (index === -1) return res.status(404).json({ error: '해당 찜 항목을 찾을 수 없습니다.' });

    all.splice(index, 1);
    writeData(all);

    res.json({ message: '찜 해제 완료' });
  } catch (err) {
    console.error('찜 해제 에러:', err);
    res.status(500).json({ error: '서버 오류' });
  }
});

export default router;
