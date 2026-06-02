import axios from 'axios'

// 백엔드 서버 주소
const BASE_URL = 'http://localhost:3000'

// 키워드로 YouTube 영상 검색
export const searchVideos = async (keyword) => {
  const response = await axios.get(`${BASE_URL}/search`, {
    params: { keyword }
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
