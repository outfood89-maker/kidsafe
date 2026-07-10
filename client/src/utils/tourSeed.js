// ── AD-7: 부모 '둘러보기' 예시 가족 정적 시드 ──
//   LLM 0 · 서버 0 · DB 0 · localStorage/IDB 0 (클라이언트 메모리 전용). 종료 시 흔적 0.
//   ⚠️ 아이 이름 "라온" — 심사 시드(하늘·바다)와 절대 혼동 금지(부모 화면 전용).
//   ⚠️ 모든 텍스트는 팀장 §5 스탬프 verbatim(임의 생성 금지).
//   ⚠️ 날짜는 상대계산(new Date 등) 금지 — 전부 고정 ISO 문자열(결정적·재현 가능).
//   ⚠️ imageId/drawingId 없음 → IDB(getImage) 미호출, IMAGE_PLACEHOLDER 렌더.

// 예시 가족 프로필 — 자녀설정 카드(코치마크 뒤 배경) 렌더용 필드까지 포함.
export const TOUR_PROFILE = {
  id: "tour_raon", name: "라온", age: 6, gender: "여자", avatarId: 3,
  timeLimit: 60, safetyThreshold: 80,
};

// 주간 리포트 — getCheckinReport의 d.report 소비 shape. ⚠️ patternSignal.active=true(💜 배너 발화).
export const TOUR_REPORT = {
  empty: false,
  periodStart: "2026-07-02",
  periodEnd: "2026-07-08",
  moodTimeline: [
    { checkinDate: "2026-07-02", date: "2일", mood: "good",  moodEmoji: "🙂" },
    { checkinDate: "2026-07-03", date: "3일", mood: "happy", moodEmoji: "😄" },
    { checkinDate: "2026-07-04", date: "4일", mood: "sad",   moodEmoji: "😢" },
    { checkinDate: "2026-07-05", date: "5일", mood: "good",  moodEmoji: "🙂" },
    { checkinDate: "2026-07-06", date: "6일", mood: "happy", moodEmoji: "😄" },
    { checkinDate: "2026-07-07", date: "7일", mood: "soso",  moodEmoji: "😐" },
    { checkinDate: "2026-07-08", date: "8일", mood: "good",  moodEmoji: "🙂" },
  ],
  moodSummary: {
    counts: { happy: 2, good: 3, soso: 1, sad: 1, angry: 0 },
    trend: "즐거운 날이 많았고, 속상한 날에도 마음을 잘 이야기했어요",
    note: "자기 기분을 말로 표현하는 게 조금씩 늘고 있어요.",
    // 대화의 씨앗(§5 verbatim)
    talkSeed: "라온아, 오늘 제일 즐거웠던 일 하나만 얘기해줄래?",
  },
  sharedHighlights: [
    { checkinDate: "2026-07-03", date: "3일", moodEmoji: "😄", items: ["블록으로 만든 성"] },
    { checkinDate: "2026-07-06", date: "6일", moodEmoji: "😄", items: ["놀이터 그네"] },
  ],
  // 키디의 편지(§5 verbatim)
  kiddyMessage:
    "이번 주 라온이는 즐거운 날이 많았어요. 화요일엔 속상한 일도 있었지만, 키디한테 마음을 잘 이야기해줬어요. 자기 기분을 말로 표현하는 게 조금씩 늘고 있어요.",
  patternSignal: { active: true },
  hadSecrets: false,
};

// 그림일기 4건 — 2개월 분산(6월 2 + 7월 2). 도장 3건 선반영(예시) + 1건 없음(부모 도장 체험용).
//   문장은 §5 verbatim. 도장 이모지는 diaryCopy STAMP_EMOJIS 값(❤️🌟👍)만 사용(임의 생성 아님).
export const TOUR_DIARY_ENTRIES = [
  { id: "tour_e1", date: "2026-06-20", sentences: ["오늘은 블록으로 큰 성을 만들었어요. 정말 높았어요!"], moodEmoji: "🙂", childPick: "", keptAt: "2026-06-20",
    stamp: { emoji: "❤️", letter: "", at: "2026-06-20", seenAt: "2026-06-20" } },
  { id: "tour_e2", date: "2026-06-28", sentences: ["친구랑 놀이터에서 그네를 탔어요. 재미있었어요."], moodEmoji: "😄", childPick: "", keptAt: "2026-06-28",
    stamp: { emoji: "🌟", letter: "", at: "2026-06-28", seenAt: "2026-06-28" } },
  // ⚠️ 도장 없음 — 부모가 직접 찍어보는 체험용 엔트리(③ 정거장)
  { id: "tour_e3", date: "2026-07-03", sentences: ["동생이 내 그림을 망가뜨려서 속상했어요."], moodEmoji: "😢", childPick: "", keptAt: "2026-07-03" },
  { id: "tour_e4", date: "2026-07-05", sentences: ["엄마랑 카레를 만들었어요. 맛있었어요."], moodEmoji: "🙂", childPick: "", keptAt: "2026-07-05",
    stamp: { emoji: "👍", letter: "", at: "2026-07-05", seenAt: "2026-07-05" } },
];

