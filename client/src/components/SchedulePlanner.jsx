import { useState, useEffect, useMemo, useRef } from "react";
import { FaChevronLeft, FaChevronRight, FaPlus, FaTrash, FaPen, FaTimes } from "react-icons/fa";
import { getSchedules, createSchedule, updateSchedule, deleteSchedule, getKiddyGreeting, agentSchedule } from "../utils/api";
import Typewriter from "./Typewriter";

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

// 'YYYY-MM-DD' → '6월 26일 (목)' (인라인 패널 헤더용)
const fmtSelected = (date) => {
  if (!date) return "";
  const [y, m, d] = date.split("-").map(Number);
  const wd = WEEKDAYS[new Date(y, m - 1, d).getDay()];
  return `${m}월 ${d}일 (${wd})`;
};

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

// 달력 그리드 gap (격자선 방식이라 0) — 기간 바 위치(%) 계산에 사용
const GRID_GAP = 0;

// 클릭한 셀 중심이 컨테이너 중심에서 얼마나 떨어졌는지(px).
// 팝오버는 가운데에 뜨되, 이 거리만큼 떨어진 '셀 위치'에서 가운데로 날아오며 커진다.
const originFromEvent = (el, container) => {
  if (!el || !container) return { dx: 0, dy: 0 };
  const r = el.getBoundingClientRect();
  const c = container.getBoundingClientRect();
  return {
    dx: r.left + r.width / 2 - c.left - c.width / 2,
    dy: r.top + r.height / 2 - c.top - c.height / 2,
  };
};

