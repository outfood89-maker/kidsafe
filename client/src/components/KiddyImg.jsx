import { useState, useEffect } from "react";

const POSES = {
  greet:    { src: "/images/kiddy.png",          fallback: "🤖" },
  hello:    { src: "/images/kiddy_hello.png",    fallback: "👋" },
  think:    { src: "/images/kiddy_think.png",    fallback: "🤔" },
  search:   { src: "/images/kiddy_search.png",   fallback: "🔍" },
  help:     { src: "/images/kiddy_help.png",     fallback: "🙌" },
  jump:     { src: "/images/kiddy_jump.png",     fallback: "🎉" },
  chat:     { src: "/images/kiddy_chat.png",     fallback: "💬" },
  sad:      { src: "/images/kiddy_sad.png",      fallback: "😢" },
  success:  { src: "/images/kiddy_success.png",  fallback: "🏆" },
  confused: { src: "/images/kiddy_confused.png", fallback: "😵" },
  sleep:    { src: "/images/kiddy_sleep.png",    fallback: "😴" },
  point:    { src: "/images/kiddy_point.png",    fallback: "👉" },
  reading:  { src: "/images/kiddy_reading.png",  fallback: "📖" },
};

// 애니메이션 모드에서 순환할 포즈 순서
const ANIMATE_POSES = ["hello", "jump", "success", "point", "reading"];

// float 키프레임 CSS 한 번만 주입
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
 * pose   : "greet" | "hello" | "think" | "help" | "jump" | "chat"
 *        | "sad" | "success" | "confused" | "sleep" | "point" | "reading"
 * size   : 픽셀 크기
 * bg     : 배경색 (기본 투명)
 * circle : true → 원형 크롭 / false(기본) → 이미지 원본 모양 그대로
 * animate: true → 3초마다 포즈 전환 + float 애니메이션
 */
export default function KiddyImg({ pose = "greet", size = 80, bg = null, circle = false, animate = false }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [poseIndex, setPoseIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  // 애니메이션 모드: 3초마다 포즈 전환 (페이드 아웃 → 전환 → 페이드 인)
  useEffect(() => {
    if (!animate) return;
    const interval = setInterval(() => {
      setVisible(false); // 페이드 아웃
      setTimeout(() => {
        setPoseIndex((prev) => (prev + 1) % ANIMATE_POSES.length);
        setLoaded(false);
        setVisible(true); // 페이드 인
      }, 400);
    }, 3000);
    return () => clearInterval(interval);
  }, [animate]);

  const activePose = animate ? ANIMATE_POSES[poseIndex] : pose;
  const { src, fallback } = POSES[activePose] ?? POSES.greet;
  const showFallback = error || !loaded;

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: circle ? "50%" : "0",
        backgroundColor: bg ?? "transparent",
        overflow: circle ? "hidden" : "visible",
        position: "relative",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        // float 애니메이션
        animation: animate ? "kiddyFloat 2.5s ease-in-out infinite" : "none",
      }}
    >
      {showFallback && (
        <span style={{ fontSize: size * 0.52, lineHeight: 1, userSelect: "none" }}>
          {fallback}
        </span>
      )}
      <img
        key={activePose}
        src={src}
        alt={`키디 ${activePose}`}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: circle ? "cover" : "contain",
          opacity: loaded && !error && visible ? 1 : 0,
          transition: "opacity 0.4s ease",
        }}
      />
    </div>
  );
}
