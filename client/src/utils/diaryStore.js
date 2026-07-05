// ── 우리 그림일기 v0 — 저장 계층 (AD §6) ──
// v0 = localStorage. 서버·DB 무접촉(오너 SQL 0). 고도화 머지 시 Supabase 테이블+라우터로 교체 전제.
//   → 교체 시 이 파일의 함수 시그니처만 유지하고 내부를 async DB 호출로 바꾸면 됨(호출부 무변경 목표).
// 불변식(§6): ①'간직' 선택분만 저장 ②음성 원문(transcript) 미저장 ③위기 텍스트 유입 없음
//   ④찢기=페이지 단위 즉시 완전 삭제(복구 불가) ⑤배지·보상·알림 연결 금지.
// ⚠️ feature/diary-v0 브랜치 전용.

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

const defaultMeta = () => ({ recentQids: [], recentClosings: [], rejectStreak: 0, lastProposalDate: null });
const getMeta = (pid) => ({ ...defaultMeta(), ...readJson(META_KEY(pid), {}) });
const setMeta = (pid, meta) => writeJson(META_KEY(pid), meta);

// ── 엔트리 (일기 페이지) ──
export const getEntries = (pid) => readJson(ENTRIES_KEY(pid), []);

// ⚠️ 저장물 = { id, date, sentences[], moodEmoji, childPick, keptAt } 만. transcript 등 원문 금지(불변식②③).
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
  entries.push(clean);
  writeJson(ENTRIES_KEY(pid), entries);
  return clean;
}

// 찢기 — 페이지 단위 즉시 완전 삭제(AD5, 복구 불가). 부모 삭제 기능 없음.
export function tearEntry(pid, entryId) {
  const entries = getEntries(pid).filter((e) => e.id !== entryId);
  writeJson(ENTRIES_KEY(pid), entries);
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

// 가족 책장 자발 방문 → 기본 빈도 복귀 (R8)
export function recordShelfVisit(pid) {
  const meta = getMeta(pid);
  meta.rejectStreak = 0;
  setMeta(pid, meta);
}
