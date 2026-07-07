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
// ⚠️ 오프라인 우선 원칙(스탬프 조항): 재미(fun) 칩에 미디어 시청 활동 금지 —
//    칩이 "제일 재밌던 건 영상 보기" 일기를 유도하면 안 됨. 칩 변경 시에도 유지.
// AD-10 §3: 형제 호칭 성별 연동 — 남아 '형·누나' / 여아 '오빠·언니'(팀장 스탬프). who·thanks 공용.
//   ROTATING_QUESTIONS는 정적이라 자리표시자(sentinel)를 넣고 렌더 시 profile.gender로 치환(resolveChips).
export const SIBLING = "__sibling__";
export const siblingLabel = (gender) => (gender === "여자" ? "오빠·언니" : "형·누나");
export const resolveChips = (chips, gender) =>
  (chips || []).map((c) => (c === SIBLING ? siblingLabel(gender) : c));

// AD-10 §3: 회전질문 칩 풀 확충 — 4~7세 일상 빈출어(팀장 스탬프 verbatim, 순서 고정). 결합칩 폐기·조부모 2칩 분리·형제 성별연동·혼자=하단 단독.
export const ROTATING_QUESTIONS = [
  { qid: "who", ask: "오늘 누구랑 제일 많이 있었어?", sunnyOnly: false, minAge: 0,
    chips: ["엄마", "아빠", "친구", "동생", SIBLING, "할머니", "할아버지", "선생님"], solo: "혼자" }, // 8칩 + 혼자=그리드 밖 하단 단독(정서 신호)
  { qid: "tasty", ask: "오늘 제일 맛있었던 건 뭐야?", sunnyOnly: false, minAge: 0,
    chips: ["밥", "과일", "간식", "아이스크림", "고기", "김밥", "치킨"] }, // 7칩
  { qid: "fun", ask: "오늘 제일 재미있었던 순간은 언제야?", sunnyOnly: true, minAge: 0,
    chips: ["놀이터", "그림 그리기", "산책", "블록 놀이", "숨바꼭질", "술래잡기", "소꿉놀이"] }, // 7칩 (오프라인 우선 — 미디어 시청 금지 유지)
  { qid: "firstsaw", ask: "오늘 처음 본 거나 새로 안 거 있어?", sunnyOnly: false, minAge: 0,
    chips: ["곤충", "꽃", "새", "무지개", "강아지", "달팽이", "별"] }, // 7칩
  { qid: "thanks", ask: "오늘 고마웠던 사람 있어?", sunnyOnly: false, minAge: 0,
    chips: ["엄마", "아빠", "친구", "선생님", "할머니", "할아버지", "동생", SIBLING] }, // 8칩
  { qid: "sound", ask: "오늘 무슨 소리가 제일 기억나?", sunnyOnly: false, minAge: 6,
    chips: ["새", "비", "음악", "웃음", "강아지", "매미", "청소기"] }, // 7칩 · 6세+ 전용 (조립문 "○○ 소리가" 라 소스 명사)
  // tomorrow(내일 하고 싶은 것) 제외 — 그림일기=오늘의 기록(팀장 승인 7/6). 회전 풀=today 계열 7종.
  { qid: "bestdid", ask: "오늘 뭘 제일 잘했어?", sunnyOnly: true, minAge: 0,
    chips: ["정리", "인사", "양보", "심부름", "양치", "손 씻기", "나눔"] }, // 7칩
];

