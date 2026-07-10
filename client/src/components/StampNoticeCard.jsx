import { STAMP_NOTICE } from "../utils/diaryCopy";

// ── AD-6 §4: 부모 도장 미확인 알림 카드(아이 홈) ──
// 도장만 / 편지 포함(hasLetter) 분기 · 탭 → 책장 이동(onOpen) · ✕ 닫기(onClose).
// ⚠️ 푸시·뱃지·숫자 없음(인앱 1카드). 표시 여부·티저 우선·seen 소멸은 KidHome이 제어(이 컴포넌트는 표현만).
export default function StampNoticeCard({ hasLetter, onOpen, onClose }) {
  return (
    <div className="fixed z-40" style={{ right: 16, bottom: 152 }}>
      <div className="flex items-center gap-2 rounded-2xl px-4 py-3" style={{ maxWidth: 264, backgroundColor: "#0E2A2A", border: "1px solid rgba(95,224,188,0.35)", boxShadow: "0 8px 24px rgba(0,0,0,0.45)" }}>
        <button onClick={onOpen} className="flex items-center gap-2 text-left">
          <span className="text-xl shrink-0">📖</span>
          <p className="text-sm font-bold" style={{ color: "#EAF5F1" }}>{hasLetter ? STAMP_NOTICE.letter : STAMP_NOTICE.stamp}</p>
        </button>
        <button onClick={onClose} aria-label="닫기" className="shrink-0 text-sm" style={{ color: "#90A9A8" }}>✕</button>
      </div>
    </div>
  );
}
