// ── 길게 눌러야 실행되는 버튼 (2026-08-09 오너 제안) ──
//
// 🔴 왜 필요한가
//   지우기에는 이미 확인 화면이 있다("이 일기를 지울까요? / 한 번 지우면 되돌릴 수 없어요").
//   그런데 **4~7세는 '응'을 습관적으로 누른다.** 확인 화면이 한 번 더 있어도 탭 두 번이면 끝이다.
//   길게 누르기는 클릭과 달리 **의도를 요구**한다 — 모르고 지우는 것을 구조로 막는다.
//
// ⚠️ 되돌리기(휴지통)를 만들 수는 없다 — 처리방침 제5조에 "지우면 정말 지워집니다" 라고 썼고
//    그건 지켜야 할 약속이다. ⇒ **복구를 만들지 말고 실수를 줄인다.**
//
// 설계 판단
//   ① **차오르는 표시가 필수다.** 아무 반응이 없으면 아이는 "왜 안 눌려?" 하고 포기한다.
//   ② **버튼 밖으로 완전히 나가야 취소.** 아이 손가락은 가만있지 않는다 — 조금 밀렸다고
//      취소하면 4살은 영영 못 지운다.
//   ③ 손을 떼면 **즉시 0으로** 되돌아간다. 진행이 남아 있으면 다음 탭에 바로 지워질 수 있다.
//   ④ 취소 버튼("아니야, 둘래")은 **계속 클릭 한 번**이다 — 빠져나가는 길은 어렵게 만들지 않는다.
//
// ⚠️ 마우스·터치는 pointer 이벤트로 함께 처리된다. 키보드 단독 사용은 지원하지 않는다
//    (오너 확인 2026-08-09: 해당 사용자가 없다). 대신 취소는 언제나 클릭 한 번이라 갇히지 않는다.

import { useRef, useState, useEffect, useCallback } from "react";

/** 눌러야 하는 시간. 아이가 "되고 있다"를 알아차리기에 충분하고, 실수로 채우기엔 긴 값. */
export const HOLD_MS = 2000;

export default function HoldToConfirm({
  onConfirm,
  holdMs = HOLD_MS,
  className = "",
  style = {},
  fillColor = "rgba(242,101,92,0.45)",
  children,
  ...rest
}) {
  const [progress, setProgress] = useState(0);   // 0~1
  const rafRef = useRef(0);
  const startRef = useRef(0);
  const firedRef = useRef(false);                // 한 번만 실행 (rAF 가 겹쳐 두 번 부르지 않게)

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    firedRef.current = false;
    setProgress(0);   // ⚠️ 반드시 0 으로 — 남겨두면 다음 탭에 곧바로 채워진다
  }, []);

  // 언마운트 시 타이머 정리 (유령 실행 차단)
  useEffect(() => stop, [stop]);

  const tick = useCallback(() => {
    const p = Math.min(1, (Date.now() - startRef.current) / holdMs);
    setProgress(p);
    if (p >= 1) {
      if (!firedRef.current) {
        firedRef.current = true;
        stop();
        onConfirm?.();
      }
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [holdMs, onConfirm, stop]);

  const start = useCallback((e) => {
    // 터치에서 길게 누를 때 뜨는 OS 메뉴(복사·선택)를 막는다 — 아이 화면에 나오면 안 된다
    if (e?.preventDefault) e.preventDefault();
    if (rafRef.current) return;          // 이미 진행 중이면 다시 시작하지 않는다
    startRef.current = Date.now();
    firedRef.current = false;
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  return (
    <button
      type="button"
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}      // ② 버튼 밖으로 나가면 취소 (조금 밀리는 건 허용된다)
      onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}   // 길게 누르기 = 우클릭 메뉴 방지
      aria-label={typeof children === "string" ? `${children} (길게 누르기)` : undefined}
      className={`relative overflow-hidden select-none ${className}`}
      style={{ touchAction: "none", ...style }}   // touchAction: 누른 채 스크롤로 새는 것 방지
      {...rest}
    >
      {/* ① 차오르는 표시 — 왼쪽부터. 손을 떼면 width 가 0 이 되어 즉시 되돌아간다 */}
      <span
        aria-hidden="true"
        style={{
          position: "absolute", left: 0, top: 0, bottom: 0,
          width: `${progress * 100}%`,
          backgroundColor: fillColor,
          transition: progress === 0 ? "width .18s ease" : "none",  // 되돌아갈 때만 부드럽게
          pointerEvents: "none",
        }}
      />
      <span style={{ position: "relative" }}>{children}</span>
    </button>
  );
}
