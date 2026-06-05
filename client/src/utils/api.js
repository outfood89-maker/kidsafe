import axios from 'axios'

// 백엔드 서버 주소
const BASE_URL = 'http://localhost:3000'

// 키워드로 YouTube 영상 검색
export const searchVideos = async (keyword) => {
  const response = await axios.get(`${BASE_URL}/search`, {
    params: { keyword }
  })
  return response.data // videos + playlists 둘 다 반환
}

// 나이별 추천 영상 검색 (신규)
export const getRecommendedVideos = async (age) => {
  const response = await axios.get(`${BASE_URL}/search/recommend`, {
    params: { age }
  })
  return response.data
}

// 영상 안전도 검수
export const analyzeVideo = async (title, description) => {
  const response = await axios.post(`${BASE_URL}/analyze`, {
    title,
    description
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















