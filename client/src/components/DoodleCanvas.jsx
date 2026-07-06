import { useRef, useState, useEffect } from "react";
import KiddyImg from "./KiddyImg";
import { DIARY_TITLE, FLOW_STOP, DOODLE_DONE_BTN } from "../utils/diaryCopy";

// ── AD-8: 낙서 캔버스 (인앱 생성물만 — 사진·카메라·갤러리 경로 없음, 프라이버시 §0-2) ──
// 4세 기준: 큰 붓 1종·색 6개·되돌리기(스택 pop)·"다 그렸어!". 정교 도구(두께·지우개·도형) 금지.
// 출력 = 크림 배경 합성 PNG(투명 배경이 편집 API에서 왜곡되지 않게). ⚠️ feature/diary-v0 브랜치 전용.

const CREAM = "#FBF6E9";
const CANVAS_W = 720;
const CANVAS_H = 960;   // 3:4 세로(size:auto가 낙서 세로 비율 보존 — 크롭 방지)
const BRUSH = 18;       // 큰 붓 1종
// 크레용 6색(검정·빨강·주황·노랑·초록·파랑)
const COLORS = ["#3A3A3A", "#E5484D", "#F2A63B", "#F6C945", "#3F9E5A", "#3E7BD6"];

export default function DoodleCanvas({ onDone, onCancel }) {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const drawingRef = useRef(false);
  const strokesRef = useRef([]); // [{ color, points:[{x,y}] }] — 되돌리기(pop) 소스
  const curRef = useRef(null);
  const [color, setColor] = useState(COLORS[0]);
  const [hasStroke, setHasStroke] = useState(false);

  // 크림 배경 초기화 + ctx 확보(미지원 환경은 조용히 no-op)
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext ? cv.getContext("2d") : null;
    ctxRef.current = ctx || null;
    if (ctx) {
      ctx.fillStyle = CREAM;
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    }
  }, []);

  const redraw = () => {
    const ctx = ctxRef.current;
    const cv = canvasRef.current;
    if (!ctx || !cv) return;
    ctx.fillStyle = CREAM;
    ctx.fillRect(0, 0, cv.width, cv.height);
    for (const s of strokesRef.current) {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = BRUSH;
      ctx.beginPath();
      s.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.stroke();
      if (s.points.length === 1) { // 한 점 콕 → 원 채우기
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(s.points[0].x, s.points[0].y, BRUSH / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };

  // 화면 좌표 → 캔버스 내부 좌표(스케일 보정)
  const pos = (e) => {
    const cv = canvasRef.current;
    const r = cv.getBoundingClientRect();
    const sx = cv.width / (r.width || 1);
    const sy = cv.height / (r.height || 1);
    return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy };
  };

  const down = (e) => {
    const cv = canvasRef.current;
    if (!cv) return;
    try { cv.setPointerCapture?.(e.pointerId); } catch { /* 무시 */ }
    drawingRef.current = true;
    curRef.current = { color, points: [pos(e)] };
    strokesRef.current.push(curRef.current);
    setHasStroke(true);
    redraw();
  };
  const move = (e) => {
    if (!drawingRef.current || !curRef.current) return;
    curRef.current.points.push(pos(e));
    const ctx = ctxRef.current;
    if (ctx) {
      const pts = curRef.current.points;
      const n = pts.length;
      ctx.strokeStyle = curRef.current.color;
      ctx.lineWidth = BRUSH;
      ctx.beginPath();
      ctx.moveTo(pts[n - 2].x, pts[n - 2].y);
      ctx.lineTo(pts[n - 1].x, pts[n - 1].y);
      ctx.stroke();
    }
  };
  const up = () => { drawingRef.current = false; curRef.current = null; };

  const undo = () => {
    strokesRef.current.pop();
    setHasStroke(strokesRef.current.length > 0);
    redraw();
  };

  const done = () => {
    const cv = canvasRef.current;
    let url = "";
    try { url = cv && cv.toDataURL ? cv.toDataURL("image/png") : ""; } catch { url = ""; }
    onDone?.(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "radial-gradient(120% 90% at 50% 0%, #123a35 0%, #0c1f1d 60%)" }}>
      {/* 헤더: ‹ 그만하기 / 문패 (§0 화면 문법) */}
      <div className="flex items-center justify-between px-4 py-3">
        <button onClick={() => onCancel?.()} className="text-sm font-bold" style={{ color: "#90A9A8" }}>{FLOW_STOP}</button>
        <p className="text-sm font-extrabold" style={{ color: "#5FE0BC" }}>{DIARY_TITLE}</p>
        <span className="w-14" />
      </div>

      <div className="flex flex-1 flex-col items-center gap-3 px-4 pb-4" style={{ minHeight: 0 }}>
        <KiddyImg pose="point" size={72} />
        {/* 색 팔레트(6색) */}
        <div className="flex items-center justify-center gap-2" style={{ flexWrap: "wrap" }}>
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              aria-label={`색 ${c}`}
              className="rounded-full active:scale-90 transition"
              style={{ width: 40, height: 40, backgroundColor: c, border: color === c ? "3px solid #fff" : "3px solid rgba(255,255,255,0.25)", boxShadow: color === c ? "0 0 0 2px #18C49A" : "none" }}
            />
          ))}
        </div>
        {/* 캔버스(크림 종이 — 작품 지면 예외) */}
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          data-testid="doodle-canvas"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onPointerLeave={up}
          className="rounded-2xl"
          style={{ width: "100%", maxWidth: 360, aspectRatio: "3 / 4", backgroundColor: CREAM, boxShadow: "0 8px 24px rgba(0,0,0,0.3)", touchAction: "none" }}
        />
        {/* 되돌리기(아이콘) + 다 그렸어! */}
        <div className="flex w-full items-center gap-2" style={{ maxWidth: 360 }}>
          <button onClick={undo} disabled={!hasStroke} aria-label="되돌리기" className="rounded-2xl px-4 py-3 text-lg font-bold disabled:opacity-40" style={{ backgroundColor: "#13302B", color: "#5FE0BC", border: "1px solid rgba(95,224,188,0.3)" }}>↩️</button>
          <button onClick={done} disabled={!hasStroke} className="flex-1 rounded-2xl px-4 py-3 text-base font-bold disabled:opacity-50" style={{ background: "linear-gradient(135deg, #18C49A, #14B8C4)", color: "#08160F", boxShadow: "0 8px 24px rgba(20,184,196,0.3)" }}>{DOODLE_DONE_BTN}</button>
        </div>
      </div>
    </div>
  );
}
