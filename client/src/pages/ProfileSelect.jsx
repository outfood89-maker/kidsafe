import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FaPlus, FaLock, FaSignOutAlt, FaUserCircle, FaTrash, FaSlidersH, FaPen } from "react-icons/fa";
import KiddyImg from "../components/KiddyImg";
import PinModal from "../components/PinModal";
import ProfileFormModal from "../components/ProfileFormModal";
import InterestSeed from "../components/InterestSeed";
import Typewriter from "../components/Typewriter";
import PaywallModal from "../components/PaywallModal";
import useTour from "../hooks/useTour"; // P3: 프로필 생성 온보딩 — 기존 앵커드 코치마크 엔진 재사용(훅 무수정)
import TourCoachmark from "../components/TourCoachmark"; // P3: 코치마크 UI 재사용(컴포넌트 무수정)
import { getProfiles, getBadges, getPinStatus, deleteProfile } from "../utils/api";
import { useAuth } from "../contexts/AuthContext";
import { PROFILE_ONBOARD } from "../utils/diaryCopy"; // P3: 온보딩 3스텝 카피(팀장 스탬프 verbatim)

// 높을수록 희귀 (획득 조건 기준) — 서버 배지 목록과 동기화(N 개편: 시청량·빈도 배지 제거, 마음 개근왕 추가)
const BADGE_RANK = {
  all_star: 10,
  kidsafe_master: 9,
  heart_attendance: 8,
  safety_expert: 7,
  perfectionist: 7,
  brain_power: 6,
  safety_guard: 5,
  curious_explorer: 4,
  play_expert: 4,
  fav_collector: 3,
  genre_pioneer: 3,
  playlist_fan: 3,
  fairy_tale_lover: 2,
  dino_expert: 2,
  science_sprout: 2,
  first_step: 1,
};

const getRarestBadge = (badges) => {
  if (!badges || badges.length === 0) return null;
  return [...badges].sort((a, b) =>
    (BADGE_RANK[b.badgeId] ?? 0) - (BADGE_RANK[a.badgeId] ?? 0)
  )[0];
};

const getBadgeTierClass = (badgeId) => {
  const rank = BADGE_RANK[badgeId] ?? 0;
  if (rank >= 9) return "badge-diamond";
  if (rank >= 7) return "badge-emerald";
  if (rank >= 5) return "badge-gold";
  if (rank >= 3) return "badge-silver";
  return "badge-bronze";
};

// P3: 프로필 생성 온보딩 3정거장 — targetId는 아래 앵커(data-tour-id)와 일치. ①만 interactive(실제 ➕ 클릭 통과).
//   ⚠️ PROFILE_ONBOARD.steps(diaryCopy)와 1:1 인덱스 매칭. TourCoachmark·useTour 무수정 재사용.
export const PROFILE_ONBOARD_STATIONS = [ // export: 1:1 가드 테스트 접근용
  { targetId: "onboard-add",  interactive: true },  // ① 만들기(➕) — 사용자가 실제로 눌러 생성 모달 진입
  { targetId: "onboard-card", interactive: false }, // ② 방금 만든 아이 카드
  { targetId: "onboard-lock", interactive: false }, // ③ 🔒 부모 공간
];

