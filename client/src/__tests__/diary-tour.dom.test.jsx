// AD-7 커밋 B — 부모 '둘러보기' 투어 통합 검증 (feature/diary-v0 전용).
//   V1 서버호출 0 · V2 흔적 0(도장체험 diaryStore/IDB 무기록·플래그만) · V3 정직배너 4정거장 상시 ·
//   V4 진입제안 1회(플래그)+재진입 · V5 종료 CTA→자녀설정·실데이터 복귀 · V6 시드이름=라온(≠하늘·바다).
// ParentDashboard를 실제 렌더 — api·AuthContext·diaryStore·recharts·무거운 컴포넌트 모킹(네트워크·저장 0).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

const H = vi.hoisted(() => ({
  api: {
    getHistory: vi.fn(), getProfiles: vi.fn(), createProfile: vi.fn(), deleteProfile: vi.fn(), updateProfile: vi.fn(),
    getBadges: vi.fn(), getBlockedKeywords: vi.fn(), addBlockedKeyword: vi.fn(), deleteBlockedKeyword: vi.fn(),
    getAlerts: vi.fn(), markAlertRead: vi.fn(), markAllAlertsRead: vi.fn(), getAlertSettings: vi.fn(), saveAlertSettings: vi.fn(),
    deleteHistoryItem: vi.fn(), deleteAllHistory: vi.fn(), getReportInsights: vi.fn(), getReportCoach: vi.fn(),
    getCareSignals: vi.fn(), markCareSignalRead: vi.fn(), getCheckinReport: vi.fn(),
  },
  diary: { getEntries: vi.fn(() => []), setStamp: vi.fn(), todayKST: vi.fn(() => "2026-07-08"), DIARY_V0: true },
  img: { getImage: vi.fn(() => Promise.resolve(null)), putImage: vi.fn(() => Promise.resolve(true)), deleteImage: vi.fn() },
  params: {}, // useParams 목값(스코프 페이지 테스트에서 { profileId } 로 교체)
}));
vi.mock("../utils/api", () => H.api);
vi.mock("../utils/diaryStore", () => H.diary);
vi.mock("../utils/diaryImageStore", () => H.img);
vi.mock("../contexts/AuthContext", () => ({ useAuth: () => ({ isPremium: true, isAdmin: false }) }));
vi.mock("react-router-dom", () => ({ useParams: () => H.params }));
vi.mock("../components/NavBar", () => ({ default: () => null }));
vi.mock("../components/KiddyImg", () => ({ default: () => null }));
vi.mock("../components/KiddyVideo", () => ({ default: () => null }));
vi.mock("../components/VideoModal", () => ({ default: () => null }));
vi.mock("../components/PaywallModal", () => ({ default: () => null }));
vi.mock("../components/PinModal", () => ({ default: () => null }));
vi.mock("../components/SchedulePlanner", () => ({ default: () => null }));
vi.mock("../components/Typewriter", () => ({ default: ({ text }) => text }));
vi.mock("recharts", () => {
  const Noop = () => null;
  return {
    ResponsiveContainer: Noop, BarChart: Noop, Bar: Noop, LineChart: Noop, Line: Noop, PieChart: Noop, Pie: Noop,
    Cell: Noop, RadarChart: Noop, Radar: Noop, PolarGrid: Noop, PolarAngleAxis: Noop, PolarRadiusAxis: Noop,
    CartesianGrid: Noop, XAxis: Noop, YAxis: Noop, Tooltip: Noop, Legend: Noop,
  };
});

import ParentDashboard from "../pages/ParentDashboard";
import { PARENT_TOUR, monthBookTitle, STAMP_EMOJIS } from "../utils/diaryCopy";
import { TOUR_SEED } from "../utils/tourSeed";

const REAL_PROFILE = { id: "real1", name: "현우", age: 7, avatarId: 1, timeLimit: 60, safetyThreshold: 80 };
const WD = ["일", "월", "화", "수", "목", "금", "토"];
const shortDate = (ymd) => { const d = new Date(`${ymd}T00:00:00`); return `${d.getDate()}일 ${WD[d.getDay()]}`; };

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  H.params = {}; // 기본: 비스코프
  // 실경로 마운트 조회 기본 응답(clearAllMocks는 impl 보존 안 하므로 매번 재설정)
  H.api.getHistory.mockResolvedValue([]);
  H.api.getProfiles.mockResolvedValue([REAL_PROFILE]);
  H.api.getBadges.mockResolvedValue([]);
  H.api.getBlockedKeywords.mockResolvedValue({ system: [], custom: [] });
  H.api.getAlerts.mockResolvedValue({ alerts: [] });
  H.api.getAlertSettings.mockResolvedValue({ threshold: 70, lateNightAlert: true, lateNightHour: 22 });
  H.api.getCareSignals.mockResolvedValue([]);
  H.api.getReportInsights.mockResolvedValue({ totalWatched: 0 });
  H.api.getReportCoach.mockResolvedValue({ insights: {}, coach: null, empty: true });
  H.api.getCheckinReport.mockResolvedValue({ report: { empty: true } });
});
afterEach(() => cleanup());