export const TOUR_SEED = {
  profile: TOUR_PROFILE,
  report: TOUR_REPORT,
  diaryEntries: TOUR_DIARY_ENTRIES,
};

// ── AD-7 확장: 부모 '둘러보기' 탭 데모 — 스케줄러 ──
//   ⚠️ 투어는 서버 호출 0(V1) → 이 탭들은 실데이터를 못 부른다. 시연용 정적 예시로 채운다.
//   ⚠️ SchedulePlanner에 prop으로 직접 주입(profileId 필터 무관). 날짜는 고정 ISO(2026-07·결정적).
//   ⚠️ 주혁 데모/라온 폴백과 무관한 '예시 화면' 공용(정직 배너 '예시 화면'과 일치).
//   ⚠️ 문구는 팀장 §5 스탬프 verbatim(임의 생성 금지). 4종(일정/이벤트/음식/상태) + 기간 바 1건.
export const TOUR_SCHEDULES = [
  { id: "tour_s1", date: "2026-07-08", endDate: null,         type: "상태",   title: "콧물 조금",   time: null,    memo: "아침에 재채기 — 따뜻하게 입히기" },
  { id: "tour_s2", date: "2026-07-10", endDate: null,         type: "일정",   title: "태권도",      time: "16:00", memo: "도복 챙기기" },
  { id: "tour_s3", date: "2026-07-11", endDate: null,         type: "음식",   title: "저녁 카레",   time: null,    memo: null },
  { id: "tour_s4", date: "2026-07-12", endDate: null,         type: "이벤트", title: "할머니 생신", time: "12:00", memo: null },
  { id: "tour_s5", date: "2026-07-14", endDate: "2026-07-16", type: "이벤트", title: "가족 여행",   time: null,    memo: "속초 바다" },
];
// 키디 인사말(투어 고정 — 실제론 getKiddyGreeting(Haiku)가 일정 수를 읽고 만드는 자리). 팀장 §5 verbatim.
export const TOUR_GREETING = "이번 주엔 태권도랑 가족 여행이 기다리고 있어요. 즐거운 한 주 되세요! 🌈";

// ── AD-7 확장: 부모 '둘러보기' 탭 데모 — 안전 알림 ──
//   ⚠️ 서버 0(V1): getAlerts/getAlertSettings/getCareSignals/getBlockedKeywords는 fetchData(tourMode early-return)라 미발화.
//   ⚠️ 이 탭은 인라인 섹션 → startTour가 state에 '직접 주입'(스케줄처럼 prop 아님). profileId=시드 아이 id(TOUR_PROFILE.id).
//   ⚠️ visibleAlerts/visibleCareSignals가 scopedId 필터 → 스코프 페이지선 tourMode 우회(ParentDashboard §2) 없으면 다 걸러진다.
//   ⚠️ 날짜 고정 ISO(결정적). 부모 노출 '문장'(제목/채널/차단이유/키워드)은 팀장 §7 스탬프 verbatim 확정(컨트롤타워).
//   ⚠️ 썸네일 생략(network-0): {alert.thumbnail && <img>} 가드라 필드 없으면 이미지 없이 텍스트 카드로 안전 렌더.

