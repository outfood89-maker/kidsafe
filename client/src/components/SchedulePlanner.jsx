import { useState, useEffect, useMemo } from "react";
import { FaChevronLeft, FaChevronRight, FaPlus, FaTrash, FaTimes, FaPen } from "react-icons/fa";
import { getSchedules, createSchedule, updateSchedule, deleteSchedule } from "../utils/api";

// 멀티 스케줄러 — 부모가 아이별 일정/사건/음식/상태를 월간 달력에 기록.
// 1단계(토대): 입력 + 월간 조회 + 앱 내 '오늘·내일' 표시. 푸시/날씨/AI는 나중 단계.
// props:
//  - profileId   : 아이 프로필 id
//  - profileName : 아이 이름 (표기용)

const C = {
  card: "#0E2A2A", inner: "#163635", accent: "#18C49A", accent2: "#14B8C4",
  ink: "#EAF5F1", sub: "#90A9A8", dim: "#6B7E7C",
};

// 일정 종류 → 이모지·색 (백엔드 SCHEDULE_TYPES 와 일치)
const TYPE_META = {
  "일정":   { emoji: "📌", color: "#18C49A" },
  "이벤트": { emoji: "🎉", color: "#F5B829" },
  "음식":   { emoji: "🍽️", color: "#F2655C" },
  "상태":   { emoji: "💬", color: "#5AA9E6" },
};
const TYPE_LIST = ["일정", "이벤트", "음식", "상태"];
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const pad2 = (n) => String(n).padStart(2, "0");
const ymd = (y, m, d) => `${y}-${pad2(m)}-${pad2(d)}`;

// 'YYYY-MM' 현재 달
const thisMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
};
const todayStr = () => {
  const d = new Date();
  return ymd(d.getFullYear(), d.getMonth() + 1, d.getDate());
};

// 달 이동 ('YYYY-MM' → 이전/다음 달)
const shiftMonth = (month, delta) => {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
};

// 달력 셀 배열 구성 (앞쪽 빈칸 포함, 7칸 단위로 떨어지게 뒤쪽도 채움)
const buildCells = (month) => {
  const [y, m] = month.split("-").map(Number);
  const firstDay = new Date(y, m - 1, 1).getDay(); // 0=일
  const daysInMonth = new Date(y, m, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, date: ymd(y, m, d) });
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
};

// 하루치 일정 정렬: 시간 있는 것 먼저(오름차순), 시간 없는 것 뒤
const sortDay = (items) =>
  [...items].sort((a, b) => {
    if (a.time && b.time) return a.time.localeCompare(b.time);
    if (a.time) return -1;
    if (b.time) return 1;
    return 0;
  });