// 한 주(7칸)에 걸쳐 그릴 기간 바를 계산.
// 각 바: { s, startCol, span, lane, clipLeft, clipRight }
//  - startCol/span : 이 주 안에서 바가 차지하는 시작 열·칸 수
//  - lane          : 같은 주에 바가 여러 개면 세로로 쌓는 줄 번호
//  - clipLeft/Right: 일정이 이 주 밖으로 이어지는지(모서리 각지게 + 화살표)
const computeWeekBars = (week, spanItems) => {
  const dates = week.map((c) => (c ? c.date : null));
  const firstIdx = dates.findIndex(Boolean);
  if (firstIdx < 0) return { bars: [], lanes: 0 };
  let lastIdx = dates.length - 1;
  while (lastIdx >= 0 && !dates[lastIdx]) lastIdx--;
  const weekStart = dates[firstIdx];
  const weekEnd = dates[lastIdx];

  // 이 주와 겹치는 기간 일정만, 시작일(같으면 긴 것) 순 정렬
  const candidates = spanItems
    .filter((s) => s.date <= weekEnd && s.endDate >= weekStart)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.endDate > b.endDate ? -1 : 1));

  const laneEnds = []; // lane별 마지막 점유 열
  const bars = candidates.map((s) => {
    const segStart = s.date < weekStart ? weekStart : s.date;
    const segEnd = s.endDate > weekEnd ? weekEnd : s.endDate;
    const startCol = dates.indexOf(segStart);
    const endCol = dates.indexOf(segEnd);
    const span = endCol - startCol + 1;
    let lane = 0;
    while (lane < laneEnds.length && laneEnds[lane] >= startCol) lane++;
    laneEnds[lane] = endCol;
    return { s, startCol, span, lane, clipLeft: s.date < weekStart, clipRight: s.endDate > weekEnd };
  });
  return { bars, lanes: laneEnds.length };
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

  const [selectedDate, setSelectedDate] = useState(() => todayStr()); // 'YYYY-MM-DD' (선택 날짜 — 기본 오늘)
  const [panelOpen, setPanelOpen] = useState(false);                  // 팝오버 열림 여부 (날짜 클릭 시 달력 위로 뜸)
  const [popOrigin, setPopOrigin] = useState({ dx: 0, dy: 0 });       // 클릭 셀 → 중앙 거리(px). 팝오버가 그 셀에서 날아옴
  const calRef = useRef(null);                                        // 달력 카드 — 클릭 셀 좌표 계산 기준
  const [formOpen, setFormOpen] = useState(false);        // 폼 표시 여부 (false=보기만, true=추가/수정)
  const [editingId, setEditingId] = useState(null);       // 수정 중 일정 id | null(=새 입력)
  const [fType, setFType] = useState("일정");
  const [fTitle, setFTitle] = useState("");
  const [fTime, setFTime] = useState("");
  const [fMemo, setFMemo] = useState("");
  const [fEndDate, setFEndDate] = useState(""); // 종료일 (기간 일정, 비우면 하루짜리)
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // 키디 인사말
  const [greeting, setGreeting] = useState(null);     // null=로딩중, ""=실패, string=완료
  const [greetingKey, setGreetingKey] = useState(0);  // 새로고침용

  // 대화형 등록 (키디에게 말로 부탁)
  const [agentOpen, setAgentOpen] = useState(false);  // 패널 열림 여부
  const [agentInput, setAgentInput] = useState("");
  const [agentLog, setAgentLog] = useState([]);       // [{ role:'user'|'kiddy', text, created? }]
  const [agentBusy, setAgentBusy] = useState(false);

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

  // 키디 인사말 로드 (profileId 바뀔 때 + greetingKey 새로고침 시)
  useEffect(() => {
    if (!profileId) return;
    let cancelled = false;
    const load = async () => {
      setGreeting(null);
      try {
        const data = await getKiddyGreeting(profileId);
        if (!cancelled) setGreeting(data.message);
      } catch {
        if (!cancelled) setGreeting("");
      }
    };
    load();
    return () => { cancelled = true; };
  }, [profileId, greetingKey]);

  // 날짜별 그룹 (모달·오늘/내일 요약용 — 전체 일정)
  const byDate = useMemo(() => {
    const map = {};
    for (const s of schedules) {
      (map[s.date] = map[s.date] || []).push(s);
    }
    return map;
  }, [schedules]);

  // 달력 표시용 분리: 기간 일정(가로 바) vs 단일일(셀 칩)
  const spanItems = useMemo(
    () => schedules.filter((s) => s.endDate && s.endDate > s.date),
    [schedules]
  );
  const singleByDate = useMemo(() => {
    const map = {};
    for (const s of schedules) {
      if (s.endDate && s.endDate > s.date) continue; // 기간은 바로 따로
      (map[s.date] = map[s.date] || []).push(s);
    }
    return map;
  }, [schedules]);

  const cells = useMemo(() => buildCells(month), [month]);
  const weeks = useMemo(() => {
    const w = [];
    for (let i = 0; i < cells.length; i += 7) w.push(cells.slice(i, i + 7));
    return w;
  }, [cells]);
  const today = todayStr();
  const [monthY, monthM] = month.split("-");

  const resetForm = () => {
    setEditingId(null); setFType("일정"); setFTitle(""); setFTime(""); setFMemo(""); setFEndDate(""); setFormError("");
  };

  // 날짜 선택 → 달력 위 팝오버로 그 날짜 일정 표시 (origin = 클릭한 셀 위치 %)
  const openDay = (date, origin) => {
    setSelectedDate(date);
    setPopOrigin(origin || { dx: 0, dy: 0 });
    setPanelOpen(true);
    setFormOpen(false);
    resetForm();
  };
  const closePanel = () => { setPanelOpen(false); setFormOpen(false); resetForm(); };

  // 보기 → 추가 폼으로
  const openNew = () => { resetForm(); setFormOpen(true); };
  // 보기 → 수정 폼으로
  const openEdit = (s) => {
    setEditingId(s.id); setFType(s.type || "일정"); setFTitle(s.title || "");
    setFTime(s.time || ""); setFMemo(s.memo || ""); setFEndDate(s.endDate || ""); setFormError("");
    setFormOpen(true);
  };
  // 폼 → 보기로 (취소/저장 후)
  const closeForm = () => { setFormOpen(false); resetForm(); };

  const handleSave = async () => {
    if (!fTitle.trim()) { setFormError("제목을 입력해주세요"); return; }
    setSaving(true); setFormError("");
    try {
      // 종료일: 시작일보다 뒤일 때만 기간. 수정 시 ""를 보내 종료일 제거 가능
      const validEnd = fEndDate && fEndDate > selectedDate ? fEndDate : "";
      if (editingId) {
        await updateSchedule(editingId, { type: fType, title: fTitle.trim(), time: fTime || null, memo: fMemo.trim() || null, endDate: validEnd });
      } else {
        await createSchedule({ profileId, date: selectedDate, endDate: validEnd || null, type: fType, title: fTitle.trim(), time: fTime || null, memo: fMemo.trim() || null });
      }
      closeForm();
      setReloadKey((k) => k + 1);
      setGreetingKey((k) => k + 1); // 일정 추가/수정 시 인사말도 갱신
    } catch {
      setFormError("저장에 실패했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  };

  // 대화형 등록 전송 — 자연어를 키디가 파싱해 일정 등록 후 달력 갱신
  const sendAgent = async (raw) => {
    const message = (raw ?? agentInput).trim();
    if (!message || agentBusy) return;
    setAgentInput("");
    setAgentLog((log) => [...log, { role: "user", text: message }]);
    setAgentBusy(true);
    try {
      const res = await agentSchedule({ profileId, message, today: todayStr(), viewMonth: month });
      const cards = res.cards || [];
      setAgentLog((log) => [...log, { role: "kiddy", text: res.reply, cards }]);
      // 결과가 있으면 첫 일정의 달로 이동 (조회/등록/수정 모두 바로 보이게)
      if (cards.length > 0 && cards[0]?.date) {
        setMonth(cards[0].date.slice(0, 7));
        setSelectedDate(cards[0].date);
      }
      // 달력이 바뀐 경우(등록/수정/삭제)만 재조회 + 인사말 갱신
      if (res.changed) {
        setReloadKey((k) => k + 1);
        setGreetingKey((k) => k + 1);
      }
    } catch {
      setAgentLog((log) => [...log, { role: "kiddy", text: "앗, 잠깐 문제가 생겼어요. 잠시 후 다시 말해줄래요?", created: [] }]);
    } finally {
      setAgentBusy(false);
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

  // 선택한 날의 일정 = 그날 시작분(단일+기간시작) + 그날을 지나가는 기간 일정
  const dayItems = useMemo(() => {
    if (!selectedDate) return [];
    const direct = byDate[selectedDate] || [];
    const spanning = spanItems.filter((s) => s.date < selectedDate && s.endDate >= selectedDate);
    return sortDay([...direct, ...spanning]);
  }, [selectedDate, byDate, spanItems]);

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

      {/* 기간 (선택) — 종료일을 정하면 여러 날에 걸친 일정 */}
      <div className="flex items-center gap-2 mb-2.5 flex-wrap">
        <span className="text-xs" style={{ color: C.sub }}>기간</span>
        <span className="text-xs font-semibold" style={{ color: C.ink }}>
          {selectedDate ? selectedDate.slice(5).replace("-", "/") : ""}
        </span>
        <span className="text-xs" style={{ color: C.dim }}>~</span>
        <input
          type="date"
          value={fEndDate}
          min={selectedDate || undefined}
          onChange={(e) => setFEndDate(e.target.value)}
          className="rounded-lg px-3 py-2 text-sm outline-none"
          style={{ backgroundColor: C.card, color: C.ink, border: "1px solid rgba(255,255,255,0.1)" }}
        />
        {fEndDate && (
          <button onClick={() => setFEndDate("")} className="text-xs" style={{ color: C.dim }}>기간 해제</button>
        )}
        <span className="ml-auto text-xs" style={{ color: C.dim }}>여러 날이면 종료일 선택</span>
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
        .sch-cell     { transition: background-color .14s ease }
        .sch-cell:hover { background-color: rgba(255,255,255,0.04) }
        .sch-cell:active { background-color: rgba(24,196,154,0.10) }
        .sch-summary { transition: transform .15s ease, box-shadow .15s ease }
        .sch-summary:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0,0,0,.3) }
        .sch-bar { transition: filter .14s ease, transform .14s ease; box-shadow: 0 1px 4px rgba(0,0,0,.25) }
        .sch-bar:hover { filter: brightness(1.08); transform: translateY(-1px) }
        .sch-panel { animation: schItem .26s ease-out }
        @keyframes schPopIn { from { opacity: 0; transform: translate(var(--dx,0), var(--dy,0)) scale(.25) } to { opacity: 1; transform: translate(0,0) scale(1) } }
        .sch-pop { animation: schPopIn .26s cubic-bezier(.2,.8,.3,1.04) }
      `}</style>

      {/* ── 키디 인사말 (슬림 — 분위기 한마디만) ── */}
      <div className="flex items-center gap-3 rounded-2xl px-4 py-2.5"
        style={{ backgroundColor: C.inner, border: "1px solid rgba(24,196,154,0.18)" }}>
        {/* 키디 아이콘 */}
        <img
          src="/images/kiddy_hello.png"
          alt="키디"
          className="flex-shrink-0 rounded-full"
          style={{ width: 40, height: 40, objectFit: "cover", background: "rgba(24,196,154,0.12)" }}
          onError={(e) => { e.currentTarget.style.display = "none"; }}
        />
        {/* 말풍선 */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold mb-1" style={{ color: C.accent }}>키디</p>
          {/* 분위기 한마디 (LLM) */}
          {greeting === null ? (
            <p className="text-sm" style={{ color: C.sub }}>생각하는 중... ✨</p>
          ) : greeting === "" ? (
            <p className="text-sm" style={{ color: C.sub }}>
              {profileName || "아이"}의 오늘 일정을 확인해보세요 🌈
            </p>
          ) : (
            <p className="text-sm leading-relaxed" style={{ color: C.ink }}>
              <Typewriter key={greeting} text={greeting} speed={28} />
            </p>
          )}
        </div>
        {/* 새로고침 버튼 */}
        <button
          onClick={() => setGreetingKey((k) => k + 1)}
          disabled={greeting === null}
          className="flex-shrink-0 text-xs rounded-lg px-2 py-1 transition-opacity disabled:opacity-40"
          style={{ color: C.sub, backgroundColor: C.card }}
          title="다시 생성"
        >
          🔄
        </button>
      </div>

      {/* ── 대화형 등록 (키디에게 말로 부탁) ── */}
      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: C.card, border: "1px solid rgba(24,196,154,0.18)" }}>
        {/* 헤더 토글 */}
        <button
          onClick={() => setAgentOpen((v) => !v)}
          className="w-full flex items-center gap-2.5 px-4 py-3 text-left transition-colors"
          style={{ backgroundColor: agentOpen ? C.inner : "transparent" }}
        >
          <span className="text-lg">🤖</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-extrabold" style={{ color: C.ink }}>키디에게 말로 일정 부탁하기</p>
            <p className="text-xs" style={{ color: C.sub }}>예: &quot;13일 태권도 넣어줘&quot;</p>
          </div>
          <span className="text-xs" style={{ color: C.sub, transform: agentOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }}>▼</span>
        </button>

        {agentOpen && (
          <div className="sch-panel px-3 pb-3" style={{ borderTop: `1px solid rgba(255,255,255,0.06)` }}>
            {/* 대화 로그 */}
            {agentLog.length > 0 && (
              <div className="flex flex-col gap-2 py-3 max-h-64 overflow-y-auto">
                {agentLog.map((m, i) => (
                  m.role === "user" ? (
                    <div key={i} className="self-end max-w-[80%] rounded-2xl rounded-br-sm px-3.5 py-2 text-sm font-medium"
                      style={{ background: `linear-gradient(135deg, ${C.accent}, ${C.accent2})`, color: "#08160F" }}>
                      {m.text}
                    </div>
                  ) : (
                    <div key={i} className="self-start max-w-[88%]">
                      <div className="rounded-2xl rounded-bl-sm px-3.5 py-2 text-sm" style={{ backgroundColor: C.inner, color: C.ink }}>
                        {m.text}
                      </div>
                      {/* 결과 일정 미니 카드 (등록/조회/수정/삭제 대상) */}
                      {m.cards && m.cards.length > 0 && (
                        <div className="flex flex-col gap-1.5 mt-1.5">
                          {m.cards.map((s) => (
                            <div key={s.id} className="flex items-center gap-2 rounded-xl px-3 py-2"
                              style={{ backgroundColor: C.card, border: `1px solid ${TYPE_META[s.type]?.color || C.accent}55` }}>
                              <span className="text-base shrink-0">{TYPE_META[s.type]?.emoji || "📌"}</span>
                              <span className="text-xs font-extrabold rounded px-1.5 py-0.5 shrink-0" style={{ color: "#08160F", backgroundColor: TYPE_META[s.type]?.color || C.accent }}>
                                {Number(s.date.slice(5, 7))}/{Number(s.date.slice(8, 10))}
                                {s.endDate && s.endDate > s.date ? `~${Number(s.endDate.slice(5, 7))}/${Number(s.endDate.slice(8, 10))}` : ""}
                              </span>
                              {s.time && <span className="text-xs font-bold shrink-0" style={{ color: C.accent }}>{s.time}</span>}
                              <span className="text-sm font-bold truncate" style={{ color: C.ink }}>{s.title}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                ))}
                {agentBusy && (
                  <div className="self-start rounded-2xl rounded-bl-sm px-3.5 py-2 text-sm" style={{ backgroundColor: C.inner, color: C.sub }}>
                    키디가 달력에 적는 중... ✍️
                  </div>
                )}
              </div>
            )}

            {/* 예시 칩 (로그 비었을 때만) */}
            {agentLog.length === 0 && (
              <div className="flex flex-wrap gap-1.5 py-3">
                {["13일 태권도 넣어줘", "이번 달 일정 알려줘", "내일 오후 5시 가족 외식", "13일 태권도 취소해줘"].map((ex) => (
                  <button key={ex} onClick={() => sendAgent(ex)} disabled={agentBusy}
                    className="rounded-full px-3 py-1.5 text-xs font-medium transition-transform active:scale-95 disabled:opacity-50"
                    style={{ backgroundColor: C.inner, color: C.sub, border: "1px solid rgba(255,255,255,0.08)" }}>
                    {ex}
                  </button>
                ))}
              </div>
            )}

            {/* 입력 바 */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={agentInput}
                onChange={(e) => setAgentInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") sendAgent(); }}
                placeholder="일정을 말로 부탁해보세요"
                disabled={agentBusy}
                className="flex-1 rounded-xl px-3.5 py-2.5 text-sm outline-none disabled:opacity-60"
                style={{ backgroundColor: C.inner, color: C.ink, border: "1px solid rgba(24,196,154,0.25)" }}
              />
              <button
                onClick={() => sendAgent()}
                disabled={agentBusy || !agentInput.trim()}
                className="rounded-xl px-4 py-2.5 text-sm font-extrabold transition-transform active:scale-95 disabled:opacity-40"
                style={{ background: `linear-gradient(135deg, ${C.accent}, ${C.accent2})`, color: "#08160F" }}
              >
                보내기
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── 월간 달력 ── */}
      <div ref={calRef} className="relative rounded-2xl p-2 md:p-3" style={{ backgroundColor: C.card, border: "1px solid rgba(255,255,255,0.08)" }}>
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
          <div className="flex flex-col" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", borderLeft: "1px solid rgba(255,255,255,0.06)" }}>
            {weeks.map((week, wi) => {
              const { bars, lanes } = computeWeekBars(week, spanItems);
              const BAR_H = 17, BAR_GAP = 2, BAR_TOP = 38; // 날짜 원(26px) 아래에서 시작
              const barZoneH = lanes * (BAR_H + BAR_GAP);
              // 기간 바가 가린 칸 수만큼 단일 칩 표시 개수를 줄여 셀이 넘치지 않게
              const singleMax = Math.max(1, 3 - lanes);
              return (
                <div key={`w${wi}`} className="relative grid grid-cols-7">
                  {week.map((cell, di) => {
                    if (!cell) return <div key={`b${wi}-${di}`} />;
                    const single = sortDay(singleByDate[cell.date] || []);
                    const isToday = cell.date === today;
                    const isSelected = cell.date === selectedDate;
                    const dow = di;
                    return (
                      <button
                        key={cell.date}
                        onClick={(e) => openDay(cell.date, originFromEvent(e.currentTarget, calRef.current))}
                        className="sch-cell flex flex-col p-1.5 text-left"
                        style={{
                          minHeight: "104px",
                          backgroundColor: isSelected ? "rgba(24,196,154,0.07)" : "transparent",
                          borderRight: "1px solid rgba(255,255,255,0.06)",
                          borderBottom: "1px solid rgba(255,255,255,0.06)",
                        }}
                      >
                        <span
                          className="inline-flex items-center justify-center mb-1"
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: "9999px",
                            fontSize: "13px",
                            fontWeight: 700,
                            color: isToday ? "#08160F" : dow === 0 ? "#F2655C" : dow === 6 ? "#5AA9E6" : C.sub,
                            backgroundColor: isToday ? C.accent : "transparent",
                            border: isSelected && !isToday ? `2px solid ${C.accent}` : "none",
                          }}
                        >
                          {cell.day}
                        </span>
                        {/* 기간 바가 차지할 공간 확보 (바는 아래 절대배치 레이어에서 그림) */}
                        {barZoneH > 0 && <div style={{ height: barZoneH }} />}
                        {/* 단일일 칩 */}
                        <div className="flex flex-col gap-0.5 overflow-hidden">
                          {single.slice(0, singleMax).map((s) => (
                            <span
                              key={s.id}
                              className="truncate rounded px-1 py-0.5 leading-tight"
                              style={{ fontSize: "11px", backgroundColor: `${TYPE_META[s.type]?.color || C.accent}22`, color: TYPE_META[s.type]?.color || C.accent }}
                            >
                              {TYPE_META[s.type]?.emoji} {s.title}
                            </span>
                          ))}
                          {single.length > singleMax && <span style={{ fontSize: "11px", color: C.dim }}>+{single.length - singleMax}</span>}
                        </div>
                      </button>
                    );
                  })}

                  {/* 기간 바 레이어 (셀 위에 가로로 얹음) */}
                  {bars.map((b) => {
                    const meta = TYPE_META[b.s.type] || {};
                    const color = meta.color || C.accent;
                    const left = `calc((100% - ${6 * GRID_GAP}px) / 7 * ${b.startCol} + ${GRID_GAP * b.startCol}px)`;
                    const width = `calc((100% - ${6 * GRID_GAP}px) / 7 * ${b.span} + ${GRID_GAP * (b.span - 1)}px)`;
                    return (
                      <div
                        key={`${b.s.id}-w${wi}`}
                        onClick={(e) => { e.stopPropagation(); openDay(b.s.date, originFromEvent(e.currentTarget, calRef.current)); }}
                        className="sch-bar absolute truncate cursor-pointer"
                        style={{
                          top: BAR_TOP + b.lane * (BAR_H + BAR_GAP),
                          left,
                          width,
                          height: BAR_H,
                          lineHeight: `${BAR_H}px`,
                          paddingLeft: 6,
                          paddingRight: 6,
                          fontSize: "11px",
                          fontWeight: 700,
                          color: "#08160F",
                          backgroundColor: color,
                          borderTopLeftRadius: b.clipLeft ? 0 : 5,
                          borderBottomLeftRadius: b.clipLeft ? 0 : 5,
                          borderTopRightRadius: b.clipRight ? 0 : 5,
                          borderBottomRightRadius: b.clipRight ? 0 : 5,
                        }}
                        title={b.s.title}
                      >
                        {b.clipLeft ? "◀ " : ""}{meta.emoji} {b.s.title}{b.clipRight ? " ▶" : ""}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}

        {/* ── 선택 날짜 팝오버 (달력 위에 떠서 — 스크롤 없이 바로 보임) ── */}
        {panelOpen && (
          <div
            className="sch-backdrop absolute inset-0 z-20 flex items-center justify-center p-3"
            style={{ backgroundColor: "rgba(6,16,16,0.45)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)", borderRadius: "16px" }}
            onClick={closePanel}
          >
              <div
                key={selectedDate}
                className="sch-pop w-full max-w-md p-4 md:p-5 overflow-y-auto"
                style={{ "--dx": `${popOrigin.dx}px`, "--dy": `${popOrigin.dy}px`, marginBottom: "14%", maxHeight: "calc(100% - 24px)", borderRadius: "18px", backgroundColor: C.card, border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 20px 50px rgba(0,0,0,0.5)" }}
                onClick={(e) => e.stopPropagation()}
              >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-extrabold flex items-center gap-2" style={{ color: C.ink }}>
                {fmtSelected(selectedDate)}
                {selectedDate === today && (
                  <span className="text-xs font-bold rounded-full px-2 py-0.5" style={{ color: "#08160F", backgroundColor: C.accent }}>오늘</span>
                )}
              </h3>
              <button onClick={closePanel} style={{ color: C.sub }}><FaTimes /></button>
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
                          {s.endDate && s.endDate > s.date && (
                            <span className="text-xs rounded px-1.5 py-0.5" style={{ color: C.sub, backgroundColor: C.card }}>
                              {s.date.slice(5).replace("-", "/")}~{s.endDate.slice(5).replace("-", "/")}
                            </span>
                          )}
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
    </div>
  );
}
