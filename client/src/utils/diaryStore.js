// ── 우리 그림일기 v0 — 저장 계층 (AD §6) ──
// v0 = localStorage. 서버·DB 무접촉(오너 SQL 0). 고도화 머지 시 Supabase 테이블+라우터로 교체 전제.
//   → 교체 시 이 파일의 함수 시그니처만 유지하고 내부를 async DB 호출로 바꾸면 됨(호출부 무변경 목표).
// 불변식(§6): ①'간직' 선택분만 저장 ②음성 원문(transcript) 미저장 ③위기 텍스트 유입 없음
//   ④찢기=페이지 단위 즉시 완전 삭제(복구 불가) ⑤배지·보상·알림 연결 금지.
// ⚠️ feature/diary-v0 브랜치 전용.

import { ROTATING_QUESTIONS } from "./diaryCopy"; // AD-4 §4: getTodayQuestion 선정 풀(단방향 의존)
import { deleteImage } from "./diaryImageStore"; // AD-5: 찢기 시 IDB 이미지 완전삭제(브라우저 전용, 노드선 no-op)
import { deleteAudio } from "./diaryAudioStore"; // B08a: 음성 편지 orphan·완전삭제(브라우저 전용, 노드선 no-op)

// AD-2 §1: 그림일기 진입 플래그·날짜 헬퍼 단일 소스(승격). DailyCheckin·KidHome·FamilyShelf가 모두 여기서 import.
//   → main엔 이 브랜치 diff가 없어야 하므로 플래그로 신규 UI 전체를 게이트한다.
export const DIARY_V0 = true;
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
const setMeta = (pid, meta) => writeJson(META_KEY(pid), meta);

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
  entries.push(clean);
  writeJson(ENTRIES_KEY(pid), entries);
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
  if (e) { e.imageId = imageId; writeJson(ENTRIES_KEY(pid), entries); }
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
}
// 아이가 상세를 열어 확인 → seenAt 기록(알림 자연 소멸용).
export function markStampSeen(pid, entryId) {
  const entries = getEntries(pid);
  const e = entries.find((x) => x.id === entryId);
  if (e && e.stamp) { e.stamp.seenAt = todayKST(); writeJson(ENTRIES_KEY(pid), entries); }
}
// 미확인 도장 목록(도장 있고 seenAt 없음) → 아이 홈 알림 분기(도장만 vs 편지 vs 음성). B08a: hasVoice 파생 추가(음성 최우선).
export function getUnseenStamps(pid) {
  return getEntries(pid)
    .filter((e) => e.stamp && !e.stamp.seenAt)
    .map((e) => ({ entryId: e.id, hasLetter: !!(e.stamp.letter && e.stamp.letter.trim()), hasVoice: !!e.stamp.voiceId }));
}
