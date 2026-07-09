import { useState, useEffect, useCallback } from "react";

// ── 앵커드 스포트라이트 투어 공용 엔진 ──
//   부모 대시보드에서 검증된 rAF 측정 로직을 재사용 가능하게 추출(무회귀 위해 부모는 미이관).
//   stations: [{ targetId, interactive, ...호스트자유필드 }] — targetId=data-tour-id로 짚을 요소.
//   반환: isActive/step/rect/station/total/isLast + start/next/prev/goto/exit.
//   ⚠️ 시드 주입·탭 전환·강제펼침 등 화면별 부수효과는 '호스트'가 반환값(isActive/step/station)으로 처리.
//      훅은 순수 상태+측정만 — 5개 아이 페이지 공용이라 특정 화면에 결합 금지.
export default function useTour(stations) {
  const [isActive, setIsActive] = useState(false);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState(null); // 현재 정거장 대상의 화면 좌표(스포트라이트)

  const start = useCallback(() => { setStep(0); setIsActive(true); }, []);
  const exit = useCallback(() => { setIsActive(false); setStep(0); setRect(null); }, []);
  const goto = useCallback(
    (n) => setStep(Math.max(0, Math.min(stations.length - 1, n))),
    [stations.length]
  );
  const next = useCallback(() => setStep((s) => Math.min(stations.length - 1, s + 1)), [stations.length]);
  const prev = useCallback(() => setStep((s) => Math.max(0, s - 1)), []);

  // 대상(data-tour-id) 측정 → 스포트라이트 rect 주입. 대상이 나타날 때까지 rAF 재시도 + 화면 안으로 스크롤.
  //   못 찾으면 rect=null 폴백(전체 딤+중앙 말풍선) — 투어가 절대 안 깨지게. (부모 대시보드 287~312 동일)
  useEffect(() => {
    if (!isActive) { setRect(null); return; }
    const targetId = stations[step]?.targetId;
    if (!targetId) { setRect(null); return; }
    let raf = 0, scrolled = false, last = null;
    const changed = (a, b) => !a || Math.abs(a.top - b.top) > 0.5 || Math.abs(a.left - b.left) > 0.5 || Math.abs(a.width - b.width) > 0.5 || Math.abs(a.height - b.height) > 0.5;
    const tick = () => {
      const el = document.querySelector(`[data-tour-id="${targetId}"]`);
      if (el) {
        if (!scrolled) { try { el.scrollIntoView({ block: "center" }); } catch { /* jsdom 미구현 무시 */ } scrolled = true; }
        const r = el.getBoundingClientRect();
        if (r.width > 0 || r.height > 0) {
          const nx = { top: r.top, left: r.left, width: r.width, height: r.height };
          if (changed(last, nx)) { last = nx; setRect(nx); }
        }
      } else if (last) { last = null; setRect(null); } // 대상 사라짐 → 폴백
      raf = requestAnimationFrame(tick);
    };
    if (!document.querySelector(`[data-tour-id="${targetId}"]`)) setRect(null); // 아직 없으면 이전 rect 잔존 방지
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, step]);

  return {
    isActive, step, rect,
    station: stations[step],
    total: stations.length,
    isLast: step >= stations.length - 1,
    start, next, prev, goto, exit,
  };
}
