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
