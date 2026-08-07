// ── B13: '어디서나 열리는 가족 책장' — 동의 카드 ──
//
// 🔴 이 화면의 성격: **면책 문구가 아니라 기능 소개다.**
//    "결제 시 클라우드에 저장됩니다" 처럼 쓰면 부모는 "뭔가 불리한 거구나" 로 읽고
//    동의도 형식적으로 체크하고 넘어간다. 그러면 동의를 받는 의미가 사라진다.
//    → 무엇이 좋아지는지 먼저 말하고, 무엇이 저장되는지는 **켤 때** 정직하게 보여준다.
//    (오너 결정 2026-08-07 · 고도화/원가와가격/유료플랜_구성과_노출.md)
//
// ⚠️ 켤 때만 확인 화면을 띄운다. 끌 때는 묻지 않는다 —
//    되돌리는 걸 어렵게 만드는 건 다크패턴이다.
//
// ⚠️ 철회는 '더 올리지 않는다'까지다. 이미 올라간 일기는 지우지 않는다(부록 A #22 답변 대기).
//    그래서 끌 때 그 사실을 **반드시 알린다.** "껐으니 다 지워졌겠지"라고 오해하면 안 된다.

import { useState } from "react";
import { postDiaryConsent } from "../utils/api";

const C = {
  panel: "#0E2A2A",
  card: "#123030",
  line: "rgba(255,255,255,0.08)",
  text: "#EAF5F1",
  muted: "#90A9A8",
  dim: "#6d8281",
  on: "#18C49A",
};

export default function DiaryConsentCard({ profile, onChanged }) {
  const [sheet, setSheet] = useState(false);     // 켜기 확인 화면
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");          // 끈 뒤 안내

  if (!profile?.id) return null;
  const on = profile.diaryServerOn === true;
  const name = profile.name || "아이";

  const send = async (action) => {
    setBusy(true); setErr("");
    try {
      await postDiaryConsent(profile.id, action);
      setSheet(false);
      setNote(action === "revoke"
        ? "껐어요. 지금부터는 새 일기가 이 기기에만 남아요. 이미 올려둔 일기는 그대로 있어요 — 지우시려면 각 페이지에서 지워주세요."
        : "");
      onChanged?.(profile.id, action === "grant");
    } catch (e) {
      // 403 = 서버가 동의를 확인하고 막은 것. 그 외는 통신 문제.
      setErr(e?.response?.status === 401
        ? "다시 로그인해 주세요."
        : "지금은 바꾸지 못했어요. 잠시 뒤 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-4 p-4" style={{ borderRadius: "12px", backgroundColor: C.card, border: `1px solid ${C.line}` }}>
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <div className="text-sm font-semibold mb-1" style={{ color: C.text }}>
            📖 어디서나 열리는 가족 책장
          </div>
          <div className="text-xs leading-relaxed" style={{ color: C.muted }}>
            {on
              ? `${name}의 그림일기를 부모님 휴대전화에서도 보실 수 있어요. 기기를 바꿔도 따라옵니다.`
              : `지금 ${name}의 그림일기는 ${name}이 쓴 기기에만 있어요. 켜시면 부모님 휴대전화에서도 보실 수 있어요.`}
          </div>
        </div>

        {/* 토글 — 켤 때만 확인 화면, 끌 때는 바로 */}
        <button
          // ⚠️ 켜기 화면을 열 때 이전 안내를 지운다 — 안 지우면 "껐어요"와
          //    "켜기 전에 알려드릴게요"가 한 화면에 같이 떠서 서로 모순된다(2026-08-07 오너 발견).
          onClick={() => (on ? send("revoke") : (setNote(""), setSheet(true)))}
          disabled={busy}
          aria-pressed={on}
          aria-label="어디서나 열리는 가족 책장"
          className="shrink-0 mt-0.5 transition disabled:opacity-50"
          style={{
            width: 46, height: 26, borderRadius: 13,
            backgroundColor: on ? C.on : "rgba(255,255,255,0.14)",
            position: "relative",
          }}
        >
          <span
            style={{
              position: "absolute", top: 3, left: on ? 23 : 3,
              width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff",
              transition: "left .16s ease",
            }}
          />
        </button>
      </div>

      {err && <div className="mt-2.5 text-xs" style={{ color: "#F2655C" }}>{err}</div>}
      {note && <div className="mt-2.5 text-xs leading-relaxed" style={{ color: C.dim }}>{note}</div>}

      {/* ── 켜기 확인 — 무엇이 저장되는지 정직하게 ── */}
      {sheet && (
        <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${C.line}` }}>
          <div className="text-xs font-semibold mb-2" style={{ color: C.text }}>
            켜기 전에 알려드릴게요
          </div>
          <ul className="space-y-1.5 text-xs leading-relaxed mb-3" style={{ color: C.muted }}>
            <li>• {name}이 <strong style={{ color: C.text }}>간직하기로 고른 일기</strong>의 글·그림·녹음이 키디 서버에 저장돼요.</li>
            <li>• 저장은 <strong style={{ color: C.text }}>미국에 있는 서버</strong>(Supabase)에서 이뤄져요. 파일은 비공개로 보관되고, 열어볼 때마다 10분짜리 임시 주소를 새로 만들어요.</li>
            <li>• <strong style={{ color: C.text }}>{name}의 목소리를 글자로 옮기지 않아요.</strong> 그런 항목 자체가 없어요.</li>
            <li>• 일기를 지우시면 <strong style={{ color: C.text }}>서버에서도 함께 지워져요.</strong></li>
            <li>• <strong style={{ color: C.text }}>언제든 다시 끄실 수 있어요.</strong> 끄면 새 일기가 더는 올라가지 않아요.</li>
          </ul>
          <div className="flex gap-2">
            <button
              onClick={() => send("grant")}
              disabled={busy}
              className="flex-1 py-2.5 text-xs font-bold text-white transition disabled:opacity-50"
              style={{ borderRadius: "10px", background: "linear-gradient(135deg, #18C49A, #14B8C4)" }}
            >
              {busy ? "켜는 중..." : "동의하고 켜기"}
            </button>
            <button
              onClick={() => { setSheet(false); setErr(""); }}
              disabled={busy}
              className="px-4 py-2.5 text-xs font-medium transition disabled:opacity-50"
              style={{ borderRadius: "10px", border: `1px solid ${C.line}`, color: C.muted }}
            >
              나중에
            </button>
          </div>
          <a
            href="/privacy"
            className="mt-2.5 inline-block text-xs underline underline-offset-4"
            style={{ color: C.dim }}
          >
            개인정보 처리방침 보기
          </a>
        </div>
      )}
    </div>
  );
}
