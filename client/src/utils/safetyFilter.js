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

// 중간 나이(4·6·8·9)를 설정 버킷(3/5/7/10)에 귀속 — 보수적(아래 버킷=더 엄격) (V)
const resolveAgeBucket = (age) => (age >= 10 ? 10 : age >= 7 ? 7 : age >= 5 ? 5 : 3)

// 프로필의 실효 기준점수 반환 (커스텀 → 연령 버킷 기본값 → 전역 기본값 순)
// ⚠️ age가 null이면 버킷(→3)으로 떨어뜨리지 말고 전역 폴백 70 유지 (V null 가드)
export const getEffectiveThreshold = (age, customThreshold) =>
  customThreshold ?? (age != null ? AGE_THRESHOLD[resolveAgeBucket(age)] : 70)

// 연령 기준으로 콘텐츠 필터링 (커스텀 threshold 우선 적용)
// + AI 정밀분석(confidence==='high')으로 위험 판정된 영상은 아이 화면에서 숨김.
//   재생 게이팅(VideoModal canPlay / recommend.is_safe_candidate)과 동일 기준으로 일관 유지.
//   ⚠️ low(키워드만 본 것)는 오탐 방지를 위해 숨기지 않는다 — 모달을 열어 deep 분석 후 걸러진다.
//   한 번 걸린 영상은 캐시에 high로 기록되므로 다음 검색부터 자동으로 사라진다.
export const filterByAge = (videos, age, customThreshold) => {
  const threshold = getEffectiveThreshold(age, customThreshold)
  return videos.filter(video => {
    // 1) 총점 미달 제외 (기존 동작)
    if (video.totalScore < threshold) return false

    // 2) 권장 연령 초과 → 숨김 (confidence 무관)
    //    배틀 가드 등 제목 기반으로 부여된 ageRating 은 키워드 단계라도 명백한 신호라 신뢰한다.
    if (video.ageRating != null && age != null && video.ageRating > age) return false

    // 3) 위험 카테고리/상업성은 AI 정밀분석(high)일 때만 — 오탐 방지
    if (video.confidence === 'high') {
      // 위험 카테고리(폭력/언어/선정/공포/모방) 중 하나라도 60 미만 → 숨김
      const danger = [video.violence, video.language, video.sexual, video.scary, video.imitationRisk]
      if (danger.some(s => s != null && s < 60)) return false
      // 비상업성 50 이하(언박싱·가챠 등 소비 유도) → 숨김
      if (video.commercialism != null && video.commercialism <= 50) return false
    }
    return true
  })
}

// ── 재생 게이트 (VideoModal·VideoPlayer 공용) — canPlay 룰 단일화로 드리프트 방지 (W #3, 팀장) ──
// 연령 상향(10+) 장르 신호 — 키워드/제외셋은 서버 analyze.py AGE_GENRE_KEYWORDS/EXCLUDE 와 **같은 내용** 유지(한쪽 고치면 양쪽 다).
//   ⚠️ 매칭 범위만 다름: 서버는 제목만, 클라(게이팅)는 Y부터 제목+채널명(채널 브랜드가 장르 신호인 경우 포착). 키워드셋 자체는 동일.
const AGE_GENRE_KEYWORDS = ['asmr', '먹방', 'mukbang']
const AGE_GENRE_EXCLUDE = ['동요', '자장가', '동화', '키즈', 'kids']
// 제목+채널명 소문자 부분일치, EXCLUDE 우선 (Y: 채널명도 검사)
const hitsAgeGenre = (title, channelTitle = '') => {
  const t = `${title || ''} ${channelTitle || ''}`.toLowerCase()
  if (!AGE_GENRE_KEYWORDS.some((k) => t.includes(k))) return false
  if (AGE_GENRE_EXCLUDE.some((k) => t.includes(k))) return false
  return true
}

// 인증(madeForKids) 영상의 최소 안전 통과(passMinSafety): 비상업성 > 50 (W #1, 팀장)
//   ⚠️ 장르 가드(ASMR 등)는 Y부터 ageBlocked(프로필 나이 게이팅)로 이관 — 여기선 검사하지 않는다 ((C) 원형).
// 반환: true(통과) | false(fast-pass 탈락 → 정밀분석 경로) | null(상업성 데이터 없음 → 폴백: 허용하되 '안심' 미출력)
const certMinSafety = (video) => {
  if (video?.commercialism == null) return null         // 상업성 데이터 없음 → 폴백(허용, 안심 주장 X)
  return video.commercialism > 50                       // 비상업성 > 50 통과
}

