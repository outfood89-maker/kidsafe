import { useState } from "react";

// 키디 로딩 애니메이션 (투명 배경 WebP)
// 마젠타(#FF00FF) 배경으로 생성한 영상을 ffmpeg 크로마키로 투명 처리 → 애니메이션 WebP.
// 애니메이션 WebP는 <img>로 넣으면 자동 재생·무한 루프되고 iOS Safari까지 투명 지원.
// clip: "search"(검색) | "chat"(검수·코치) | "hello"(인사)
const SRC = {
  search: "/videos/kiddy_search.webp",
  chat: "/videos/kiddy_chat.webp",
  hello: "/videos/kiddy_hello.webp",
};

// webp 로드 실패 시 폴백할 정적 PNG (KiddyImg와 동일 자산)
const FALLBACK_PNG = {
  search: "/images/kiddy_search.png",
  chat: "/images/kiddy_chat.png",
  hello: "/images/kiddy_hello.png",
};

// float 키프레임 CSS 한 번만 주입 (KiddyImg와 동일한 kiddyFloat 재사용)
const STYLE_ID = "kiddy-float-style";
if (typeof document !== "undefined" && !document.getElementById(STYLE_ID)) {
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes kiddyFloat {
      0%, 100% { transform: translateY(0px); }
      50%       { transform: translateY(-12px); }
    }
  `;
  document.head.appendChild(style);
}

/**
 * clip  : "search" | "chat" | "hello"
 * size  : 픽셀 크기 (정사각 박스, 내부는 contain이라 안 잘림)
 * float : true → 둥둥 뜨는 애니메이션
 * scale : 레이아웃 박스 크기는 그대로 두고 '보이는' 키디만 확대 (예: 1.2 → 20% 크게).
 *         transform이라 주변 레이아웃을 밀지 않음. img에 적용해 float(바깥 div)과 충돌 없음.
 */
export default function KiddyVideo({ clip = "chat", size = 160, float = false, scale = 1 }) {
  const [error, setError] = useState(false);
  const src = error ? (FALLBACK_PNG[clip] ?? FALLBACK_PNG.chat) : (SRC[clip] ?? SRC.chat);

  return (
    <div
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        animation: float ? "kiddyFloat 2.5s ease-in-out infinite" : "none",
      }}
    >
      <img
        src={src}
        alt={`키디 ${clip}`}
        onError={() => setError(true)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          display: "block",
          transform: scale !== 1 ? `scale(${scale})` : undefined,
        }}
      />
    </div>
  );
}
