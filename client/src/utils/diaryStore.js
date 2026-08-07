// ── 우리 그림일기 v0 — 저장 계층 (AD §6) ──
// v0 = localStorage. 서버·DB 무접촉(오너 SQL 0). 고도화 머지 시 Supabase 테이블+라우터로 교체 전제.
//   → 교체 시 이 파일의 함수 시그니처만 유지하고 내부를 async DB 호출로 바꾸면 됨(호출부 무변경 목표).
// 불변식(§6): ①'간직' 선택분만 저장 ②음성 원문(transcript) 미저장 ③위기 텍스트 유입 없음
//   ④찢기=페이지 단위 즉시 완전 삭제(복구 불가) ⑤배지·보상·알림 연결 금지.
// ⚠️ feature/diary-v0 브랜치 전용.

// GD-8a: 서버(Supabase) 정본 + 로컬 캐시 구조 도입. 읽기는 동기 캐시 그대로(호출부 28곳 무변경),
//        쓰기만 캐시→서버 push. DIARY_SERVER=false 동안 동작은 v0과 100% 동일.

import { ROTATING_QUESTIONS } from "./diaryCopy"; // AD-4 §4: getTodayQuestion 선정 풀(단방향 의존)
import { deleteImage, getImage } from "./diaryImageStore"; // AD-5: 찢기 시 IDB 이미지 완전삭제 / GD-8a: push 시 원본 읽기
import { deleteAudio, getAudio } from "./diaryAudioStore"; // B08a: 음성 편지 orphan·완전삭제 / GD-8a: push 시 음성 읽기
import { uploadImageAsset, uploadAudioAsset, primeAssetUrls } from "./diaryAssets"; // GD-8a
import {
  getDiaryEntries, postDiaryEntry, patchDiaryImage, patchDiaryStamp,
  patchDiaryStampSeen, getDiaryMeta, putDiaryMeta,
  deleteDiaryEntry, // GD-8b
} from "./api"; // GD-8a

// AD-2 §1: 그림일기 진입 플래그·날짜 헬퍼 단일 소스(승격). DailyCheckin·KidHome·FamilyShelf가 모두 여기서 import.
//   → main엔 이 브랜치 diff가 없어야 하므로 플래그로 신규 UI 전체를 게이트한다.
export const DIARY_V0 = true;
// GD-8a: 서버 저장 게이트. 🔴 GD-8b(삭제 경로) 완료 + 오너 승인 전까지 false 고정 —
//   찢기가 서버에 관철되지 않으면 불변식④가 깨진다(아이가 찢은 일기가 서버에 남는다).
export const DIARY_SERVER = false;
// 오늘 날짜(KST, YYYY-MM-DD) — 날짜 계산 중복 신설 금지, 신규 3곳(타일·홈·브릿지) 모두 이것만 사용.
export const todayKST = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });

const ENTRIES_KEY = (pid) => `diary_v0_${pid}`;
const META_KEY = (pid) => `diary_v0_meta_${pid}`;

const readJson = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};
const writeJson = (key, val) => {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
    /* 저장 실패는 조용히 무시 — v0은 로컬 전용 */
  }
};

const defaultMeta = () => ({ recentQids: [], recentClosings: [], rejectStreak: 0, lastProposalDate: null, todayQ: null, teaserDate: null, regen: null, continueUsed: null, pendingContinue: null });
const getMeta = (pid) => ({ ...defaultMeta(), ...readJson(META_KEY(pid), {}) });
// GD-8a: 캐시 기록은 그대로(동기). 서버 push 는 400ms 디바운스 — recordQid·recordRegen·recordShelfVisit 등
//   고빈도 호출부가 많아 매번 올리면 왕복이 폭증한다. 마지막 값만 올리면 충분하다(메타는 상태 스냅샷).
const setMeta = (pid, meta) => { writeJson(META_KEY(pid), meta); if (DIARY_SERVER) queueMetaPush(pid, meta); };

// ── 엔트리 (일기 페이지) ──
export const getEntries = (pid) => readJson(ENTRIES_KEY(pid), []);

