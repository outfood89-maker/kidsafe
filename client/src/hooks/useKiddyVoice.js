import { useRef, useState, useCallback, useEffect } from "react";
import { synthesizeKiddyVoice } from "../utils/api";

// 키디 음성 재생 훅 (재사용 자산) — H 브리프 §2.
//  - speak(text, tone)  : 새 대사 → 이전 그룹을 멈추고 새로 재생(겹침 방지). 화면이 바뀌는 대사용.
//  - enqueue(text, tone): 현재 대사에 '이어서' 재생(끊지 않음). 한 말풍선에 이어지는 대사
//        (받아주기 → '한 박자 더' 후속 질문)가 중간에 잘리지 않게 연쇄.
//  - replay()           : 현재 대사 그룹(이어진 대사 전체)을 처음부터 메모리 재생 → 추가 호출 0.
//  - hasAudio           : 다시듣기 버튼 노출 여부.
//
// 🔑 재생 순서 보장: 합성(요청)은 비동기라 짧은 대사가 먼저 끝날 수 있음. 그래서 '완료 순서'가 아니라
//    '호출 순서'로 재생해야 함 → 각 대사는 호출 즉시 그룹에 자리(slot)를 예약하고, 합성이 끝나면
//    그 자리에 채운다. 재생(pump)은 앞 자리부터 순서대로만 진행하며, 다음 자리가 아직 합성 중이면
//    기다렸다가(채워지면 재개) 잇는다. (짧은 후속 질문이 받아주기보다 먼저 재생되던 버그 방지)
//
// ⚠️ localStorage/sessionStorage 미사용(정책). Blob URL은 컴포넌트 생명주기 동안만 메모리에 유지.
// 음성은 보조 → 합성/재생 실패해도 조용히 넘어감(텍스트만으로 진행). 같은 대사 중복 합성은 막음.
export default function useKiddyVoice() {
  const audioRef = useRef(null);     // 현재 재생 중인 Audio
  const clipsRef = useRef([]);       // 현재 대사 그룹: [{ status:'pending'|'ready'|'failed', url }] — 호출 순서 유지
  const idxRef = useRef(0);          // 다음에 재생할 클립 인덱스
  const genRef = useRef(0);          // 세대 — speak만 증가(이전 그룹의 늦은 합성응답 폐기)
  const lastKeyRef = useRef(null);   // 중복 호출 방지 키 (tone::text)
  const [hasAudio, setHasAudio] = useState(false);

  const stopCurrent = useCallback(() => {
    const a = audioRef.current;
    if (a) {
      try { a.onended = null; a.pause(); } catch { /* noop */ }
      audioRef.current = null;
    }
  }, []);

  // 클립을 '호출 순서대로' 재생. 다음 자리가 아직 합성 중(pending)이면 멈춰 기다렸다가,
  // 채워지면(say 완료 시 pump 재호출) 이어서 재생. (명명 함수 표현식 → 자기 이름으로 재귀)
  const pump = useCallback(function pump() {
    if (audioRef.current) return;                 // 재생 중이면 onended가 이어받음
    const clip = clipsRef.current[idxRef.current];
    if (!clip) return;                            // 그룹 끝
    if (clip.status === "pending") return;        // 합성 대기 → 채워지면 다시 pump 됨
    if (clip.status === "failed" || !clip.url) {  // 실패한 클립은 건너뜀
      idxRef.current += 1;
      pump();
      return;
    }
    const audio = new Audio(clip.url);
    audioRef.current = audio;
    audio.onended = () => {
      if (audioRef.current === audio) {
        audioRef.current = null;
        idxRef.current += 1;
        pump();                                   // 다음 자리로
      }
    };
    // 자동재생 차단(사용자 제스처 전) 등은 조용히 무시 — 음성은 보조 기능
    audio.play().catch(() => { /* noop */ });
  }, []);

  const revokeClips = useCallback(() => {
    clipsRef.current.forEach((c) => {
      if (c.url) { try { URL.revokeObjectURL(c.url); } catch { /* noop */ } }
    });
    clipsRef.current = [];
  }, []);

  // 공통: 그룹에 자리를 '즉시' 예약(호출 순서 고정) → 합성 후 그 자리에 채우고 pump.
  //  fresh=true(speak)   : 새 그룹 시작(이전 그룹 정지·정리, 세대 증가)
  //  fresh=false(enqueue): 현재 그룹 뒤에 이어붙임(끊지 않음)
  const say = useCallback(async (text, tone, fresh) => {
    if (!text || !text.trim()) return;
    const key = `${tone}::${text}`;
    if (key === lastKeyRef.current) return;       // 같은 대사 중복 호출 무시
    lastKeyRef.current = key;

    let myGen;
    let slot;
    if (fresh) {
      myGen = ++genRef.current;                   // 새 세대 → 이전 그룹의 늦은 응답 폐기
      stopCurrent();
      revokeClips();
      idxRef.current = 0;
      clipsRef.current = [{ status: "pending", url: null }];
      slot = 0;
      setHasAudio(false);                         // 새 대사 준비될 때까지 다시듣기 숨김
    } else {
      myGen = genRef.current;                      // 같은 세대(이어붙임)
      slot = clipsRef.current.length;
      clipsRef.current.push({ status: "pending", url: null });
    }

    const blob = await synthesizeKiddyVoice({ text, tone });
    if (myGen !== genRef.current) return;          // 그새 새 대사(speak)로 갈아탐 → 폐기
    const clip = clipsRef.current[slot];
    if (!clip) return;                             // 방어(그룹이 리셋됐으면 무시)

    if (!blob) {
      clip.status = "failed";                      // 합성 실패 → 이 자리는 건너뜀
    } else {
      clip.url = URL.createObjectURL(blob);
      clip.status = "ready";
      setHasAudio(true);
    }
    pump();
  }, [stopCurrent, revokeClips, pump]);

  const speak = useCallback((text, tone = "bright") => say(text, tone, true), [say]);
  const enqueue = useCallback((text, tone = "bright") => say(text, tone, false), [say]);

  // 다시듣기 — 현재 그룹(이어진 대사 전체)을 처음부터 재생 (추가 호출 0)
  const replay = useCallback(() => {
    if (!clipsRef.current.some((c) => c.status === "ready")) return;
    stopCurrent();
    idxRef.current = 0;
    pump();
  }, [stopCurrent, pump]);

  // 재생 즉시 정지 — 대기열 비우고 진행 중 합성 응답도 무효화(gen++). 다음 영상 자동재생·직접 말하기 직전 등 명시적 정지용.
  const stop = useCallback(() => {
    genRef.current += 1;        // in-flight 합성 응답이 늦게 와도 폐기
    stopCurrent();
    revokeClips();             // 현재 그룹 Blob URL 해제 + 대기열 비움(clipsRef=[])
    idxRef.current = 0;
    lastKeyRef.current = null;  // 중복가드 해제 → 같은 대사를 다시 재생할 수 있게(되읽기 재시도 등)
    setHasAudio(false);
  }, [stopCurrent, revokeClips]);

  // 언마운트 정리 (재생 중지 + Blob URL 전부 해제)
  // lastKeyRef 도 리셋 — StrictMode(개발) 이펙트 이중 실행 시, 정리 후 재실행되는 speak 가
  // 중복 가드에 막혀 '첫 대사(인사)'가 무음이 되던 문제 방지(재실행이 다시 합성·재생하게).
  useEffect(() => () => {
    stopCurrent();
    revokeClips();
    lastKeyRef.current = null;
  }, [stopCurrent, revokeClips]);

  return { speak, enqueue, replay, stop, hasAudio };
}
