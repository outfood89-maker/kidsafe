// ── 📦 저장 용량 카드 + 정리 화면 (2026-08-11) ──
//
// 🔴 이 카드의 성격: **경고문이 아니라 미리 알리는 것이다.**
//    100% 에서 처음 말하면 그건 "아이 그림을 지금 버리세요"가 된다.
//    80% 에서 알리는 이유가 그것이다 — 아직 여유가 있을 때, 급하지 않게.
//    (2026-08-11 오너: *"가득 차기 전에 미리 부모님께 공지"*)
//
// 🚨 윤리선 — 정리 목록에는 **비공개 일기도 뜬다**(용량을 차지하니까).
//    그래서 서버가 날짜·용량·공유여부 셋만 보낸다. 문장·감정·그림은 오지 않는다.
//    화면도 그 이상을 만들지 말 것 — 여기서 썸네일을 붙이는 순간 윤리선이 무너진다.
//    (서버 계약: server/routers/diary.py `GET /diary/usage/entries`)
//
// ⚠️ 지우기는 되돌릴 수 없다(방침 제5조). 그래서 확인을 붙이고, 문구가 정직해야 한다.

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getDiaryUsage, getDiaryUsageEntries, deleteDiaryEntry } from "../utils/api";

const C = {
  card: "#123030",
  line: "rgba(255,255,255,0.08)",
  text: "#EAF5F1",
  muted: "#90A9A8",
  on: "#18C49A",
  warn: "#F2A65C",
  danger: "#F2655C",
};

/** 바이트를 사람이 읽는 말로. 0 은 "0MB" 가 아니라 "0" 이 맞다(아직 아무것도 없다). */
export function humanBytes(n) {
  const b = Number(n) || 0;
  if (b <= 0) return "0";
  if (b < 1024 * 1024) return `${Math.max(1, Math.round(b / 1024))}KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)}MB`;
  return `${(b / (1024 * 1024 * 1024)).toFixed(2)}GB`;
}

/** "2026-03-01" → "2026년 3월 1일". 못 읽으면 원문 그대로(지어내지 않는다). */
function humanDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ""));
  return m ? `${m[1]}년 ${Number(m[2])}월 ${Number(m[3])}일` : String(s || "");
}

/**
 * @param reloadKey  이 값이 바뀌면 사용량을 다시 읽는다.
 *   🔴 왜 필요한가 (2026-08-12 오너 시범) — 마운트 때 한 번만 읽으면 **이사보다 먼저** 읽는다.
 *      그래서 배너는 "1편 보관했어요" 인데 바로 위 카드는 `0` 이었다. 같은 화면이 서로 다른 말을 했다.
 *      🧹 정리 화면을 열면 그때 새로 읽어오므로 **거기서만 진짜 용량이 보였다** — 그게 더 헷갈린다.
 *      (정리 뒤에는 removePicked 가 load() 를 부른다. 빠져 있던 것은 '이사 직후' 하나였다)
 */