// ⚠️ 저장물 = { id, date, sentences[], moodEmoji, childPick, keptAt } 만. transcript 등 원문 금지(불변식②③).
//   AD-8: imageId(채택본)·drawingId(원본 낙서)는 선택 필드 — 있을 때만(직렬화 불변식 유지).
export function saveEntry(pid, entry) {
  const entries = getEntries(pid);
  const clean = {
    id: entry.id,
    date: entry.date,
    sentences: Array.isArray(entry.sentences) ? entry.sentences : [],
    moodEmoji: entry.moodEmoji || "",
    childPick: entry.childPick || "",
    keptAt: entry.keptAt,
  };
  if (entry.imageId) clean.imageId = entry.imageId; // AD-5: 그림 있을 때만(선택 필드)
  if (entry.drawingId) clean.drawingId = entry.drawingId; // AD-8: 이어 그린 그림 채택 시 원본 낙서도 함께 보관(원칙③ 병치)
  if (entry.imgSource) clean.imgSource = entry.imgSource; // AD-8b §3b: "ai"|"continue"|"mine" — regen 게이트 판정(mine/failadopt는 AI 덮어쓰기 미제안)
  // B08b: 아이가 직접 남긴 음성 메모(선택 필드). entry.voiceId=diaryAudioStore key, voiceMs=재생 바 분모(webm duration=Infinity 회피).
  //   ⚠️ stamp.voiceId(부모 음성 편지)와 별개 축 — 한 엔트리에 아이 메모 + 부모 편지가 공존 가능. STT 없음(음성 그대로) → 위기 텍스트 스크리닝 비적용(아이 '작품 일부', 대화 아님).
  if (entry.voiceId) clean.voiceId = entry.voiceId;
  if (entry.voiceMs) clean.voiceMs = entry.voiceMs;
  entries.push(clean);
  writeJson(ENTRIES_KEY(pid), entries);
  // GD-8a: 캐시에 먼저 쓰고(위) 서버로는 뒤늦게 밀어 올린다. ⚠️ async 로 바꾸지 말 것 —
  //   이 함수의 동기 반환에 호출부가 의존한다. void = 응답을 기다리지 않는다(아이가 느끼는 지연 0).
  if (DIARY_SERVER) { void pushEntryToServer(pid, clean); }
  return clean;
}

// 찢기 — 페이지 단위 즉시 완전 삭제(AD5, 복구 불가). 부모 삭제 기능 없음. AD-5/AD-8: IDB 이미지(완성본+원본) 함께 삭제.
export function tearEntry(pid, entryId) {
  const all = getEntries(pid);
  const torn = all.find((e) => e.id === entryId);
  writeJson(ENTRIES_KEY(pid), all.filter((e) => e.id !== entryId));
  if (torn?.imageId) { try { deleteImage(torn.imageId); } catch { /* 무시 */ } } // 채택본 완전삭제
  if (torn?.drawingId) { try { deleteImage(torn.drawingId); } catch { /* 무시 */ } } // AD-8: 원본 낙서도 완전삭제
  if (torn?.stamp?.voiceId) { try { deleteAudio(torn.stamp.voiceId); } catch { /* 무시 */ } } // B08a: 부모 음성 편지도 완전삭제(모든 삭제 경로=tearEntry로 수렴: doTear·doShelfDelete·doRemake)
  if (torn?.voiceId) { try { deleteAudio(torn.voiceId); } catch { /* 무시 */ } } // B08b: 아이 음성 메모도 완전삭제(orphan 0 — 부모 편지와 별개 축)
  // GD-8b: 서버에서도 지운다. ⚠️ 위 5줄은 한 글자도 안 바뀌었다 —
  //   서버 이전 뒤에도 **과거 기기의 잔존물을 지우는 유일한 코드**라 그대로 살아 있어야 한다.
  //   ⚠️ tearEntry 를 async 로 만들지 않는다 — 호출부 3곳(FamilyShelf:215,224,295)이
  //      setEntries 로 즉시 화면을 갱신하는 UX 에 의존한다. 아이는 기다리면 안 된다.
  if (DIARY_SERVER) { void deleteEntryOnServer(pid, entryId); }
}

// ── 회전 질문 dedup (최근 3일 사용 qid 회피) ──
export const getRecentQids = (pid) => getMeta(pid).recentQids.map((r) => r.qid);
export function recordQid(pid, qid, date) {
  const meta = getMeta(pid);
  meta.recentQids = [{ qid, date }, ...meta.recentQids.filter((r) => r.qid !== qid)].slice(0, 3); // 최근 3
  setMeta(pid, meta);
}

