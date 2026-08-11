import axios from 'axios'
import { supabase } from './supabase'
// B13: 동의 캐시. diaryConsent 는 아무것도 import 하지 않는 잎 모듈이라 순환이 생기지 않는다.
import { setDiaryConsentFromProfiles, setDiaryConsentOne } from './diaryConsent'

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

// ── AD-5: 그림일기 이미지 생성 (feature/diary-v0 브랜치 전용) ──
// 인증 필수 엔드포인트 — 위 인터셉터가 토큰 자동 첨부. { ok, b64, prompt } | { ok:false }
export const generateDiaryImage = async (payload) => {
  const response = await axios.post(`${BASE_URL}/diary-image/generate`, payload)
  return response.data
}

// ── AD-8: 이어 그리기 (아이 낙서 + AI 완성). payload에 drawingB64(data URL) 포함. { ok, b64, prompt } | { ok:false } ──
export const continueDiaryImage = async (payload) => {
  const response = await axios.post(`${BASE_URL}/diary-image/continue`, payload)
  return response.data
}

// ── GD-8a: 그림일기 서버 저장 (엔트리·메타·자산) ──────────────────────
// ⚠️ 이 함수들은 diaryStore 의 DIARY_SERVER 게이트 뒤에서만 호출된다. 플래그가 false 면 아무도 안 부른다.
// 인증 필수 — 위 인터셉터가 토큰 자동 첨부. 경로 파라미터는 반드시 encodeURIComponent.
export const getDiaryEntries = async (profileId) => {
  const res = await axios.get(`${BASE_URL}/diary/entries`, { params: { profileId } })
  return res.data
}
// GD-8d: 다른 기기에서 지워진 일기 목록. hydrate 가 "지운 것"과 "푸시 실패분"을 구분하는 유일한 근거다.
//   ⚠️ 실패하면 절대 삭제로 해석하지 말 것 — 호출부(diaryStore)가 null 이면 아무것도 지우지 않는다.
export const getDiaryDeletions = async (profileId) => {
  const res = await axios.get(`${BASE_URL}/diary/deletions`, { params: { profileId } })
  return res.data
}
export const postDiaryEntry = async (payload) => {
  const res = await axios.post(`${BASE_URL}/diary/entries`, payload)
  return res.data
}
export const patchDiaryImage = async (entryId, payload) => {
  const res = await axios.patch(`${BASE_URL}/diary/entries/${encodeURIComponent(entryId)}/image`, payload)
  return res.data
}
export const patchDiaryStamp = async (entryId, payload) => {
  const res = await axios.patch(`${BASE_URL}/diary/entries/${encodeURIComponent(entryId)}/stamp`, payload)
  return res.data
}
export const patchDiaryStampSeen = async (entryId, payload) => {
  const res = await axios.patch(`${BASE_URL}/diary/entries/${encodeURIComponent(entryId)}/stamp-seen`, payload)
  return res.data
}
export const getDiaryMeta = async (profileId) => {
  const res = await axios.get(`${BASE_URL}/diary/meta`, { params: { profileId } })
  return res.data
}
export const putDiaryMeta = async (payload) => {
  const res = await axios.put(`${BASE_URL}/diary/meta`, payload)
  return res.data
}
// ⚠️ multipart — Content-Type 을 직접 세팅하지 말 것. boundary 는 axios 가 붙인다
//    (선례 주석: server/routers/diary_image.py:313).
export const postDiaryAsset = async (formData) => {
  const res = await axios.post(`${BASE_URL}/diary/assets`, formData)
  return res.data
}
export const getDiaryAssetUrl = async (assetId, params) => {
  const res = await axios.get(`${BASE_URL}/diary/assets/${encodeURIComponent(assetId)}/url`, { params })
  return res.data
}
// GD-8b: 삭제의 서버 관철. 아이가 '지우기'를 누르면 서버에서도 사라진다.
export const deleteDiaryEntry = async (entryId, profileId) => {
  const res = await axios.delete(`${BASE_URL}/diary/entries/${encodeURIComponent(entryId)}`, {
    params: { profileId },
  })
  return res.data
}
// 🚨 부모용 책장 — 아이가 공유하기로 한 일기만 온다(서버가 쿼리 레벨에서 거른다).
//    아이용 getDiaryEntries 와 **다른 엔드포인트**다. 부모 화면에서 이걸 쓰지 않으면 비공개가 샌다.
export const getDiaryShelf = async (profileId) => {
  const res = await axios.get(`${BASE_URL}/diary/shelf`, { params: { profileId } })
  return res.data
}

