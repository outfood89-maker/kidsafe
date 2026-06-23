import { useState, useEffect, useCallback } from "react";
import { setParentPin, verifyParentPin } from "../utils/api";

// 부모 PIN 모달 — 프로필별 부모 페이지 진입 보호용 4자리 PIN
// profileId: 대상 아이 프로필 / mode: "verify"(입력) | "setup"(최초 설정) | "change"(변경)
// onSuccess(): 검증/설정 성공 시 호출 / onClose(): 닫기
export default function PinModal({ profileId, mode = "verify", onSuccess, onClose }) {
  const [pin, setPin] = useState("");
  const [firstPin, setFirstPin] = useState("");   // setup/change: 새 PIN 1차 입력 보관
  const [currentHold, setCurrentHold] = useState(""); // change: 현재 PIN 보관
  const [step, setStep] = useState(
    mode === "setup" ? "new" : mode === "change" ? "current" : "verify"
  );
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);

  // 단계별 안내 문구
  const COPY = {
    verify:  { title: "부모 확인", sub: "부모 PIN 4자리를 입력하세요" },
    current: { title: "PIN 변경", sub: "현재 PIN을 입력하세요" },
    new:     { title: mode === "change" ? "PIN 변경" : "PIN 설정", sub: "새 PIN 4자리를 입력하세요" },
    confirm: { title: mode === "change" ? "PIN 변경" : "PIN 설정", sub: "새 PIN을 한 번 더 입력하세요" },
  }[step];

  const fail = useCallback((msg) => {
    setError(msg);
    setShake(true);
    setPin("");
    setTimeout(() => setShake(false), 400);
  }, []);

  const handleComplete = useCallback(async (entered) => {
    setError("");
    // ── 입력(verify) ──
    if (step === "verify") {
      setBusy(true);
      try {
        const { ok } = await verifyParentPin(profileId, entered);
        if (ok) { onSuccess(); } else { fail("PIN이 일치하지 않아요"); }
      } catch { fail("확인 중 오류가 발생했어요"); }
      finally { setBusy(false); }
      return;
    }
    // ── 변경: 현재 PIN 입력 단계 ──
    if (step === "current") {
      setCurrentHold(entered);
      setStep("new");
      setPin("");
      return;
    }
    // ── 설정/변경: 새 PIN 1차 입력 ──
    if (step === "new") {
      setFirstPin(entered);
      setStep("confirm");
      setPin("");
      return;
    }
    // ── 설정/변경: 새 PIN 확인 입력 ──
    if (step === "confirm") {
      if (entered !== firstPin) {
        setStep("new");
        setFirstPin("");
        fail("두 PIN이 달라요. 다시 설정해주세요");
        return;
      }
      setBusy(true);
      try {
        await setParentPin(profileId, entered, mode === "change" ? currentHold : null);
        onSuccess();
      } catch (err) {
        if (err.response?.status === 403) {
          // 현재 PIN 불일치 → 변경 첫 단계로 되돌림
          setStep("current");
          setCurrentHold("");
          setFirstPin("");
          fail("현재 PIN이 일치하지 않아요");
        } else {
          fail("저장 중 오류가 발생했어요");
        }
      } finally { setBusy(false); }
    }
  }, [step, firstPin, currentHold, mode, profileId, onSuccess, fail]);

  // 4자리 채워지면 자동 진행
  useEffect(() => {
    if (pin.length === 4 && !busy) handleComplete(pin);
  }, [pin, busy, handleComplete]);

  const press = (d) => {
    if (busy) return;
    setError("");
    setPin((p) => (p.length < 4 ? p + d : p));
  };
  const back = () => { if (!busy) setPin((p) => p.slice(0, -1)); };

  // 물리 키보드 입력도 지원
  useEffect(() => {
    const onKey = (e) => {
      if (e.key >= "0" && e.key <= "9") press(e.key);
      else if (e.key === "Backspace") back();
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy]);

  const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4" style={{ backgroundColor: "rgba(0,0,0,0.6)" }}>
      <div
        className="w-full max-w-xs p-6"
        style={{ borderRadius: "24px", backgroundColor: "#0E2A2A", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        {/* 헤더 */}
        <div className="text-center mb-5">
          <div className="text-3xl mb-2">🔒</div>
          <h3 className="text-lg font-bold" style={{ color: "#EAF5F1" }}>{COPY.title}</h3>
          <p className="mt-1 text-sm" style={{ color: "#90A9A8" }}>{COPY.sub}</p>
        </div>

        {/* 입력 점 4개 */}
        <div
          className="flex justify-center gap-3 mb-3"
          style={{ transition: "transform 0.1s", transform: shake ? "translateX(0)" : "none", animation: shake ? "pinShake 0.4s" : "none" }}
        >
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className="rounded-full"
              style={{
                width: "16px", height: "16px",
                backgroundColor: i < pin.length ? "#18C49A" : "transparent",
                border: `2px solid ${i < pin.length ? "#18C49A" : "rgba(255,255,255,0.25)"}`,
                transition: "all 0.12s",
              }}
            />
          ))}
        </div>

        {/* 에러 메시지 */}
        <p className="h-5 text-center text-xs font-medium mb-3" style={{ color: "#F2655C" }}>{error}</p>

        {/* 키패드 */}
        <div className="grid grid-cols-3 gap-2.5">
          {KEYS.map((k, idx) =>
            k === "" ? (
              <div key={idx} />
            ) : k === "del" ? (
              <button
                key={idx}
                onClick={back}
                disabled={busy}
                className="flex items-center justify-center rounded-2xl py-3.5 text-xl font-bold transition hover:opacity-80 disabled:opacity-40"
                style={{ backgroundColor: "#163635", color: "#90A9A8" }}
                aria-label="지우기"
              >
                ⌫
              </button>
            ) : (
              <button
                key={idx}
                onClick={() => press(k)}
                disabled={busy}
                className="flex items-center justify-center rounded-2xl py-3.5 text-xl font-bold transition hover:opacity-80 disabled:opacity-40"
                style={{ backgroundColor: "#163635", color: "#EAF5F1" }}
              >
                {k}
              </button>
            )
          )}
        </div>

        {/* 닫기 */}
        <button
          onClick={onClose}
          disabled={busy}
          className="mt-4 w-full rounded-2xl py-2.5 text-sm font-medium transition hover:opacity-80 disabled:opacity-40"
          style={{ color: "#90A9A8" }}
        >
          취소
        </button>
      </div>

      {/* 흔들기 애니메이션 */}
      <style>{`
        @keyframes pinShake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-8px); }
          40%, 80% { transform: translateX(8px); }
        }
      `}</style>
    </div>
  );
}
