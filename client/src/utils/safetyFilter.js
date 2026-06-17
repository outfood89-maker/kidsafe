// 연령별 안전도 기준점수
const AGE_THRESHOLD = {
  3: 90,
  5: 85,
  7: 80,
  10: 70,
}

// 연령별 가중치 설정
const AGE_WEIGHTS = {
  3:  { total: 0.2, violenceSexual: 0.5, language: 0.2, educational: 0.1 },
  5:  { total: 0.2, violenceSexual: 0.4, language: 0.2, educational: 0.2 },
  7:  { total: 0.2, violenceSexual: 0.3, language: 0.2, educational: 0.3 },
  10: { total: 0.2, violenceSexual: 0.2, language: 0.2, educational: 0.4 },
}

// Anti-Bias 감지용 키워드 목록
const TOPIC_KEYWORDS = [
  '공룡', '뽀로로', '타요', '동요', '자장가', '율동',
  '동화', '애니메이션', '캐릭터', '동물', '인형',
  '에그박사', '곤충', '과학', '실험', '다큐',
  '역사', '우주', '수학', '상식',
]

// 안전도 등급 반환
export const getSafetyGrade = (score) => {
  if (score >= 90) return { grade: '안전', color: 'green' }
  if (score >= 70) return { grade: '주의', color: 'yellow' }
  return { grade: '위험', color: 'red' }
}

// 프로필의 실효 기준점수 반환 (커스텀 → 연령 기본값 → 전역 기본값 순)
export const getEffectiveThreshold = (age, customThreshold) =>
  customThreshold ?? AGE_THRESHOLD[age] ?? 70

// 연령 기준으로 콘텐츠 필터링 (커스텀 threshold 우선 적용)
export const filterByAge = (videos, age, customThreshold) => {
  const threshold = getEffectiveThreshold(age, customThreshold)
  return videos.filter(video => video.totalScore >= threshold)
}

// 안전도 점수 기반 정렬 (높은 순)
export const sortBySafety = (videos) => {
  return [...videos].sort((a, b) => b.totalScore - a.totalScore)
}

// 안전도 점수 종합 계산
export const calculateTotalScore = (scores) => {
  const { violence, language, sexual, educational } = scores
  return Math.round((violence + language + sexual + educational) / 4)
}

// 나이별 가중치 적용 점수 계산
export const calculateWeightedScore = (video, age) => {
  const weights = AGE_WEIGHTS[age] || AGE_WEIGHTS[7]
  const { totalScore, violence, language, sexual, educational } = video
  const violenceSexualAvg = Math.round((violence + sexual) / 2)
  const weightedScore = Math.round(
    totalScore        * weights.total +
    violenceSexualAvg * weights.violenceSexual +
    language          * weights.language +
    educational       * weights.educational
  )
  return weightedScore
}

// 나이별 가중치 점수로 영상 목록 정렬 (높은 순)
export const sortByWeightedScore = (videos, age) => {
  return [...videos].sort((a, b) => {
    const scoreA = calculateWeightedScore(a, age)
    const scoreB = calculateWeightedScore(b, age)
    return scoreB - scoreA
  })
}

// 영상 제목에서 태그 추출
export const extractTags = (title) => {
  return TOPIC_KEYWORDS.filter(keyword =>
    title.toLowerCase().includes(keyword.toLowerCase())
  )
}

// 최근 시청 기록에서 태그 빈도 분석
// 반환: { 공룡: 7, 동요: 2, 우주: 1 } 형태
const analyzeWatchHistory = (watchHistory) => {
  const recent = watchHistory.slice(-10) // 최근 10개만
  const tagCount = {}

  recent.forEach(item => {
    const tags = extractTags(item.title || '')
    tags.forEach(tag => {
      tagCount[tag] = (tagCount[tag] || 0) + 1
    })
  })

  return tagCount
}

// Anti-Bias 편식 방지 점수 조정
// - 특정 태그 70% 초과 시 해당 영상 15% 감점
// - 새로운 영역 영상 +20점 보너스
export const applyAntiBias = (videos, watchHistory, age) => {
  if (!watchHistory || watchHistory.length === 0) return videos

  const tagCount = analyzeWatchHistory(watchHistory)
  const totalTagCount = Object.values(tagCount).reduce((sum, count) => sum + count, 0)

  // 편식 태그 찾기 (비율 70% 초과)
  const overusedTags = Object.entries(tagCount)
    .filter(([, count]) => totalTagCount > 0 && count / totalTagCount > 0.7)
    .map(([tag]) => tag)

  return videos.map(video => {
    const videoTags = extractTags(video.title || '')
    let baseScore = calculateWeightedScore(video, age)

    // 편식 태그 포함 영상 → 15% 감점
    const hasOverusedTag = videoTags.some(tag => overusedTags.includes(tag))
    if (hasOverusedTag) {
      baseScore = Math.round(baseScore * 0.85)
    }

    // 시청 기록에 없는 새로운 태그 영상 → +20점 보너스
    const isNewArea = videoTags.length > 0 &&
      videoTags.every(tag => !tagCount[tag])
    if (isNewArea) {
      baseScore = Math.min(100, baseScore + 20)
    }

    return { ...video, finalScore: baseScore }
  }).sort((a, b) => b.finalScore - a.finalScore) // finalScore 기준 정렬
}

// 시청 기록에서 가장 많이 본 키워드 추출 (상위 1개)
export const getTopKeyword = (watchHistory) => {
  if (!watchHistory || watchHistory.length === 0) return null

  const tagCount = {}
  watchHistory.forEach(item => {
    const tags = extractTags(item.title || '')
    tags.forEach(tag => {
      tagCount[tag] = (tagCount[tag] || 0) + 1
    })
  })

  if (Object.keys(tagCount).length === 0) return null

  // 가장 많이 본 키워드 반환
  return Object.entries(tagCount)
    .sort((a, b) => b[1] - a[1])[0][0]
}