// 📦 저장 용량 (2026-08-11) — 부모 화면이 80% 경고를 띄우는 근거.
//    { usedBytes, limitBytes, percent, warn, warnAtPercent, full, complete }
//    ⚠️ 프로필을 안 보낸다 — 상한이 **계정 단위**라 아이별로 쪼개면 뜻이 달라진다.
export const getDiaryUsage = async () => {
  const res = await axios.get(`${BASE_URL}/diary/usage`)
  return res.data
}

// 📦 정리 화면용 목록 — 오래된 순. 항목은 { id, profileId, date, bytes, shared } **다섯 개뿐**이다.
//    🚨 윤리선: 비공개 일기도 자리를 차지하므로 목록에 뜨지만 **내용은 서버가 안 보낸다.**
//       화면에서 여기에 썸네일·문장을 붙이지 말 것 — 그 순간 부모 화면으로 비공개가 샌다.
export const getDiaryUsageEntries = async () => {
  const res = await axios.get(`${BASE_URL}/diary/usage/entries`)
  return res.data
}

// 📦 507 = 저장 공간이 가득 참. 429(한도)·413(파일 큼)과 **다르게 말해야 한다.**
//    🔴 지금은 업로드 실패가 전부 조용히 삼켜진다(diaryStore.pushEntryToServer 의 catch).
//       아이는 아무 일도 안 일어난 것처럼 보고, 부모는 영영 모른다.
//       그래서 실패를 여기서 **이름 붙여** 위로 올린다.
export class StorageFullError extends Error {
  constructor(detail) {
    super(detail?.message || "책장이 가득 찼어요")
    this.name = "StorageFullError"
    this.detail = detail || {}
  }
}

/** 업로드 예외에서 507 을 골라낸다. 아니면 null. */
export const readStorageFull = (err) => {
  if (err instanceof StorageFullError) return err.detail
  const res = err?.response
  if (res?.status !== 507) return null
  const d = res.data?.detail
  return d && typeof d === "object" ? d : { code: "STORAGE_FULL" }
}

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
// ⚠️ B13: 여기서 **동의 캐시를 함께 갱신한다.** 호출부가 4곳(ParentDashboard·ProfileSelect·
//    KidHome·BadgeCollection)이라 각자 갱신하게 두면 하나 빠뜨리는 순간 캐시가 어긋난다.
//    "프로필을 받으면 동의 상태도 최신"이 항상 참이 되도록 단일 지점에 심는다.
export const getProfiles = async () => {
  const response = await axios.get(`${BASE_URL}/profiles`)
  const profiles = response.data.profiles
  setDiaryConsentFromProfiles(profiles)
  return profiles
}