// 초기 실데이터 로드 '완료'(kiddy 스위처에 실프로필 노출=loading 종료)를 기다린 뒤 진입 —
// mount fetch가 비행 중일 때 진입하는 레이스를 배제(결정적). 진입 직전 api 스파이 리셋(마운트 호출 제외).
const enterTour = async () => {
  render(<ParentDashboard />);
  // 마운트의 '마지막' async(로딩 종료 후 마운트되는 KiddyReportCard의 getCheckinReport)까지 정착 대기 —
  // 로딩 텍스트만 기다리면 그 직후 리포트카드 fetch가 clearAllMocks와 레이스(간헐 1콜 누수). 스코프 무관.
  await waitFor(() => expect(H.api.getCheckinReport).toHaveBeenCalled());
  vi.clearAllMocks();
  fireEvent.click(screen.getByText(PARENT_TOUR.offer.start));
};

describe("AD-7 B — V6 시드 무결성(이름·고정날짜)", () => {
  it("시드 아이 이름=라온(≠하늘·바다) + 모든 날짜 고정 ISO", () => {
    expect(TOUR_SEED.profile.name).toBe("라온");
    expect(["하늘", "바다"]).not.toContain(TOUR_SEED.profile.name);
    const dates = [
      TOUR_SEED.report.periodStart, TOUR_SEED.report.periodEnd,
      ...TOUR_SEED.report.moodTimeline.map((m) => m.checkinDate),
      ...TOUR_SEED.diaryEntries.map((e) => e.date),
    ];
    dates.forEach((d) => expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/));
    expect(TOUR_SEED.report.patternSignal.active).toBe(true); // 💜 배너 발화
    // 도장 없는 체험용 엔트리 정확히 1건
    expect(TOUR_SEED.diaryEntries.filter((e) => !e.stamp).length).toBe(1);
  });
});

describe("AD-7 B — V3·V1 4정거장 배너 상시 + 서버호출 0", () => {
  it("①→②→③→④ 배너·정거장 안내 상시 + 어떤 api도 미호출", async () => {
    await enterTour();
    // ① 편지
    expect(screen.getByText(PARENT_TOUR.banner)).toBeTruthy();
    expect(screen.getByText(PARENT_TOUR.stations[0])).toBeTruthy();
    expect(screen.getByText(/이번 주 라온이는 즐거운 날이 많았어요/)).toBeTruthy(); // 시드 편지
    // ② 씨앗 (같은 kiddy 뷰)
    fireEvent.click(screen.getByText(PARENT_TOUR.nav.next));
    expect(screen.getByText(PARENT_TOUR.banner)).toBeTruthy();
    expect(screen.getByText(PARENT_TOUR.stations[1])).toBeTruthy();
    expect(screen.getByText(TOUR_SEED.report.moodSummary.talkSeed)).toBeTruthy(); // 대화의 씨앗
    // ③ 책장
    fireEvent.click(screen.getByText(PARENT_TOUR.nav.next));
    expect(screen.getByText(PARENT_TOUR.banner)).toBeTruthy();
    expect(screen.getByText(PARENT_TOUR.stations[2])).toBeTruthy();
    expect(screen.getByText(monthBookTitle("07"))).toBeTruthy(); // 시드 책장(7월 책)
    // ④ 자녀설정 (마지막 → '다음'이 종료 CTA)
    fireEvent.click(screen.getByText(PARENT_TOUR.nav.next));
    expect(screen.getByText(PARENT_TOUR.banner)).toBeTruthy();
    expect(screen.getByText(PARENT_TOUR.stations[3])).toBeTruthy();
    expect(screen.getByText(PARENT_TOUR.exitCta)).toBeTruthy(); // 마지막 정거장 CTA
    // V1 — 전 정거장 서버호출 0
    Object.values(H.api).forEach((fn) => expect(fn).not.toHaveBeenCalled());
  });

  it("읽기전용(①②④)=backdrop 포인터차단 / ③(책장)=인터랙션 허용", async () => {
    await enterTour();
    // ① 읽기전용
    expect(screen.getByTestId("tour-overlay").getAttribute("data-interactive")).toBe("0");
    expect(screen.queryByTestId("tour-backdrop")).toBeTruthy();
    // ③으로
    fireEvent.click(screen.getByText(PARENT_TOUR.nav.next)); // ②
    fireEvent.click(screen.getByText(PARENT_TOUR.nav.next)); // ③
    expect(screen.getByTestId("tour-overlay").getAttribute("data-interactive")).toBe("1");
    expect(screen.queryByTestId("tour-backdrop")).toBeNull(); // 책장 인터랙션 허용
  });
});