// 재생 가능 판정 + 표시 등급(tier). VideoModal·VideoPlayer가 이 함수 하나만 쓴다.
//   canPlay = (madeForKids && certMinSafety≠false) || (deep && !dangerous)   ※ 단, 연령 초과(ageBlocked)면 인증·deep 무관 차단
//   tier: 'dangerous'(차단) | 'deep'(정밀통과=안심) | 'cert'(인증기반 통과, 안심 주장X) | 'pending'(판정 전)
//   age: 프로필 나이(없으면 null=부모 뷰 등 → 연령 차단 없음). effAgeRating > age 면 차단 (Y).
export const evaluatePlayGate = (video, safetyThreshold = 70, age = null) => {
  const isDeep = video?.confidence === 'high'
  const danger = [video?.violence, video?.language, video?.sexual, video?.scary, video?.imitationRisk].filter((s) => s != null)
  const critical = danger.some((s) => s < 60)
  const commercialRisk = video?.commercialism != null && video.commercialism <= 50
  const analysisDangerous = isDeep && ((video?.totalScore ?? 0) < safetyThreshold || critical || commercialRisk)

  // 연령 상향 장르(ASMR 등) 또는 명시 ageRating → 프로필 나이 초과면 차단 (인증·deep 양쪽 공통, Y).
  //   deep 통과했어도 ageRating이 프로필 나이보다 높으면 차단 — 연속재생 큐로 6세에게 ASMR 가던 구멍도 여기서 닫힘.
  const effAgeRating = Math.max(video?.ageRating ?? 0, hitsAgeGenre(video?.title, video?.channelTitle) ? 10 : 0)
  const ageBlocked = age != null && effAgeRating > age

  const certPass = !!video?.madeForKids && certMinSafety(video) !== false

  let tier
  if (ageBlocked) tier = 'dangerous'           // 연령 초과 → 차단 (인증/deep 무관, 정직한 차단 카피)
  else if (analysisDangerous) tier = 'dangerous' // 정밀분석 위험 → 인증이어도 차단(기존 버튼 동작 보존)
  else if (isDeep) tier = 'deep'               // 정밀분석 통과 → 안심
  else if (certPass) tier = 'cert'             // 인증 + 최소안전(또는 데이터 없음 폴백) → 재생 허용, 안심 주장 X
  else tier = 'pending'                         // 아직 판정 전(분석 중/애매) → 보고 있어

  // ⚠️ isDangerous = '분석상 위험'이 아니라 '차단 판정'(정밀분석 위험 + 연령 초과 모두 포함). 소비자(VideoModal 차단 버튼)가 tier와 한 몸으로 움직이게 하기 위함.
  return { canPlay: tier === 'deep' || tier === 'cert', tier, isDeep, isDangerous: tier === 'dangerous', isPending: tier === 'pending' }
}

// 안전도 점수 기반 정렬 (높은 순)
export const sortBySafety = (videos) => {
  return [...videos].sort((a, b) => b.totalScore - a.totalScore)
}

// 길이에 따른 "순위 페널티(칸 수)" — 매우 긴 영상일수록 살짝 뒤로.
// 하드 컷이 아니라 약한 가중치라 좋은 긴 영상도 사라지지 않고 조금만 내려간다.
const lengthRankPenalty = (sec) => {
  if (!sec || sec <= 0) return 0
  const min = sec / 60
  if (min <= 10) return 0
  if (min <= 20) return 2
  if (min <= 40) return 5
  if (min <= 60) return 8
  return 12
}

// 검색 결과를 "YouTube 관련도(원래 순서) + 길이 선호"로 부드럽게 재정렬.
// 원래 순위(index)를 주 가중치로 유지하므로 관련도는 거의 보존되고,
// 너무 긴 영상만 페널티만큼 뒤로 밀려 짧은 영상이 자연스럽게 더 잘 보인다.
export const sortByLengthPreference = (videos) =>
  videos
    .map((v, i) => ({ v, key: i + lengthRankPenalty(v.duration) }))
    .sort((a, b) => a.key - b.key)
    .map((x) => x.v)

// 안전도 점수 종합 계산
export const calculateTotalScore = (scores) => {
  const { violence, language, sexual, educational } = scores
  return Math.round((violence + language + sexual + educational) / 4)
}

// 나이별 가중치 적용 점수 계산
export const calculateWeightedScore = (video, age) => {
  const weights = AGE_WEIGHTS[resolveAgeBucket(age)] || AGE_WEIGHTS[7]
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
