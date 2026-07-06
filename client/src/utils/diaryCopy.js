// ── 우리 그림일기 v0 — 카피 상수 (AD §7) ──
// 기준 문서: kiddy_voice/그림일기/Kiddy_그림일기_키디대본_및_그림프롬프트_v1.md (§1 대본 + §1.5 R1~R8 + §1.6 확정본)
// ⚠️ 팀장 카피 게이트 스탬프 완료본(2026-07-04) — 아래 값은 그 문서에서 복사한 verbatim. 임의 수정 금지.
// ⚠️ feature/diary-v0 브랜치 전용. 7/14 이전 main 머지 금지.

// 기능명/보관명 (§7 — 오너 pick 미결. 교체가 1줄이 되게 상수로.)
export const FEATURE_NAME = "우리 그림일기";
export const SHELF_NAME = "가족 책장";

// ① 진입 (§7-①)
export const ENTRY = {
  base: "오늘 이야기로 그림일기 만들어볼까? 내가 도와줄게! 🎨", // 버튼: 좋아! / 오늘은 안 할래
  baseYes: "좋아!",
  baseNo: "오늘은 안 할래",
  // 😢😡 변주
  sad: "오늘은 그냥 쉬어도 돼. 그래도 쓰고 싶으면, 내가 같이 할게.", // 버튼: 써볼래 / 오늘은 쉴래
  sadYes: "써볼래",
  sadNo: "오늘은 쉴래",
  declineReply: "응, 알겠어! 내일 또 물어볼게.", // 저장 0, 재촉·알림 없음
};

// 날씨 (§3 칩 + §1.6 조립 문장)
export const WEATHER_ASK = "오늘 날씨는 어땠어?";
export const WEATHER_CHIPS = [
  { key: "sunny", label: "☀️ 맑음" },
  { key: "cloudy", label: "☁️ 구름" },
  { key: "rainy", label: "🌧️ 비" },
  { key: "snowy", label: "⛄ 눈" },
  { key: "unknown", label: "모르겠어" }, // R3 — 선택 시 날씨 문장 생략
];
// 조립 문장 (§1.6 verbatim). unknown → 문장 생략(R3).
export const WEATHER_SENTENCES = {
  sunny: "오늘 날씨는 맑았어요.",
  cloudy: "오늘은 구름이 많았어요.",
  rainy: "오늘은 비가 왔어요.",
  snowy: "오늘은 눈이 왔어요.",
};

// 기분 5종 조립 문장 (§1.6 verbatim — 체크인 mood 재사용, 재질문 없음)
//   체크인 mood 이모지 키(😄🙂😐😢😡)로 매핑. 😢 "조금" 축소 금지(팀장 수정).
export const MOOD_SENTENCES = {
  "😄": "오늘 기분은 아주아주 좋았어요.",
  "🙂": "오늘 기분은 좋았어요.",
  "😐": "오늘은 그냥 그런 하루였어요.",
  "😢": "오늘은 슬픈 하루였어요.",
  "😡": "오늘은 화가 나는 일이 있었어요.",
};
// 흐린 날(😢😡) 판정용
export const SAD_MOODS = ["😢", "😡"];

// 마무리 문장 풀 (§4 R4 — 풀 구조, 최근 2회 중복 회피. v0 확정 2종)
export const CLOSING_POOL = {
  good: ["오늘도 참 좋은 하루였어요"], // 좋은 날
  sad: ["내일은 더 웃을 수 있으면 좋겠어요"], // 흐린 날(😢😡) — 소망형(미래 약속 아님)
};

