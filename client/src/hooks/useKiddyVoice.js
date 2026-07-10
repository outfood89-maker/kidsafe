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
// ── WebAudio 재생 경로 (7/10 4라운드 — iOS 마이크 고착의 근본 대응) ──
//   실측: <audio>(미디어 엘리먼트)로 mp3를 튼 '다음' 턴의 음성인식만 시작 직후 aborted로 죽음.
//   재생이 없던 턴(첫 턴·빈 턴 뒤)은 항상 성공, getUserMedia 프라이밍으로도 못 풂(스트림 ok인데 abort),
//   자연 복구는 3.5~5초(커뮤니티 보고) — 아이 대화 UX에 못 씀.
//   원인: 미디어 엘리먼트 재생은 iOS 'Now Playing' 미디어 세션에 등록돼 인식 서비스와 충돌.
//   해법: WebAudio(AudioContext)는 Now Playing에 등록되지 않고, 재생이 끝나면 suspend()로 세션을
//   즉시 반납할 수 있어 인식과 공존. AudioContext 미지원/디코드 실패는 기존 엘리먼트 경로 폴백.
//   ⚠️ 트레이드오프(오너 보고 완료): WebAudio는 iOS 무음 스위치를 따름(스위치 ON이면 TTS 무음 —
//   표준 동작이고 텍스트는 항상 표시됨). 무음 스위치 우회(무음 audio 상시재생)는 인식을 다시 죽여 금지.
let sharedCtx = null;
function getCtx() {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!sharedCtx) { try { sharedCtx = new AC(); } catch { return null; } }
  return sharedCtx;
}
// 재생이 끝나는 즉시 세션 반납 — 다음 마이크(음성인식)가 깨끗하게 시작하게.
// P4: BGM 루프가 살아 있는 동안엔 반납하지 않음(반납하면 음악이 멎음) — BGM 화면(인터뷰·그림 대기)엔 마이크가 없고,
//     마이크 직전 경로(releaseKiddyAudioForMic)는 BGM을 '즉시 정지'시킨 뒤 강제 반납하므로 공존 규율 불변.
function suspendCtxForMic() {
  try { if (bgmSrc) return; } catch { /* noop */ }
  try { if (sharedCtx && sharedCtx.state === "running") sharedCtx.suspend(); } catch { /* noop */ }
}