describe("AD-7 B — V2 ③ 도장 체험(흔적 0)", () => {
  it("도장 저장 → diaryStore·IDB 무기록 + 저장 피드백(메모리만)", async () => {
    await enterTour();
    fireEvent.click(screen.getByText(PARENT_TOUR.nav.next)); // ②
    fireEvent.click(screen.getByText(PARENT_TOUR.nav.next)); // ③
    vi.clearAllMocks();
    // 도장 없는 체험용 엔트리(2026-07-03)로 도장 찍기
    fireEvent.click(screen.getByText(monthBookTitle("07")));
    fireEvent.click(screen.getByText(shortDate("2026-07-03")));
    fireEvent.click(screen.getByLabelText(`도장 ${STAMP_EMOJIS[0]}`));
    fireEvent.click(screen.getByText("저장"));
    expect(H.diary.setStamp).not.toHaveBeenCalled();   // diaryStore 무기록
    expect(H.diary.getEntries).not.toHaveBeenCalled(); // (진입 후 기준)
    expect(H.img.putImage).not.toHaveBeenCalled();     // IDB 무기록
    expect(screen.getByText("저장했어요 ✓")).toBeTruthy();
    // 저장 후에도 서버 0
    Object.values(H.api).forEach((fn) => expect(fn).not.toHaveBeenCalled());
  });
});

describe("AD-7 B — V5 종료→실데이터 복귀", () => {
  it("종료 CTA → 코치마크 사라짐 + fetchData 재실행(실데이터)", async () => {
    await enterTour();
    fireEvent.click(screen.getByText(PARENT_TOUR.nav.next)); // ②
    fireEvent.click(screen.getByText(PARENT_TOUR.nav.next)); // ③
    fireEvent.click(screen.getByText(PARENT_TOUR.nav.next)); // ④
    vi.clearAllMocks();
    H.api.getProfiles.mockResolvedValue([REAL_PROFILE]); // 재조회 응답
    fireEvent.click(screen.getByText(PARENT_TOUR.exitCta)); // 종료
    expect(screen.queryByText(PARENT_TOUR.banner)).toBeNull(); // 코치마크 제거
    await waitFor(() => expect(H.api.getProfiles).toHaveBeenCalled()); // 실데이터 복귀
  });

  it("중도 '그만보기' → 코치마크 사라짐 + 실데이터 재조회", async () => {
    await enterTour();
    fireEvent.click(screen.getByText(PARENT_TOUR.nav.next)); // ②
    vi.clearAllMocks();
    H.api.getProfiles.mockResolvedValue([REAL_PROFILE]);
    fireEvent.click(screen.getByText(PARENT_TOUR.nav.exit)); // 그만보기
    expect(screen.queryByText(PARENT_TOUR.banner)).toBeNull();
    await waitFor(() => expect(H.api.getProfiles).toHaveBeenCalled());
  });

  // 적대검증 MEDIUM 회귀 — 종료 후 재조회가 '실패'해도 시드 아이(tour_raon)가 실뷰에 잔존/실서버 호출 금지.
  it("종료 후 재조회 실패 → 가짜 아이 잔재 0(getCheckinReport('tour_raon') 미발사)", async () => {
    await enterTour();
    fireEvent.click(screen.getByText(PARENT_TOUR.nav.next)); // ②
    vi.clearAllMocks();
    // getProfiles만 reject(둘 다 reject하면 Promise.all이 첫 rejection만 처리→나머지 unhandled 누수).
    // getHistory는 resolve로 두어 Promise.all이 소비 → unhandled rejection 0. catch에서 setError만.
    H.api.getHistory.mockResolvedValue([]);
    H.api.getProfiles.mockRejectedValue(new Error("network")); // 재조회 실패
    fireEvent.click(screen.getByText(PARENT_TOUR.nav.exit)); // 그만보기
    await waitFor(() => expect(H.api.getProfiles).toHaveBeenCalled());
    // 시드 폐기 → KiddyReportCard(tour_raon) 미마운트 → 서버 호출 없음
    const calledWithSeed = H.api.getCheckinReport.mock.calls.some((c) => c[0] === "tour_raon");
    expect(calledWithSeed).toBe(false);
    expect(screen.queryByText(PARENT_TOUR.banner)).toBeNull();
  });
});

