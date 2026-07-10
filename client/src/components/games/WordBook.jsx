import { useState, useEffect, useRef } from "react";
import useKiddyVoice from "../../hooks/useKiddyVoice"; // B09: TTS(오늘 iOS 안정화 상속). 훅 수정 금지·import만. ⚠️ 마이크 없는 화면 — hold/무음우회 금지.
import KiddyImg from "../KiddyImg";
import { WORD_BOOK } from "../../utils/wordBook";
import { WORD_BOOK_COPY } from "../../utils/diaryCopy";

// ── B09: 단어장 — 그림(이모지) 콕 누르면 키디가 label을 읽어주는 배움 놀이 ──
//   보상 프레임=배움·성취('시간' 문구 없음). 완료 판정=서로 다른 단어 10개(세션 Set). onComplete(10) 세션당 1회(ref 가드).
//   카드 탭 = voice.stop()로 중복 가드를 풀어 연타도 매번 소리(InterestSeed 카드 패턴 동일).
//   ⚠️ feature/diary-v0 브랜치 전용. 마이크 코드 없음(재생만).
const GOLD = "#F5B829";

export default function WordBook({ onComplete }) {
  const voice = useKiddyVoice();
  const [catIdx, setCatIdx] = useState(0);
  const [heard, setHeard] = useState(() => new Set()); // 서로 다른 단어(label) 세션 집합 — ⭐ 마크·완료 판정
  const [done, setDone] = useState(false);             // 10개 달성(doneToast·moreHint)
  const completedRef = useRef(false);                  // onComplete 세션당 1회 가드

  const cat = WORD_BOOK[catIdx] || WORD_BOOK[0];

  // 마운트 인트로 1회. 언마운트 시 유령 TTS 차단(voice.stop) — 훅 자체 정리에 더해 방어(§6-⑧).
  useEffect(() => {
    try { voice.speak(WORD_BOOK_COPY.intro, "bright"); } catch { /* 무시 */ }
    return () => { try { voice.stop(); } catch { /* 무시 */ } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 서로 다른 단어 10개 → doneToast(라벨 뒤 이어서 enqueue: 10번째 단어를 끊지 않음) + onComplete(10) 1회.
  useEffect(() => {
    if (heard.size >= 10 && !completedRef.current) {
      completedRef.current = true;
      setDone(true);
      try { voice.enqueue(WORD_BOOK_COPY.doneToast, "bright"); } catch { /* 무시 */ }
      try { onComplete?.(10); } catch { /* 무시 */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heard]);

  // 카드 탭 = 이름 외치기. stop이 중복 가드를 풀어 같은 단어 연타도 매번 소리.
  const onCardTap = (label) => {
    try { voice.stop(); voice.speak(`${label}!`, "bright"); } catch { /* 무시 */ }
    setHeard((prev) => {
      if (prev.has(label)) return prev; // 이미 들은 단어 — Set 불변(재렌더 최소)
      const next = new Set(prev);
      next.add(label);
      return next;
    });
  };

  return (
    <div className="min-h-full px-4 py-4" style={{ backgroundColor: "#0A1E1E" }}>
      {/* 상단: 키디 + 인트로 + 진행 */}
      <div className="flex flex-col items-center pt-2 pb-3 text-center">
        <KiddyImg pose="hello" size={72} bg="transparent" />
        <p className="mt-2 text-base font-extrabold" style={{ color: "#EAF5F1" }}>{WORD_BOOK_COPY.intro}</p>
        <p className="mt-1 text-sm font-bold" style={{ color: GOLD }}>{WORD_BOOK_COPY.progress(heard.size)}</p>
      </div>

      {/* 완료 토스트 + 자유 탐색 안내 */}
      {done && (
        <div className="mx-auto mb-4 max-w-md rounded-2xl px-4 py-3 text-center" style={{ backgroundColor: "rgba(245,184,41,0.12)", border: `1.5px solid ${GOLD}` }}>
          <p className="text-base font-extrabold" style={{ color: GOLD }}>{WORD_BOOK_COPY.doneToast}</p>
          <p className="text-sm mt-0.5" style={{ color: "#90A9A8" }}>{WORD_BOOK_COPY.moreHint}</p>
        </div>
      )}

      {/* 카테고리 탭 — 8개라 가로 스크롤(flex-nowrap + shrink-0) */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-3" style={{ flexWrap: "nowrap" }}>
        {WORD_BOOK.map((c, i) => {
          const on = i === catIdx;
          return (
            <button
              key={c.id}
              onClick={() => setCatIdx(i)}
              className="shrink-0 rounded-full px-3.5 py-2 text-sm font-extrabold transition active:scale-95"
              style={{
                backgroundColor: on ? GOLD : "#163635",
                color: on ? "#1A1300" : "#EAF5F1",
                border: `1px solid ${on ? GOLD : "rgba(255,255,255,0.1)"}`,
              }}
            >
              <span className="mr-1">{c.emoji}</span>{c.name}
            </button>
          );
        })}
      </div>

      {/* 단어 카드 그리드 — 3열, 이모지 크게 + 한글 라벨. 탭한 단어 ⭐. */}
      <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
        {cat.words.map((w) => {
          const marked = heard.has(w.label);
          return (
            <button
              key={w.label}
              onClick={() => onCardTap(w.label)}
              aria-label={w.label}
              className="relative flex flex-col items-center justify-center rounded-2xl py-4 transition active:scale-95"
              style={{ backgroundColor: "#163635", border: `2px solid ${marked ? GOLD : "rgba(255,255,255,0.1)"}` }}
            >
              {marked && <span className="absolute top-1.5 right-1.5 text-sm" aria-hidden="true">⭐</span>}
              <span className="leading-none" style={{ fontSize: "40px" }}>{w.emoji}</span>
              <span className="mt-2 text-base font-extrabold" style={{ color: "#EAF5F1" }}>{w.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
