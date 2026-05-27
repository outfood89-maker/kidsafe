// 연령별 안전도 기준점수
const AGE_THRESHOLD = {
  3: 90,
  5: 85,
  7: 80,
  10: 70,
}

// 안전도 등급 반환
export const getSafetyGrade = (score) => {
  if (score >= 90) return { grade: '안전', color: 'green' }
  if (score >= 70) return { grade: '주의', color: 'yellow' }
  return { grade: '위험', color: 'red' }
}

// 연령 기준으로 콘텐츠 필터링
export const filterByAge = (videos, age) => {
  const threshold = AGE_THRESHOLD[age] || 70
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