export default function ProfileSelect() {
  const navigate = useNavigate();
  const { user, signOut, isPremium } = useAuth();
  const [profiles, setProfiles] = useState([]);
  const [pinTarget, setPinTarget] = useState(null); // null | { profileId, mode } — 프로필별 부모 PIN 모달
  const [showCreate, setShowCreate] = useState(false); // 프로필 생성 모달 (계정 영역)
  const [seedTarget, setSeedTarget] = useState(null); // null | profile — 생성 직후 관심사 씨앗(F0) 오버레이
  const [editTarget, setEditTarget] = useState(null); // null | profile — 프로필 수정 모달 (관리 모드)
  const [confirmTarget, setConfirmTarget] = useState(null); // null | profile — 아이 확인 오버레이
  const [showPaywall, setShowPaywall] = useState(false); // 무료 1개 초과 시 paywall
  const [manage, setManage] = useState(false); // 관리 모드 (켜면 카드에 삭제 노출 — 계정 영역 동작)
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [profileBadges, setProfileBadges] = useState({});
  // P3: 프로필 생성 온보딩(프로필 0개 최초 1회) — 앵커드 코치마크 3스텝
  const tour = useTour(PROFILE_ONBOARD_STATIONS);
  const onboardStartedRef = useRef(false); // 세션 내 중복 시작 방지

  useEffect(() => {
    // 로그인 사용자가 확정된 뒤 조회. user.id는 토큰 갱신과 무관하게 안정적이라
    // 재조회 폭주/갱신 순간의 일시 실패를 피한다. 첫 조회가 실패하면 자동 재시도(최대 2회).
    if (!user) return;
    let cancelled = false;

    const fetchProfiles = async (attempt = 0) => {
      try {
        const data = await getProfiles();
        if (cancelled) return;
        setProfiles(data);
        const badgeResults = await Promise.all(
          data.map(async (p) => {
            try {
              return [p.id, await getBadges(p.id)];
            } catch {
              return [p.id, []];
            }
          })
        );
        if (!cancelled) {
          setProfileBadges(Object.fromEntries(badgeResults));
          setLoading(false);
        }
      } catch (err) {
        // 첫 진입 토큰 race 등 일시 실패 → 잠깐 후 재시도
        if (!cancelled && attempt < 2) {
          setTimeout(() => fetchProfiles(attempt + 1), 500);
          return;
        }
        if (!cancelled) {
          console.error("프로필 불러오기 실패:", err);
          setLoading(false);
        }
      }
    };

    fetchProfiles();
    return () => { cancelled = true; };
  }, [user?.id]);

  // P3 개정(오너 7/10): "?" 재진입 버튼 신설 — 프로필이 이미 있는 계정도 언제든 안내를 볼 수 있게.
  //   투어 시작 시점의 프로필 수를 기억해, '투어 중 새 프로필이 생겼을 때만' 스텝1→2 자동 전환(아래 §3).
  const tourBaseCountRef = useRef(0);
  const startOnboarding = () => {
    tourBaseCountRef.current = profiles.length;
    tour.start();
  };

  // P3 §1: 로딩 완료 후 프로필 0개 + 미노출 플래그 없을 때만 온보딩 1회 자동 시작. 시작 시점에 플래그 기록(부모 투어 패턴 동일).
  //   ⚠️ 로딩 중 profiles=[] 오판 금지 — 반드시 loading 완료 뒤. 기존 사용자(1개 이상)는 자동으론 안 뜸("?"로만).
  useEffect(() => {
    if (loading || onboardStartedRef.current || profiles.length !== 0) return;
    let seen = false;
    try { seen = localStorage.getItem("kidsafe_profile_onboarding_seen") === "1"; } catch { /* 무시 */ }
    if (seen) return;
    onboardStartedRef.current = true;
    try { localStorage.setItem("kidsafe_profile_onboarding_seen", "1"); } catch { /* 무시 */ }
    startOnboarding();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, profiles.length]);

  // P3 §3(시퀀스 함정): 스텝1→스텝2 전환은 '생성 모달 닫힘'이 아니라 '관심사 인터뷰까지 끝나고 그리드에 프로필이 생긴 순간'.
  //   생성 취소/실패로 안 늘었으면 스텝1 유지. showCreate·seedTarget 떠 있는 동안은 아래 렌더 게이트가 코치마크를 숨김.
  //   개정: '투어 시작 때보다 프로필이 늘었을 때'만 전환 — "?" 재진입(프로필 이미 있음)에서 스텝1이 즉시 건너뛰어지는 것 방지.
  useEffect(() => {
    if (tour.isActive && tour.step === 0 && !showCreate && !seedTarget && profiles.length > tourBaseCountRef.current) {
      tour.next();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tour.isActive, tour.step, showCreate, seedTarget, profiles.length]);

  // P3: 코치마크 '다음' 배선 — TourCoachmark 무수정이라 '다음' 버튼은 항상 렌더됨.
  //   ①(만들기): 프로필 0개면 '다음' = ➕와 동일하게 생성 모달 열기(프로필이 생기면 위 §3 효과가 ②로 자동 전환).
  //     "?" 재진입(이미 있음)이면 안내만 하고 일반 진행 — 무료 1개 초과 paywall을 우회해 생성 모달을 열면 안 됨.
  //   ②→③: 일반 진행. ③: 종료 CTA로 투어 종료.
  const onboardNext = () => {
    if (tour.step === 0 && profiles.length === 0) { setShowCreate(true); return; }
    if (tour.isLast) { tour.exit(); return; }
    tour.next();
  };

  // 카드 클릭 → 먼저 확인 오버레이 (잘못 들어가기 방지)
  const handleProfileClick = (profile) => {
    setConfirmTarget(profile);
  };

  // 확인 오버레이에서 "웅 맞아!!!" → 실제 진입
  const handleConfirmEnter = (profile) => {
    setConfirmTarget(null);
    setSelectedId(profile.id);
    localStorage.setItem("selectedProfile", JSON.stringify(profile));
    setTimeout(() => navigate("/kids"), 150);
  };

  // 프로필 삭제 (계정 영역 동작) — 종속 데이터는 DB cascade 자동 정리
  const handleDeleteProfile = async (profile) => {
    if (!window.confirm(`'${profile.name}' 프로필을 삭제할까요?\n시청기록·찜·배지 등도 함께 삭제되며 복구할 수 없어요.`)) return;
    try {
      await deleteProfile(profile.id);
      setProfiles((prev) => prev.filter((p) => p.id !== profile.id));
    } catch {
      alert("삭제에 실패했어요.");
    }
  };

  // 특정 아이의 부모 페이지 진입 — 그 프로필 PIN 게이트 (설정돼 있으면 입력, 없으면 최초 설정)
  const handleParentEnter = async (profile) => {
    try {
      const { hasPin } = await getPinStatus(profile.id);
      setPinTarget({ profileId: profile.id, mode: hasPin ? "verify" : "setup" });
    } catch {
      setPinTarget({ profileId: profile.id, mode: "verify" }); // 조회 실패 시 입력 모달로 (검증은 서버가 함)
    }
  };

  // 로그아웃 → 세션 종료 후 랜딩으로 (로그인 전용 화면이라 랜딩 복귀가 맞음)
  const handleSignOut = async () => {
    try {
      localStorage.removeItem("selectedProfile");
      await signOut();
      navigate("/");
    } catch (e) {
      console.error("로그아웃 실패:", e);
    }
  };

  const getAvatarUrl = (profile) =>
    `/images/avatars/avatar_${String(profile?.avatarId || 1).padStart(2, "0")}.png`;

  // 아바타 이미지는 재가공 완료(정사각·상반신·머리위 여백 통일) → CSS는 단순 cover면 충분
  const getAvatarStyle = () => ({
    width: "100%",
    height: "100%",
    objectFit: "cover",
    objectPosition: "center top",
    transform: "scale(1.04)", // 원 테두리 미세 흰선 방지
    transformOrigin: "center top",
  });

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0A1E1E" }}>

      {/* NavBar — 키즈 페이지와 동일 틀 (h-14 / max-w-7xl / px-4) */}
      <header
        className="sticky top-0 z-50"
        style={{ backgroundColor: "#0E2A2A", borderBottom: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        {/* 왼쪽: 로고 (키즈 페이지와 규격 통일 — h-8 w-8 / text-sm) */}
        <div className="flex items-center gap-1.5">
          <img src="/images/logo/symbol_256.png" alt="Kiddy" className="h-8 w-8" style={{ objectFit: "contain" }} />
          <span className="text-sm font-extrabold tracking-tight" style={{ color: "#EAF5F1" }}>Kiddy</span>
        </div>

        {/* 오른쪽: 계정 액션 묶음 (계정 + 로그아웃 + 부모님) — 관습대로 우측 정렬
            계정 설정을 프로필 선택 단계에 둠 → 향후 프로필별 개별 부모페이지+PIN(멀티테넌시) 대비 */}
        <div className="flex items-center gap-2">
          {/* 관리 모드 토글 — 켜면 카드에 삭제 노출 (프로필 추가/삭제는 계정 영역) */}
          <button
            onClick={() => setManage((m) => !m)}
            className="flex items-center gap-1.5 rounded-[10px] px-3.5 py-2 text-sm font-bold transition hover:opacity-80"
            style={manage
              ? { backgroundColor: "#18C49A", color: "#08160F", border: "1px solid #18C49A" }
              : { backgroundColor: "#163635", color: "#EAF5F1", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <FaSlidersH style={{ color: manage ? "#08160F" : "#18C49A" }} />
            <span className="hidden sm:block">{manage ? "완료" : "관리"}</span>
          </button>
          <button
            onClick={() => navigate("/account")}
            className="flex items-center gap-1.5 rounded-[10px] px-3.5 py-2 text-sm font-bold transition hover:opacity-80"
            style={{ backgroundColor: "#163635", color: "#EAF5F1", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <FaUserCircle style={{ color: "#18C49A" }} />
            <span className="hidden sm:block">계정</span>
          </button>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 rounded-[10px] px-3.5 py-2 text-sm font-bold transition hover:opacity-80"
            style={{ backgroundColor: "#163635", color: "#EAF5F1", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <FaSignOutAlt style={{ color: "#18C49A" }} />
            <span className="hidden sm:block">로그아웃</span>
          </button>
          {/* 통합 '부모님' 버튼 제거 — 부모페이지는 이제 아이 카드의 🔒(프로필별)로 진입 */}
        </div>
        </div>
      </header>

      {/* P3: 읽기전용 스텝(②③)에선 콘텐츠 inert — 스포트라이트 구멍으로의 실제 클릭(카드 진입 등) 차단. ①(interactive)은 ➕ 실제 클릭 허용 위해 inert 해제. */}
      <div className="mx-auto max-w-2xl px-5 py-8" inert={tour.isActive && !tour.station?.interactive}>

        {/* P3 개정(오너 7/10): 헤더 아래 우측 버튼 줄 — "?" 온보딩 재진입 + 👀 아이 화면 미리보기(헤더에서 이동, 라벨 상시 표시) */}
        <div className="mb-4 flex items-center justify-end gap-2">
          <button
            data-testid="onboard-help-btn"
            onClick={startOnboarding}
            title="이 화면 안내"
            className="shrink-0 flex items-center justify-center rounded-full text-sm font-black transition hover:opacity-80"
            style={{ width: "34px", height: "34px", backgroundColor: "#163635", color: "#18C49A", border: "1px solid rgba(24,196,154,0.35)" }}
          >
            ?
          </button>
          {/* §7: 아이 화면 미리보기 — /kids?tour=1(KidHome 데모 프로필 자동 주입·종료 시 복귀). 프로필 0개여도 안전. 온보딩 앵커 아님. */}
          <button
            data-testid="profile-kid-preview-btn"
            onClick={() => navigate("/kids?tour=1")}
            className="flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-bold transition hover:opacity-80 active:scale-95"
            style={{ background: "linear-gradient(135deg, #F5B829, #EF9F27)", color: "#3A2A00" }}
          >
            <span>👀</span>
            <span>아이 화면 미리보기</span>
          </button>
        </div>

        {/* 상단 인사 */}
        <div className="mb-8 flex flex-col items-center gap-2">
          {/* 키디 */}
          <div className="relative inline-block">
            <KiddyImg pose="search" size={300} />
          </div>
          <div
            className="flex flex-col items-center gap-1 rounded-2xl px-8 py-4 mt-2"
            style={{ backgroundColor: "#0E2A2A", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 8px 28px rgba(0,0,0,0.35)" }}
          >
            <h1 className="text-3xl font-black tracking-tight" style={{ color: "#EAF5F1" }}>
              누가 볼 건가요? 👀
            </h1>
            <p className="text-sm" style={{ color: "#90A9A8" }}>프로필을 선택해주세요</p>
          </div>
        </div>

        {loading && (
          <p className="text-center text-sm" style={{ color: "#90A9A8" }}>불러오는 중...</p>
        )}

        {!loading && (
          <>
            {/* 프로필 그리드 */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              {profiles.map((profile, idx) => {
                const isSelected = selectedId === profile.id;
                const topBadge = getRarestBadge(profileBadges[profile.id]);
                return (
                  <div key={profile.id} className="relative">
                  {/* 관리 모드일 때만: 수정·삭제 (좌상단, 나란히) */}
                  {manage && (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditTarget(profile); }}
                        className="absolute left-3 top-3 z-10 flex items-center justify-center rounded-full transition hover:opacity-80"
                        style={{ width: "36px", height: "36px", backgroundColor: "rgba(0,0,0,0.45)", border: "1px solid rgba(255,255,255,0.2)" }}
                        aria-label={`${profile.name} 수정`}
                        title="프로필 수정"
                      >
                        <FaPen style={{ color: "#18C49A", fontSize: "12px" }} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteProfile(profile); }}
                        className="absolute left-[56px] top-3 z-10 flex items-center justify-center rounded-full transition hover:opacity-80"
                        style={{ width: "36px", height: "36px", backgroundColor: "rgba(242,101,92,0.9)", border: "1px solid rgba(255,255,255,0.2)" }}
                        aria-label={`${profile.name} 삭제`}
                        title="프로필 삭제"
                      >
                        <FaTrash style={{ color: "#fff", fontSize: "13px" }} />
                      </button>
                    </>
                  )}
                  {/* 부모 잠금 — 이 아이 전용 부모페이지(PIN 게이트). P3: 첫 카드 🔒 = 온보딩 ③ 앵커 */}
                  <button
                    data-tour-id={idx === 0 ? "onboard-lock" : undefined}
                    onClick={(e) => { e.stopPropagation(); handleParentEnter(profile); }}
                    className="absolute right-3 top-3 z-10 flex items-center justify-center rounded-full transition hover:opacity-80"
                    style={{ width: "36px", height: "36px", backgroundColor: "rgba(24,196,154,0.18)", border: "1px solid rgba(24,196,154,0.35)" }}
                    aria-label={`${profile.name} 부모 설정`}
                    title="부모 설정"
                  >
                    <FaLock style={{ color: "#18C49A", fontSize: "15px" }} />
                  </button>
                  <button
                    data-tour-id={idx === 0 ? "onboard-card" : undefined}
                    onClick={() => handleProfileClick(profile)}
                    className="w-full flex flex-col items-center py-8 px-6 transition hover:-translate-y-1"
                    style={{
                      borderRadius: "20px",
                      backgroundColor: "#0E2A2A",
                      border: isSelected ? "2px solid #18C49A" : "1px solid rgba(255,255,255,0.08)",
                      boxShadow: isSelected ? "0 0 0 4px rgba(24,196,154,0.2), 0 12px 36px rgba(20,184,196,0.25)" : "0 8px 24px rgba(0,0,0,0.3)",
                    }}
                  >
                    {/* 아바타 */}
                    <div
                      className="rounded-full overflow-hidden mb-4"
                      style={{
                        width: "120px", height: "120px",
                        border: "3px solid #163635",
                      }}
                    >
                      <img
                        src={getAvatarUrl(profile)}
                        alt={profile.name}
                        style={getAvatarStyle()}
                      />
                    </div>
                    {/* 이름 */}
                    <p className="text-xl font-bold mb-2" style={{ color: "#EAF5F1" }}>
                      {profile.name}
                    </p>
                    {/* 나이 배지 */}
                    <span
                      className="text-sm font-bold rounded-full px-3.5 py-1 mb-3"
                      style={{ backgroundColor: "#163635", color: "#5FE0BC" }}
                    >
                      {profile.age}세
                    </span>
                    {/* 대표 배지 */}
                    {topBadge ? (
                      <div className={`${getBadgeTierClass(topBadge.badgeId)} flex items-center justify-center gap-1 rounded-full px-2.5 py-1.5 w-full overflow-hidden`}>
                        <span className="text-sm leading-none shrink-0">{topBadge.emoji}</span>
                        <span className="text-[11px] font-bold whitespace-nowrap overflow-hidden text-ellipsis">{topBadge.name}</span>
                      </div>
                    ) : (
                      <div
                        className="rounded-full px-3 py-1"
                        style={{ backgroundColor: "#163635" }}
                      >
                        <span className="text-xs" style={{ color: "#6B8378" }}>아직 모으는 중!</span>
                      </div>
                    )}
                  </button>
                  </div>
                );
              })}

              {/* 프로필 추가 카드 — 계정 영역 동작 (생성 모달, 무료는 1개 초과 시 paywall). P3: 온보딩 ① 앵커 */}
              {profiles.length < 4 && (
                <button
                  data-tour-id="onboard-add"
                  onClick={() => {
                    if (!isPremium && profiles.length >= 1) setShowPaywall(true);
                    else setShowCreate(true);
                  }}
                  className="flex flex-col items-center justify-center py-8 px-6 transition hover:-translate-y-1"
                  style={{
                    borderRadius: "20px",
                    backgroundColor: "rgba(255,255,255,0.02)",
                    border: "1.5px dashed rgba(255,255,255,0.15)",
                    minHeight: "280px",
                  }}
                >
                  <div
                    className="flex items-center justify-center rounded-full mb-4"
                    style={{ width: "72px", height: "72px", backgroundColor: "#163635" }}
                  >
                    <FaPlus style={{ color: "#18C49A", fontSize: "24px" }} />
                  </div>
                  <p className="text-base font-bold" style={{ color: "#EAF5F1" }}>
                    프로필 추가
                  </p>
                  <p className="text-sm mt-1" style={{ color: "#6B8378" }}>
                    새 자녀 프로필
                  </p>
                </button>
              )}
            </div>

            {profiles.length === 0 && (
              <div className="text-center py-6">
                <p className="text-sm" style={{ color: "#90A9A8" }}>아직 프로필이 없어요.</p>
                <p className="text-sm mt-1" style={{ color: "#90A9A8" }}>부모모드에서 프로필을 만들어주세요!</p>
              </div>
            )}
          </>
        )}

      </div>

      {/* 아이 확인 오버레이 — 프로필 카드 클릭 후 "정말 나 맞아?" 한번 더 확인 (잘못 진입 방지) */}
      {confirmTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-5"
          style={{ backgroundColor: "rgba(8,22,22,0.82)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
          onClick={() => setConfirmTarget(null)} // 바깥 탭 → 취소 (잘못 들어와도 쉽게 빠져나옴)
        >
          {/* 등장 팝 애니메이션 */}
          <style>{`@keyframes confirmPop{0%{opacity:0;transform:scale(0.9) translateY(8px)}100%{opacity:1;transform:scale(1) translateY(0)}}`}</style>

          {/* 카드 (한 덩어리로 응집 — 빈공간 제거) */}
          <div
            onClick={(e) => e.stopPropagation()} // 카드 안 탭은 닫히지 않게
            className="relative w-full px-6 pt-7 pb-6"
            style={{
              maxWidth: "360px",
              backgroundColor: "#0E2A2A",
              borderRadius: "28px",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 24px 60px rgba(0,0,0,0.55)",
              animation: "confirmPop 0.28s cubic-bezier(0.34,1.56,0.64,1)",
            }}
          >
            {/* 아이 아바타 (주인공 — 중앙) */}
            <div className="flex justify-center mb-3">
              <div
                className="overflow-hidden"
                style={{
                  width: "104px", height: "104px", borderRadius: "50%",
                  border: "4px solid #18C49A",
                  boxShadow: "0 0 0 6px rgba(24,196,154,0.12), 0 10px 28px rgba(0,0,0,0.45)",
                }}
              >
                <img src={getAvatarUrl(confirmTarget)} alt={confirmTarget.name} style={getAvatarStyle()} />
              </div>
            </div>

            {/* 키디 (크게, 중앙) + 말풍선 (키디 아래 — 꼬리가 위로 키디를 가리킴) */}
            <div className="flex flex-col items-center mb-6">
              <KiddyImg pose="think" size={150} />
              <div
                className="relative w-full rounded-2xl px-5 py-4 text-center"
                style={{ marginTop: "6px", backgroundColor: "#163635", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                {/* 위쪽 꼬리 (키디를 가리킴) */}
                <div
                  className="absolute"
                  style={{
                    left: "50%", top: "-6px", width: "12px", height: "12px",
                    transform: "translateX(-50%) rotate(45deg)",
                    backgroundColor: "#163635",
                    borderLeft: "1px solid rgba(255,255,255,0.06)",
                    borderTop: "1px solid rgba(255,255,255,0.06)",
                  }}
                />
                <Typewriter
                  key={confirmTarget.id}
                  text={`정말 ${confirmTarget.name} 맞아? 🤔`}
                  className="font-extrabold leading-snug"
                  style={{ color: "#FFFFFF", fontSize: "19px" }}
                />
                <p className="mt-1 font-semibold" style={{ color: "#B9D0CC", fontSize: "15px" }}>준비됐으면 눌러줘! 🌟</p>
              </div>
            </div>

            {/* 선택 버튼 (가로 — 왼쪽 취소 / 오른쪽 확인) */}
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmTarget(null)}
                className="flex-1 rounded-2xl py-4 font-bold transition active:scale-95"
                style={{
                  backgroundColor: "#163635", color: "#C2D6D2",
                  border: "1px solid rgba(255,255,255,0.1)", fontSize: "16px",
                }}
              >
                아니에요 🙅
              </button>
              <button
                onClick={() => handleConfirmEnter(confirmTarget)}
                className="flex-1 rounded-2xl py-4 font-extrabold transition active:scale-95"
                style={{
                  background: "linear-gradient(135deg, #18C49A, #14B8C4)",
                  color: "#08160F", fontSize: "16px",
                  boxShadow: "0 6px 18px rgba(24,196,154,0.35)",
                }}
              >
                응, 나 맞아! 🙋
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 프로필별 부모 PIN 게이트 — 통과 시 그 아이 부모페이지 진입 */}
      {pinTarget && (
        <PinModal
          profileId={pinTarget.profileId}
          mode={pinTarget.mode}
          onSuccess={() => { const id = pinTarget.profileId; setPinTarget(null); navigate(`/parent/${id}`); }}
          onClose={() => setPinTarget(null)}
        />
      )}

      {/* 프로필 생성 모달 (계정 영역) */}
      {showCreate && (
        <ProfileFormModal
          onClose={() => setShowCreate(false)}
          onCreated={(profile) => {
            setProfiles((prev) => [...prev, profile]);
            setShowCreate(false);
            setSeedTarget(profile); // 생성 직후 관심사 씨앗(F0) 흐름 시작
          }}
        />
      )}

      {/* 관심사 씨앗 심기 (F0) — 프로필 생성 직후 1회 */}
      {seedTarget && (
        <InterestSeed
          profile={seedTarget}
          onDone={(updated) => {
            // 저장 성공 시 갱신된 프로필(interests 포함)로 목록 반영, 건너뛰면 그대로 둠
            if (updated) {
              setProfiles((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
            }
            setSeedTarget(null);
          }}
        />
      )}

      {/* 프로필 수정 모달 (관리 모드) */}
      {editTarget && (
        <ProfileFormModal
          profile={editTarget}
          onClose={() => setEditTarget(null)}
          onUpdated={(updated) => {
            setProfiles((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
            setEditTarget(null);
          }}
        />
      )}

      {/* 무료 1개 초과 paywall */}
      {showPaywall && <PaywallModal reason="profile" onClose={() => setShowPaywall(false)} />}

      {/* P3: 프로필 생성 온보딩 코치마크 — 루트 직속(inert 밖). §3: 생성 모달·관심사 인터뷰·기타 오버레이가 떠 있는 동안은 숨김(z-index 싸움 금지).
          banner="" — 온보딩은 '미리보기 예시'가 아니라 실제 화면이라 부모 투어의 예시 배너를 쓰지 않음(빈 값·신규 카피 미생성). */}
      {tour.isActive && !showCreate && !seedTarget && !pinTarget && !editTarget && !confirmTarget && !showPaywall && (
        <TourCoachmark
          rect={tour.rect}
          text={PROFILE_ONBOARD.steps[tour.step]}
          step={tour.step}
          total={tour.total}
          interactive={tour.station?.interactive}
          banner=""
          onPrev={tour.prev}
          onNext={onboardNext}
          onExit={tour.exit}
        />
      )}
    </div>
  );
}