// ── 마무리 문장 최근 2회 회피 (R4) ──
export const getRecentClosings = (pid) => getMeta(pid).recentClosings;
export function recordClosing(pid, closing) {
  const meta = getMeta(pid);
  meta.recentClosings = [closing, ...meta.recentClosings.filter((c) => c !== closing)].slice(0, 2);
  setMeta(pid, meta);
}

// ── 진입 빈도 (R5 진입조건 + R8 거절 하향) ──
const daysBetween = (a, b) => {
  if (!a || !b) return Infinity;
  const ms = new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`);
  return Math.round(ms / 86400000);
};
// rejectStreak → 제안 간격(일). <3 매일 / 3~6 격일(2) / 7+ 주2회(≈3)
const gapForStreak = (streak) => (streak >= 7 ? 3 : streak >= 3 ? 2 : 1);

// 오늘 일기 제안을 띄울지 (R5: 당일 체크인 완료 필수 + R8 빈도)
export function shouldProposeToday(pid, today, checkinDone) {
  if (!checkinDone) return false; // R5 — 체크인 미완료면 제안 자체 없음
  const meta = getMeta(pid);
  if (meta.lastProposalDate === today) return false; // 오늘 이미 제안함
  const gap = gapForStreak(meta.rejectStreak);
  if (meta.lastProposalDate && daysBetween(meta.lastProposalDate, today) < gap) return false; // R8 빈도 미달
  return true;
}

// 제안을 실제로 띄운 날 기록 (하루 1회 게이트)
export function markProposed(pid, today) {
  const meta = getMeta(pid);
  meta.lastProposalDate = today;
  setMeta(pid, meta);
}

// 제안 결과 반영 — accepted=false('안 할래') → 거절 streak++ / accepted=true(썼음) → streak 리셋
export function recordProposalResult(pid, accepted) {
  const meta = getMeta(pid);
  meta.rejectStreak = accepted ? 0 : (meta.rejectStreak || 0) + 1;
  setMeta(pid, meta);
}

// ── AD-4 §4: '오늘의 질문' 하루 고정 선정 (티저↔플로우 일치, "사실은 코드가" 계보) ──
//   isSad: true(흐림)·false(맑음)·undefined(무드 미상=티저). 결과를 meta.todayQ에 고정 → 같은 날 재호출 시 동일 qid.
//   선정은 결정적(날짜+pid 시드) — 랜덤 제거로 티저·재진입·플로우가 완전히 일치.
export function getTodayQuestion(pid, { age = 7, isSad } = {}) {
  const today = todayKST();
  const meta = getMeta(pid);
  const agePool = ROTATING_QUESTIONS.filter((q) => age >= q.minAge); // 연령 필터(Q6 6세+)
  const passes = (qid) => {
    const q = agePool.find((x) => x.qid === qid);
    if (!q) return false;
    if (isSad && q.sunnyOnly) return false; // R1: 흐린 날 sunnyOnly 제외
    return true;
  };
  // 오늘 이미 고정된 질문이 현재 필터를 통과하면 그대로(재진입·플로우 일치)
  if (meta.todayQ && meta.todayQ.date === today && passes(meta.todayQ.qid)) {
    return agePool.find((x) => x.qid === meta.todayQ.qid);
  }
  // 재선정: 흐림 또는 무드 미상(티저) → sunnyOnly 제외(R1/안전) · 맑음(isSad===false) → 전체
  const selectPool = isSad === false ? agePool : agePool.filter((q) => !q.sunnyOnly);
  const recent = getRecentQids(pid);
  const fresh = selectPool.filter((q) => !recent.includes(q.qid));
  const pool = fresh.length ? fresh : selectPool;
  // ⚠️ fresh[0] 고정 선택 금지 — 최근3 dedup과 결합하면 배열 앞 4종만 영원히 순환(뒤 질문 기아, 회전 8종 취지 위반).
  //    날짜+pid 시드 결정적 선택: 하루 고정·티저 일치 성질은 유지하면서 날마다 인덱스가 움직여 전 질문 커버. (컨트롤타워 리뷰 수정)
  const seed = [...`${pid}_${today}`].reduce((a, c) => a + c.charCodeAt(0), 0);
  const chosen = pool[seed % pool.length] || agePool[0] || ROTATING_QUESTIONS[0];
  if (chosen) { meta.todayQ = { date: today, qid: chosen.qid }; setMeta(pid, meta); }
  return chosen;
}

// AD-4 §4: 티저 노출 날짜 (하루 1회 게이트 — 표시 즉시 기록, 유일 기준)
export const getTeaserDate = (pid) => getMeta(pid).teaserDate;
export function markTeaserShown(pid, today) {
  const meta = getMeta(pid);
  meta.teaserDate = today;
  setMeta(pid, meta);
}

// AD-5 §2: 저장된 엔트리에 뒤늦게 그림 연결(최초 생성 실패 복구=책장 재시도). 없으면 무시.
export function setEntryImage(pid, entryId, imageId) {
  const entries = getEntries(pid);
  const e = entries.find((x) => x.id === entryId);
  if (e) {
    e.imageId = imageId; writeJson(ENTRIES_KEY(pid), entries);
    if (DIARY_SERVER) void pushEntryImageToServer(pid, entryId, imageId); // GD-8a
  }
}

// ── AD-5 §3: 그림 다시 그리기 하루 2회 한도 (meta.regen {date,count}, 날짜 바뀌면 리셋) ──
export const REGEN_MAX = 2;
export function getRegenLeft(pid, today) {
  const r = getMeta(pid).regen;
  const used = r && r.date === today ? (r.count || 0) : 0;
  return Math.max(0, REGEN_MAX - used);
}
export function recordRegen(pid, today) {
  const meta = getMeta(pid);
  const r = meta.regen;
  const used = r && r.date === today ? (r.count || 0) : 0;
  meta.regen = { date: today, count: used + 1 };
  setMeta(pid, meta);
}

// 가족 책장 자발 방문 → 기본 빈도 복귀 (R8)
export function recordShelfVisit(pid) {
  const meta = getMeta(pid);
  meta.rejectStreak = 0;
  setMeta(pid, meta);
}

// ── AD-8 §0-3: 이어 그리기 하루 1회 한도 (regen 2회와 별도 쿼터). meta.continueUsed {date,count} ──
//   ⚠️ 소비는 '간직(채택) 시'에만(recordContinue) — 이탈/미간직은 미소비·같은 날 재시도 가능(하루1회 헛소비 금지, 팀장 확정 ①).
export const CONTINUE_MAX = 1;
export function getContinueLeft(pid, today) {
  const c = getMeta(pid).continueUsed;
  const used = c && c.date === today ? (c.count || 0) : 0;
  return Math.max(0, CONTINUE_MAX - used);
}
export function recordContinue(pid, today) {
  const meta = getMeta(pid);
  const c = meta.continueUsed;
  const used = c && c.date === today ? (c.count || 0) : 0;
  meta.continueUsed = { date: today, count: used + 1 };
  setMeta(pid, meta);
}

// ── AD-8b: 대기 중 이탈 → 완성본 보존(pendingContinue). 채택 재료 최소만(위기 텍스트·transcript 금지, 불변식 유지) ──
//   { id, date, drawingId, imageId, sentences[], childPick, moodEmoji }. 채택/안볼래/만료 시 clear.
export const getPendingContinue = (pid) => getMeta(pid).pendingContinue;
export function setPendingContinue(pid, pc) {
  const meta = getMeta(pid);
  const prev = meta.pendingContinue;
  // AD-8b: 같은 날 2차 이탈 등으로 미해결 이전 pending을 덮어쓸 때 그 orphan IDB(완성본·원본) 삭제 — blob 누수 방지(적대리뷰 발견)
  if (prev && prev !== pc) { if (prev.imageId) { try { deleteImage(prev.imageId); } catch { /* 무시 */ } } if (prev.drawingId) { try { deleteImage(prev.drawingId); } catch { /* 무시 */ } } }
  meta.pendingContinue = pc;
  setMeta(pid, meta);
}
export function clearPendingContinue(pid) {
  const meta = getMeta(pid);
  meta.pendingContinue = null;
  setMeta(pid, meta);
}
// AD-8b-FIX(HIGH): pending 폐기 = orphan IDB(완성본·원본) 삭제 + meta clear를 한 번에.
//   dismissReturn('안 볼래')·만료 청소·keep(새 일기 완성 시 미해결 pending 폐기) 공용 진입점(DRY).
export function discardPendingContinue(pid) {
  const pc = getPendingContinue(pid);
  if (pc) {
    if (pc.imageId) { try { deleteImage(pc.imageId); } catch { /* 무시 */ } }
    if (pc.drawingId) { try { deleteImage(pc.drawingId); } catch { /* 무시 */ } }
  }
  clearPendingContinue(pid);
}

// ── AD-6: 부모 도장·편지 (entry 선택 필드 stamp). 사후 setStamp로만 설정 — saveEntry 저장경로 무접촉 ──
//   stamp: { emoji, letter, at, seenAt }. entry에 얹히므로 tearEntry(통삭제) 시 함께 소멸(아이 삭제권 우선, 불변식④).
//   ⚠️ 배지·보상·평가 연결 금지(§0-3). letter는 부모→아이 방향(비밀채널 무침식).
export function setStamp(pid, entryId, { emoji, letter, voiceId, voiceMs } = {}) {
  const entries = getEntries(pid);
  const e = entries.find((x) => x.id === entryId);
  if (!e) return; // 없는 entryId면 무시
  const prevVoiceId = e.stamp?.voiceId; // B08a: 재도장 orphan 방지용 이전 값 보관
  // 변경=덮어쓰기: at 갱신·seenAt 리셋(재도장 시 아이에게 다시 '미확인'으로). letter 30자 방어(UI maxLength와 별개).
  e.stamp = { emoji: emoji || "", letter: String(letter || "").slice(0, 30), at: todayKST(), seenAt: null };
  if (voiceId) e.stamp.voiceId = voiceId; // B08a: 음성 편지 참조(있을 때만 — 직렬화 불변식 유지)
  if (voiceMs) e.stamp.voiceMs = voiceMs; // B08a: 실측 녹음 길이(재생 바 분모 — webm duration=Infinity 회피)
  writeJson(ENTRIES_KEY(pid), entries);
  // B08a: 옛 음성 orphan 삭제 — 새 voiceId와 다르거나(재녹음) 음성 제거 시. fire-and-forget(diaryStore async 방지).
  if (prevVoiceId && prevVoiceId !== voiceId) { try { deleteAudio(prevVoiceId); } catch { /* 무시 */ } }
  if (DIARY_SERVER) void pushStampToServer(pid, entryId, e.stamp); // GD-8a
}
// 아이가 상세를 열어 확인 → seenAt 기록(알림 자연 소멸용).
export function markStampSeen(pid, entryId) {
  const entries = getEntries(pid);
  const e = entries.find((x) => x.id === entryId);
  if (e && e.stamp) {
    e.stamp.seenAt = todayKST(); writeJson(ENTRIES_KEY(pid), entries);
    if (DIARY_SERVER) void pushStampSeenToServer(pid, entryId); // GD-8a
  }
}
// 미확인 도장 목록(도장 있고 seenAt 없음) → 아이 홈 알림 분기(도장만 vs 편지 vs 음성). B08a: hasVoice 파생 추가(음성 최우선).
export function getUnseenStamps(pid) {
  return getEntries(pid)
    .filter((e) => e.stamp && !e.stamp.seenAt)
    .map((e) => ({ entryId: e.id, hasLetter: !!(e.stamp.letter && e.stamp.letter.trim()), hasVoice: !!e.stamp.voiceId }));
}

// ══════════════════════════════════════════════════════════════════════
// GD-8a: 서버 동기화 (DIARY_SERVER=false 인 동안 아래 전부 호출되지 않는다)
// ══════════════════════════════════════════════════════════════════════
// ⚠️ 전 함수 async + try-catch, **절대 throw 하지 않는다.** 캐시에는 이미 저장돼 있으므로
//    서버가 실패해도 아이 일기는 안전하다. 여기서 예외가 올라가면 멀쩡한 저장 흐름이 깨진다.
// ⚠️ 위쪽 동기 함수들의 시그니처는 한 글자도 바뀌지 않았다 — 호출부 28곳 무변경(§0-3).

/** 🚨 불변식① 관철 지점 — 업로드는 여기서만 일어난다.
 *
 *  putImage/putAudio 에 업로드를 붙이지 않은 이유가 이것이다: 그 함수들은 **아이가 간직하기 전**에도
 *  불린다(AI 그림 생성 직후 DiaryFlow.jsx:340, 이탈 보존 pendingContinue :380-381).
 *  거기 붙이면 **아이가 버린 그림이 서버로 샌다.**
 *  이 함수는 엔트리에 실제로 얹힌 id 만 알고 있으므로 '간직된 것'만 올라간다 — 구조로 강제된다.
 */
export async function pushEntryToServer(pid, entry) {
  try {
    if (!DIARY_SERVER || !pid || !entry?.id) return;
    // ① 그림 — 완성본과 원본 낙서
    if (entry.imageId) {
      const data = await getImage(entry.imageId);
      // imgSource==="mine" 이면 아이가 직접 그린 것 → role=drawing
      if (data) await uploadImageAsset(pid, entry.imageId, data, entry.imgSource === "mine" ? "drawing" : "completed");
    }
    if (entry.drawingId) {
      const data = await getImage(entry.drawingId);
      if (data) await uploadImageAsset(pid, entry.drawingId, data, "drawing");
    }
    // ② 음성 — 아이 메모 / 부모 편지
    if (entry.voiceId) {
      const blob = await getAudio(entry.voiceId);
      if (blob) await uploadAudioAsset(pid, entry.voiceId, blob, "memo");
    }
    if (entry.stamp?.voiceId) {
      const blob = await getAudio(entry.stamp.voiceId);
      if (blob) await uploadAudioAsset(pid, entry.stamp.voiceId, blob, "letter");
    }
    // ③ 엔트리 본문
    await postDiaryEntry({ profileId: pid, ...entry });
  } catch { /* 캐시가 정본 역할을 계속한다. 다음 hydrate 가 재푸시한다. */ }
}

// 소량 복구 상한 — 이보다 많으면 '이사'의 영역이다(부모 화면 엔진이 진행률을 보여주며 처리).
//   여기서 수십 편을 밀어 올리면 아이가 책장을 여는 동안 앱이 느려진다.
const REPUSH_MAX = 3;

/** 밀린 엔트리를 **한 편씩 순차로** 올린다. 동시 발사 금지(용량이 크다). */
async function repushSequentially(pid, entries) {
  for (const e of entries) {
    try { await pushEntryToServer(pid, e); }
    catch { /* 다음 진입 때 다시 시도 */ }
  }
}

async function pushEntryImageToServer(pid, entryId, imageId) {
  try { await patchDiaryImage(entryId, { profileId: pid, imageId: imageId || null }); }
  catch { /* 무시 */ }
}

async function pushStampToServer(pid, entryId, stamp) {
  try { await patchDiaryStamp(entryId, { profileId: pid, stamp: stamp || null }); }
  catch { /* 무시 */ }
}

async function pushStampSeenToServer(pid, entryId) {
  try { await patchDiaryStampSeen(entryId, { profileId: pid }); }
  catch { /* 무시 */ }
}

// 메타 push 디바운스 — 프로필별 타이머. 마지막 값만 올린다.
const metaTimers = {};
function queueMetaPush(pid, meta) {
  try {
    if (!DIARY_SERVER || !pid) return;
    clearTimeout(metaTimers[pid]);
    metaTimers[pid] = setTimeout(() => {
      // 🚨 pendingContinue(미채택물)는 올리지 않는다 — 불변식①. 서버도 한 번 더 거른다(이중 방어).
      const { pendingContinue, ...clean } = meta || {};
      void putDiaryMeta({ profileId: pid, data: clean }).catch(() => {});
    }, 400);
  } catch { /* 무시 */ }
}

/** 서버 → 로컬 캐시 채우기. 책장 진입 시 호출(§1-10, 2곳).
 *
 *  병합 규칙: 키는 entry.id.
 *    · 양쪽에 있으면 **서버 우선**(다른 기기에서 고친 게 이깁니다)
 *    · 서버에만 있으면 캐시에 추가 (= 기기 교체 후 복구)
 *    · 🔴 **로컬에만 있는 것은 지우지 않는다.** 지난 세션에서 push 가 실패한 것일 수 있으므로
 *      남겨두고 재푸시한다. "서버에 없으니 지운다"로 만들면 유실이 조용히 일어난다.
 */
export async function hydrateDiary(pid) {
  try {
    if (!DIARY_SERVER || !pid) return;           // 플래그 off → 네트워크 0
    const [entriesRes, metaRes] = await Promise.all([
      getDiaryEntries(pid).catch(() => null),
      getDiaryMeta(pid).catch(() => null),
    ]);
    if (entriesRes?.assets) primeAssetUrls(pid, entriesRes.assets);

    const serverEntries = Array.isArray(entriesRes?.entries) ? entriesRes.entries : [];
    if (serverEntries.length || entriesRes) {
      const local = getEntries(pid);
      const byId = new Map(local.map((e) => [e.id, e]));
      const serverIds = new Set();
      for (const se of serverEntries) {
        if (!se?.id) continue;
        serverIds.add(se.id);
        byId.set(se.id, se);                      // 서버 우선
      }
      writeJson(ENTRIES_KEY(pid), Array.from(byId.values()));
      // 로컬에만 있던 것 = 지난번 push 실패분 → 다시 밀어 올린다.
      //
      // 🔴 여기는 **소량 복구 전용**이다 (2026-08-07 정정).
      //    처음엔 `for (…) void pushEntryToServer(…)` 로 전량을 동시에 발사했는데,
      //    일기가 수십 편이면 그림·음성 업로드가 **한꺼번에** 터져 나간다.
      //    GD-8c 브리프가 `Promise.all 금지 — 용량이 크다` 라고 명시적으로 금지한 바로 그 패턴이었다.
      //    → ① 한 번에 최대 REPUSH_MAX 편 ② 순차(await) 로 바꿨다.
      //    대량 이사는 이 경로가 아니라 **부모 화면의 이사 엔진**(diaryMigrate.js)이 맡는다.
      const stale = local.filter((le) => le?.id && !serverIds.has(le.id));
      void repushSequentially(pid, stale.slice(0, REPUSH_MAX));
    }

    if (metaRes?.meta && typeof metaRes.meta === "object") {
      const localMeta = getMeta(pid);
      // pendingContinue 는 서버에 없는 로컬 전용 키 — 서버 값으로 덮어쓰면 이탈 복구가 사라진다
      writeJson(META_KEY(pid), { ...localMeta, ...metaRes.meta, pendingContinue: localMeta.pendingContinue });
    }

    // GD-8b: 밀린 삭제가 있으면 이 기회에 마저 보낸다(오프라인에서 지운 것 복구).
    void flushPendingDeletes(pid);
  } catch { /* 캐시만으로도 화면은 그대로 뜬다 */ }
}

// ══════════════════════════════════════════════════════════════════════
// GD-8b: 삭제의 서버 관철
// ══════════════════════════════════════════════════════════════════════
// 순서 고정: ① 로컬 즉시(아이의 약속 — 오프라인에서도 이행) → ② 큐 적재 → ③ 서버 전송
//   ③이 실패해도 아이 화면에서는 이미 사라졌다. 큐에 남겨 다음 책장 진입 때 다시 보낸다.
//   ⚠️ 큐에는 **entryId 만** 담는다. 문장·그림 같은 내용은 담지 않는다 —
//      "지우려던 것"의 내용을 남기는 건 삭제의 취지에 반한다.
const PENDING_DEL_KEY = (pid) => `diary_v0_pending_del_${pid}`;

function queuePendingDelete(pid, entryId) {
  try {
    const list = readJson(PENDING_DEL_KEY(pid), []);
    if (!list.includes(entryId)) {
      list.push(entryId);
      writeJson(PENDING_DEL_KEY(pid), list);
    }
  } catch { /* 무시 */ }
}

function unqueuePendingDelete(pid, entryId) {
  try {
    const list = readJson(PENDING_DEL_KEY(pid), []).filter((x) => x !== entryId);
    if (list.length) writeJson(PENDING_DEL_KEY(pid), list);
    else localStorage.removeItem(PENDING_DEL_KEY(pid));
  } catch { /* 무시 */ }
}

/** 서버에서 일기 1편 삭제. 실패하면 큐에 남긴다(다음 hydrate 가 재시도). */
export async function deleteEntryOnServer(pid, entryId) {
  if (!DIARY_SERVER || !pid || !entryId) return;
  queuePendingDelete(pid, entryId);      // 먼저 적재 — 전송 중 창을 닫아도 남는다
  try {
    await deleteDiaryEntry(entryId, pid);
    unqueuePendingDelete(pid, entryId);  // 성공했을 때만 큐에서 뺀다
  } catch { /* 큐에 남는다 */ }
}

/** 밀린 삭제 재전송 — 책장 진입 시 hydrateDiary 가 부른다. */
export async function flushPendingDeletes(pid) {
  if (!DIARY_SERVER || !pid) return;
  let list = [];
  try { list = readJson(PENDING_DEL_KEY(pid), []); } catch { return; }
  for (const entryId of list) {
    try {
      await deleteDiaryEntry(entryId, pid);
      unqueuePendingDelete(pid, entryId);
    } catch { /* 다음 기회에 */ }
  }
}
