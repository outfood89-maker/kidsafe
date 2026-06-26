import axios from 'axios'
import { supabase } from './supabase'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

// 우리 백엔드(BASE_URL) 요청에는 로그인 토큰을 자동으로 붙인다.
// (백엔드 auth.py가 이 토큰으로 회원/관리자/구독 권한을 검증)
axios.interceptors.request.use(async (config) => {
  const url = config.url || ''
  if (url.startsWith(BASE_URL)) {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

// 키워드로 YouTube 영상 검색
export const searchVideos = async (keyword) => {
  const response = await axios.get(`${BASE_URL}/search`, {
    params: { keyword }
  })
  return response.data // videos + playlists 둘 다 반환
}

// 재생목록 안 영상 목록 가져오기 (검수용)
export const getPlaylistItems = async (playlistId) => {
  const response = await axios.get(`${BASE_URL}/search/playlist-items`, {
    params: { playlistId }
  })
  return response.data.videos
}

// 나이별 추천 영상 검색 (신규)
export const getRecommendedVideos = async (age) => {
  const response = await axios.get(`${BASE_URL}/search/recommend`, {
    params: { age }
  })
  return response.data
}

// 영상 안전도 검수 (Tier 0~1 — 키워드+채널+YouTube 메타데이터, 검색 목록용)
// ⚠️ thumbnail/channelTitle도 함께 보냄 — 백엔드가 캐시 _meta에 저장해 추천 엔진 후보 풀로 재활용
export const analyzeVideo = async (video) => {
  const response = await axios.post(`${BASE_URL}/analyze`, {
    title: video.title,
    description: video.description || "",
    videoId: video.videoId || "",
    channelId: video.channelId || "",
    channelTitle: video.channelTitle || "",
    thumbnail: video.thumbnail || "",
    duration: video.duration || 0,
    madeForKids: video.madeForKids || false,
    categoryId: video.categoryId || "",
    topicCategories: video.topicCategories || [],
  })
  return response.data
}

// 캐시 기반 맞춤 추천 (YouTube 쿼터 0 — 이미 분석된 안전 영상 풀에서 선호 채널 우대)
export const getCacheRecommendedVideos = async (profileId, limit = 12) => {
  const response = await axios.get(`${BASE_URL}/recommend`, {
    params: { profileId, limit },
  })
  return response.data // { videos, source, poolSize }
}

// 여러 영상 일괄 안전도 검수 (Tier 0~1 — DB in쿼리 1번 + 신규만 키워드 분석, 검색 속도 최적화)
export const analyzeVideosBatch = async (videos) => {
  const response = await axios.post(`${BASE_URL}/analyze/batch`, { items: videos })
  return response.data.results
}

// 영상 정밀 검수 (Tier 2 — 자막 + Claude AI, 영상 상세 모달용)
export const analyzeVideoDeep = async (video) => {
  const response = await axios.post(`${BASE_URL}/analyze/deep`, {
    title: video.title,
    description: video.description || "",
    videoId: video.videoId || "",
    channelId: video.channelId || "",
    channelTitle: video.channelTitle || "",
  })
  return response.data
}

// 시청 기록 저장
export const saveHistory = async (video) => {
  const response = await axios.post(`${BASE_URL}/history`, video)
  return response.data
}

// 시청 기록 불러오기
export const getHistory = async () => {
  const response = await axios.get(`${BASE_URL}/history`)
  return response.data.history
}

// 특정 시청 기록 삭제
export const deleteHistoryItem = async (watchedAt, profileId) => {
  const response = await axios.delete(`${BASE_URL}/history/item`, {
    params: { watchedAt, profileId }
  })
  return response.data
}

// 전체 시청 기록 삭제 (profileId 없으면 전체 삭제)
export const deleteAllHistory = async (profileId) => {
  const response = await axios.delete(`${BASE_URL}/history/all`, {
    params: profileId ? { profileId } : {}
  })
  return response.data
}

// 프로필 전체 조회
export const getProfiles = async () => {
  const response = await axios.get(`${BASE_URL}/profiles`)
  return response.data.profiles
}

// 프로필 생성
export const createProfile = async (profileData) => {
  const response = await axios.post(`${BASE_URL}/profiles`, profileData)
  return response.data.profile
}

// 프로필 삭제
export const deleteProfile = async (profileId) => {
  const response = await axios.delete(`${BASE_URL}/profiles/${profileId}`)
  return response.data
}

// 프로필 수정
export const updateProfile = async (profileId, profileData) => {
  const response = await axios.put(`${BASE_URL}/profiles/${profileId}`, profileData)
  return response.data.profile
}

// ── 오늘의 체크인 (F1) ──────────────────────────────────────

// 오늘 체크인 했는지 조회 (있으면 checkin, 없으면 null)
export const getTodayCheckin = async (profileId) => {
  const response = await axios.get(`${BASE_URL}/checkins/today`, { params: { profile_id: profileId } })
  return response.data // { checkin }
}

// 오늘 이전 가장 최근 체크인 (키디 인사 '어제 기분' 끌어오기용)
export const getRecentCheckin = async (profileId) => {
  const response = await axios.get(`${BASE_URL}/checkins/recent`, { params: { profile_id: profileId } })
  return response.data // { checkin }
}

// 오늘의 질문 목록 (기분·하루·볼것 3개, '볼 것'은 씨앗 기반)
export const getCheckinQuestions = async (profileId) => {
  const response = await axios.get(`${BASE_URL}/checkins/questions`, { params: { profile_id: profileId } })
  return response.data.questions
}

// 오늘 체크인 저장 (upsert)
export const saveCheckin = async ({ profileId, mood, moodEmoji, answers, shareWithParent }) => {
  const response = await axios.post(`${BASE_URL}/checkins`, { profileId, mood, moodEmoji, answers, shareWithParent })
  return response.data.checkin
}

// 체크인 공유 여부 갱신 (부모와 나누기)
export const updateCheckinShare = async (id, shareWithParent) => {
  const response = await axios.patch(`${BASE_URL}/checkins/${id}/share`, { shareWithParent })
  return response.data.checkin
}

// 아이 답에 대한 키디 반응 생성 (Haiku) — 실패 시 throw → 프론트가 로컬 템플릿으로 폴백
export const reactToCheckin = async ({ profileName, profileAge, qId, qText, answer, answerType, priorAnswers }) => {
  const response = await axios.post(`${BASE_URL}/checkins/react`, {
    profileName, profileAge, qId, qText, answer, answerType, priorAnswers,
  })
  return response.data.reaction
}

// 키디 반응 스트리밍 — 토큰을 받는 즉시 onChunk(누적텍스트) 호출 (대기 체감↓).
// ⚠️ 스트리밍은 브라우저 axios로 불가 → 이 호출만 fetch 사용 (스트리밍 한정 예외).
// 토큰은 axios 인터셉터가 아닌 직접 첨부. 실패/빈응답 시 throw → 프론트가 로컬 폴백.
export const reactToCheckinStream = async (payload, onChunk) => {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  const res = await fetch(`${BASE_URL}/checkins/react/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok || !res.body) throw new Error('stream-failed')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let full = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    full += decoder.decode(value, { stream: true })
    if (full) onChunk(full)
  }
  if (!full.trim()) throw new Error('empty')
  return full
}

// 관심사 씨앗(F0) 저장 — PUT /profiles/{id} 재사용 (interests + 누가 골랐는지)
export const saveProfileInterests = async (profileId, interests, interestSource) => {
  const response = await axios.put(`${BASE_URL}/profiles/${profileId}`, { interests, interestSource })
  return response.data.profile
}

// 프로필 배지 조회
export const getBadges = async (profileId) => {
  const response = await axios.get(`${BASE_URL}/badges/${profileId}`)
  return response.data.badges
}

export const checkBadges = async (profileId) => {
  const response = await axios.post(`${BASE_URL}/badges/check/${profileId}`)
  return response.data
}

// 시청 기록 기반 추천 영상 검색 (신규)
export const getHistoryRecommendedVideos = async (keyword) => {
  const response = await axios.get(`${BASE_URL}/search/history-recommend`, {
    params: { keyword }
  })
  return response.data
}


// 검색 히스토리 조회
export const getSearchHistory = async (profileId) => {
  const response = await axios.get(`${BASE_URL}/search-history`, {
    params: { profileId }
  })
  return response.data
}

// 검색 히스토리 저장
export const saveSearchHistory = async (profileId, keyword) => {
  const response = await axios.post(`${BASE_URL}/search-history`, {
    profileId,
    keyword
  })
  return response.data
}

// 검색 히스토리 1개 삭제
export const deleteSearchHistory = async (id) => {
  const response = await axios.delete(`${BASE_URL}/search-history/${id}`)
  return response.data
}

// 검색 히스토리 전체 삭제
export const deleteAllSearchHistory = async (profileId) => {
  const response = await axios.delete(`${BASE_URL}/search-history/all/${profileId}`)
  return response.data
}

// 찜 목록 조회
export const getFavorites = async (profileId) => {
  const response = await axios.get(`${BASE_URL}/favorites`, { params: { profileId } })
  return response.data
}

// 찜 추가
export const addFavorite = async (data) => {
  const response = await axios.post(`${BASE_URL}/favorites`, data)
  return response.data
}

// 찜 해제
export const removeFavorite = async (id) => {
  const response = await axios.delete(`${BASE_URL}/favorites/${id}`)
  return response.data
}

// 키디 챗봇
export const sendChatMessage = async (messages, profileName, profileAge) => {
  const response = await axios.post(`${BASE_URL}/chat`, { messages, profileName, profileAge })
  return response.data
}

// 차단 키워드
export const getBlockedKeywords = async () => {
  const response = await axios.get(`${BASE_URL}/blocked-keywords`)
  return response.data
}

export const checkBlockedKeyword = async (keyword) => {
  const response = await axios.get(`${BASE_URL}/blocked-keywords/check`, { params: { keyword } })
  return response.data
}

export const addBlockedKeyword = async (keyword) => {
  const response = await axios.post(`${BASE_URL}/blocked-keywords/custom`, { keyword })
  return response.data
}

export const deleteBlockedKeyword = async (keyword) => {
  const response = await axios.delete(`${BASE_URL}/blocked-keywords/custom/${encodeURIComponent(keyword)}`)
  return response.data
}

// 위험 영상 알림
export const getAlerts = async () => {
  const response = await axios.get(`${BASE_URL}/alerts`)
  return response.data
}

export const markAlertRead = async (id) => {
  const response = await axios.patch(`${BASE_URL}/alerts/${id}/read`)
  return response.data
}

export const markAllAlertsRead = async () => {
  const response = await axios.patch(`${BASE_URL}/alerts/read-all`)
  return response.data
}

export const getAlertSettings = async () => {
  const response = await axios.get(`${BASE_URL}/alerts/settings`)
  return response.data
}

export const saveAlertSettings = async (settings) => {
  const response = await axios.put(`${BASE_URL}/alerts/settings`, settings)
  return response.data
}

// 게임 보너스 조회
export const getGameBonus = async (profileId) => {
  const response = await axios.get(`${BASE_URL}/game-bonus`, { params: { profileId } })
  return response.data
}

// 게임 보너스 저장
export const saveGameBonus = async ({ profileId, game, correctCount }) => {
  const response = await axios.post(`${BASE_URL}/game-bonus`, { profileId, game, correctCount })
  return response.data
}

// 점수 피드백 제출 (단순 수집)
export const submitFeedback = async (data) => {
  const response = await axios.post(`${BASE_URL}/feedback`, data)
  return response.data
}

// 점수 피드백 자동화 파이프라인 (룰 추가 + 캐시 삭제 한 방에)
export const submitFeedbackPipeline = async (data) => {
  const response = await axios.post(`${BASE_URL}/feedback/pipeline`, data)
  return response.data
}

// 시청 분석 심화 리포트 (history ⋈ analysis_cache 조인 + pandas 집계)
export const getReportInsights = async (profileId = "all") => {
  const response = await axios.get(`${BASE_URL}/reports/insights`, {
    params: { profileId }
  })
  return response.data
}

// AI 코치 분석 (숫자 → 부모 실천 조언, Claude Haiku · 버튼 클릭 시)
export const getReportCoach = async (profileId = "all") => {
  const response = await axios.get(`${BASE_URL}/reports/coach`, {
    params: { profileId }
  })
  return response.data // { insights, coach, cached|empty }
}

// 현재 유저의 role + 프리미엄 여부 조회
export const getUserStatus = async () => {
  const response = await axios.get(`${BASE_URL}/me/status`)
  return response.data // { role, is_premium }
}

// 프로필별 부모 PIN — 설정 여부 조회
export const getPinStatus = async (profileId) => {
  const response = await axios.get(`${BASE_URL}/profiles/${profileId}/pin/status`)
  return response.data // { hasPin }
}

// 프로필별 부모 PIN 설정/변경 (기존 PIN 있으면 currentPin 필요)
export const setParentPin = async (profileId, pin, currentPin = null) => {
  const response = await axios.post(`${BASE_URL}/profiles/${profileId}/pin/set`, { pin, currentPin })
  return response.data // { ok }
}

// 프로필별 부모 PIN 검증
export const verifyParentPin = async (profileId, pin) => {
  const response = await axios.post(`${BASE_URL}/profiles/${profileId}/pin/verify`, { pin })
  return response.data // { ok, hasPin }
}

// ── 관리자 전용 ──────────────────────────────────────────────

export const getAdminFeedbacks = async () => {
  const response = await axios.get(`${BASE_URL}/feedback`)
  return response.data
}

export const suggestAdminRules = async () => {
  const response = await axios.post(`${BASE_URL}/feedback/admin/rules/suggest`)
  return response.data
}

export const getAdminPendingRules = async () => {
  const response = await axios.get(`${BASE_URL}/feedback/admin/rules/pending`)
  return response.data
}

export const approveAdminRule = async (index) => {
  const response = await axios.post(`${BASE_URL}/feedback/admin/rules/approve`, { index })
  return response.data
}

export const rejectAdminRule = async (index) => {
  const response = await axios.delete(`${BASE_URL}/feedback/admin/rules/pending/${index}`)
  return response.data
}

export const approveAdminRulesBulk = async (indices) => {
  const response = await axios.post(`${BASE_URL}/feedback/admin/rules/approve-bulk`, { indices })
  return response.data
}

export const rejectAdminRulesBulk = async (indices) => {
  const response = await axios.post(`${BASE_URL}/feedback/admin/rules/reject-bulk`, { indices })
  return response.data
}

export const getAdminCurrentRules = async () => {
  const response = await axios.get(`${BASE_URL}/feedback/admin/rules`)
  return response.data
}

export const getAdminStats = async () => {
  const response = await axios.get(`${BASE_URL}/admin/stats`)
  return response.data
}

export const getAdminAuditLog = async () => {
  const response = await axios.get(`${BASE_URL}/admin/audit`)
  return response.data
}

export const getAdminUsers = async () => {
  const response = await axios.get(`${BASE_URL}/admin/users`)
  return response.data
}

export const updateAdminUserRole = async (userId, role) => {
  const response = await axios.patch(`${BASE_URL}/admin/users/${userId}/role`, { role })
  return response.data
}

export const updateAdminUserPremium = async (userId, grant) => {
  const response = await axios.patch(`${BASE_URL}/admin/users/${userId}/premium`, { grant })
  return response.data
}