// ── P4: 배경음악(BGM) — 부드러운 루프 + TTS 자동 덕킹 + 페이드아웃 (팀장 규격 7/10 + 오너 확장) ──
//   적용(오너 7/10): 키디랑 인터뷰하는 모든 곳 — 관심사 인터뷰·체크인·키디의 방(진입 시 자동)·그림일기 전체.
//   loop=true라 곡이 끝나면 이어서 무한 반복 / 화면 이탈·인터뷰 종료는 페이드아웃(툭 끊김 금지).
//   기존 WebAudio 체계 재사용(iOS 언락 상속) → 무음 스위치 정책도 TTS와 동일(스위치 ON=무음).
//   ⚠️ 마이크 공존(5차전 규율): 음성인식 직전 pauseKiddyBgmForMic()로 '즉시 일시정지'(의도는 유지) →
//      키디가 다음에 말하는 순간(trackTtsStart) 자동 복귀. 듣는 중 음악이 인식을 죽이거나 마이크에 섞이는 것 방지.
//   트랙: client/public/music/ (오너 제작 Warm Room Glow — 원본 wav 23.7MB → aac 128k 2MB 변환본). 404면 조용히 무음.
let bgmSrc = null;        // 현재 재생 소스(AudioBufferSource)
let bgmGain = null;       // 마스터 게인 — 덕킹·페이드 담당
let bgmWanted = false;    // '지금 BGM을 원하는 상태'(시작/정지 레이스·언락/마이크 후 복귀·다음 곡 체인 판정)
let bgmLastUrl = null;    // 직전/현재 곡(랜덤 연속 중복 회피 + 일시정지 이어재생 대상)
let bgmOffset = 0;        // 일시정지 위치(초) — 마이크 등으로 멈췄다 복귀할 때 '같은 곡, 같은 위치'부터(오너 7/10: 처음부터 재생 금지)
let bgmBaseOffset = 0;    // 이번 소스가 시작한 곡 내 위치
let bgmStartedAt = 0;     // 이번 소스 시작 시각(ctx.currentTime) — 일시정지 시 위치 계산용
let bgmStopTimer = null;  // 화면 전환 유예(300ms) — 키즈 구역 안 이동(방↔책장↔일기)에서 음악이 끊기지 않게
const bgmBuffers = new Map(); // url → AudioBuffer 디코드 캐시(재생한 곡만 로드·재진입 시 재다운로드 0)
// 오너 제작 트랙 6곡(7/10 수신, wav → aac 128k 변환) — 랜덤 선곡·곡 끝나면 다음 랜덤 곡 자동 이어짐
const BGM_TRACKS = [
  "/music/warm-room-glow.m4a",
  "/music/warm-cocoon.m4a",
  "/music/quiet-hours-1.m4a",
  "/music/quiet-hours-2.m4a",
  "/music/quiet-hours-3.m4a",
  "/music/quiet-hours-4.m4a",
];
const BGM_VOL = 0.22;     // 기본 볼륨(낮게 — 키디 목소리 밑에 깔리는 용도)
const BGM_DUCK = 0.06;    // TTS 발화 중 덕킹 볼륨
// 랜덤 선곡 — 직전 곡만 피함(2곡 연속 같은 곡 방지)
function pickBgmTrack() {
  const pool = BGM_TRACKS.length > 1 ? BGM_TRACKS.filter((u) => u !== bgmLastUrl) : BGM_TRACKS;
  return pool[Math.floor(Math.random() * pool.length)];
}
function bgmSetDuck(on) {
  try {
    if (!bgmGain || !sharedCtx) return;
    const t = sharedCtx.currentTime;
    bgmGain.gain.cancelScheduledValues(t);
    bgmGain.gain.setValueAtTime(bgmGain.gain.value, t);
    bgmGain.gain.linearRampToValueAtTime(on ? BGM_DUCK : BGM_VOL, t + 0.25); // 0.25s 스무드 덕킹
  } catch { /* noop */ }
}
// 중첩 화면 참조 카운트 — 체크인(음악) 안에서 일기 오버레이가 열렸다 닫혀도 바깥 음악이 죽지 않게.
//   startKiddyBgm=획득(+1) / stopKiddyBgm=반납(-1, 0이 될 때만 실제 페이드아웃). 내부 복귀(_bgmPlay)는 카운트 무관.
let bgmHolds = 0;
export function startKiddyBgm() {
  bgmHolds += 1;
  bgmWanted = true;
  // 화면 전환 유예 안에 다음 화면이 음악을 다시 원함(방→책장 등) — 예약된 정지를 취소하고 그대로 이어감(끊김 0)
  if (bgmStopTimer) { clearTimeout(bgmStopTimer); bgmStopTimer = null; }
  return _bgmPlay();
}
async function _bgmPlay() {
  try {
    if (typeof fetch === "undefined" || !bgmWanted || bgmSrc) return;
    const ctx = getCtx();
    if (!ctx) return;
    if (!ctx._kiddyUnlocked) {
      // 아직 제스처 언락 전 — 다음 탭에서 재시도(그새 stop됐으면 무시)
      if (typeof document !== "undefined") {
        document.addEventListener("pointerdown", () => { if (bgmWanted) _bgmPlay(); }, { once: true, capture: true });
      }
      return;
    }
    // 일시정지(마이크) 복귀면 '같은 곡, 같은 위치'부터 — 아니면 새 랜덤 곡(직전 곡 회피)
    const resuming = bgmOffset > 0 && bgmLastUrl;
    const url = resuming ? bgmLastUrl : pickBgmTrack();
    if (!url) return;
    let buffer = bgmBuffers.get(url);
    if (!buffer) {
      const res = await fetch(url);
      if (!res.ok) return; // 트랙 미배치(404 등) — 조용히 무음
      buffer = await ctx.decodeAudioData(await res.arrayBuffer());
      bgmBuffers.set(url, buffer);
    }
    if (!bgmWanted || bgmSrc) return; // 로딩 사이에 stop/이중 시작 — 폐기
    if (ctx.state !== "running") { try { await ctx.resume(); } catch { return; } }
    if (!bgmWanted || bgmSrc) return; // resume 사이 레이스 방어
    const offset = resuming ? bgmOffset % buffer.duration : 0;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(activeTtsNodes.size > 0 ? BGM_DUCK : BGM_VOL, ctx.currentTime + (resuming ? 0.35 : 0.6)); // 페이드인(복귀는 짧게)
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    // 랜덤 재생(오너 7/10): 한 곡이 끝나면 다음 랜덤 곡으로 자동 이어짐(방에 계속 있으면 음악이 계속).
    src.onended = () => {
      if (bgmSrc === src) {
        bgmSrc = null; bgmGain = null; bgmOffset = 0; // 자연 종료 — 다음 곡은 처음부터
        if (bgmWanted) _bgmPlay(); // 다음 곡(직전 곡 회피 랜덤)
      }
    };
    src.connect(gain).connect(ctx.destination);
    src.start(0, offset);
    bgmSrc = src; bgmGain = gain; bgmLastUrl = url;
    bgmBaseOffset = offset; bgmStartedAt = ctx.currentTime; bgmOffset = 0; // 위치 추적 리셋(다음 일시정지 때 계산)
  } catch { /* BGM은 장식 — 실패 시 조용히 */ }
}
// 실제 정지(페이드아웃) — stopKiddyBgm의 유예가 끝났거나 immediate일 때만 호출
function _bgmRealStop(immediate) {
  try {
    bgmWanted = false;
    bgmOffset = 0; // 완전 종료 — 다음 시작은 새 랜덤 곡 처음부터
    const src = bgmSrc, gain = bgmGain;
    bgmSrc = null; bgmGain = null; // 즉시 해제 — suspendCtxForMic 게이트가 바로 풀리게
    if (!src) return;
    try { src.onended = null; } catch { /* noop */ } // 다음 곡 체인 차단(정지가 선곡으로 이어지지 않게)
    if (immediate || !sharedCtx || sharedCtx.state !== "running") {
      try { src.stop(); } catch { /* noop */ }
    } else {
      // 화면 이탈·인터뷰 종료 페이드아웃(0.9s) 후 정지 — 툭 끊김 금지(오너 규격)
      const t = sharedCtx.currentTime;
      try {
        gain.gain.cancelScheduledValues(t);
        gain.gain.setValueAtTime(gain.gain.value, t);
        gain.gain.linearRampToValueAtTime(0.0001, t + 0.9);
      } catch { /* noop */ }
      setTimeout(() => { try { src.stop(); } catch { /* noop */ } if (activeTtsNodes.size === 0) suspendCtxForMic(); }, 950);
      return;
    }
    if (activeTtsNodes.size === 0) suspendCtxForMic();
  } catch { /* noop */ }
}
export function stopKiddyBgm({ immediate = false } = {}) {
  try {
    bgmHolds = Math.max(0, bgmHolds - 1);
    if (bgmHolds > 0) return; // 아직 음악을 원하는 바깥 화면이 남아 있음(중첩 오버레이) — 계속 재생
    if (immediate) { if (bgmStopTimer) { clearTimeout(bgmStopTimer); bgmStopTimer = null; } _bgmRealStop(true); return; }
    // 화면 전환 유예(300ms): 방→책장→일기처럼 언마운트 직후 다음 화면이 다시 시작하면 정지를 취소 — 음악이 안 끊김(오너 7/10)
    if (bgmStopTimer) clearTimeout(bgmStopTimer);
    bgmStopTimer = setTimeout(() => { bgmStopTimer = null; if (bgmHolds === 0) _bgmRealStop(false); }, 300);
  } catch { /* noop */ }
}
// P4: 마이크 직전 일시정지 — 재생만 즉시 멈추되 위치를 기억, '원하는 상태(bgmWanted)'도 유지 →
//     키디가 다음에 말하는 순간(trackTtsStart) '같은 곡, 같은 위치'로 복귀. 화면 이탈(stopKiddyBgm)과 구분됨.
function pauseKiddyBgmForMic() {
  try {
    const src = bgmSrc;
    if (src && sharedCtx) {
      try { bgmOffset = (bgmBaseOffset + (sharedCtx.currentTime - bgmStartedAt)) % src.buffer.duration; } catch { bgmOffset = 0; }
    }
    bgmSrc = null; bgmGain = null; // 즉시 해제 — suspendCtxForMic 게이트가 바로 풀리게
    if (src) { try { src.onended = null; src.stop(); } catch { /* noop */ } }
  } catch { /* noop */ }
}

