import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// searches.json 파일 경로
const DATA_PATH = path.join(__dirname, '../data/searches.json');

// JSON 파일 읽기 헬퍼 함수
const readData = () => {
  const raw = fs.readFileSync(DATA_PATH, 'utf-8');
  return JSON.parse(raw);
};

// JSON 파일 쓰기 헬퍼 함수
const writeData = (data) => {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf-8');
};

// ✅ GET /search-history?profileId=xxx
// 특정 프로필의 검색 히스토리 조회 (최신순, 중복 제거, 최대 20개)
router.get('/', (req, res) => {
  try {
    const { profileId } = req.query;

    if (!profileId) {
      return res.status(400).json({ error: 'profileId가 필요합니다.' });
    }

    const allSearches = readData();

    // profileId로 필터링 후 최신순 정렬
    const filtered = allSearches
      .filter((s) => s.profileId === profileId)
      .sort((a, b) => new Date(b.searchedAt) - new Date(a.searchedAt));

    // 중복 키워드 제거 (가장 최근 것만 유지)
    const seen = new Set();
    const unique = filtered.filter((s) => {
      if (seen.has(s.keyword)) return false;
      seen.add(s.keyword);
      return true;
    }).slice(0, 20);

    res.json(unique);
  } catch (err) {
    console.error('검색 히스토리 조회 에러:', err);
    res.status(500).json({ error: '서버 오류' });
  }
});

// ✅ POST /search-history
// 검색 키워드 저장
// body: { profileId, keyword }
router.post('/', (req, res) => {
  try {
    const { profileId, keyword } = req.body;

    if (!profileId || !keyword) {
      return res.status(400).json({ error: 'profileId와 keyword가 필요합니다.' });
    }

    if (keyword.trim() === '') {
      return res.status(400).json({ error: 'keyword가 비어있습니다.' });
    }

    const allSearches = readData();

    const newEntry = {
      id: uuidv4(),
      profileId,
      keyword: keyword.trim(),
      searchedAt: new Date().toISOString(),
    };

    allSearches.push(newEntry);
    writeData(allSearches);

    res.status(201).json(newEntry);
  } catch (err) {
    console.error('검색 히스토리 저장 에러:', err);
    res.status(500).json({ error: '서버 오류' });
  }
});

// ✅ DELETE /search-history/:id
// 특정 검색 기록 1개 삭제
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const allSearches = readData();

    const index = allSearches.findIndex((s) => s.id === id);

    if (index === -1) {
      return res.status(404).json({ error: '해당 기록을 찾을 수 없습니다.' });
    }

    allSearches.splice(index, 1);
    writeData(allSearches);

    res.json({ message: '삭제 완료' });
  } catch (err) {
    console.error('검색 히스토리 삭제 에러:', err);
    res.status(500).json({ error: '서버 오류' });
  }
});

// ✅ DELETE /search-history/all/:profileId
// 특정 프로필의 검색 기록 전체 삭제
router.delete('/all/:profileId', (req, res) => {
  try {
    const { profileId } = req.params;
    const allSearches = readData();

    const filtered = allSearches.filter((s) => s.profileId !== profileId);
    writeData(filtered);

    res.json({ message: '전체 삭제 완료' });
  } catch (err) {
    console.error('검색 히스토리 전체 삭제 에러:', err);
    res.status(500).json({ error: '서버 오류' });
  }
});

export default router;
