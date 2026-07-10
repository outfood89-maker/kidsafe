import { useCallback, useEffect, useRef, useState } from "react";
import { releaseKiddyAudioForMic } from "./useKiddyVoice";

// ── 임시 실기기 진단 (7/10 iOS 마이크 고착 추적) — URL에 ?voicedebug 붙이면 인식 이벤트를 폰 화면에 표시. 원인 확정 후 제거 예정. ──
const MIC_DEBUG = typeof location !== "undefined" && /voicedebug/.test(location.search);
function dbg(msg) {
  if (!MIC_DEBUG || typeof document === "undefined") return;
  let el = document.getElementById("kiddy-voice-debug");
  if (!el) {
    el = document.createElement("div");
    el.id = "kiddy-voice-debug";
    el.style.cssText = "position:fixed;left:4px;bottom:4px;z-index:99999;max-width:92vw;max-height:38vh;overflow:auto;background:rgba(0,0,0,.88);color:#5FE0BC;font:10px/1.5 monospace;padding:6px 8px;border-radius:8px;pointer-events:none;white-space:pre-wrap;";
    document.body.appendChild(el);
  }
  el.textContent += msg + "\n";
  el.scrollTop = el.scrollHeight;
}

// 키디 음성 입력 훅 (재사용 자산) — K 브리프 §1. useKiddyVoice(TTS)의 '입력' 버전.
// 브라우저 Web Speech API(webkitSpeechRecognition)를 얇게 감싼다. 이미 KidHome 음성 검색이
// 쓰는 엔진과 동일하되, 이번 UX는 '수동 종료'([다 말했어요])라 continuous=true 로 뽑는다.
//
// 반환: { supported, listening, transcript, interim, error, start, stop, reset }
//  - supported : SpeechRecognition 존재 여부(false면 호출부가 마이크를 숨기고 기존 버튼/타이핑 폴백)
//  - start()   : 녹음 시작. lang="ko-KR", continuous=true(자동종료 X), interimResults=true.
//  - stop()    : 녹음 종료 → onend 에서 최종 transcript 확정. (continuous라 반드시 stop 필요)
//  - transcript: 최종 인식 텍스트 / interim: 말하는 중 실시간 텍스트(피드백용)
//  - error     : 'no-speech' | 'not-allowed' | 'aborted' | 'unsupported' 등 원인 코드(호출부가 친절 메시지로)
//  - reset()   : transcript/interim/error 초기화 ('다시 말할래')
//
// ⚠️ 저장 안 함(정책): 오디오 저장 0, transcript 는 메모리 state 만. localStorage/sessionStorage 금지.
//    (Web Speech 는 브라우저→구글 인식이지만 우리 쪽 저장·전송·보관은 없음.)
export default function useKiddySpeech() {
  const [supported] = useState(
    () => typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition)
  );
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState(null);

  const recognitionRef = useRef(null);
  const finalRef = useRef("");   // 세션 동안 누적된 최종 인식 텍스트
  const retryTimerRef = useRef(null); // iOS aborted 자동 재시작 대기 타이머(7/10)
  const micStreamRef = useRef(null);  // iOS 세션 전환용 프라이밍 마이크 스트림(7/10 3라운드)

  // 프라이밍 스트림 해제(마이크 표시등 끔) — 인식 종료/중단/언마운트 공통.
  const releaseMicStream = useCallback(() => {
    const s = micStreamRef.current;
    if (s) {
      try { s.getTracks().forEach((t) => t.stop()); } catch { /* noop */ }
      micStreamRef.current = null;
    }
  }, []);

  // 진행 중인 인식 정리 (핸들러 해제 후 중단) — 언마운트/재시작 공통.
  const teardown = useCallback(() => {
    if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
    releaseMicStream();
    const rec = recognitionRef.current;
    if (rec) {
      try {
        rec.onstart = null;
        rec.onresult = null;
        rec.onerror = null;
        rec.onend = null;
        rec.stop();
      } catch { /* noop */ }
      recognitionRef.current = null;
    }
  }, [releaseMicStream]);

  const reset = useCallback(() => {
    finalRef.current = "";
    setTranscript("");
    setInterim("");
    setError(null);
  }, []);

  const start = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("unsupported");
      return;
    }
    teardown();            // 혹시 남은 세션 정리 후 새로 시작
    // iOS 오디오 세션 고착 방지(7/10): TTS 엘리먼트가 미디어 자원을 물고 있으면 인식이 무음만 잡음 →
    // 마이크 켜기 직전에 전부 반납. (데스크톱 무영향 — 어차피 아이가 말하기 전 키디는 멈추는 UX)
    try { releaseKiddyAudioForMic(); dbg("오디오 세션 반납"); } catch { /* noop */ }
    finalRef.current = "";
    setTranscript("");
    setInterim("");
    setError(null);

    // ── iOS aborted 자동 재시작(7/10 실측): TTS가 한 번이라도 재생된 뒤의 인식은 iOS 오디오 세션
    //    전환 지연 때문에 시작 직후 'aborted'로 죽을 수 있음(1턴은 되고 2턴부터 즉사 패턴).
    //    아무것도 못 들은 aborted면 0.3초 뒤 같은 듣기 세션으로 자동 재시작(최대 2회) —
    //    그때는 세션 정리가 끝난 뒤라 성공. listening은 유지해 화면 '듣는 중' 흔들림 없음.
    let retries = 0; // 이번 start() 한 번(한 듣기 세션)에 한정
    const begin = (isRetry) => {
      retryTimerRef.current = null;
      const recognition = new SpeechRecognition();
      recognition.lang = "ko-KR";
      recognition.continuous = true;      // 수동 종료 모드 — 말 멈춰도 자동 종료 안 됨(stop 필요)
      recognition.interimResults = true;  // 말하는 도중 실시간 텍스트
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        dbg(isRetry ? `인식 재시작(${retries}차)` : "인식 시작");
        setError(null);
        setListening(true);
      };
      recognition.onerror = (e) => {
        if (e.error === "aborted" && !finalRef.current.trim() && retries < 2 && recognitionRef.current === recognition) {
          retries += 1;
          recognition._kiddyRetried = true; // 이 세션의 잔여 onend는 마무리 처리 건너뜀
          dbg(`aborted → ${retries}차 재시도 예약`);
          retryTimerRef.current = setTimeout(() => begin(true), 300);
          return; // listening 유지
        }
        dbg(`인식 에러 ${e.error}`);
        setListening(false);
        // 'aborted'(정상 stop 과정에서 흔히 발생)는 에러로 취급하지 않음 — 조용히 넘어감.
        // 재시도 세션의 'not-allowed'는 제스처 밖 시작 거부일 수 있음 → 마이크 차단으로 오인 금지(m6 래치 방지).
        setError(e.error === "aborted" || (isRetry && e.error === "not-allowed") ? null : e.error);
      };
      recognition.onresult = (event) => {
        let finalText = "";
        let interimText = "";
        // continuous=true 라 results 는 세션 시작부터 누적 → 매번 전체를 다시 조립.
        for (let i = 0; i < event.results.length; i++) {
          const t = event.results[i][0].transcript;
          if (event.results[i].isFinal) finalText += t;
          else interimText += t;
        }
        finalRef.current = finalText;
        dbg(`인식 결과 확정${finalText.trim().length}자/중간${interimText.trim().length}자`);
        setTranscript(finalText.trim());
        setInterim(interimText.trim());
      };
      recognition.onend = () => {
        if (recognition._kiddyRetried) {
          // 재시도로 대체된 세션의 잔여 onend — 상태를 건드리면 '듣는 중'이 풀려버림 → 정리만.
          if (recognitionRef.current === recognition) recognitionRef.current = null;
          return;
        }
        dbg(`인식 종료 (확정 ${finalRef.current.trim().length}자)`);
        releaseMicStream(); // 프라이밍 스트림 해제(마이크 표시등 끔)
        setListening(false);
        setInterim("");
        setTranscript(finalRef.current.trim());   // 최종 확정
        if (recognitionRef.current === recognition) recognitionRef.current = null;
      };

      recognitionRef.current = recognition;
      try {
        recognition.start();
      } catch {
        // 이미 시작됐거나 즉시 실패 — 조용히 무시(호출부는 error/listening 로 상태 판단)
        setListening(false);
      }
    };

    // ── iOS 오디오 세션 강제 전환(7/10 3라운드, 실측+웹 리서치 근거) ──
    //   TTS가 한 번 재생되면 세션이 '재생' 카테고리에 갇혀 인식이 시작 직후 aborted로 죽고,
    //   0.3~0.6초 재시도로도 복구 안 됨(자연 복구는 3.5~5초 — 아이 대화 UX에 못 씀).
    //   getUserMedia로 마이크를 실제로 열면 세션이 그 즉시 '재생+녹음'으로 전환됨
    //   (우리 음성편지 '녹음'이 TTS 후에도 잘 되는 것과 같은 원리). 인식하는 동안 스트림을
    //   쥐고 있다가 종료 시 해제(마이크 표시등 정리). 실패(거부 등)해도 인식은 그대로 시도.
    const primeThenBegin = async () => {
      try {
        if (navigator.mediaDevices?.getUserMedia) {
          micStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
          dbg("마이크 프라이밍 ok");
        }
      } catch (e) { dbg(`프라이밍 fail ${e?.name}`); }
      begin(false);
    };
    primeThenBegin();
  }, [teardown, releaseMicStream]);

  const stop = useCallback(() => {
    if (retryTimerRef.current) {
      // 재시작 대기 중 사용자가 [다 말했어요] — 대기 취소하고 지금까지 결과로 조용히 마무리.
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
      releaseMicStream();
      setListening(false);
      setInterim("");
      setTranscript(finalRef.current.trim());
      return;
    }
    const rec = recognitionRef.current;
    if (rec) {
      try { rec.stop(); } catch { /* noop */ }   // onend 에서 최종 transcript 확정
    }
  }, [releaseMicStream]);

  // 언마운트 시 인식 중단(마이크 해제) — 위젯 닫힘/화면 이동 시 남지 않게.
  useEffect(() => () => teardown(), [teardown]);

  return { supported, listening, transcript, interim, error, start, stop, reset };
}
