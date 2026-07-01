import { useCallback, useEffect, useRef, useState } from "react";

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

  // 진행 중인 인식 정리 (핸들러 해제 후 중단) — 언마운트/재시작 공통.
  const teardown = useCallback(() => {
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
  }, []);

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
    finalRef.current = "";
    setTranscript("");
    setInterim("");
    setError(null);

    const recognition = new SpeechRecognition();
    recognition.lang = "ko-KR";
    recognition.continuous = true;      // 수동 종료 모드 — 말 멈춰도 자동 종료 안 됨(stop 필요)
    recognition.interimResults = true;  // 말하는 도중 실시간 텍스트
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setError(null);
      setListening(true);
    };
    recognition.onerror = (e) => {
      setListening(false);
      // 'aborted'(정상 stop 과정에서 흔히 발생)는 에러로 취급하지 않음 — 조용히 넘어감.
      setError(e.error === "aborted" ? null : e.error);
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
      setTranscript(finalText.trim());
      setInterim(interimText.trim());
    };
    recognition.onend = () => {
      setListening(false);
      setInterim("");
      setTranscript(finalRef.current.trim());   // 최종 확정
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      // 이미 시작됐거나 즉시 실패 — 조용히 무시(호출부는 error/listening 로 상태 판단)
      setListening(false);
    }
  }, [teardown]);

  const stop = useCallback(() => {
    const rec = recognitionRef.current;
    if (rec) {
      try { rec.stop(); } catch { /* noop */ }   // onend 에서 최종 transcript 확정
    }
  }, []);

  // 언마운트 시 인식 중단(마이크 해제) — 위젯 닫힘/화면 이동 시 남지 않게.
  useEffect(() => () => teardown(), [teardown]);

  return { supported, listening, transcript, interim, error, start, stop, reset };
}
