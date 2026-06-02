// 연령별 안전도 기준점수
const AGE_THRESHOLD = {
  3: 90,
  5: 85,
  7: 80,
  10: 70,
}

// 연령별 가중치 설정
// 나이가 어릴수록 폭력/선정 비중 높게, 나이가 많을수록 교육성 비중 높게
const AGE_WEIGHTS = {
  3:  { total: 0.2, violenceSexual: 0.5, language: 0.2, educational: 0.1 },
  5:  { total: 0.2, violenceSexual: 0.4, language: 0.2, educational: 0.2 },
  7:  { total: 0.2, violenceSexual: 0.3, language: 0.2, educational: 0.3 },
  10: { total: 0.2, violenceSexual: 0.2, language: 0.2, educational: 0.4 },
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

// 나이별 가중치 적용 점수 계산 (2단계)
// 폭력성+선정성 평균을 별도로 계산해서 나이별 비중 적용
export const calculateWeightedScore = (video, age) => {
  const weights = AGE_WEIGHTS[age] || AGE_WEIGHTS[7]

  const { totalScore, violence, language, sexual, educational } = video

  // 폭력성 + 선정성 평균
  const violenceSexualAvg = Math.round((violence + sexual) / 2)

  // 가중치 적용 점수 계산
  const weightedScore = Math.round(
    totalScore    * weights.total +
    violenceSexualAvg * weights.violenceSexual +
    language      * weights.language +
    educational   * weights.educational
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