// 위험 영상 알림 3건 — 위험(danger) 1 + 주의(warning) 1 + 반복시청(danger·repeated) 1. read:false → 미읽음 뱃지·'전체 읽음' 노출.
export const TOUR_ALERTS = [
  { id: "tour_al1", profileId: TOUR_PROFILE.id, videoId: "tour_av1",
    title: "괴물 슬라임 먹방 - 이상한 색 도전", channelTitle: "펀펀 챌린지",
    reasons: ["과도한 먹방", "자극적 연출"],
    severity: "danger", watchedAt: "2026-07-08T20:15:00",
    watchCount: 1, repeated: false, read: false },
  { id: "tour_al2", profileId: TOUR_PROFILE.id, videoId: "tour_av2",
    title: "장난감 총 대결 배틀", channelTitle: "토이 배틀존",
    reasons: ["모방 위험", "경쟁 조장"],
    severity: "warning", watchedAt: "2026-07-07T18:40:00",
    watchCount: 1, repeated: false, read: false },
  { id: "tour_al3", profileId: TOUR_PROFILE.id, videoId: "tour_av3",
    title: "한밤중 괴담 - 화장실 귀신", channelTitle: "미스터리 나이트",
    reasons: ["공포 조장", "연령 부적합"],
    severity: "danger", watchedAt: "2026-07-06T21:05:00",
    watchCount: 3, repeated: true, read: false },
];

// 위기 관심 신호 1건(💛) — 부모에겐 '존재만' 알림. 문구는 고정 상수 PARENT_SIGNAL_MESSAGE(safetyLexicon)라 스탬프 대상 아님.
//   ⚠️ profileName 필수 — 실플로우는 fetchData가 붙이지만 투어는 직접 주입이라 시드에 미리 포함해야 childStem(sig.profileName) 동작. TOUR_PROFILE.name(=라온) 사용.
export const TOUR_CARE_SIGNALS = [
  { id: "tour_cs1", profileId: TOUR_PROFILE.id, profileName: TOUR_PROFILE.name,
    level: "high", read: false, createdAt: "2026-07-07T21:10:00" },
];

// 알림 설정 — 실데이터 잔존(부모의 실제 기준 점수) 덮기용. 전부 숫자/불리언(스탬프 아님). threshold는 TOUR_PROFILE.safetyThreshold(80)와 일치.
export const TOUR_ALERT_SETTINGS = { threshold: 80, lateNightAlert: true, lateNightHour: 22 };

// 걸러낼 키워드 — 실데이터 잔존(부모의 실제 커스텀 키워드) 덮기용. 부모 노출 '단어'라 팀장 §7 스탬프 verbatim 확정.
export const TOUR_BLOCKED_KEYWORDS = {
  system: ["폭력", "무서운"],
  custom: ["귀신", "먹방 챌린지"],
};

// ── AD-7 확장: 부모 '둘러보기' 탭 데모 — 시청 분석(history·insights·coach) ──
//   ⚠️ 투어는 서버 0(V1) → getReportInsights/getReportCoach를 못 부른다. 정적 시드로 채운다.
//   ⚠️ ParentDashboard state에 직접 주입(startTour). 컴포넌트 prop 패턴 아님(이 탭은 인라인).
//   ⚠️ 날짜는 고정 ISO(2026-07). watchedAt/weeklyTrend는 상대계산 금지(결정적).
//   ⚠️ 부모 노출 문장(title·channelTitle·coach headline/comment/sections/todos)은 팀장 §8 스탬프 verbatim 확정(컨트롤타워). 숫자·enum·라벨은 확정.

// 시청 기록/분석 공유 썸네일 플레이스홀더 — 투명 1x1 GIF(외부 GET 0·network-0). 회색 박스 위 폴백.
export const TOUR_THUMB = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

// (1) 시청 기록 5건 — ⚠️ 시청기록(⑦) 정거장과 '공유'(⑦은 재정의 말고 import 재사용). title·channelTitle 스탬프는 공용(팀장 한 벌만 채움).
export const TOUR_HISTORY = [
  { videoId: "tour_v1", profileId: "tour_raon", totalScore: 96, watchedAt: "2026-07-03T08:20:00",
    channelTitle: "동요친구 키즈", title: "가나다 노래 - 한글 배우기",
    watchSeconds: 320, thumbnail: TOUR_THUMB },
  { videoId: "tour_v2", profileId: "tour_raon", totalScore: 74, watchedAt: "2026-07-05T16:45:00",
    channelTitle: "펀펀 챌린지", title: "젤리 산더미 먹방 챌린지",
    watchSeconds: 300, thumbnail: TOUR_THUMB },
  { videoId: "tour_v3", profileId: "tour_raon", totalScore: 92, watchedAt: "2026-07-06T10:05:00",
    channelTitle: "동요친구 키즈", title: "무지개 색깔 이름 배우기",
    watchSeconds: 410, thumbnail: TOUR_THUMB },
  { videoId: "tour_v4", profileId: "tour_raon", totalScore: 88, watchedAt: "2026-07-07T18:30:00",
    channelTitle: "만들기 대장", title: "색종이로 공룡 접기",
    watchSeconds: 540, thumbnail: TOUR_THUMB },
  { videoId: "tour_v5", profileId: "tour_raon", totalScore: 62, watchedAt: "2026-07-08T09:10:00",
    channelTitle: "펀펀 챌린지", title: "한밤중 괴담 - 계단에서 생긴 일",
    watchSeconds: 260, thumbnail: TOUR_THUMB },
];

