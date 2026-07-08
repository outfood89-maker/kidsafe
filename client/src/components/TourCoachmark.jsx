import KiddyImg from "./KiddyImg";
import { PARENT_TOUR } from "../utils/diaryCopy";

// ── AD-7: 부모 '둘러보기' 앵커드 코치마크 오버레이 ──
//   정직 배너(상시 상단) + 대상 스포트라이트(rect 구멍) + 그 옆 안내 말풍선 + [그만보기/이전/다음].
//   핵심: 안내 문구가 '지금 화면의 그 요소'를 실제로 짚는다(문구↔화면 불일치 제거). rect는 부모가 측정해 주입.
//   ⚠️ rect 있으면 4-패널(상/하/좌/우)로 대상만 남기고 어둡게 + 바깥 클릭 차단. 대상 구멍은 열려 통과.
//      interactive(③ 책장)일 때만 구멍 안 클릭이 실제로 먹힘(도장 체험). 읽기전용은 배경 inert가 별도 방어.
//   ⚠️ rect 없으면(측정 전/대상 없음) 전체 어둡게 + 중앙 하단 말풍선(폴백 — 투어가 절대 안 깨지게).
// props: rect({top,left,width,height}|null) · text · step · total · interactive · onPrev · onNext · onExit
const DIM = "rgba(0,0,0,0.62)";
const PAD = 12; // 대상 주위 여백(구멍이 요소에 딱 붙지 않게 — 예제가 여유 있게 보이도록)

export default function TourCoachmark({ rect, text, step, total, interactive, onPrev, onNext, onExit }) {
  const isLast = step >= total - 1;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;

  // 대상 스포트라이트 구멍(여백 포함, 뷰포트 상단 클램프)
  const hole = rect
    ? {
        top: Math.max(0, rect.top - PAD),
        left: Math.max(0, rect.left - PAD),
        width: rect.width + PAD * 2,
        height: rect.height + PAD * 2,
      }
    : null;

  // 말풍선은 대상 반대쪽 절반에 배치(대상을 가리지 않게). 대상이 위쪽이면 하단, 아래쪽이면 상단.
  // rect 없으면(폴백) 하단 고정(기존 동작).
  const cardAtBottom = hole ? hole.top + hole.height / 2 < vh * 0.5 : true;

  return (
    <div
      data-testid="tour-overlay"
      data-interactive={interactive ? "1" : "0"}
      className="fixed inset-0 z-[60] pointer-events-none"
    >
      {/* ── 배경 딤 ── */}
      {/* ⚠️ 루트가 pointer-events-none이라 '구멍'은 실제로 밑의 대상(도장)으로 클릭 통과.
          딤 패널·폴백 backdrop만 pointer-events-auto로 되살려 바깥 클릭은 차단(적대검증 MED 수정). */}
      {hole ? (
        // 4-패널 스포트라이트: 대상 구멍만 남기고 어둡게 + 바깥 클릭 차단(구멍은 열려 통과)
        <div data-testid="tour-spotlight">
          <div className="fixed left-0 right-0 top-0 pointer-events-auto" style={{ height: hole.top, backgroundColor: DIM }} />
          <div className="fixed left-0 right-0 bottom-0 pointer-events-auto" style={{ top: hole.top + hole.height, backgroundColor: DIM }} />
          <div className="fixed pointer-events-auto" style={{ top: hole.top, left: 0, width: hole.left, height: hole.height, backgroundColor: DIM }} />
          <div className="fixed pointer-events-auto" style={{ top: hole.top, left: hole.left + hole.width, right: 0, height: hole.height, backgroundColor: DIM }} />
          {/* 대상 강조 링(클릭 통과) */}
          <div
            className="fixed pointer-events-none animate-tour-pulse"
            style={{
              top: hole.top, left: hole.left, width: hole.width, height: hole.height,
              borderRadius: "16px", border: "2px solid #18C49A", boxShadow: "0 0 0 3px rgba(24,196,154,0.28)",
            }}
          />
        </div>
      ) : (
        // 폴백: 전체 딤(대상 측정 전/없음) — 클릭 차단
        <div data-testid="tour-backdrop" className="fixed inset-0 pointer-events-auto" style={{ backgroundColor: DIM }} />
      )}

      {/* ── 정직 배너 (상시 상단·NavBar 아래) ── */}
      <div className="fixed left-0 right-0 top-0 px-4 pointer-events-none" style={{ paddingTop: "68px" }}>
        <div
          className="mx-auto max-w-lg rounded-full px-4 py-2.5 text-center text-sm font-bold"
          style={{ backgroundColor: "rgba(14,42,42,0.94)", color: "#5FE0BC", border: "1px solid rgba(24,196,154,0.45)" }}
        >
          {PARENT_TOUR.banner}
        </div>
      </div>

      {/* ── 안내 말풍선 (대상 반대쪽 절반, 카드만 클릭 가능) ── */}
      <div
        className={`fixed left-0 right-0 px-4 pointer-events-none ${cardAtBottom ? "bottom-0 pb-4" : "top-0 pt-32"}`}
      >
        <div
          className="mx-auto max-w-lg rounded-2xl p-5 pointer-events-auto"
          style={{ backgroundColor: "#0E2A2A", border: "1px solid rgba(24,196,154,0.35)", boxShadow: "0 12px 40px rgba(0,0,0,0.55)" }}
        >
          <div className="flex items-start gap-3">
            <div className="shrink-0"><KiddyImg pose="hello" size={52} /></div>
            <p className="pt-0.5 text-base md:text-lg font-bold leading-relaxed" style={{ color: "#EAF5F1" }}>{text}</p>
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