export default function SchedulePlanner({ profileId, profileName }) {
  const [month, setMonth] = useState(thisMonth());
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  const [selectedDate, setSelectedDate] = useState(null); // 'YYYY-MM-DD' | null (모달)
  const [formOpen, setFormOpen] = useState(false);        // 폼 표시 여부 (false=보기만, true=추가/수정)
  const [editingId, setEditingId] = useState(null);       // 수정 중 일정 id | null(=새 입력)
  const [fType, setFType] = useState("일정");
  const [fTitle, setFTitle] = useState("");
  const [fTime, setFTime] = useState("");
  const [fMemo, setFMemo] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // 일정 로드 (profileId/월/reloadKey 변화 시) — setState 는 중첩 async 안에서 (lint 회피)
  useEffect(() => {
    if (!profileId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const list = await getSchedules(profileId, month);
        if (!cancelled) setSchedules(list);
      } catch {
        if (!cancelled) setSchedules([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [profileId, month, reloadKey]);

  // 날짜별 그룹
  const byDate = useMemo(() => {
    const map = {};
    for (const s of schedules) {
      (map[s.date] = map[s.date] || []).push(s);
    }
    return map;
  }, [schedules]);

  const cells = useMemo(() => buildCells(month), [month]);
  const today = todayStr();
  const [monthY, monthM] = month.split("-");

  // ── 오늘·내일 요약 (앱 내 '알림' 대체) ──
  const upcoming = useMemo(() => {
    const t = new Date();
    const tomorrow = new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1);
    const tStr = today;
    const tmStr = ymd(tomorrow.getFullYear(), tomorrow.getMonth() + 1, tomorrow.getDate());
    return {
      today: sortDay(byDate[tStr] || []),
      tomorrow: sortDay(byDate[tmStr] || []),
      tStr, tmStr,
    };
  }, [byDate, today]);

  const resetForm = () => {
    setEditingId(null); setFType("일정"); setFTitle(""); setFTime(""); setFMemo(""); setFormError("");
  };

  const openDay = (date) => { setSelectedDate(date); setFormOpen(false); resetForm(); };
  const closeDay = () => { setSelectedDate(null); setFormOpen(false); resetForm(); };

  // 보기 → 추가 폼으로
  const openNew = () => { resetForm(); setFormOpen(true); };
  // 보기 → 수정 폼으로
  const openEdit = (s) => {
    setEditingId(s.id); setFType(s.type || "일정"); setFTitle(s.title || "");
    setFTime(s.time || ""); setFMemo(s.memo || ""); setFormError("");
    setFormOpen(true);
  };
  // 폼 → 보기로 (취소/저장 후)
  const closeForm = () => { setFormOpen(false); resetForm(); };

  const handleSave = async () => {
    if (!fTitle.trim()) { setFormError("제목을 입력해주세요"); return; }
    setSaving(true); setFormError("");
    try {
      if (editingId) {
        await updateSchedule(editingId, { type: fType, title: fTitle.trim(), time: fTime || null, memo: fMemo.trim() || null });
      } else {
        await createSchedule({ profileId, date: selectedDate, type: fType, title: fTitle.trim(), time: fTime || null, memo: fMemo.trim() || null });
      }
      closeForm();
      setReloadKey((k) => k + 1);
    } catch {
      setFormError("저장에 실패했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("이 일정을 삭제할까요?")) return;
    try {
      await deleteSchedule(id);
      if (editingId === id) closeForm();
      setReloadKey((k) => k + 1);
    } catch {
      alert("삭제에 실패했어요.");
    }
  };

  const dayItems = selectedDate ? sortDay(byDate[selectedDate] || []) : [];

  // 입력/수정 공통 폼 (새 추가·인라인 수정 양쪽에서 재사용)
  const renderFormBody = () => (
    <>
      {/* 종류 칩 */}
      <div className="flex gap-1.5 mb-2.5">
        {TYPE_LIST.map((t) => (
          <button
            key={t}
            onClick={() => setFType(t)}
            className="flex-1 rounded-lg py-2 text-xs font-bold transition-transform active:scale-95"
            style={fType === t
              ? { backgroundColor: TYPE_META[t].color, color: "#08160F", transform: "scale(1.03)" }
              : { backgroundColor: C.card, color: C.sub }}
          >
            {TYPE_META[t].emoji} {t}
          </button>
        ))}
      </div>

      {/* 제목 */}
      <input
        type="text"
        placeholder="제목 (예: 태권도, 친구 생일파티)"
        value={fTitle}
        onChange={(e) => setFTitle(e.target.value)}
        autoFocus
        className="w-full rounded-lg px-3 py-2.5 text-sm outline-none mb-2.5"
        style={{ backgroundColor: C.card, color: C.ink, border: "1px solid rgba(24,196,154,0.3)" }}
      />

      {/* 시간 (선택) */}
      <div className="flex items-center gap-2 mb-2.5">
        <input
          type="time"
          value={fTime}
          onChange={(e) => setFTime(e.target.value)}
          className="rounded-lg px-3 py-2 text-sm outline-none"
          style={{ backgroundColor: C.card, color: C.ink, border: "1px solid rgba(255,255,255,0.1)" }}
        />
        {fTime && (
          <button onClick={() => setFTime("")} className="text-xs" style={{ color: C.dim }}>시간 지우기</button>
        )}
        <span className="ml-auto text-xs" style={{ color: C.dim }}>시간은 선택</span>
      </div>

      {/* 메모 (선택) */}
      <textarea
        placeholder="메모 (선택) — 예: 도시락 챙기기, 따뜻하게 입히기"
        value={fMemo}
        onChange={(e) => setFMemo(e.target.value)}
        rows={2}
        className="w-full rounded-lg px-3 py-2.5 text-sm outline-none mb-2.5 resize-none"
        style={{ backgroundColor: C.card, color: C.ink, border: "1px solid rgba(255,255,255,0.1)" }}
      />

      {formError && <p className="text-xs mb-2" style={{ color: "#F2655C" }}>{formError}</p>}

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-extrabold transition-transform active:scale-95 disabled:opacity-60"
          style={{ background: `linear-gradient(135deg, ${C.accent}, ${C.accent2})`, color: "#08160F" }}
        >
          <FaPlus className="text-xs" /> {saving ? "저장 중..." : editingId ? "수정 저장" : "추가하기"}
        </button>
        <button onClick={closeForm} className="rounded-lg px-4 py-2.5 text-sm font-bold transition-transform active:scale-95" style={{ backgroundColor: C.card, color: C.sub }}>
          취소
        </button>
      </div>
    </>
  );

  return (
    <div className="flex flex-col gap-4">
      {/* 스케줄러 전용 모션 키프레임 (클래스 prefix sch-) */}
      <style>{`
        @keyframes schFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes schPop  { from { opacity: 0; transform: translateY(14px) scale(.96) } to { opacity: 1; transform: translateY(0) scale(1) } }
        @keyframes schItem { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
        .sch-backdrop { animation: schFade .18s ease-out }
        .sch-modal    { animation: schPop .24s cubic-bezier(.2,.85,.25,1) }
        .sch-item     { animation: schItem .28s ease-out backwards }
        .sch-cell     { transition: transform .14s ease, box-shadow .14s ease, background-color .14s ease }
        .sch-cell:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0,0,0,.28) }
        .sch-cell:active { transform: scale(.96) }
        .sch-summary { transition: transform .15s ease, box-shadow .15s ease }
        .sch-summary:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0,0,0,.3) }
      `}</style>

      {/* ── 오늘·내일 요약 (앱 내 알림 대체) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[
          { label: "오늘", items: upcoming.today, date: upcoming.tStr },
          { label: "내일", items: upcoming.tomorrow, date: upcoming.tmStr },
        ].map((box) => (
          <button
            key={box.label}
            onClick={() => openDay(box.date)}
            className="sch-summary text-left rounded-2xl p-4"
            style={{ backgroundColor: C.card, border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-bold" style={{ color: C.accent }}>{box.label}</span>
              <span className="text-xs" style={{ color: C.dim }}>{box.date.slice(5).replace("-", "/")}</span>
              <span className="ml-auto text-xs" style={{ color: C.sub }}>{box.items.length}건</span>
            </div>
            {box.items.length === 0 ? (
              <p className="text-xs" style={{ color: C.dim }}>예정된 일정이 없어요</p>
            ) : (
              <div className="flex flex-col gap-1">
                {box.items.slice(0, 3).map((s) => (
                  <div key={s.id} className="flex items-center gap-1.5 text-xs" style={{ color: C.ink }}>
                    <span>{TYPE_META[s.type]?.emoji || "📌"}</span>
                    {s.time && <span style={{ color: C.sub }}>{s.time}</span>}
                    <span className="truncate">{s.title}</span>
                  </div>
                ))}
                {box.items.length > 3 && <span className="text-xs" style={{ color: C.dim }}>+{box.items.length - 3}건 더</span>}
              </div>
            )}
          </button>
        ))}
      </div>

      {/* ── 월간 달력 ── */}
      <div className="rounded-2xl p-3 md:p-5" style={{ backgroundColor: C.card, border: "1px solid rgba(255,255,255,0.08)" }}>
        {/* 월 네비 */}
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => setMonth(shiftMonth(month, -1))} className="rounded-lg p-2 transition hover:opacity-80" style={{ color: C.sub, backgroundColor: C.inner }}>
            <FaChevronLeft className="text-xs" />
          </button>
          <h3 className="text-base font-extrabold" style={{ color: C.ink }}>{monthY}년 {Number(monthM)}월</h3>
          <button onClick={() => setMonth(shiftMonth(month, 1))} className="rounded-lg p-2 transition hover:opacity-80" style={{ color: C.sub, backgroundColor: C.inner }}>
            <FaChevronRight className="text-xs" />
          </button>
        </div>

        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 mb-1">
          {WEEKDAYS.map((w, i) => (
            <div key={w} className="text-center text-xs font-bold py-1" style={{ color: i === 0 ? "#F2655C" : i === 6 ? "#5AA9E6" : C.dim }}>{w}</div>
          ))}
        </div>

        {/* 날짜 그리드 */}
        {loading ? (
          <p className="py-12 text-center text-sm" style={{ color: C.sub }}>불러오는 중...</p>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {cells.map((cell, i) => {
              if (!cell) return <div key={`b${i}`} />;
              const items = sortDay(byDate[cell.date] || []);
              const isToday = cell.date === today;
              const dow = i % 7;
              return (
                <button
                  key={cell.date}
                  onClick={() => openDay(cell.date)}
                  className="sch-cell flex flex-col rounded-lg p-1 text-left"
                  style={{
                    minHeight: "62px",
                    backgroundColor: isToday ? "rgba(24,196,154,0.14)" : C.inner,
                    border: isToday ? "1px solid rgba(24,196,154,0.5)" : "1px solid rgba(255,255,255,0.04)",
                  }}
                >
                  <span className="text-xs font-bold mb-0.5" style={{ color: isToday ? C.accent : dow === 0 ? "#F2655C" : dow === 6 ? "#5AA9E6" : C.sub }}>
                    {cell.day}
                  </span>
                  <div className="flex flex-col gap-0.5 overflow-hidden">
                    {items.slice(0, 2).map((s) => (
                      <span
                        key={s.id}
                        className="truncate rounded px-1 leading-tight"
                        style={{ fontSize: "10px", backgroundColor: `${TYPE_META[s.type]?.color || C.accent}22`, color: TYPE_META[s.type]?.color || C.accent }}
                      >
                        {TYPE_META[s.type]?.emoji} {s.title}
                      </span>
                    ))}
                    {items.length > 2 && <span style={{ fontSize: "10px", color: C.dim }}>+{items.length - 2}</span>}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 날짜 상세 모달 (그날 일정 보기 + 입력) ── */}
      {selectedDate && (
        <div
          className="sch-backdrop fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ backgroundColor: "rgba(6,16,16,0.55)", backdropFilter: "blur(5px)", WebkitBackdropFilter: "blur(5px)" }}
          onClick={closeDay}
        >
          <div
            className="sch-modal w-full max-w-md p-5 max-h-[85vh] overflow-y-auto"
            style={{ borderRadius: "20px", backgroundColor: C.card, border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 24px 60px rgba(0,0,0,0.5)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-extrabold" style={{ color: C.ink }}>
                {selectedDate.replace(/-/g, ".").slice(0)} · {profileName || "아이"}
              </h3>
              <button onClick={closeDay} style={{ color: C.sub }}><FaTimes /></button>
            </div>

            {/* 그날 일정 목록 (항상 보임). 수정 누르면 그 항목이 그 자리에서 펼쳐짐 */}
            {dayItems.length === 0 ? (
              <p className="py-3 text-center text-sm mb-3" style={{ color: C.dim }}>아직 일정이 없어요.</p>
            ) : (
              <div className="flex flex-col gap-2.5 mb-4">
                {dayItems.map((s, idx) => (
                  editingId === s.id ? (
                    // ── 인라인 수정 (그 자리에서 상하로 펼쳐짐) ──
                    <div
                      key={s.id}
                      className="rounded-xl p-3"
                      style={{ backgroundColor: C.inner, border: `1px solid ${TYPE_META[s.type]?.color || C.accent}55` }}
                    >
                      <p className="text-xs font-bold mb-2.5 flex items-center gap-1.5" style={{ color: C.accent }}>
                        <FaPen className="text-[10px]" /> 일정 수정 중
                      </p>
                      {renderFormBody()}
                    </div>
                  ) : (
                    // ── 일반 카드 ──
                    <div
                      key={s.id}
                      className="sch-item flex items-start gap-3 rounded-xl p-3"
                      style={{ backgroundColor: C.inner, animationDelay: `${idx * 45}ms` }}
                    >
                      <span className="text-xl shrink-0 mt-0.5">{TYPE_META[s.type]?.emoji || "📌"}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {s.time && (
                            <span className="text-xs font-extrabold rounded px-1.5 py-0.5" style={{ color: "#08160F", backgroundColor: TYPE_META[s.type]?.color || C.accent }}>
                              {s.time}
                            </span>
                          )}
                          <span className="text-[15px] font-extrabold" style={{ color: C.ink }}>{s.title}</span>
                        </div>
                        {s.memo && (
                          <p className="text-sm mt-1.5 leading-relaxed rounded-lg px-3 py-2" style={{ color: "#C9DAD6", backgroundColor: C.card }}>
                            {s.memo}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col gap-1.5 shrink-0">
                        <button onClick={() => openEdit(s)} className="rounded-full p-2 transition-transform active:scale-90" style={{ color: "#3FE0B0", backgroundColor: "rgba(24,196,154,0.15)" }}><FaPen className="text-xs" /></button>
                        <button onClick={() => handleDelete(s.id)} className="rounded-full p-2 transition-transform active:scale-90" style={{ color: "#F2655C", backgroundColor: "rgba(242,101,92,0.12)" }}><FaTrash className="text-xs" /></button>
                      </div>
                    </div>
                  )
                ))}
              </div>
            )}

            {/* 새 일정 추가: 버튼 → 누르면 폼으로 (인라인 수정 중엔 숨김) */}
            {!editingId && (!formOpen ? (
              <button
                onClick={openNew}
                className="w-full flex items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-extrabold transition-transform active:scale-95"
                style={{ background: `linear-gradient(135deg, ${C.accent}, ${C.accent2})`, color: "#08160F" }}
              >
                <FaPlus className="text-xs" /> 일정 추가
              </button>
            ) : (
              <div className="sch-item rounded-xl p-3" style={{ backgroundColor: C.inner, border: "1px solid rgba(24,196,154,0.3)" }}>
                <p className="text-xs font-bold mb-2.5 flex items-center gap-1.5" style={{ color: C.accent }}>
                  <FaPlus className="text-[10px]" /> 새 일정 추가
                </p>
                {renderFormBody()}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
