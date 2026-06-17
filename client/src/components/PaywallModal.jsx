import { useNavigate } from "react-router-dom";
import { FaTimes, FaLock } from "react-icons/fa";

// reason: "tier2" (AI 정밀검수 한도 초과) | "profile" (프로필 추가 한도 초과)
export default function PaywallModal({ onClose, reason = "tier2" }) {
  const navigate = useNavigate();

  const config = {
    tier2: {
      icon: "🤖",
      title: "오늘의 AI 정밀검수를\n모두 사용했어요",
      subtitle: "무료 플랜은 하루 3회까지 이용 가능해요",
      freeItem: "AI 정밀검수 하루 3회",
      premiumItem: "AI 정밀검수 무제한",
    },
    profile: {
      icon: "👶",
      title: "자녀 프로필은\n1명까지 만들 수 있어요",
      subtitle: "프리미엄으로 업그레이드하면 최대 4명까지!",
      freeItem: "자녀 프로필 1명",
      premiumItem: "자녀 프로필 최대 4명",
    },
  }[reason] || {};

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.65)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm bg-white"
        style={{ borderRadius: "28px", overflow: "hidden" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 닫기 */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full"
          style={{ backgroundColor: "#F0F5ED", color: "#6B7A65" }}
        >
          <FaTimes className="text-xs" />
        </button>

        {/* 상단 그라디언트 헤더 */}
        <div
          className="px-6 pt-8 pb-6 text-center"
          style={{ background: "linear-gradient(135deg, #2C3528 0%, #4a6741 100%)" }}
        >
          <div className="text-4xl mb-3">{config.icon}</div>
          <h2
            className="text-lg font-bold text-white leading-snug"
            style={{ whiteSpace: "pre-line" }}
          >
            {config.title}
          </h2>
          <p className="text-sm text-white/70 mt-2">{config.subtitle}</p>
        </div>

        {/* 비교 섹션 */}
        <div className="px-6 py-5 flex flex-col gap-3">
          {/* 무료 플랜 */}
          <div
            className="flex items-center gap-3 rounded-2xl px-4 py-3"
            style={{ backgroundColor: "#F8F7F2", border: "1px solid #E4EAE0" }}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm"
              style={{ backgroundColor: "#E4EAE0", color: "#9BA89A" }}>
              <FaLock className="text-xs" />
            </span>
            <div>
              <p className="text-xs font-medium" style={{ color: "#9BA89A" }}>Free 플랜 (현재)</p>
              <p className="text-sm font-semibold" style={{ color: "#6B7A65" }}>{config.freeItem}</p>
            </div>
          </div>

          {/* 프리미엄 플랜 */}
          <div
            className="flex items-center gap-3 rounded-2xl px-4 py-3"
            style={{ background: "linear-gradient(135deg, #E8F5E4, #F0F5ED)", border: "1.5px solid #6DAB60" }}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm"
              style={{ backgroundColor: "#6DAB60", color: "white" }}>
              ✓
            </span>
            <div>
              <p className="text-xs font-medium" style={{ color: "#6DAB60" }}>💎 Premium 업그레이드</p>
              <p className="text-sm font-semibold" style={{ color: "#2C3528" }}>{config.premiumItem}</p>
            </div>
          </div>

          {/* 가격 표시 */}
          <p className="text-center text-xs" style={{ color: "#9BA89A" }}>
            월 <span className="font-bold text-sm" style={{ color: "#2C3528" }}>4,900원</span> · 언제든지 해지 가능
          </p>

          {/* CTA 버튼 */}
          <button
            onClick={() => { onClose(); navigate("/account?tab=membership"); }}
            className="w-full rounded-2xl py-3.5 text-sm font-bold text-white transition hover:opacity-90"
            style={{ backgroundColor: "#6DAB60" }}
          >
            프리미엄 시작하기 →
          </button>

          {/* 나중에 */}
          <button
            onClick={onClose}
            className="w-full py-2 text-sm font-medium transition hover:opacity-70"
            style={{ color: "#9BA89A" }}
          >
            나중에
          </button>
        </div>
      </div>
    </div>
  );
}
