import { useState, useEffect } from "react";
import KiddyImg from "./KiddyImg";
import Typewriter from "./Typewriter";
import { withVocative } from "../utils/korean";
import { greetingLine } from "../utils/kiddyLines";
import useKiddyVoice from "../hooks/useKiddyVoice";

// F1 — 키디 환영 인사 (체크인 흐름의 첫 화면)
// "키디가 기다린다" 한 겹: 어제 기분(recentMood)을 가볍게 언급. 없으면(첫날) 기본 인사.
// 대사는 kiddyLines.js 풀에서 랜덤(이름 자주 호출) — 마운트 시 한 번 뽑아 고정(재타이핑 방지).
// props:
//  - name        : 아이 이름
//  - recentMood  : 어제(가장 최근) 기분 코드 (happy/good/excited/soso/sad/angry) | null
//  - greeting    : Claude 생성 인사(있으면 우선). 없으면(null) 로컬 greetingLine 템플릿 폴백
//  - onContinue  : "응! 얘기하자" → 질문으로
//  - onSkip      : "오늘은 그냥 볼래" → 체크인 건너뛰기(강제 금지)

const C = {
  card: "#0E2A2A", accent: "#18C49A", accent2: "#14B8C4", ink: "#EAF5F1", sub: "#90A9A8",
};

export default function KiddyGreeting({ name, recentMood, greeting, onContinue, onSkip }) {
  // Claude 생성 인사가 있으면 그걸, 없으면 로컬 템플릿. 마운트 시 한 번만 고정(리렌더 시 재타이핑 방지).
  const [line] = useState(() => greeting || greetingLine(name, recentMood));

  // 키디 음성 — 인사 대사를 읽어줌. 세션 기분 아직 모름 → 밝게(bright). H 브리프 §2.
  const voice = useKiddyVoice();
  useEffect(() => {
    voice.speak(line, "bright");
  }, [line]); // eslint-disable-line react-hooks/exhaustive-deps

  const btnPrimary = {
    background: `linear-gradient(135deg, ${C.accent}, ${C.accent2})`,
    color: "#08160F", boxShadow: "0 6px 18px rgba(24,196,154,0.35)",
  };

  return (
    <div className="flex flex-col items-center text-center">
      <KiddyImg pose="hello" size={200} float />

      <p className="font-bold mt-2" style={{ color: "#5FE0BC", fontSize: "15px" }}>
        {withVocative(name)}!
      </p>

      <div
        className="w-full rounded-2xl px-6 py-5 mt-2"
        style={{ backgroundColor: C.card, border: "1px solid rgba(255,255,255,0.08)" }}
      >
        <Typewriter
          key={line}
          text={line}
          className="font-extrabold leading-snug"
          style={{ color: C.ink, fontSize: "19px" }}
        />
      </div>

      {/* 키디 목소리 다시듣기 (메모리 재생 — 추가 호출 0) */}
      {voice.hasAudio && (
        <button
          onClick={() => voice.replay()}
          className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-full text-sm font-bold transition active:scale-95"
          style={{ backgroundColor: C.card, color: C.sub, border: "1px solid rgba(255,255,255,0.08)" }}
          aria-label="키디 목소리 다시 듣기"
        >
          🔊 다시 듣기
        </button>
      )}

      <button
        onClick={onContinue}
        className="w-full rounded-2xl py-4 mt-5 font-extrabold transition active:scale-95"
        style={btnPrimary}
      >
        응! 얘기하자 😊
      </button>
      <button
        onClick={onSkip}
        className="mt-3 text-sm font-semibold transition hover:opacity-80"
        style={{ color: C.sub }}
      >
        오늘은 그냥 볼래
      </button>
    </div>
  );
}