// B13: 그림일기 서버 저장 동의/철회. action = 'grant' | 'revoke'
//   방침 버전은 **서버가 찍는다** — 클라이언트가 보내면 위조할 수 있다.
export const postDiaryConsent = async (profileId, action) => {
  const response = await axios.post(`${BASE_URL}/profiles/${profileId}/diary-consent`, { action })
  setDiaryConsentOne(profileId, response.data?.diaryServerOn === true)
  return response.data
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

// 키디 환영 인사 생성 (Haiku). 실패 시 throw → 프론트가 로컬 greetingLine 템플릿으로 폴백.
// recentMood: 어제(최근) 기분 코드 | null. 어제 기분만 다정히 언급, 기분 질문 없이 대화 초대로 끝남.
export const getCheckinGreeting = async ({ profileName, profileAge, recentMood }) => {
  const response = await axios.post(`${BASE_URL}/checkins/greet`, { profileName, profileAge, recentMood })
  return response.data.greeting
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

// 부모 리포트 "키디의 한 주" (F2) — 감정 흐름 + 공유 하이라이트 + 키디 한마디
export const getCheckinReport = async (profileId, period = 'week') => {
  const response = await axios.get(`${BASE_URL}/reports/checkins`, {
    params: { profile_id: profileId, period },
  })
  return response.data // { report, cached }
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

// 키디 대사를 CLOVA Voice(다인 Pro) 음성 mp3로 합성 → Blob 반환 (H 브리프 §1·§3).
// 음성은 보조 기능 → 실패하면 null 반환(앱은 텍스트만으로 진행). 토큰은 axios 인터셉터가 자동 첨부.
//  - text: 읽어줄 키디 대사 (이모지는 서버가 제거 후 합성)
//  - tone: 'calm'(😢😡 위로=차분) | 'bright'(😄🙂😐 밝게)
// ⚠️ 다시듣기는 받은 Blob을 메모리에 들고 재생(추가 호출 0). 디스크/스토리지 저장 금지(정책).
//   (개정 7/10) STT/TTS 자동 오디오는 비저장 유지. 단, 사용자가 명시적으로 남긴 음성 편지·메모(diaryAudioStore)는 예외 저장 — 오너 확정.
// 💸 한도(429)로 막혔을 때 호출부가 알 수 있게 하는 신호 (2026-08-10).
//   🔴 그전까지는 실패가 전부 null 로 뭉개져 **키디가 조용해지고 아무도 이유를 몰랐다.**
//   ⚠️ responseType:'blob' 이라 에러 본문도 Blob 으로 온다 → 텍스트로 풀어 JSON 을 읽는다.
export class TTSQuotaError extends Error {
  constructor(message) { super(message || 'tts-quota'); this.name = 'TTSQuotaError'; this.quotaMessage = message }
}

const readQuotaMessage = async (err) => {
  try {
    const d = err?.response?.data
    const raw = (d && typeof d.text === 'function') ? await d.text() : d
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    return parsed?.detail?.message || ''
  } catch { return '' }
}

export const synthesizeKiddyVoice = async ({ text, tone = 'bright' }) => {
  if (!text || !text.trim()) return null
  try {
    const response = await axios.post(
      `${BASE_URL}/tts/kiddy`,
      { text, tone },
      { responseType: 'blob' }
    )
    // 204(읽을 것 없음/키 미설정) → 빈 Blob → null 처리
    const blob = response.data
    if (!blob || blob.size === 0) return null
    // iOS 사파리는 blob URL의 MIME이 정확한 오디오 타입이 아니면 재생을 거부(크롬은 내용 추측으로 재생) —
    // 전송 과정에서 타입이 비거나 어긋나도 안전하게 audio/mpeg로 강제 정규화(7/10 iOS 무음 대응).
    if (!blob.type || !blob.type.startsWith('audio/')) return new Blob([blob], { type: 'audio/mpeg' })
    return blob
  } catch (e) {
    // 💸 한도(429)만 따로 알린다 — 나머지 실패와 원인이 다르고, 알려야 고칠 수 있다.
    if (e?.response?.status === 429) {
      throw new TTSQuotaError(await readQuotaMessage(e))
    }
    // 키 오류·네트워크·CLOVA 실패(204/502) → 음성 없이 진행
    // ⚠️ 프로덕션 무음이면 제일 먼저 Railway 환경변수 CLOVA_VOICE_CLIENT_ID/SECRET 확인 (7/10 실사고 — 서버는 키 없으면 204)
    return null
  }
}

// ── 멀티 스케줄러 (부모가 아이 일정/사건/음식/상태 기록) ──────────
// 한 아이의 일정 목록 (month: 'YYYY-MM' 주면 그 달만)
export const getSchedules = async (profileId, month) => {
  const response = await axios.get(`${BASE_URL}/schedules`, {
    params: { profile_id: profileId, ...(month ? { month } : {}) },
  })
  return response.data.schedules
}

// 일정 생성 (endDate 주면 기간 일정)
export const createSchedule = async ({ profileId, date, endDate, type, title, time, memo }) => {
  const response = await axios.post(`${BASE_URL}/schedules`, { profileId, date, endDate, type, title, time, memo })
  return response.data.schedule
}

// 일정 수정 (보낸 필드만 갱신)
export const updateSchedule = async (id, patch) => {
  const response = await axios.patch(`${BASE_URL}/schedules/${id}`, patch)
  return response.data.schedule
}

// 일정 삭제
export const deleteSchedule = async (id) => {
  const response = await axios.delete(`${BASE_URL}/schedules/${id}`)
  return response.data
}

// 대화형 등록 — "13일 태권도 넣어줘" 같은 자연어를 키디가 파싱해 일정 처리(등록/조회/수정/삭제)
// today: 클라이언트 로컬 'YYYY-MM-DD' (상대날짜 '내일' 등 계산 기준)
// viewMonth: 사용자가 보고 있는 달 'YYYY-MM' ('12일'처럼 일만 말할 때 이 달 기준으로 해석)
// 반환: { cards: [...대상 일정], reply: '안내문구', changed }
export const agentSchedule = async ({ profileId, message, today, viewMonth }) => {
  const response = await axios.post(`${BASE_URL}/schedules/agent`, { profileId, message, today, viewMonth })
  return response.data
}

// 키디 스케줄 인사 — 오늘/내일 일정 읽고 Haiku가 생성한 한마디
export const getKiddyGreeting = async (profileId) => {
  const response = await axios.get(`${BASE_URL}/kiddy-greeting`, {
    params: { profileId },
  })
  return response.data // { message, todayCount, tomorrowCount }
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

// 키디 챗봇 — level: 대화 수준(beginner|intermediate|advanced). 미지정 시 백엔드가 초급으로 폴백.
export const sendChatMessage = async (messages, profileName, profileAge, level = "beginner") => {
  const response = await axios.post(`${BASE_URL}/chat`, { messages, profileName, profileAge, level })
  return response.data
}

// ── 위기 신호 (P 브리프 §4) — 부모에게 '존재만' 알림. 내용은 저장·전송 안 함 ──────
// 위기(HIGH) 감지 시 클라가 생성. 서버가 auth+소유검증 + 같은 날 중복 1건 처리.
export const createCareSignal = async (profileId, level = "high") => {
  const response = await axios.post(`${BASE_URL}/care-signals`, { profileId, level })
  return response.data // { careSignal, deduped }
}

// 부모 조회 — 특정 프로필의 위기 신호 목록
export const getCareSignals = async (profileId) => {
  const response = await axios.get(`${BASE_URL}/care-signals`, { params: { profileId } })
  return response.data.careSignals
}

// 부모가 신호 카드 확인(읽음) 처리
export const markCareSignalRead = async (id) => {
  const response = await axios.patch(`${BASE_URL}/care-signals/${id}/read`)
  return response.data.careSignal
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
// ⚠️ 호출부 0 (2026-08-05 레포 전수 grep). '점수 이상해요' 버튼은 submitFeedback(단순 접수)을 쓴다
//    — 설계 결정: 문서/설계/KidSafe_회원_수익_아키텍처_설계.md:188.
//    GD-A1 이후 서버가 require_admin 전용 → 일반 회원 세션으로 부르면 403. 삭제하지 말 것(기록 보존).
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

// ── B4 회원 탈퇴 ─────────────────────────────────────────────
// 🔴 되돌릴 수 없다. 부르기 전에 화면이 ①"탈퇴" 입력 ②비밀번호 재확인 둘 다 통과시켜야 한다.
//    비밀번호는 여기로 넘기지 않는다 — 재확인은 Supabase 에 직접 하고, 서버는 토큰만 본다.
export const deleteAccount = async () => {
  const response = await axios.post(`${BASE_URL}/account/delete`, { confirm: "탈퇴" })
  return response.data // { ok, deleted, files, tombstones }
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















