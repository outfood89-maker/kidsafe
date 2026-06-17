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
export const analyzeVideo = async (video) => {
  const response = await axios.post(`${BASE_URL}/analyze`, {
    title: video.title,
    description: video.description || "",
    videoId: video.videoId || "",
    channelId: video.channelId || "",
    madeForKids: video.madeForKids || false,
    categoryId: video.categoryId || "",
    topicCategories: video.topicCategories || [],
  })
  return response.data
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















