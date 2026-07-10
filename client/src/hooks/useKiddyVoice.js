import { useRef, useState, useCallback, useEffect } from "react";
import { synthesizeKiddyVoice } from "../utils/api";

// ── iOS 오디오 언락 풀 (오너 리포트 7/10: iOS에서 키디 음성 전부 무음) ──
//   iOS 사파리는 '사용자 제스처 직후'가 아니면 Audio.play()를 차단한다. 키디 TTS는
//   합성(서버 0.5~2초)이 제스처 여운을 지나서 + 매번 new Audio(미신뢰 엘리먼트)라 전부 차단됐음
//   (녹음 재생은 탭→IDB 수 ms라 통과 — 증상 일치). 표준 해법 = '언락 풀':
//   앱의 첫 제스처(프로필 선택 등 탭 없이는 진행 불가) 때 무음 wav를 살짝 재생해 엘리먼트를
//   신뢰 상태로 만들어 두고, 이후 TTS는 새 Audio 대신 이 엘리먼트를 재사용(src 교체)한다.
//   iOS는 한번 언락된 엘리먼트의 이후 프로그램적 재생을 허용. 데스크톱은 원래 허용이라 무영향.
//   ⚠️ v2(7/10 2차): muted 언락은 iOS가 '사용자 승인 재생'으로 인정 안 함 + data URI wav는 사파리가
//      거부할 수 있음 + once 리스너·선플래그 = 한 번 실패하면 영구 잠금 → 셋 다 교체:
//      런타임 생성 진짜 WAV(Blob URL) · 비뮤트 재생(0진폭이라 무음) · 성공할 때까지 매 제스처 재시도.
// ── 임시 실기기 진단 패널 (7/10 iOS 무음 추적) — URL에 ?voicedebug 붙이면 폰 화면에 로그 표시. 원인 확정 후 제거 예정. ──
const VOICE_DEBUG = typeof location !== "undefined" && /voicedebug/.test(location.search);
function dbg(msg) {
  if (!VOICE_DEBUG || typeof document === "undefined") return;
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

const POOL_SIZE = 4; // 동시 마운트되는 useKiddyVoice 인스턴스 수보다 넉넉히
const audioPool = [];
let unlockUrl = null; // 런타임 생성 무음 wav Blob URL(모듈 수명 유지 — revoke 안 함)
function makeSilentWavUrl() {
  // 유효한 최소 WAV를 코드로 생성(mono 16bit 8kHz, 무음 샘플 8개) — 포맷 거부 불가
  const rate = 8000, samples = 8;
  const buf = new ArrayBuffer(44 + samples * 2);
  const v = new DataView(buf);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, "RIFF"); v.setUint32(4, 36 + samples * 2, true); w(8, "WAVE");
  w(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, "data"); v.setUint32(40, samples * 2, true); // 샘플은 0(무음)
  return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
}
function ensurePool() {
  if (typeof Audio === "undefined") return;
  while (audioPool.length < POOL_SIZE) audioPool.push(new Audio());
}
function blessPool() {
  // 제스처 핸들러 '안'에서 호출됨 — 풀에서 쉬는 엘리먼트를 무음(비뮤트) 재생으로 언락.
  ensurePool();
  if (!audioPool.length) return;
  try { if (!unlockUrl) unlockUrl = makeSilentWavUrl(); } catch { return; }
  audioPool.forEach((a) => {
    if (a._kiddyBlessed) return; // 이미 언락 — no-op(매 제스처 호출돼도 비용 0)
    try {
      a.src = unlockUrl;
      const p = a.play();
      if (p?.then) p.then(() => { a._kiddyBlessed = true; dbg("언락 ok"); try { a.pause(); a.currentTime = 0; } catch { /* noop */ } }).catch((e) => { dbg(`언락 fail ${e?.name}: ${e?.message}`); /* 다음 제스처에 재시도 */ });
      else a._kiddyBlessed = true;
    } catch (e) { dbg(`언락 throw ${e?.name}`); /* 다음 제스처에 재시도 */ }
  });
}
if (typeof document !== "undefined") {
  // once 아님 — 성공할 때까지 모든 제스처에서 재시도(한 번 실패=영구 잠금 방지). 언락 후엔 플래그 체크만이라 비용 0.
  document.addEventListener("pointerdown", blessPool, { capture: true });
  document.addEventListener("touchend", blessPool, { capture: true });
}
function acquireAudio() {
  ensurePool();
  const i = audioPool.findIndex((a) => a._kiddyBlessed); // 언락된 엘리먼트 우선
  const el = i >= 0 ? audioPool.splice(i, 1)[0] : audioPool.pop();
  return el || (typeof Audio !== "undefined" ? new Audio() : null);
}
function releaseAudio(a) {
  if (!a) return;
  try { a.onended = null; a.pause(); a.removeAttribute("src"); } catch { /* noop */ }
  if (audioPool.length < POOL_SIZE) audioPool.push(a); // 풀 복귀(언락 상태 유지 — 다음 인스턴스가 재사용)
}

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
//   (개정 7/10) STT/TTS 자동 오디오는 비저장 유지. 단, 사용자가 명시적으로 남긴 음성 편지·메모(diaryAudioStore)는 예외 저장 — 오너 확정.
// 음성은 보조 → 합성/재생 실패해도 조용히 넘어감(텍스트만으로 진행). 같은 대사 중복 합성은 막음.
export default function useKiddyVoice() {
  const audioRef = useRef(null);     // 현재 재생 중인 Audio(= elRef 엘리먼트, 재생 중 표시 겸용)
  const elRef = useRef(null);        // 언락 풀에서 받은 재사용 엘리먼트(iOS 제스처 언락 유지) — 언마운트 시 풀 복귀
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
    // iOS 언락 유지: 매번 new Audio(미신뢰) 대신 언락 풀 엘리먼트를 재사용(src 교체) — 상단 언락 풀 주석 참조
    if (!elRef.current) elRef.current = acquireAudio();
    const audio = elRef.current;
    if (!audio) return;                           // Audio 미지원 환경(노드 등) — 텍스트만 진행
    audio.src = clip.url;
    try { audio.load(); } catch { /* noop */ } // 사파리: 재사용 엘리먼트 src 교체 후 load 권장(스테일 소스 방지)
    audioRef.current = audio;
    audio.onerror = () => { dbg(`audio.error code=${audio.error?.code} (4=소스/포맷 거부)`); };
    audio.onended = () => {
      if (audioRef.current === audio) {
        audioRef.current = null;
        idxRef.current += 1;
        pump();                                   // 다음 자리로
      }
    };
    // 자동재생 차단(제스처 밖 재생 거부) 시 대사를 버리지 않고 '다음 탭'에서 재시도 —
    // 탭 핸들러 안에서 play()가 다시 불리므로 iOS가 반드시 허용(★2차 안전망, 첫 인사 등 무제스처 진입 커버).
    const p = audio.play();
    if (p?.then) p.then(() => dbg(`재생 ok (blessed=${!!audio._kiddyBlessed})`)).catch((e) => {
      dbg(`재생 fail ${e?.name}: ${e?.message}`);
      if (audioRef.current === audio) audioRef.current = null; // 재생 실패 표시 → pump 재진입 가능
      if (typeof document !== "undefined") {
        document.addEventListener("pointerdown", () => { dbg("탭 재시도"); pump(); }, { once: true, capture: true });
      }
    });
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
    dbg(blob ? `합성 ok ${blob.size}b type=${blob.type || "(없음)"}` : "합성 null(서버/네트워크)");
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
    releaseAudio(elRef.current); // 언락 엘리먼트 풀 복귀(다음 화면 인스턴스가 재사용 — iOS 언락 상태 유지)
    elRef.current = null;
  }, [stopCurrent, revokeClips]);

  return { speak, enqueue, replay, stop, hasAudio };
}