// ── P5: 효과음(SFX) — WebAudio 신디 합성(음원 파일 0, 팀장 허용안 7/10) ──
//   부드러운 사인파 계열만(날카로운 비프 금지)·낮은 볼륨. TTS 재생 중이면 생략(키디 목소리 항상 우선).
//   ctx 규율은 TTS와 완전 동일: 제스처 언락 전엔 침묵, 재생 끝나면 TTS가 안 돌 때만 suspend(마이크 공존 — 오디오 5차전 재발 방지).
const activeTtsNodes = new Set(); // 재생 중 TTS 노드/엘리먼트(모듈 전역) — SFX 중첩 생략 + P4 BGM 덕킹 판정
// P4: TTS 시작/종료를 한 곳에서 추적 — BGM 덕킹(키디 목소리 항상 우선)을 자동 연동.
//   TTS 시작은 '마이크 일시정지된 BGM의 복귀 신호'이기도 함(듣기 끝 → 키디 답변과 함께 음악 페이드인).
function trackTtsStart(n) {
  activeTtsNodes.add(n);
  if (bgmWanted && !bgmSrc) { try { _bgmPlay(); } catch { /* noop */ } } // 마이크 일시정지 복귀(카운트 무관, 새 랜덤 곡)
  bgmSetDuck(true);
}
function trackTtsEnd(n) { activeTtsNodes.delete(n); if (activeTtsNodes.size === 0) bgmSetDuck(false); }
// [주파수Hz, 시작오프셋s, 길이s] — 전부 짧고 부드러운 차임(어택 15ms·지수 감쇠로 클릭 노이즈 방지)
const SFX_DEFS = {
  select: [[880, 0, 0.09]],                                        // ① 칩/카드 선택 — 짧은 블립
  keep:   [[660, 0, 0.12], [880, 0.09, 0.18]],                     // ② 간직 완료 — 2음 도약 차임
  badge:  [[660, 0, 0.11], [830, 0.09, 0.11], [990, 0.18, 0.22]],  // ③ 배지 획득 — 3음 상승 차임
  reveal: [[520, 0, 0.14], [780, 0.1, 0.22]],                      // ④ 그림 완성 공개 — 부드러운 스파클
};
export function playKiddySfx(kind) {
  try {
    if (activeTtsNodes.size > 0) return; // TTS와 중첩 시 SFX 생략(팀장 규격)
    const ctx = getCtx();
    if (!ctx || !ctx._kiddyUnlocked) return; // 언락 전(첫 제스처 이전) — 조용히 포기(장식이라 무해)
    const notes = SFX_DEFS[kind];
    if (!notes) return;
    const play = () => {
      try {
        if (ctx.state !== "running") return;
        const t0 = ctx.currentTime;
        let lastEnd = 0;
        notes.forEach(([freq, at, dur]) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0, t0 + at);
          gain.gain.linearRampToValueAtTime(0.08, t0 + at + 0.015); // 낮은 볼륨(피크 0.08)
          gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur);
          osc.connect(gain).connect(ctx.destination);
          osc.start(t0 + at);
          osc.stop(t0 + at + dur + 0.02);
          lastEnd = Math.max(lastEnd, at + dur);
        });
        // 여운 뒤 세션 반납 — 그새 TTS가 시작됐으면 건드리지 않음(TTS 자신이 끝에서 반납)
        setTimeout(() => { if (activeTtsNodes.size === 0) suspendCtxForMic(); }, (lastEnd + 0.15) * 1000);
      } catch { /* noop */ }
    };
    if (ctx.state !== "running") {
      const rp = ctx.resume();
      if (rp?.then) rp.then(play).catch(() => { /* 효과음은 장식 — 실패 시 조용히 */ });
      else play();
    } else play();
  } catch { /* 효과음은 장식 — 실패 시 조용히 */ }
}