// AD-3 §1: 칩 '이모지 위 + 라벨 아래'(목업 .chip 문법) — 회전/그림참여 칩 라벨별 이모지(시각 전용, 라벨=스탬프 불변).
//   목업 ②가 보여주는 문법을 회전 칩 어휘 전체로 확장. 라벨에 없는 값은 이모지 생략(undefined).
export const CHIP_EMOJI = {
  // who / thanks (사람) — AD-10 §3: 조부모 2칩 분리·동생·형제(성별연동 치환 라벨) 추가. 결합키 "할머니·할아버지"는 존치(미사용·무해)
  "엄마": "👩", "아빠": "👨", "친구": "🧒", "선생님": "🧑‍🏫", "할머니·할아버지": "👵", "혼자": "🧍",
  "동생": "🧒", "형·누나": "🧑", "오빠·언니": "🧑", "할머니": "👵", "할아버지": "👴",
  // tasty — AD-10 §3 추가: 고기·김밥·치킨
  "밥": "🍚", "과일": "🍓", "간식": "🍪", "아이스크림": "🍦", "고기": "🍖", "김밥": "🍙", "치킨": "🍗",
  // fun (활동) — AD-10 §3 추가: 숨바꼭질·술래잡기·소꿉놀이
  "놀이터": "🛝", "그림 그리기": "🎨", "산책": "🚶", "블록 놀이": "🧱", "숨바꼭질": "🙈", "술래잡기": "🏃", "소꿉놀이": "🍳",
  // firstsaw — AD-10 §3 추가: 강아지·달팽이·별
  "곤충": "🐛", "꽃": "🌸", "새": "🐦", "무지개": "🌈", "강아지": "🐕", "달팽이": "🐌", "별": "⭐",
  // sound — AD-10 §3 추가: 매미·청소기 (강아지·새·비는 공유)
  "비": "🌧️", "음악": "🎵", "웃음": "😄", "매미": "🦗", "청소기": "🧽",
  // bestdid — AD-10 §3 추가: 양치·손 씻기·나눔
  "정리": "🧹", "인사": "👋", "양보": "🤝", "심부름": "🛍️", "양치": "🪥", "손 씻기": "🧼", "나눔": "💝",
};

// R2 출구 (§7-⑧ verbatim) — 모든 회전 질문 칩 끝에 상시
export const NO_ANSWER_CHIP = "음… 오늘은 없었어!";
export const NO_ANSWER_REACTION = "그런 날도 있지!";

// ── AD-10 §3: 음성 되묻기 리추얼 카피 (팀장 스탬프 verbatim 2026-07-07) ──
// '음성 = 말로 고르는 칩' — 매칭된 칩만 되물어 확정. raw 자유텍스트 유입 폐기. ○○=매핑 칩 라벨만.
export const REASK = {
  // 날씨 되물음 4종(키별). unknown은 되묻지 않음(음성 미매칭으로 처리 → 재시도)
  weather: {
    sunny: "오, 해가 쨍쨍했구나?",
    cloudy: "오, 구름이 많았구나?",
    rainy: "오, 비가 왔구나?",
    snowy: "오, 눈이 왔구나?",
  },
  ask: (label) => `${label}! 맞아?`, // 질문·그림참여 틀 — label=매핑된 칩 라벨(raw 음성 아님)
  yes: "응, 맞아!",
  no: "아니야, 다시!",
  retry: "그럼 다시 말해줄래?",        // '아니야, 다시!' 또는 미매칭 시
  fallback: "그럼 손가락으로 골라볼까?", // '다시' 2회 실패 → 칩 폴백
};

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

// ⑦ 지우기 (§7-⑦ → AD-9 §2.5: '찢다'의 폭력적 어감 폐기 → '지우기'. export명 TEAR 유지·값만 교체)
export const TEAR = {
  confirm: "이 일기를 지울까요?", // 버튼: 응, 지울래 / 아니야, 둘래
  desc: "한 번 지우면 되돌릴 수 없어요.", // AD-9 §2.5 신규 — 삭제의 무게(정직한 되물음)
  yes: "응, 지울래",
  no: "아니야, 둘래",
  done: "응, 지웠어. 괜찮아!", // 죄책감 유발 금지
};

