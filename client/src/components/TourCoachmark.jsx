import KiddyImg from "./KiddyImg";
import { PARENT_TOUR } from "../utils/diaryCopy";

// ── AD-7: 부모 '둘러보기' 코치마크 오버레이 ──
//   정직 배너(4정거장 상시 상단) + 정거장 안내 + [그만보기/이전/다음]. 카피는 diaryCopy PARENT_TOUR(§5 스탬프).
//   ⚠️ 읽기전용 정거장(①②④): 반투명 backdrop으로 화면 포인터 차단(오조작 방지).
//   ⚠️ 인터랙션 정거장(③ 책장): backdrop 없이 컨테이너 pointer-events-none → 책장 클릭이 그대로 통과. 안내 카드만 클릭 가능.
// props: step(0~) · total · interactive(bool·③만 true) · onPrev · onNext · onExit
export default function TourCoachmark({ step, total, interactive, onPrev, onNext, onExit }) {
  const isLast = step >= total - 1;
  const body = PARENT_TOUR.stations[step] || "";

  return (
    <div
      data-testid="tour-overlay"
      data-interactive={interactive ? "1" : "0"}
      className={`fixed inset-0 z-[60] flex flex-col ${interactive ? "pointer-events-none" : ""}`}
    >
      {/* 읽기전용 정거장 backdrop(포인터 차단). ③은 렌더 안 함(책장 인터랙션 허용) */}
      {!interactive && <div data-testid="tour-backdrop" className="absolute inset-0" style={{ backgroundColor: "rgba(0,0,0,0.6)" }} />}

      {/* 정직 배너 — 상시. ⚠️ NavBar(고정 top·높이 56px) 위에 겹치지 않게 pt로 그 아래로 내림. */}
      <div className="relative px-4" style={{ paddingTop: "68px" }}>
        <div
          className="mx-auto max-w-lg rounded-full px-4 py-2.5 text-center text-sm font-bold"
          style={{ backgroundColor: "rgba(24,196,154,0.18)", color: "#5FE0BC", border: "1px solid rgba(24,196,154,0.4)" }}
        >
          {PARENT_TOUR.banner}
        </div>
      </div>

      {/* 안내 카드 — 하단 고정, 항상 클릭 가능 */}
      <div className="relative mt-auto p-4 pointer-events-auto">
        <div
          className="mx-auto max-w-lg rounded-2xl p-5"
          style={{ backgroundColor: "#0E2A2A", border: "1px solid rgba(24,196,154,0.35)", boxShadow: "0 12px 40px rgba(0,0,0,0.5)" }}
        >
          <div className="flex items-start gap-3">
            <div className="shrink-0"><KiddyImg pose="hello" size={52} /></div>
            <p className="pt-0.5 text-base md:text-lg font-bold leading-relaxed" style={{ color: "#EAF5F1" }}>{body}</p>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <span className="mr-auto text-xs" style={{ color: "#6B7E7C" }}>{step + 1} / {total}</span>
            <button
              onClick={onExit}
              className="rounded-xl px-3 py-2 text-xs font-bold transition active:scale-95"
              style={{ color: "#8FA89F" }}
            >
              {PARENT_TOUR.nav.exit}
            </button>
            {step > 0 && (
              <button
                onClick={onPrev}
                className="rounded-xl px-4 py-2 text-sm font-bold transition active:scale-95"
                style={{ backgroundColor: "#163635", color: "#EAF5F1" }}
              >
                {PARENT_TOUR.nav.prev}
              </button>
            )}
            <button
              onClick={onNext}
              className="rounded-xl px-4 py-2 text-sm font-bold transition active:scale-95"
              style={{ backgroundColor: "#18C49A", color: "#08160F" }}
            >
              {isLast ? PARENT_TOUR.exitCta : PARENT_TOUR.nav.next}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
