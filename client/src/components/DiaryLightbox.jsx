import { useEffect } from "react";
import { LIGHTBOX } from "../utils/diaryCopy";

// ── 그림일기 라이트박스: 상세 그림 탭 → 전체화면 확대 (읽기전용·표시 전용) ──
//   서버·저장 무관. src(IDB에서 로드된 데이터 URL)만 크게 렌더. 배경/✕/ESC로 닫힘.
//   아이·부모 상세 뷰 공용(FamilyShelf·ParentDiaryShelf).
//   ⚠️ 가운데 정렬은 바깥 flex, 확대 애니메이션은 안쪽 img에만(인라인 transform 충돌 방지·CLAUDE.md).
// props: src(데이터 URL·falsy면 미렌더) · alt · onClose
export default function DiaryLightbox({ src, alt, onClose }) {
  // ESC 닫기 — 키보드 접근성. 언마운트 시 리스너 정리(유령 리스너 방지).
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!src) return null;

  return (
    <div
      data-testid="diary-lightbox"
      onClick={onClose}
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
    >
      {/* 닫기 버튼 — 크게(4~7세 탭 여유) */}
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        aria-label={LIGHTBOX.close}
        className="absolute top-4 right-4 flex items-center justify-center rounded-full text-2xl font-bold active:scale-95 transition"
        style={{ width: "48px", height: "48px", backgroundColor: "rgba(255,255,255,0.15)", color: "#FFFFFF" }}
      >
        ✕
      </button>

      {/* 그림 — 그림 탭도 닫힘(배경으로 버블). '아무 곳이나 누르면 닫혀요' 카피와 일치, 4~7세 자연 탭 존중. 확대 애니메이션은 여기에만. */}
      <img
        src={src}
        alt={alt || "그림"}
        className="animate-lightbox-pop rounded-2xl cursor-zoom-out"
        style={{ maxWidth: "100%", maxHeight: "88vh", objectFit: "contain", boxShadow: "0 12px 48px rgba(0,0,0,0.6)" }}
      />

      {/* 닫기 힌트 */}
      <p
        className="absolute bottom-5 left-0 right-0 text-center text-sm font-bold"
        style={{ color: "rgba(255,255,255,0.75)" }}
      >
        {LIGHTBOX.hint}
      </p>
    </div>
  );
}