export default function DiaryStorageCard({ profiles = [], onCleaned, reloadKey = 0 }) {
  const navigate = useNavigate();
  const [usage, setUsage] = useState(null);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(false);         // 정리 화면
  const [rows, setRows] = useState(null);          // null = 아직 안 읽음
  const [picked, setPicked] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [done, setDone] = useState("");

  const load = async () => {
    try { setUsage(await getDiaryUsage()); setErr(""); }
    catch { setErr("지금은 사용량을 읽지 못했어요."); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [reloadKey]);

  const openCleanup = async () => {
    setOpen(true); setDone("");
    try {
      const res = await getDiaryUsageEntries();
      setRows(Array.isArray(res?.entries) ? res.entries : []);
    } catch { setRows([]); setErr("목록을 읽지 못했어요."); }
  };

  const toggle = (id) => setPicked((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const removePicked = async () => {
    setBusy(true);
    let ok = 0;
    // 🔴 순차로 지운다. Promise.all 금지 — 그림·음성 삭제가 한꺼번에 터져 나간다(GD-8c 브리프).
    for (const row of (rows || []).filter((r) => picked.has(r.id))) {
      try { await deleteDiaryEntry(row.id, row.profileId); ok += 1; }
      catch { /* 실패분은 목록에 남는다 — 다시 고를 수 있다 */ }
    }
    setPicked(new Set());
    setConfirm(false);
    setBusy(false);
    setDone(ok > 0 ? `${ok}개를 정리했어요.` : "지우지 못했어요. 잠시 뒤 다시 시도해 주세요.");
    await load();
    try {
      const res = await getDiaryUsageEntries();
      setRows(Array.isArray(res?.entries) ? res.entries : []);
    } catch { /* 목록 갱신 실패는 화면을 막지 않는다 */ }
    onCleaned?.();
  };

  if (err && !usage) {
    return (
      <div className="mb-4 p-4 text-xs" style={{ borderRadius: "12px", backgroundColor: C.card, border: `1px solid ${C.line}`, color: C.muted }}>
        {err}
      </div>
    );
  }
  if (!usage) return null;

  const pct = Math.min(100, Math.max(0, Number(usage.percent) || 0));
  const warn = usage.warn === true;
  const full = usage.full === true;
  const barColor = full ? C.danger : warn ? C.warn : C.on;
  const nameOf = (pid) => profiles.find((p) => p.id === pid)?.name || "아이";

  return (
    <div
      data-testid="diary-storage-card"
      className="mb-4 p-4"
      style={{ borderRadius: "12px", backgroundColor: C.card, border: `1px solid ${warn ? "rgba(242,166,92,0.35)" : C.line}` }}
    >
      <div className="flex items-center gap-2">
        <span className="text-base">📦</span>
        <h3 className="text-sm font-bold" style={{ color: C.text }}>그림일기 저장 공간</h3>
        <span className="ml-auto text-xs font-bold" style={{ color: warn ? C.warn : C.muted }}>
          {humanBytes(usage.usedBytes)} / {humanBytes(usage.limitBytes)}
        </span>
      </div>

      {/* 막대 — 숫자를 못 읽어도 "얼마나 찼는지"가 보이게 */}
      <div className="mt-2.5 h-2 w-full overflow-hidden" style={{ borderRadius: "999px", backgroundColor: "rgba(255,255,255,0.08)" }}>
        <div style={{ width: `${pct}%`, height: "100%", backgroundColor: barColor, transition: "width .3s" }} />
      </div>

      {/* 🔴 경고는 80% 부터. 그 전에는 조용히 숫자만 — 없는 걱정을 만들지 않는다. */}
      {!warn && (
        <p className="mt-2 text-xs" style={{ color: C.muted }}>
          여유가 있어요. {usage.warnAtPercent || 80}% 를 넘으면 여기서 알려드릴게요.
        </p>
      )}
      {warn && !full && (
        <p className="mt-2 text-xs leading-relaxed" style={{ color: C.text }}>
          <b style={{ color: C.warn }}>{pct}% 를 썼어요.</b> 가득 차면 아이가 새 일기를 서버에 저장하지 못해요.
          미리 정리해 두시면 좋아요 — <b>지우기 전에 내려받아 앨범으로 남기실 수도 있어요.</b>
        </p>
      )}
      {full && (
        <p className="mt-2 text-xs leading-relaxed" style={{ color: C.text }}>
          <b style={{ color: C.danger }}>저장 공간이 가득 찼어요.</b>{" "}
          {usage.parentMessage || "지금 아이의 새 일기는 아이 기기에만 남고 있어요. 정리하시면 자동으로 올라갑니다."}
        </p>
      )}

      {/* 부모의 선택지 둘 — 정리하거나, 아이 책장에서 직접 보고 지우거나 */}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          data-testid="storage-cleanup-open"
          onClick={openCleanup}
          className="text-xs font-bold rounded-full px-3 py-1.5"
          style={{ backgroundColor: warn ? C.warn : "#163635", color: warn ? "#08160F" : C.on, border: warn ? "none" : `1px solid rgba(24,196,154,0.35)` }}
        >
          🧹 오래된 것부터 정리
        </button>
        {/* 🔴 <a href> 가 아니라 navigate 다 — <a> 는 **전체 페이지 리로드**를 일으켜
            SPA 라우팅을 깬다(번들 재파싱 · 세션 복원 · 대시보드 상태 소실).
            ⚠️ 같은 파일 계열의 `<a href="/privacy">`(DiaryConsentCard) 는 다르다 —
               그건 앱 밖으로 나가는 성격의 문서 링크고, 이건 **앱 안의 화면 전환**이다. */}
        <button
          data-testid="storage-goto-shelf"
          onClick={() => navigate("/family-shelf")}
          className="text-xs font-bold rounded-full px-3 py-1.5"
          style={{ backgroundColor: "#163635", color: C.muted, border: `1px solid ${C.line}` }}
        >
          📚 가족 책장에서 보고 고르기
        </button>
      </div>

      {/* ── 정리 화면 ────────────────────────────────────────────── */}
      {open && (
        <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${C.line}` }}>
          <div className="flex items-center gap-2 mb-2">
            <h4 className="text-xs font-bold" style={{ color: C.text }}>오래된 일기부터</h4>
            <button onClick={() => { setOpen(false); setPicked(new Set()); }} className="ml-auto text-xs" style={{ color: C.muted }}>닫기</button>
          </div>

          {/* 🚨 여기 뜨는 것 중에는 아이가 부모에게 공유하지 않은 일기도 있다.
              그 사실을 숨기지 않고 말한다 — 부모가 "왜 내용이 안 보이지?"로 오해하지 않게. */}
          <p className="text-[11px] leading-relaxed mb-3" style={{ color: C.muted }}>
            아이가 아직 함께 보기로 하지 않은 일기도 자리를 차지해요. 그래서 목록에는 있지만
            <b> 내용은 보여드리지 않아요.</b> 날짜와 크기만 보고 골라주세요.
          </p>

          {rows === null && <p className="text-xs" style={{ color: C.muted }}>읽는 중이에요…</p>}
          {rows !== null && rows.length === 0 && (
            <p className="text-xs" style={{ color: C.muted }}>정리할 일기가 아직 없어요.</p>
          )}

          {rows !== null && rows.length > 0 && (
            <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto">
              {rows.map((r) => (
                <label
                  key={r.id}
                  className="flex items-center gap-2.5 px-3 py-2 cursor-pointer"
                  style={{ borderRadius: "10px", backgroundColor: picked.has(r.id) ? "rgba(242,101,92,0.12)" : "#0E2A2A", border: `1px solid ${picked.has(r.id) ? "rgba(242,101,92,0.35)" : C.line}` }}
                >
                  <input
                    type="checkbox"
                    checked={picked.has(r.id)}
                    onChange={() => toggle(r.id)}
                    aria-label={`${humanDate(r.date)} 일기 선택`}
                  />
                  <span className="text-xs font-medium" style={{ color: C.text }}>{humanDate(r.date)}</span>
                  <span className="text-[11px]" style={{ color: C.muted }}>{nameOf(r.profileId)}</span>
                  {/* 🔴 이 배지는 **오늘 절대 안 뜬다** (2026-08-12 확인). `share_with_parent` 를 false 로
                      만드는 코드가 0건이고 설정 UI 도 없다 — sql/007:159 가 명시한 설계다
                      ("비공개 그림일기는 성립하지 않는다 — 아이 기기는 부모도 만지는 기기다").
                      지우지 않고 남긴다: 아이가 "이건 나만 볼래"를 고를 수 있게 되면 그날 바로 산다.
                      ⚠️ 이 줄을 보고 "비공개 일기가 있구나" 라고 읽지 말 것. 비밀은 체크인에만 있다. */}
                  {!r.shared && (
                    <span className="text-[10px] px-1.5 py-0.5" style={{ borderRadius: "6px", backgroundColor: "#163635", color: C.muted }}>
                      비공개
                    </span>
                  )}
                  <span className="ml-auto text-[11px] font-bold" style={{ color: C.muted }}>{humanBytes(r.bytes)}</span>
                </label>
              ))}
            </div>
          )}

          {picked.size > 0 && !confirm && (
            <button
              data-testid="storage-cleanup-ask"
              onClick={() => setConfirm(true)}
              className="mt-3 w-full text-xs font-bold rounded-full px-3 py-2"
              style={{ backgroundColor: C.danger, color: "#08160F" }}
            >
              {picked.size}개 지우기
            </button>
          )}

          {/* 🔴 되돌릴 수 없다 — 확인을 한 겹 둔다. 문구가 정직해야 한다(아이 그림도 함께 사라진다). */}
          {confirm && (
            <div className="mt-3 p-3" style={{ borderRadius: "10px", backgroundColor: "rgba(242,101,92,0.1)", border: "1px solid rgba(242,101,92,0.3)" }}>
              <p className="text-xs leading-relaxed" style={{ color: C.text }}>
                <b>{picked.size}개의 일기를 지웁니다.</b> 그림과 목소리도 함께 사라지고,
                <b> 되돌릴 수 없어요.</b> 아이 기기에서도 사라집니다.
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  data-testid="storage-cleanup-confirm"
                  onClick={removePicked}
                  disabled={busy}
                  className="text-xs font-bold rounded-full px-3 py-1.5"
                  style={{ backgroundColor: C.danger, color: "#08160F", opacity: busy ? 0.6 : 1 }}
                >
                  {busy ? "지우는 중…" : "네, 지울게요"}
                </button>
                <button onClick={() => setConfirm(false)} className="text-xs rounded-full px-3 py-1.5" style={{ backgroundColor: "#163635", color: C.muted }}>
                  아니요
                </button>
              </div>
            </div>
          )}

          {done && <p className="mt-2 text-xs" style={{ color: C.on }}>{done}</p>}
        </div>
      )}
    </div>
  );
}
