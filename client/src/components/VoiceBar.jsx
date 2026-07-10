// ── B08a: 음성 녹음/재생 진행 바 (공용 — 부모 음성 편지 · 아이 음성 메모 B08b 공용) ──
//   순수 표시용. progress(0~1)만 받음. 트랙 6px rounded-full, 채움 #18C49A(0.1s linear).
export default function VoiceBar({ progress = 0 }) {
  const pct = Math.max(0, Math.min(1, progress || 0)) * 100;
  return (
    <div data-testid="voice-bar" className="rounded-full overflow-hidden" style={{ height: 6, backgroundColor: "rgba(255,255,255,0.12)" }}>
      <div style={{ width: `${pct}%`, height: "100%", backgroundColor: "#18C49A", borderRadius: 9999, transition: "width 0.1s linear" }} />
    </div>
  );
}