describe("AD-7 B — 스코프 페이지(/parent/:id) 회귀 (적대검증 HIGH)", () => {
  it("스코프 잠금에서도 ④ 자녀설정이 시드 카드 노출(빈 화면 아님)", async () => {
    H.params = { profileId: "real1" }; // 실서비스 라우트=항상 스코프
    await enterTour();
    fireEvent.click(screen.getByText(PARENT_TOUR.nav.next)); // ②
    fireEvent.click(screen.getByText(PARENT_TOUR.nav.next)); // ③
    fireEvent.click(screen.getByText(PARENT_TOUR.nav.next)); // ④
    expect(screen.getByText(PARENT_TOUR.stations[3])).toBeTruthy();      // ④ 안내
    expect(screen.getByAltText(TOUR_SEED.profile.name)).toBeTruthy();    // 시드 카드('라온' 아바타) — 빈 화면 아님
    expect(screen.queryByText("아직 프로필이 없어요. 위 버튼을 눌러 추가해보세요!")).toBeNull();
  });
});

describe("AD-7 B — V4 진입 제안 1회(플래그)", () => {
  it("플래그 없으면 제안 노출 / '나중에' → 숨김 + 플래그 기록 / 재렌더 시 미노출", async () => {
    render(<ParentDashboard />);
    expect(await screen.findByText(PARENT_TOUR.offer.title)).toBeTruthy();
    fireEvent.click(screen.getByText(PARENT_TOUR.offer.later));
    expect(screen.queryByText(PARENT_TOUR.offer.title)).toBeNull();
    expect(localStorage.getItem("kidsafe_parent_tour_seen")).toBe("1"); // 유일 허용 저장
    cleanup();
    // 재렌더 — 플래그 있으니 제안 미노출
    render(<ParentDashboard />);
    await waitFor(() => expect(H.api.getProfiles).toHaveBeenCalled());
    expect(screen.queryByText(PARENT_TOUR.offer.title)).toBeNull();
  });
});

describe("AD-7 B — 헤더 '둘러보기' 상시 버튼(오너 지시 7/8: 잘 보이는 자리)", () => {
  it("진입 시 헤더 버튼 노출 + 제안 닫아도 유지 + 클릭 시 투어 시작(서버 0)", async () => {
    render(<ParentDashboard />);
    await waitFor(() => expect(screen.queryByText("불러오는 중...")).toBeNull());
    fireEvent.click(screen.getByText(PARENT_TOUR.offer.later)); // 제안 카드 닫음
    expect(screen.queryByText(PARENT_TOUR.offer.title)).toBeNull();
    const headerBtn = screen.getByTestId("tour-header-btn"); // 제안 닫아도 헤더 버튼은 상시(재진입 보장)
    expect(headerBtn).toBeTruthy();
    vi.clearAllMocks();
    fireEvent.click(headerBtn);
    expect(screen.getByText(PARENT_TOUR.banner)).toBeTruthy(); // 투어 시작
    Object.values(H.api).forEach((fn) => expect(fn).not.toHaveBeenCalled()); // 진입=시드만
  });
  it("투어 중엔 헤더 버튼 숨김(중복 진입 방지)", async () => {
    await enterTour();
    expect(screen.queryByTestId("tour-header-btn")).toBeNull();
  });
});