// (2) 심화 분석(서버 getReportInsights 형태). 숫자·라벨·enum 전부 확정(스탬프 아님). 스키마 완전(정밀검수 무가드 접근 크래시 방지).
export const TOUR_INSIGHTS = {
  profileScope: "tour_raon",
  totalWatched: 5,
  analyzedCount: 3,
  categoryAverages: [
    { key: "violence",      label: "폭력성",   score: 94, count: 5 },
    { key: "language",      label: "언어",     score: 90, count: 5 },
    { key: "sexual",        label: "선정성",   score: 98, count: 5 },
    { key: "scary",         label: "공포",     score: 82, count: 3 },  // 정밀분석 영상에서만 집계
    { key: "imitationRisk", label: "모방위험", score: 76, count: 3 },  // 정밀분석 영상에서만 집계
    { key: "educational",   label: "교육성",   score: 88, count: 5 },
    { key: "commercialism", label: "상업성",   score: 71, count: 3 },  // 정밀분석 영상에서만 집계
  ],
  ageFit: { fit: 3, hard: 1, unknown: 1 },              // 합=5(totalWatched)
  confidence: { high: 3, total: 5, ratio: 60 },         // ratio=round(3/5*100)
  weeklyTrend: [                                          // 7일·history 요일/점수와 정합, 빈 날 avgScore=null
    { date: "7/2", avgScore: null, count: 0 },
    { date: "7/3", avgScore: 96,   count: 1 },
    { date: "7/4", avgScore: null, count: 0 },
    { date: "7/5", avgScore: 74,   count: 1 },
    { date: "7/6", avgScore: 92,   count: 1 },
    { date: "7/7", avgScore: 88,   count: 1 },
    { date: "7/8", avgScore: 62,   count: 1 },
  ],
};

// (3) AI 코치(서버 getReportCoach의 data.coach 형태). grade/tone은 enum(확정) — 나머지 '보이는 문장'은 전부 팀장 스탬프.
export const TOUR_COACH = {
  overall: {
    grade: "양호",                          // enum(gradeStyle 인식: 좋음|양호|주의|관심필요) — 확정
    headline: "대체로 안전하게, 잘 보고 있어요",
    comment: "이번 주 라온이는 영상 다섯 편을 봤어요. 그중 세 편은 자막과 화면까지 꼼꼼히 살펴봤는데, 한글·색깔을 배우는 교육 영상이 많아 안심이었어요. 다만 자극적인 챌린지와 무서운 영상이 한두 편 섞여 있었어요.",
  },
  sections: [
    { tone: "good", title: "잘 지켜지고 있어요", comment: "폭력성·선정성·언어는 걱정 없는 수준이에요. 라온이는 배우는 영상을 특히 좋아해요.", action: "좋아하는 교육 채널을 즐겨찾기에 담아두면 다음에 찾아 보여주기 좋아요." },
    { tone: "warn", title: "조금만 함께 봐 주세요", comment: "공포와 모방위험 점수가 다른 항목보다 낮았어요. 따라 하기 쉬운 챌린지 영상의 영향으로 보여요.", action: "챌린지 영상은 곁에서 함께 보며 '이건 따라 하지 말자'고 짚어 주세요." },
    { tone: "bad",  title: "이 영상은 관심이 필요해요", comment: "'한밤중 괴담' 한 편이 안전 기준(80점) 아래로 내려갔어요. 무서운 장면이 많은 영상이에요.", action: "무서운 영상은 되도록 함께 보고, 원하시면 그 채널을 걸러낼 수 있어요." },
  ],
  todos: [
    "무서운 영상·자극적인 챌린지는 함께 보거나 걸러두기",
    "라온이가 좋아하는 교육 채널로 즐겨찾기 만들기",
    "주말에 이번 주 본 영상 함께 돌아보기",
  ],
};
