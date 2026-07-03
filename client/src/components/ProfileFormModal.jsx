import { useState } from "react";
import { FaTimes } from "react-icons/fa";
import { createProfile, updateProfile } from "../utils/api";

// 자녀 프로필 생성/수정 겸용 모달 (계정 영역 동작) — ProfileSelect에서 사용
// onClose(): 닫기
// onCreated(profile): 생성 성공 시 새 프로필 전달 (생성 모드)
// profile: 넘기면 수정 모드 (해당 프로필 값으로 프리필)
// onUpdated(profile): 수정 성공 시 갱신된 프로필 전달 (수정 모드)
const AGE_OPTIONS = [4, 5, 6, 7, 8, 9, 10];
const AVATAR_LIST = [1, 2, 3, 4, 5, 6, 7, 8];
const AVATAR_OFFSET_X = { 5: "43%" };

const avatarStyle = (id) => ({
  width: "100%",
  height: "100%",
  objectFit: "cover",
  objectPosition: `${AVATAR_OFFSET_X[id] ?? "center"} 0%`,
  transform: "scale(1.1) translateY(-2%)",
  transformOrigin: "center top",
});

export default function ProfileFormModal({ onClose, onCreated, profile = null, onUpdated }) {
  const isEdit = !!profile; // profile 넘어오면 수정 모드
  const [name, setName] = useState(profile?.name ?? "");
  const [age, setAge] = useState(profile?.age ?? 7);
  const [gender, setGender] = useState(profile?.gender ?? "남자");
  const [avatarId, setAvatarId] = useState(profile?.avatarId ?? 1);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) { setError("이름을 입력해주세요!"); return; }
    setBusy(true);
    try {
      if (isEdit) {
        const updated = await updateProfile(profile.id, { name: name.trim(), age, gender, avatarId });
        onUpdated?.(updated);
      } else {
        const created = await createProfile({ name: name.trim(), age, gender, avatarId, timeLimit: 60 });
        onCreated?.(created);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.detail || (isEdit ? "프로필 수정에 실패했어요." : "프로필 생성에 실패했어요."));
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ backgroundColor: "rgba(0,0,0,0.6)" }}>
      <div className="w-full max-w-xl p-8" style={{ borderRadius: "24px", overflow: "hidden", backgroundColor: "#0E2A2A", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold" style={{ color: "#EAF5F1" }}>{isEdit ? "프로필 수정" : "새 프로필 만들기"}</h3>
          <button onClick={onClose} className="text-xl" style={{ color: "#90A9A8" }}>
            <FaTimes />
          </button>
        </div>

        {/* 아바타 선택 */}
        <div className="mb-6">
          <p className="mb-3 text-base font-semibold" style={{ color: "#90A9A8" }}>캐릭터</p>
          <div className="flex justify-center mb-5">
            <div
              className="overflow-hidden"
              style={{ width: "260px", height: "260px", borderRadius: "28px", border: "4px solid #18C49A", backgroundColor: "#163635" }}
            >
              <img src={`/images/avatars/avatar_${String(avatarId).padStart(2, "0")}.png`} alt="선택된 캐릭터" style={avatarStyle(avatarId)} />
            </div>
          </div>
          <div
            style={{ display: "flex", gap: "12px", overflowX: "scroll", overflowY: "visible", paddingBottom: "8px", width: "100%", WebkitOverflowScrolling: "touch", scrollbarWidth: "thin", scrollbarColor: "#163635 transparent" }}
          >
            {AVATAR_LIST.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setAvatarId(id)}
                className="relative flex-shrink-0 overflow-hidden transition"
                style={{ width: "90px", height: "90px", borderRadius: "16px", border: avatarId === id ? "3px solid #18C49A" : "2px solid rgba(255,255,255,0.1)", backgroundColor: "#163635" }}
              >
                <img src={`/images/avatars/avatar_${String(id).padStart(2, "0")}.png`} alt={`캐릭터 ${id}`} style={avatarStyle(id)} />
                {avatarId === id && (
                  <div className="absolute bottom-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full" style={{ backgroundColor: "#18C49A" }}>
                    <span className="font-bold" style={{ color: "#08160F", fontSize: "10px" }}>✓</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 이름 */}
        <div className="mb-5">
          <label className="mb-2 block text-base font-semibold" style={{ color: "#90A9A8" }}>이름</label>
          <input
            type="text"
            placeholder="아이 이름 입력"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-[12px] px-4 py-3 text-base outline-none"
            style={{ border: "1px solid rgba(255,255,255,0.12)", backgroundColor: "#163635", color: "#EAF5F1" }}
          />
        </div>

        {/* 나이 */}
        <div className="mb-5">
          <label className="mb-2 block text-base font-semibold" style={{ color: "#90A9A8" }}>나이</label>
          <div className="flex flex-col gap-2 max-h-40 overflow-y-auto pr-1">
            {AGE_OPTIONS.map((a) => (
              <button
                key={a}
                onClick={() => setAge(a)}
                className="rounded-[10px] px-5 py-2.5 text-base font-medium transition"
                style={age === a
                  ? { backgroundColor: "#18C49A", color: "#08160F" }
                  : { border: "1px solid rgba(255,255,255,0.12)", backgroundColor: "#163635", color: "#90A9A8" }}
              >
                {a}세
              </button>
            ))}
          </div>
        </div>

        {/* 성별 */}
        <div className="mb-6">
          <label className="mb-2 block text-base font-semibold" style={{ color: "#90A9A8" }}>성별</label>
          <div className="flex gap-2">
            {["남자", "여자"].map((g) => (
              <button
                key={g}
                onClick={() => setGender(g)}
                className="rounded-[10px] px-6 py-2.5 text-base font-medium transition"
                style={gender === g
                  ? { backgroundColor: "#18C49A", color: "#08160F" }
                  : { border: "1px solid rgba(255,255,255,0.12)", backgroundColor: "#163635", color: "#90A9A8" }}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="mb-3 text-base" style={{ color: "#F2655C" }}>{error}</p>}

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={busy}
            className="flex-1 rounded-[12px] py-3 text-base font-semibold transition disabled:opacity-50"
            style={{ backgroundColor: "#18C49A", color: "#08160F" }}
          >
            {busy ? "저장 중..." : isEdit ? "수정하기" : "저장하기"}
          </button>
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-[12px] px-6 py-3 text-base font-medium disabled:opacity-50"
            style={{ backgroundColor: "#163635", color: "#90A9A8" }}
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );
}