// AD-9 §2: 부모(오너) 삭제 확인 — 가족 책장 그리드 '수정' 모드 전용. 아이용 TEAR와 분리('아이가 만든' 무게 문구).
export const SHELF_DELETE = {
  confirm: "이 일기를 지울까요?",
  desc: "아이가 직접 만든 일기예요. 한 번 지우면 되돌릴 수 없어요.", // ⚠️ 팀장 스탬프 verbatim — 변경 금지
  yes: "지우기",
  no: "취소",
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

// ── AD-4 §5: 방 인사 초대 변주 (팀장 verbatim 2026-07-05) ──
// "의무 금지, 유혹 환영" — 촉구·죄책감·숫자 압박 없음. 이 3개 외 신규 아동 노출 문구 0.
export const ROOM_INVITE = {
  line: "안녕! 나 오늘 너의 이야기가 궁금해. 그림일기 만들러 갈까?", // 신규 스탬프
  go: "좋아!",       // 기존 ENTRY.baseYes 스탬프 재사용
  later: "나중에",    // 신규 스탬프(팀장 버튼 지정) — 방 기능 정상 진행, 아무 기록 없음
};

// ── AD-5 §5: 그림 파이프라인 카피 (전부 기확정 verbatim — 대본 §1 + 팀장 지시) ──
// (a) 대기연출 3단 순차 (일반 생성 공통, AD-5 시정 §5 팀장 스탬프 verbatim). ~5초마다 다음 단, 마지막 단 고정.
export const WAIT_SEQ = ["키디가 크레용을 골랐어! 🖍", "쓱쓱… 열심히 그리는 중이야", "거의 다 됐어!"];
export const IMG_WAIT = "이제 키디가 그림을 그릴게. 잠깐만 기다려 줘! ✏️";           // 대본 §1 (폴백/존치)
export const IMG_DONE = "짜잔! 오늘의 그림이야!";                                    // 대본 §1
export const IMG_FAIL = "오늘은 그림이 잘 안 그려졌어. 이야기만 먼저 간직해 둘게! 그림은 다음에 다시 그려볼게."; // 대본 §1
export const REGEN = { btn: "🎨 그림 다시 그려줘" };                                 // 팀장 지시
export const REGEN_OUT = "오늘은 그림을 다 그렸어! 내일 또 그려줄게.";                 // 팀장 지시(하루 2회 소진 시)
export const REMAKE = {
  btn: "다시 만들래",                                        // 팀장 지시
  confirm: "지금 일기는 사라지고, 처음부터 다시 만들어! 괜찮아?", // 팀장 지시(선삭제를 정직하게 고지)
  yes: "응, 다시 만들래!",
  no: "아니야, 그대로 둘래",
};

// ── AD-8 §4: 이어 그리기 카피 (팀장 스탬프 verbatim 2026-07-06) ──
// 협업 프레임(대체 아님)·아이 최종 선택권·원본/완성본 병치(설계 v2 §6-4 원칙 3). 이 표 외 신규 아동 노출 문구 0.
export const CONTINUE_CHIP = {
  ai: "키디가 그려줘!",                             // 기존 AD-5 경로(키디 단독 생성)
  me: "🖍 내가 그리고, 키디가 이어 그려줘!",         // 캔버스 진입(이어 그리기)
};
export const DOODLE_DONE_BTN = "다 그렸어!";         // 캔버스 완료 버튼
export const CONTINUE_DONE = "네 그림을 보고 키디가 이어서 그렸어!";
export const CONTINUE_PICK = {
  ask: "어떤 그림을 실을까?",                        // 아이 최종 선택권
  mine: "내 그림",
  both: "키디랑 같이 그린 그림",
};
export const CONTINUE_FAIL = "오늘은 네 그림 그대로 담았어!"; // 생성 실패 → 아이 원본 채택(실패를 실패로 안 보임)
// 전용 4단 대기연출 — WAIT_SEQ(일반 3단) 앞에 '들여다보는' 단을 더한 확장. 첫 단이 협업 프레임의 연출판(핵심).
export const CONTINUE_WAIT_SEQ = [
  "키디가 네 그림을 한참 들여다보고 있어… 👀",
  "키디가 크레용을 골랐어! 🖍",
  "쓱쓱… 열심히 그리는 중이야",
  "거의 다 됐어!",
];