// ② 2층 오늘의 질문 (대본 §1 발화문 verbatim + 설계 v2 §3 조립 + §1.6-b 칩 확정본)
//   sunnyOnly: R1 맑은 날 전용(체크인 😢😡인 날은 전천후만 회전) / minAge: 6 = 6세+ 전용(질문 6)
// ⚠️ 오프라인 우선 원칙(스탬프 조항): 재미(fun)·내일(tomorrow) 칩에 미디어 시청 활동 금지 —
//    칩이 "제일 재밌던 건 영상 보기" 일기를 유도하면 안 됨. 칩 변경 시에도 유지.
export const ROTATING_QUESTIONS = [
  { qid: "who", ask: "오늘 누구랑 제일 많이 있었어?", sunnyOnly: false, minAge: 0,
    chips: ["엄마", "아빠", "친구", "할머니·할아버지", "혼자"] }, // ✅ 스탬프 확정
  { qid: "tasty", ask: "오늘 제일 맛있었던 건 뭐야?", sunnyOnly: false, minAge: 0,
    chips: ["밥", "과일", "간식", "아이스크림"] }, // ✅ 스탬프 확정
  { qid: "fun", ask: "오늘 제일 재미있었던 순간은 언제야?", sunnyOnly: true, minAge: 0,
    chips: ["놀이터", "그림 그리기", "산책", "블록 놀이"] }, // ✅ 스탬프 확정 (오프라인 우선 — 미디어 시청 금지)
  { qid: "firstsaw", ask: "오늘 처음 본 거나 새로 안 거 있어?", sunnyOnly: false, minAge: 0,
    chips: ["곤충", "꽃", "새", "무지개"] }, // ✅ 스탬프 확정
  { qid: "thanks", ask: "오늘 고마웠던 사람 있어?", sunnyOnly: false, minAge: 0,
    chips: ["엄마", "아빠", "친구", "선생님", "할머니·할아버지"] }, // ✅ 스탬프 확정
  { qid: "sound", ask: "오늘 무슨 소리가 제일 기억나?", sunnyOnly: false, minAge: 6,
    chips: ["새", "비", "음악", "웃음"] }, // ✅ 스탬프 확정 · 6세+ 전용 (조립문 "○○ 소리가" 라 소스 명사)
  { qid: "tomorrow", ask: "내일 뭐 하고 싶어?", sunnyOnly: false, minAge: 0,
    chips: ["놀이터", "그림 그리기", "소풍", "친구 만나기"] }, // ✅ 스탬프 확정 (오프라인 우선 — 미디어 시청 금지)
  { qid: "bestdid", ask: "오늘 뭘 제일 잘했어?", sunnyOnly: true, minAge: 0,
    chips: ["정리", "인사", "양보", "심부름"] }, // ✅ 스탬프 확정
];

// AD-3 §1: 칩 '이모지 위 + 라벨 아래'(목업 .chip 문법) — 회전/그림참여 칩 라벨별 이모지(시각 전용, 라벨=스탬프 불변).
//   목업 ②가 보여주는 문법을 회전 칩 어휘 전체로 확장. 라벨에 없는 값은 이모지 생략(undefined).
export const CHIP_EMOJI = {
  // who / thanks (사람)
  "엄마": "👩", "아빠": "👨", "친구": "🧒", "선생님": "🧑‍🏫", "할머니·할아버지": "👵", "혼자": "🧍",
  // tasty
  "밥": "🍚", "과일": "🍓", "간식": "🍪", "아이스크림": "🍦",
  // fun / tomorrow (활동)
  "놀이터": "🛝", "그림 그리기": "🎨", "산책": "🚶", "블록 놀이": "🧱", "소풍": "🧺", "친구 만나기": "🧒",
  // firstsaw
  "곤충": "🐛", "꽃": "🌸", "새": "🐦", "무지개": "🌈",
  // sound
  "비": "🌧️", "음악": "🎵", "웃음": "😄",
  // bestdid
  "정리": "🧹", "인사": "👋", "양보": "🤝", "심부름": "🛍️",
};

// R2 출구 (§7-⑧ verbatim) — 모든 회전 질문 칩 끝에 상시
export const NO_ANSWER_CHIP = "음… 오늘은 없었어!";
export const NO_ANSWER_REACTION = "그런 날도 있지!";

// ③ 3층 그림 참여 (대본 §1 verbatim) — 칩은 그날 답에서 자동 생성 + 말하기. 문장 미포함(child_pick 저장만)
export const PICK_ASK = "오늘 그림에 꼭 넣고 싶은 거, 하나만 골라줘!";

// ④ 낭독 전 (§7-④ verbatim)
export const READ_INTRO = "다 됐다! 내가 읽어줄게, 들어봐~ 📖";

