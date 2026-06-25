import { useState, useEffect } from "react";

// 키디 말풍선 타이핑 효과 — 글자를 타자치듯 하나씩 출력.
// 이모지(서로게이트 페어) 깨짐 방지를 위해 Array.from 으로 코드포인트 단위 분해.
// 접근성: prefers-reduced-motion 이면 즉시 전체 표시.
//
// ⚠️ 말풍선 내용이 바뀌면 처음부터 다시 타이핑하려면 부모에서 key={text} 로 remount 시킬 것.
//   (effect 내 동기 setState 를 피하려고 초기 count 를 lazy init 으로 0 에서 시작)
//
// props:
//  - text   : 출력할 문자열 (필수)
//  - speed  : 글자당 ms (기본 32)
//  - cursor : 타이핑 중 깜빡 커서 표시 (기본 true)
//  - className/style : 래핑 span 에 적용
const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function Typewriter({ text = "", speed = 32, cursor = true, className, style }) {
  const chars = Array.from(text);
  // 모션 최소화 선호 시 처음부터 전체 표시, 아니면 0 에서 시작 (remount 기준 초기화)
  const [count, setCount] = useState(() => (prefersReducedMotion() ? chars.length : 0));

  useEffect(() => {
    const total = Array.from(text).length;
    if (prefersReducedMotion() || total === 0) return;
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setCount(i);
      if (i >= total) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);

  const shown = chars.slice(0, count).join("");
  const typing = count < chars.length;

  return (
    <span className={className} style={style}>
      {shown}
      {cursor && typing && <span style={{ opacity: 0.55 }}>▍</span>}
    </span>
  );
}