const POOL_SIZE = 4; // 동시 마운트되는 useKiddyVoice 인스턴스 수보다 넉넉히
const audioPool = [];
const allAudioEls = new Set(); // 생성된 모든 엘리먼트 추적(풀 안팎 무관) — 마이크 직전 일괄 해제용
function trackAudio(a) { if (a) allAudioEls.add(a); return a; }
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
  while (audioPool.length < POOL_SIZE) audioPool.push(trackAudio(new Audio()));
}
function blessPool() {
  // 제스처 핸들러 '안'에서 호출됨 — 풀에서 쉬는 엘리먼트를 무음(비뮤트) 재생으로 언락.
  // WebAudio 컨텍스트도 최초 1회 제스처 언락(resume 후 즉시 suspend — 인식과의 공존 위해 평소엔 잠재움).
  // ⚠️ 매 제스처 resume 금지: 마이크 탭에서 ctx가 깨어나면 인식이 다시 죽는다(언락 1회만).
  const ctx = getCtx();
  if (ctx && ctx.state === "suspended" && !ctx._kiddyUnlocked) {
    try {
      ctx.resume().then(() => { ctx._kiddyUnlocked = true; suspendCtxForMic(); }).catch(() => { /* 다음 제스처 재시도 */ });
    } catch { /* noop */ }
  }
  ensurePool();
  if (!audioPool.length) return;
  try { if (!unlockUrl) unlockUrl = makeSilentWavUrl(); } catch { return; }
  audioPool.forEach((a) => {
    if (a._kiddyBlessed) return; // 이미 언락 — no-op(매 제스처 호출돼도 비용 0)
    try {
      a.src = unlockUrl;
      const p = a.play();
      if (p?.then) p.then(() => { a._kiddyBlessed = true; try { a.pause(); a.currentTime = 0; } catch { /* noop */ } }).catch(() => { /* 다음 제스처에 재시도 */ });
      else a._kiddyBlessed = true;
    } catch { /* 다음 제스처에 재시도 */ }
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
  return el || (typeof Audio !== "undefined" ? trackAudio(new Audio()) : null);
}

// ── iOS 오디오 세션 반납 (마이크 켜기 직전 전용) — 오너 리포트 7/10 ──
//   증상: 키디 TTS가 한두 턴 재생된 뒤부터 음성인식이 켜지긴 하는데 무음만 잡힘("아무 소리도 안 들렸어").
//   원인: iOS는 재생/녹음을 하나의 오디오 세션으로 관리하는데, <audio>가 미디어 자원을 물고 있으면
//         (일시정지 상태여도) 세션이 '재생 모드'에 고착 → 인식 마이크에 소리가 안 들어옴.
//   해법: src까지 떼고 load()로 자원을 완전히 비워 세션을 반납. 언락(_kiddyBlessed)은 엘리먼트에
//         남으므로(제스처 이력 기반) 다음 TTS 재생은 그대로 됨. useKiddySpeech.start()가 호출.
// ── 무음 스위치 우회 — 마이크 '없는' 화면 전용 (오너 결정 7/10: 가족 책장 편지 낭독) ──
//   무음 루프 <audio>를 같이 틀어 오디오를 벨소리 채널 → '미디어 채널'로 옮기면
//   WebAudio TTS가 무음 스위치가 켜져 있어도 들림(unmute-ios-audio 기법).
//   ⚠️ 미디어 엘리먼트 재생은 직후 음성인식을 죽임(7/10 실측 확정) — 말하기 연습·체크인·음성검색 등
//   마이크 있는 화면에서는 절대 호출 금지. 반드시 사용자 제스처 안에서 hold 호출.
let mediaHoldEl = null;
export function holdMediaChannelForTTS() {
  try {
    if (typeof Audio === "undefined") return;
    if (!unlockUrl) unlockUrl = makeSilentWavUrl();
    if (!mediaHoldEl) { mediaHoldEl = new Audio(); mediaHoldEl.loop = true; }
    if (!mediaHoldEl.getAttribute("src")) mediaHoldEl.src = unlockUrl;
    const p = mediaHoldEl.play();
    if (p?.catch) p.catch(() => { /* 재생 거부 시 그냥 표준 동작(무음 스위치=음소거)으로 남음 */ });
  } catch { /* noop */ }
}
export function releaseMediaChannelHold() {
  try {
    if (mediaHoldEl) { mediaHoldEl.pause(); mediaHoldEl.removeAttribute("src"); mediaHoldEl.load(); }
  } catch { /* noop */ }
}

export function releaseKiddyAudioForMic() {
  releaseMediaChannelHold(); // 무음 우회 루프가 남아있으면 인식이 죽음 — 마이크 직전 반드시 해제
  pauseKiddyBgmForMic(); // P4: BGM 즉시 일시정지(의도 유지 — 키디 다음 발화 때 자동 복귀). bgmSrc가 남으면 아래 suspend가 게이트에 막힘
  suspendCtxForMic(); // WebAudio 경로 세션 반납(재생 중 마이크 탭 등)
  allAudioEls.forEach((a) => {
    try {
      // 이미 자원이 없는 엘리먼트는 건드리지 않기 — 빈 load()도 iOS 세션을 출렁여
      // 직후 시작하는 음성인식을 aborted로 죽일 수 있음(7/10 실측: 2턴부터 즉시 abort).
      if (!a.getAttribute("src")) return;
      a.onended = null; a.pause(); a.removeAttribute("src"); a.load();
    } catch { /* noop */ }
  });
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
  const audioRef = useRef(null);     // 현재 재생 중인 Audio(= elRef 엘리먼트, 재생 중 표시 겸용) — 엘리먼트 폴백 경로
  const srcNodeRef = useRef(null);   // 현재 재생 중인 WebAudio BufferSource(기본 경로) — 7/10 4라운드
  const elRef = useRef(null);        // 언락 풀에서 받은 재사용 엘리먼트(iOS 제스처 언락 유지) — 언마운트 시 풀 복귀
  const clipsRef = useRef([]);       // 현재 대사 그룹: [{ status:'pending'|'ready'|'failed', url }] — 호출 순서 유지
  const idxRef = useRef(0);          // 다음에 재생할 클립 인덱스
  const genRef = useRef(0);          // 세대 — speak만 증가(이전 그룹의 늦은 합성응답 폐기)
  const lastKeyRef = useRef(null);   // 중복 호출 방지 키 (tone::text)
  const [hasAudio, setHasAudio] = useState(false);

  const stopCurrent = useCallback(() => {
    const s = srcNodeRef.current;
    if (s) {
      trackTtsEnd(s); // P5 SFX·P4 덕킹 판정 집합에서 제거
      try { s.onended = null; s.stop(); } catch { /* noop */ }
      srcNodeRef.current = null;
      suspendCtxForMic(); // 재생을 끊었으면(마이크 직전 등) 세션도 즉시 반납
    }
    const a = audioRef.current;
    if (a) {
      trackTtsEnd(a); // P5·P4: 폴백 엘리먼트도 동일 추적
      // pause만 하면 iOS가 '재생 세션'을 계속 붙들어 직후 음성인식이 무음/abort — src까지 떼서 즉시 반납(7/10).
      try { a.onended = null; a.pause(); a.removeAttribute("src"); a.load(); } catch { /* noop */ }
      audioRef.current = null;
    }
  }, []);

  // 클립을 '호출 순서대로' 재생. 다음 자리가 아직 합성 중(pending)이면 멈춰 기다렸다가,
  // 채워지면(say 완료 시 pump 재호출) 이어서 재생. (명명 함수 표현식 → 자기 이름으로 재귀)
  const pump = useCallback(function pump() {
    if (audioRef.current || srcNodeRef.current) return; // 재생 중이면 onended가 이어받음
    const clip = clipsRef.current[idxRef.current];
    if (!clip) return;                            // 그룹 끝
    if (clip.status === "pending") return;        // 합성 대기 → 채워지면 다시 pump 됨
    if (clip.status === "failed" || (!clip.url && !clip.buffer)) { // 실패한 클립은 건너뜀
      idxRef.current += 1;
      pump();
      return;
    }

    // ── 기본 경로: WebAudio (iOS 음성인식과 공존 — 상단 주석 참조) ──
    const ctx = clip.buffer ? getCtx() : null;
    if (ctx && clip.buffer) {
      try {
        if (ctx.state !== "running") {
          // ⚠️ 'suspended'만이 아님 — iOS는 음성인식 서비스가 재생을 끊으면 'interrupted' 상태로 남긴다
          //   (7/10 실사고: 체크인 후 대화 화면에서 TTS가 영영 시작 안 됨). running이 아니면 전부 resume.
          if (!ctx._kiddyUnlocked) {
            // 아직 제스처 언락 전(첫 인사 등 무제스처 진입) — 대사를 버리지 않고 다음 탭에서 재시도
            try { ctx.resume(); } catch { /* noop */ }
            if (typeof document !== "undefined") document.addEventListener("pointerdown", () => pump(), { once: true, capture: true });
            return;
          }
          // 언락 후: resume이 '완료된 뒤' 재생 시작(실패 시 노드를 만들지 않아 pump가 영구 잠기지 않음 + 다음 탭 재시도)
          try {
            const rp = ctx.resume();
            if (rp?.then) {
              rp.then(() => pump()).catch(() => {
                if (typeof document !== "undefined") document.addEventListener("pointerdown", () => pump(), { once: true, capture: true });
              });
            } else if (ctx.state === "running") { pump(); } // 비프로미스 구형 경로 — 상태 확인 후에만 재진입(무한루프 방지)
          } catch {
            if (typeof document !== "undefined") document.addEventListener("pointerdown", () => pump(), { once: true, capture: true });
          }
          return;
        }
        const node = ctx.createBufferSource();
        node.buffer = clip.buffer;
        node.connect(ctx.destination);
        node.onended = () => {
          trackTtsEnd(node); // P5 SFX·P4 덕킹 판정
          if (srcNodeRef.current === node) {
            srcNodeRef.current = null;
            idxRef.current += 1;
            if (!clipsRef.current[idxRef.current]) suspendCtxForMic(); // 그룹 끝 — 다음 마이크 위해 즉시 반납
            pump();
          }
        };
        srcNodeRef.current = node;
        node.start(0);
        trackTtsStart(node); // P5: 재생 중 표시(SFX 생략 판정) + P4: BGM 덕킹
        return;
      } catch {
        // 생성/시작 실패 — 이 클립은 건너뜀(버퍼 경로엔 엘리먼트 폴백용 url이 없음)
        srcNodeRef.current = null;
        idxRef.current += 1;
        pump();
        return;
      }
    }

    // ── 폴백 경로: 미디어 엘리먼트 (AudioContext 미지원/디코드 실패) ──
    // iOS 언락 유지: 매번 new Audio(미신뢰) 대신 언락 풀 엘리먼트를 재사용(src 교체) — 상단 언락 풀 주석 참조
    if (!elRef.current) elRef.current = acquireAudio();
    const audio = elRef.current;
    if (!audio) return;                           // Audio 미지원 환경(노드 등) — 텍스트만 진행
    audio.src = clip.url;
    try { audio.load(); } catch { /* noop */ } // 사파리: 재사용 엘리먼트 src 교체 후 load 권장(스테일 소스 방지)
    audioRef.current = audio;
    audio.onended = () => {
      trackTtsEnd(audio); // P5 SFX·P4 덕킹 판정
      if (audioRef.current === audio) {
        audioRef.current = null;
        idxRef.current += 1;
        if (!clipsRef.current[idxRef.current]) {
          // 그룹 끝 — iOS 오디오 세션을 '말 끝난 즉시' 반납해 두면 다음 마이크가 1턴처럼 깨끗하게 시작(7/10).
          // (replay는 pump가 src를 다시 걸므로 무영향)
          try { audio.removeAttribute("src"); audio.load(); } catch { /* noop */ }
        }
        pump();                                   // 다음 자리로(끝이면 내부에서 그냥 반환)
      }
    };
    // 자동재생 차단(제스처 밖 재생 거부) 시 대사를 버리지 않고 '다음 탭'에서 재시도 —
    // 탭 핸들러 안에서 play()가 다시 불리므로 iOS가 반드시 허용(★2차 안전망, 첫 인사 등 무제스처 진입 커버).
    trackTtsStart(audio); // P5: 재생 중 표시(실패 catch에서 제거) + P4: 덕킹
    const p = audio.play();
    if (p?.then) p.catch(() => {
      trackTtsEnd(audio); // P5·P4: 재생 거부 → 미재생이므로 해제
      if (audioRef.current === audio) audioRef.current = null; // 재생 실패 표시 → pump 재진입 가능
      if (typeof document !== "undefined") {
        document.addEventListener("pointerdown", () => pump(), { once: true, capture: true });
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
    if (myGen !== genRef.current) return;          // 그새 새 대사(speak)로 갈아탐 → 폐기

    // WebAudio 기본 경로: mp3 → AudioBuffer 디코드(미지원/실패 시 엘리먼트 폴백용 Blob URL)
    let buffer = null;
    const ctx = blob ? getCtx() : null;
    if (blob && ctx) {
      try { buffer = await ctx.decodeAudioData(await blob.arrayBuffer()); } catch { buffer = null; }
      if (myGen !== genRef.current) return;        // 디코드 사이에 새 대사로 갈아탐 → 폐기
    }

    const clip = clipsRef.current[slot];
    if (!clip) return;                             // 방어(그룹이 리셋됐으면 무시)

    if (!blob) {
      clip.status = "failed";                      // 합성 실패 → 이 자리는 건너뜀
    } else {
      if (buffer) { clip.buffer = buffer; }        // 기본: WebAudio(iOS 인식과 공존)
      else { clip.url = URL.createObjectURL(blob); }
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
