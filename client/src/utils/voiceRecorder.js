// ── B08a: 음성 녹음 공용 유틸 (부모 음성 편지 · 아이 음성 메모 B08b 공용) ──
//   MediaRecorder + getUserMedia. STT 없음 — 음성 그대로 Blob 저장(원문 텍스트 미생성 = 프라이버시).
//   ⚠️ 정책: 사용자가 '직접·명시적으로 남긴' 음성만 저장(오너 확정 예외). 인터뷰 STT/자동 TTS는 여전히 비저장.
//   ⚠️ 미지원/권한 거부는 null 반환(throw 금지 — 호출부는 null이면 기능 숨김/안내, 글 편지는 평소대로).
//   ⚠️ 트랙 정리 필수 — stop/cancel에서 stream 트랙 stop()(마이크 표시등 잔류 방지, 신뢰 문제).
//   ⚠️ iOS Safari 실기기 확인 필요(mimeType·권한·재생) — 막히면 즉시 보고(전략 재논의).
// feature/diary-v0 브랜치 전용. 외부 의존 0.

export const VOICE_MAX_MS = 10000; // 최대 녹음 길이 10초(오너 개정 7/10 — 초반 단계 보수 운영). 진행 바 분모로도 사용.
const MAX_MS = VOICE_MAX_MS; // 내부 타이머로 자동 정지

// 동기 지원 판정(초기 렌더에서 버튼 노출 결정용 — getUserMedia 권한은 실제 시작 시 판정).
export function isVoiceRecordingSupported() {
  return typeof navigator !== "undefined"
    && !!navigator.mediaDevices
    && typeof navigator.mediaDevices.getUserMedia === "function"
    && typeof MediaRecorder !== "undefined";
}

// mimeType 선택 — webm 우선, iOS Safari 폴백 mp4, 둘 다 불가면 브라우저 기본("").
function pickMime() {
  try {
    if (typeof MediaRecorder !== "undefined" && typeof MediaRecorder.isTypeSupported === "function") {
      if (MediaRecorder.isTypeSupported("audio/webm")) return "audio/webm";
      if (MediaRecorder.isTypeSupported("audio/mp4")) return "audio/mp4"; // iOS Safari
    }
  } catch { /* 무시 */ }
  return "";
}

// 녹음 시작. 성공 → handle{ stop, cancel } / 미지원·권한거부 → null.
//   opts.onStop({blob|null, ms}): 수동 stop·10초 자동정지 어느 쪽이든 녹음 종료 시 1회 호출. ms=실측 길이(재생 바 분모).
export async function startVoiceRecording(opts = {}) {
  if (!isVoiceRecordingSupported()) return null;
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
  catch { return null; } // 권한 거부·장치 없음

  const mimeType = pickMime();
  let recorder;
  try { recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream); }
  catch { try { stream.getTracks().forEach((t) => t.stop()); } catch { /* 무시 */ } return null; }

  const chunks = [];
  let settled = false;
  let autoTimer = null;
  let startedAt = 0;      // recorder.start() 시각 — 실측 ms·진행 바 경과 계산용
  let resolveStop = null;

  const stopTracks = () => { try { stream.getTracks().forEach((t) => t.stop()); } catch { /* 무시 */ } };
  const settle = (blob) => {
    if (settled) return;
    settled = true;
    if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
    stopTracks(); // 마이크 표시등 끄기(잔류 방지)
    const ms = startedAt ? Math.max(0, Date.now() - startedAt) : 0; // ★실측 녹음 길이 — webm Blob의 audio.duration=Infinity 버그 회피(재생 바 분모)
    const payload = { blob, ms };
    try { opts.onStop?.(payload); } catch { /* 무시 */ }
    if (resolveStop) { resolveStop(payload); resolveStop = null; }
  };

  recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
  recorder.onstop = () => {
    const type = recorder.mimeType || mimeType || "audio/webm";
    settle(chunks.length ? new Blob(chunks, { type }) : null);
  };

  const handle = {
    startedAt: 0, // 진행 바 경과 계산용(start 후 세팅)
    // 수동 정지 → Promise<{blob,ms}>. onStop 콜백도 함께 발화(자동정지와 동일 경로).
    stop() {
      return new Promise((resolve) => {
        if (settled) { resolve({ blob: null, ms: 0 }); return; }
        resolveStop = resolve;
        try { if (recorder.state !== "inactive") recorder.stop(); else settle(null); }
        catch { settle(null); }
      });
    },
    // 폐기 — Blob 미생성·onStop 미발화. 트랙만 정리.
    cancel() {
      if (settled) return;
      settled = true;
      if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
      try { recorder.onstop = null; if (recorder.state !== "inactive") recorder.stop(); } catch { /* 무시 */ }
      stopTracks();
    },
  };

  try { recorder.start(); }
  catch { stopTracks(); return null; }
  startedAt = Date.now(); handle.startedAt = startedAt;
  autoTimer = setTimeout(() => { try { if (!settled && recorder.state !== "inactive") recorder.stop(); } catch { /* 무시 */ } }, MAX_MS); // 10초 자동 정지 → onstop → settle → onStop
  return handle;
}