// ── 독립 적대검증 확증 4건 회귀(V1·이탈복원 강화) ──
describe("AD-7 B — 적대검증 ② inert: 읽기전용 정거장 배경 키보드/포인터 차단", () => {
  it("①②④(읽기전용)=배경 inert / ③ 책장=인터랙션 유지", async () => {
    await enterTour();
    expect(screen.getByTestId("dash-main").hasAttribute("inert")).toBe(true);  // ① kiddy 읽기전용
    fireEvent.click(screen.getByText(PARENT_TOUR.nav.next)); // ②
    expect(screen.getByTestId("dash-main").hasAttribute("inert")).toBe(true);
    fireEvent.click(screen.getByText(PARENT_TOUR.nav.next)); // ③ 책장
    expect(screen.getByTestId("dash-main").hasAttribute("inert")).toBe(false); // 도장 체험 위해 인터랙션 허용
    fireEvent.click(screen.getByText(PARENT_TOUR.nav.next)); // ④ 자녀설정
    expect(screen.getByTestId("dash-main").hasAttribute("inert")).toBe(true);  // 배경 프로필 컨트롤 포커스 차단
  });
  it("[대조] 비투어 실사용에선 inert 없음(무회귀)", async () => {
    render(<ParentDashboard />);
    await waitFor(() => expect(screen.queryByText("불러오는 중...")).toBeNull());
    expect(screen.getByTestId("dash-main").hasAttribute("inert")).toBe(false);
  });
});

describe("AD-7 B — 적대검증 ③ error 배너: 투어 오염·이탈 후 잔존 제거", () => {
  it("진입 전 fetch 실패 배너가 '둘러보기' 진입 시 사라짐(큐레이션 오염 방지)", async () => {
    H.api.getHistory.mockResolvedValue([]);
    H.api.getProfiles.mockRejectedValue(new Error("network")); // 최초 조회 실패
    render(<ParentDashboard />);
    await waitFor(() => expect(screen.getByText("데이터를 불러오지 못했어요.")).toBeTruthy());
    fireEvent.click(screen.getByText(PARENT_TOUR.offer.start)); // 둘러보기 진입
    expect(screen.queryByText("데이터를 불러오지 못했어요.")).toBeNull(); // 투어에 오염 안 됨
    expect(screen.getByText(PARENT_TOUR.banner)).toBeTruthy();
    expect(screen.getByText(/이번 주 라온이는 즐거운 날이 많았어요/)).toBeTruthy(); // 시드 편지만
  });
  it("실패→투어→이탈 재조회 성공 시 잔존 에러배너 제거(성공 재조회가 clear)", async () => {
    H.api.getHistory.mockResolvedValue([]);
    H.api.getProfiles.mockRejectedValueOnce(new Error("network")); // 최초만 실패
    render(<ParentDashboard />);
    await waitFor(() => expect(screen.getByText("데이터를 불러오지 못했어요.")).toBeTruthy());
    fireEvent.click(screen.getByText(PARENT_TOUR.offer.start)); // 투어
    H.api.getProfiles.mockResolvedValue([REAL_PROFILE]);         // 재조회는 성공
    fireEvent.click(screen.getByText(PARENT_TOUR.nav.exit));     // 그만보기 → fetchData 재실행
    await waitFor(() => expect(H.api.getProfiles).toHaveBeenCalled());
    expect(screen.queryByText("데이터를 불러오지 못했어요.")).toBeNull(); // 성공 복귀에 거짓 배너 없음
  });
});

describe("AD-7 B — 적대검증 ④ 이탈 원복: 비스코프 다자녀 선택 유지", () => {
  it("둘째 아이 선택 후 투어→이탈해도 첫째로 리셋되지 않음", async () => {
    const A = { id: "childA", name: "가온", age: 7, avatarId: 1, timeLimit: 60, safetyThreshold: 80 };
    const B = { id: "childB", name: "나온", age: 6, avatarId: 2, timeLimit: 60, safetyThreshold: 80 };
    H.api.getProfiles.mockResolvedValue([A, B]);
    render(<ParentDashboard />);
    await waitFor(() => expect(screen.queryByText("불러오는 중...")).toBeNull());
    fireEvent.click(screen.getByText("나온")); // 둘째(childB) 선택
    await waitFor(() => expect(H.api.getCheckinReport).toHaveBeenCalledWith("childB"));
    vi.clearAllMocks();
    H.api.getProfiles.mockResolvedValue([A, B]);
    fireEvent.click(screen.getByText(PARENT_TOUR.offer.start)); // 투어 진입
    fireEvent.click(screen.getByText(PARENT_TOUR.nav.exit));    // 그만보기 → 이탈
    await waitFor(() => expect(H.api.getProfiles).toHaveBeenCalled());
    // 이탈 후 kiddy 리포트가 '나온'(childB) 유지 — 첫째(childA)로 리셋 안 됨
    await waitFor(() => expect(H.api.getCheckinReport).toHaveBeenCalledWith("childB"));
    expect(H.api.getCheckinReport.mock.calls.some((c) => c[0] === "childA")).toBe(false);
  });
});