// ⑤ 그림 플레이스홀더 (§1.6 verbatim — 팀장 수정본)
export const IMAGE_PLACEHOLDER = "그림은 키디가 열심히 연습하고 있어! 조금만 기다려 줘 ✏️";

// ⑥ 마무리 (§7-⑥ / §1.6 v0 한정 대체 verbatim) — 자랑 분기는 v0 범위 밖
export const KEEP = {
  ask: "이 이야기, 우리 책장에 간직해 둘까?", // 버튼: 간직하기 / 안 할래
  yes: "간직하기",
  no: "안 할래",
  done: "우리 가족 책장에 잘 넣어뒀어!",
};
// 고도화 자랑 분기 복귀 시 짝맞출 완료 멘트(R7 — v0 미사용, 기록용)
export const PROUD_DONE_FUTURE = "엄마아빠한테 살짝 전해뒀어! 오늘도 이야기 들려줘서 고마워.";

// ⑦ 찢어버리기 (§7-⑦ verbatim)
export const TEAR = {
  confirm: "정말 찢을까? 찢으면 다시 볼 수 없어.", // 버튼: 응, 찢을래 / 아니야, 둘래
  yes: "응, 찢을래",
  no: "아니야, 둘래",
  done: "응, 찢었어. 괜찮아!", // 죄책감 유발 금지
};

// 위기 스크리닝 후 칩 복귀 안내 (아이 격리 금지 — 부드러운 복귀). safetyLexicon 고정응답 뒤 표시.
// ✅ 팀장 수정 스탬프 확정.
export const CRISIS_RETURN_HINT = "준비되면, 아래에서 골라도 괜찮아.";

// ── AD-2 §6: 진입 구조 5차 개정 카피 (팀장 verbatim 2026-07-05) ──
// 키즈 메인 타일 + 그림일기 홈 쓰기 버튼 + 미체크인 브릿지. 이 7개 외 아동 노출 문구 신설 금지.
export const TILE = {
  title: "📖 오늘의 그림일기", // 타일 제목(오늘 미작성)
  sub: "오늘 이야기를 그림으로 남겨봐!", // 타일 서브
  done: "오늘 일기 완성! 보러 갈까?", // 타일·홈 완료 상태
};
export const HOME_WRITE = "오늘 일기 쓰기"; // 그림일기 홈 쓰기 버튼
export const BRIDGE = {
  line: "먼저 오늘 안부부터 나눌까?", // 미체크인 브릿지 키디 대사
  go: "좋아!", // 진행 버튼 — 기존 ENTRY.baseYes 스탬프 재사용(신규 아님)
  later: "다음에 할래", // 거절 출구(팀장 신규 스탬프 2026-07-05) — 홈 복귀, 아무 기록 없음(R8 통계 미기록 = 자발 진입의 철회)
};

// ── AD-3 §6: UI 목업 정렬 카피 (목업 4컷 verbatim + 보류 기본값, 2026-07-05) ──
// §0 시각 기준의 일부로 목업 문구를 사용. 보류1(문패)·보류2(말하기)는 팀장 회신 전 기본값.
export const DIARY_TITLE = "우리 그림일기 🎨"; // 보류1 기본값(플로우 문패) — 기능명 확정 시 이 1줄 교체
export const FLOW_STOP = "‹ 그만하기";          // 플로우 헤더 좌측(목업 verbatim) = 기존 onClose 경로
export const REPLAY_HINT = "🔊 다시 듣기";       // 말풍선 아래 재발화 pill(목업 verbatim)
export const SHELF_FOOTER = "한 장 한 장이 우리 가족의 추억이 돼요"; // 가족 책장 하단 안내(목업 ④ verbatim)
// 월 카드 라벨(목업 ④ verbatim 조립): "{n}월의 이야기" · "N개의 이야기 · 쓰는 중|완성!"
export const monthBookTitle = (m) => `${Number(m)}월의 이야기`;
export const monthBookMeta = (n, isCurrent) => `${n}개의 이야기 · ${isCurrent ? "쓰는 중" : "완성!"}`;
