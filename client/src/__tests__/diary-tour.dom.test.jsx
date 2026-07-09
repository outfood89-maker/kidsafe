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
  navigate: vi.fn(), // 항목2-②: '아이 화면 미리보기' 런처 navigate 스파이
}));
vi.mock("../utils/api", () => H.api);
vi.mock("../utils/diaryStore", () => H.diary);
vi.mock("../utils/diaryImageStore", () => H.img);
// 정적 데모(주혁)와 격리 — 투어 로직은 라온 픽스처(tourSeed) 폴백으로 검증(실데모 스냅샷에 비결합).
vi.mock("../utils/tourDemoData", () => ({ TOUR_DEMO_SEED: null, TOUR_DEMO_IMAGES: {} }));
vi.mock("../contexts/AuthContext", () => ({ useAuth: () => ({ isPremium: true, isAdmin: false }) }));
vi.mock("react-router-dom", () => ({ useParams: () => H.params, useNavigate: () => H.navigate }));
vi.mock("../components/NavBar", () => ({ default: () => null }));
vi.mock("../components/KiddyImg", () => ({ default: () => null }));
vi.mock("../components/KiddyVideo", () => ({ default: () => null }));
vi.mock("../components/VideoModal", () => ({ default: () => null }));
vi.mock("../components/PaywallModal", () => ({ default: () => null }));
vi.mock("../components/PinModal", () => ({ default: () => null }));
// 투어면 스케줄 앵커 stub을 그려 스포트라이트가 짚을 대상이 존재하게(빈화면/폴백 아님 검증용) — ④a 말로부탁·④b 달력 둘 다
vi.mock("../components/SchedulePlanner", () => ({
  default: ({ tourSchedules }) => (tourSchedules ? (
    <div>
      <div data-tour-id="tour-schedule">sched-tour</div>
      <div data-tour-id="tour-schedule-calendar">cal-tour</div>
    </div>
  ) : null),
}));
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

// AD-7 v2: 13정거장 순서(TOUR_STATIONS와 1:1). ③(index 2·책장)만 interactive.
const TOUR_ANCHORS = [
  "tour-letter", "tour-seed", "tour-stamp",            // ①②③
  "tour-schedule", "tour-schedule-calendar",           // ④a ④b
  "tour-care-signal", "tour-safety", "tour-blocked-keywords", // ⑤a ⑤b ⑤c
  "tour-analysis", "tour-analysis-charts",             // ⑥a ⑥b
  "tour-history",                                       // ⑦
  "tour-settings", "tour-settings-controls",           // ⑧a ⑧b
];

describe("AD-7 B — V3·V1 13정거장 배너 상시 + 서버호출 0", () => {
  it("전 스텝 배너·정거장 안내 상시(1:1 인덱스 매칭·빈 말풍선 아님) + 어떤 api도 미호출", async () => {
    await enterTour();
    const total = PARENT_TOUR.stations.length; // 13
    expect(total).toBe(TOUR_ANCHORS.length);   // PARENT_TOUR.stations ↔ TOUR_STATIONS 1:1 불변식
    for (let step = 0; step < total; step++) {
      if (step > 0) fireEvent.click(screen.getByText(PARENT_TOUR.nav.next));
      expect(screen.getByText(PARENT_TOUR.banner)).toBeTruthy();            // 정직 배너 상시
      expect(screen.getByText(PARENT_TOUR.stations[step])).toBeTruthy();    // 문구↔인덱스 1:1(빈 말풍선 아님)
    }
    expect(screen.getByText(PARENT_TOUR.exitCta)).toBeTruthy();             // 마지막(⑧b) = 종료 CTA
    Object.values(H.api).forEach((fn) => expect(fn).not.toHaveBeenCalled()); // V1 전 정거장 서버 0
  });

  it("정거장별 data-interactive + 대상 앵커(data-tour-id) 존재(문구↔화면 결속·폴백 아님)", async () => {
    await enterTour();
    for (let step = 0; step < TOUR_ANCHORS.length; step++) {
      if (step > 0) fireEvent.click(screen.getByText(PARENT_TOUR.nav.next));
      // ③ 책장(index 2)만 인터랙션 허용, 나머지는 읽기전용
      expect(screen.getByTestId("tour-overlay").getAttribute("data-interactive")).toBe(step === 2 ? "1" : "0");
      // 대상 앵커가 DOM에 존재(③ 자동열림·⑥b 강제펼침·④b stub 등 비동기 등장 대비 waitFor) — 폴백(rect=null) 아님
      await waitFor(() => expect(document.querySelector(`[data-tour-id="${TOUR_ANCHORS[step]}"]`)).toBeTruthy());
    }
  });
});

describe("AD-7 확장 — ④ 스케줄러 정거장(시드·서버0·읽기전용)", () => {
  it("스케줄 정거장: 배너 상시 + 시드 앵커(빈화면 아님) + inert 읽기전용 + 서버 0", async () => {
    await enterTour();
    fireEvent.click(screen.getByText(PARENT_TOUR.nav.next)); // ②
    fireEvent.click(screen.getByText(PARENT_TOUR.nav.next)); // ③
    fireEvent.click(screen.getByText(PARENT_TOUR.nav.next)); // ④ 스케줄
    expect(screen.getByText(PARENT_TOUR.banner)).toBeTruthy();                       // 정직 배너 상시
    expect(screen.getByText(PARENT_TOUR.stations[3])).toBeTruthy();                  // 스케줄 안내 문구(팀장 스탬프)
    expect(document.querySelector('[data-tour-id="tour-schedule"]')).toBeTruthy();   // 시드 앵커(폴백 아님·빈화면 아님)
    expect(screen.getByTestId("dash-main").hasAttribute("inert")).toBe(true);        // 읽기전용
    Object.values(H.api).forEach((fn) => expect(fn).not.toHaveBeenCalled());         // 서버 0(getSchedules 미발생)
  });
});

describe("AD-7 확장 — ④b 스케줄 달력 정거장(시드·서버0·읽기전용)", () => {
  it("달력 정거장: 배너 + tour-schedule-calendar 앵커(빈화면 아님) + inert + 서버0", async () => {
    await enterTour();
    const step = PARENT_TOUR.stations.length - 9; // ④b 달력 = index 4
    for (let i = 0; i < step; i++) fireEvent.click(screen.getByText(PARENT_TOUR.nav.next));
    expect(screen.getByText(PARENT_TOUR.banner)).toBeTruthy();
    expect(screen.getByText(PARENT_TOUR.stations[step])).toBeTruthy();
    expect(document.querySelector('[data-tour-id="tour-schedule-calendar"]')).toBeTruthy();
    expect(screen.getByTestId("dash-main").hasAttribute("inert")).toBe(true);
    Object.values(H.api).forEach((fn) => expect(fn).not.toHaveBeenCalled());
  });
});

describe("AD-7 확장 — ⑤a 위기 신호 정거장(시드·서버0·읽기전용)", () => {
  it("위기신호 정거장: 배너 + tour-care-signal 앵커 + 💛오늘의 관심 신호 + inert + 서버0", async () => {
    await enterTour();
    const step = PARENT_TOUR.stations.length - 8; // ⑤a 위기신호 = index 5
    for (let i = 0; i < step; i++) fireEvent.click(screen.getByText(PARENT_TOUR.nav.next));
    expect(screen.getByText(PARENT_TOUR.banner)).toBeTruthy();
    expect(screen.getByText(PARENT_TOUR.stations[step])).toBeTruthy();
    expect(document.querySelector('[data-tour-id="tour-care-signal"]')).toBeTruthy();
    expect(screen.getByText(/오늘의 관심 신호/)).toBeTruthy(); // 💛 시드 위기신호 렌더
    expect(screen.getByTestId("dash-main").hasAttribute("inert")).toBe(true);
    Object.values(H.api).forEach((fn) => expect(fn).not.toHaveBeenCalled());
  });
});

describe("AD-7 확장 — ⑤b 위험 영상 알림 정거장(시드·서버0·읽기전용)", () => {
  it("위험영상 정거장: 배너 + tour-safety 앵커 + 빈상태아님 + inert + 서버0", async () => {
    await enterTour();
    const step = PARENT_TOUR.stations.length - 7; // ⑤b 위험영상 = index 6
    for (let i = 0; i < step; i++) fireEvent.click(screen.getByText(PARENT_TOUR.nav.next));
    expect(screen.getByText(PARENT_TOUR.banner)).toBeTruthy();
    expect(screen.getByText(PARENT_TOUR.stations[step])).toBeTruthy();
    expect(document.querySelector('[data-tour-id="tour-safety"]')).toBeTruthy();
    expect(screen.queryByText(/안전하게 시청 중/)).toBeNull(); // 시드 위험알림 렌더(빈상태 아님)
    expect(screen.getByTestId("dash-main").hasAttribute("inert")).toBe(true);
    Object.values(H.api).forEach((fn) => expect(fn).not.toHaveBeenCalled());
  });
});

describe("AD-7 확장 — ⑤c 걸러낼 키워드 정거장(시드·서버0·읽기전용)", () => {
  it("걸러낼키워드 정거장: 배너 + tour-blocked-keywords 앵커 + inert + 서버0", async () => {
    await enterTour();
    const step = PARENT_TOUR.stations.length - 6; // ⑤c 걸러낼키워드 = index 7
    for (let i = 0; i < step; i++) fireEvent.click(screen.getByText(PARENT_TOUR.nav.next));
    expect(screen.getByText(PARENT_TOUR.banner)).toBeTruthy();
    expect(screen.getByText(PARENT_TOUR.stations[step])).toBeTruthy();
    expect(document.querySelector('[data-tour-id="tour-blocked-keywords"]')).toBeTruthy();
    expect(screen.getByText("걸러낼 키워드 관리")).toBeTruthy(); // 섹션 렌더 확인
    expect(screen.getByTestId("dash-main").hasAttribute("inert")).toBe(true);
    Object.values(H.api).forEach((fn) => expect(fn).not.toHaveBeenCalled());
  });
});

describe("AD-7 확장 — ⑤ 안전 스코프 페이지 회귀(적대검증 HIGH)", () => {
  it("스코프 잠금(/parent/:id)에서도 시드 위험알림·위기신호 노출(scopedId 필터 우회)", async () => {
    H.params = { profileId: "real1" }; // 스코프(scopedId=real1 ≠ tour_raon)
    await enterTour();
    const step = PARENT_TOUR.stations.length - 7; // ⑤b 위험영상 = index 6
    for (let i = 0; i < step; i++) fireEvent.click(screen.getByText(PARENT_TOUR.nav.next));
    expect(document.querySelector('[data-tour-id="tour-safety"]')).toBeTruthy();
    expect(screen.queryByText(/안전하게 시청 중/)).toBeNull();   // 우회 성공 → 시드 알림 통과(빈화면 아님)
    expect(screen.getByText(/오늘의 관심 신호/)).toBeTruthy();   // 위기신호도 통과(tour-care-signal 앵커 동일 탭)
  });
});

describe("AD-7 확장 — ⑥a AI 코치 정거장(시드·서버0·읽기전용)", () => {
  it("코치 정거장: 배너 + 코치 앵커(빈화면 아님) + 정밀검수 닫힘(대조) + inert + 서버0", async () => {
    await enterTour();
    const coachStep = PARENT_TOUR.stations.length - 5; // ⑥a 코치 = index 8
    for (let i = 0; i < coachStep; i++) fireEvent.click(screen.getByText(PARENT_TOUR.nav.next));
    expect(screen.getByText(PARENT_TOUR.banner)).toBeTruthy();
    expect(screen.getByText(PARENT_TOUR.stations[coachStep])).toBeTruthy();
    expect(document.querySelector('[data-tour-id="tour-analysis"]')).toBeTruthy();    // 코치 아코디언 앵커
    expect(screen.queryByText("시청 기록이 없어요.")).toBeNull();                       // history 시드 렌더(빈상태 아님)
    expect(screen.queryByText(/분석할 데이터가 없어요/)).toBeNull();                    // insights 시드 렌더(빈상태 아님)
    expect(screen.queryByText(/카테고리별 안전 점수/)).toBeNull();                      // ⑥a=정밀검수 닫힘(⑥b 강제펼침과 대조)
    expect(screen.getByTestId("dash-main").hasAttribute("inert")).toBe(true);
    Object.values(H.api).forEach((fn) => expect(fn).not.toHaveBeenCalled());
  });
});

describe("AD-7 확장 — ⑥b 그래프 정거장(정밀검수 강제펼침·서버0·읽기전용)", () => {
  it("그래프 정거장: 배너 + tour-analysis-charts 앵커 + 정밀검수 제목 렌더(강제펼침) + inert + 서버0", async () => {
    await enterTour();
    const chartsStep = PARENT_TOUR.stations.length - 4; // ⑥b 그래프 = index 9
    for (let i = 0; i < chartsStep; i++) fireEvent.click(screen.getByText(PARENT_TOUR.nav.next));
    expect(screen.getByText(PARENT_TOUR.banner)).toBeTruthy();
    expect(screen.getByText(PARENT_TOUR.stations[chartsStep])).toBeTruthy();
    expect(document.querySelector('[data-tour-id="tour-analysis-charts"]')).toBeTruthy(); // 정밀검수 바깥 앵커(항상 마운트)
    // 강제펼침 증명 — 정밀검수 아코디언이 열려 차트 제목(일반 텍스트)이 렌더됨(recharts는 Noop mock이나 제목은 텍스트)
    expect(await screen.findByText(/카테고리별 안전 점수/)).toBeTruthy();
    expect(screen.getByTestId("dash-main").hasAttribute("inert")).toBe(true);
    Object.values(H.api).forEach((fn) => expect(fn).not.toHaveBeenCalled());
  });
});

describe("AD-7 확장 — ⑥ 시청 분석 스코프 페이지 회귀(적대검증 HIGH)", () => {
  it("스코프 잠금(/parent/:id)에서도 시드 차트/코치 노출(chartFilteredHistory 우회)", async () => {
    H.params = { profileId: "real1" }; // 스코프(chartTab 기본=real1 ≠ tour_raon)
    await enterTour();
    const analysisStep = PARENT_TOUR.stations.length - 5; // ⑥a 코치 = index 8
    for (let i = 0; i < analysisStep; i++) fireEvent.click(screen.getByText(PARENT_TOUR.nav.next));
    expect(document.querySelector('[data-tour-id="tour-analysis"]')).toBeTruthy(); // 우회 성공(없으면 빈 카드로 앵커 소멸)
    expect(screen.queryByText("시청 기록이 없어요.")).toBeNull();
    expect(screen.queryByText(/분석할 데이터가 없어요/)).toBeNull();
  });
});

describe("AD-7 확장 — ⑦ 시청 기록 정거장(시드·서버0·읽기전용)", () => {
  it("시청 기록 정거장: 배너 상시 + 시드 카드 앵커(빈화면 아님) + inert(전체삭제 차단) + 서버 0", async () => {
    await enterTour();
    const historyStep = PARENT_TOUR.stations.length - 3; // ⑦ 시청기록 = index 10(⑧a·⑧b 앞)
    for (let i = 0; i < historyStep; i++) fireEvent.click(screen.getByText(PARENT_TOUR.nav.next));
    expect(screen.getByText(PARENT_TOUR.banner)).toBeTruthy();                       // 정직 배너 상시
    expect(screen.getByText(PARENT_TOUR.stations[historyStep])).toBeTruthy();        // 시청기록 안내(스탬프)
    expect(document.querySelector('[data-tour-id="tour-history"]')).toBeTruthy();    // 첫 카드 앵커(폴백 아님·빈화면 아님)
    expect(screen.queryByText("아직 시청 기록이 없어요.")).toBeNull();                 // 시드 카드 렌더(빈상태 아님)
    expect(screen.getByTestId("dash-main").hasAttribute("inert")).toBe(true);        // 읽기전용(전체삭제 실호출 차단)
    Object.values(H.api).forEach((fn) => expect(fn).not.toHaveBeenCalled());         // 서버 0(getHistory/deleteAllHistory 미발생)
  });
});

describe("AD-7 확장 — ⑦ 시청 기록 스코프 페이지 회귀(적대검증 HIGH)", () => {
  it("스코프 잠금(/parent/:id)에서도 시드 카드 노출(activeTab 필터 우회)", async () => {
    H.params = { profileId: "real1" }; // 스코프(activeTab 기본=real1 ≠ tour_raon)
    await enterTour();
    const historyStep = PARENT_TOUR.stations.length - 3; // ⑦ 시청기록 = index 10
    for (let i = 0; i < historyStep; i++) fireEvent.click(screen.getByText(PARENT_TOUR.nav.next));
    expect(document.querySelector('[data-tour-id="tour-history"]')).toBeTruthy(); // 우회 성공(없으면 빈 카드로 앵커 소멸)
    expect(screen.queryByText("이 프로필의 시청 기록이 없어요.")).toBeNull();
  });
});

describe("AD-7 확장 — ⑧b 자녀설정(설정 3종) 정거장(서버0·읽기전용·종료 CTA)", () => {
  it("설정 정거장: 배너 + tour-settings-controls 앵커(첫 프로필 카드) + 종료 CTA + inert + 서버0", async () => {
    await enterTour();
    const last = PARENT_TOUR.stations.length - 1; // ⑧b = 마지막
    for (let i = 0; i < last; i++) fireEvent.click(screen.getByText(PARENT_TOUR.nav.next));
    expect(screen.getByText(PARENT_TOUR.banner)).toBeTruthy();
    expect(screen.getByText(PARENT_TOUR.stations[last])).toBeTruthy();
    expect(document.querySelector('[data-tour-id="tour-settings-controls"]')).toBeTruthy(); // 첫 프로필 카드(index0) 앵커
    expect(screen.getByText(PARENT_TOUR.exitCta)).toBeTruthy();               // 마지막 = 종료 CTA
    expect(screen.getByTestId("dash-main").hasAttribute("inert")).toBe(true); // 읽기전용(설정 변경 차단)
    Object.values(H.api).forEach((fn) => expect(fn).not.toHaveBeenCalled());
  });
});

describe("AD-7 B — V2 ③ 도장 체험(흔적 0)", () => {
  it("도장 저장 → diaryStore·IDB 무기록 + 저장 피드백(메모리만)", async () => {
    await enterTour();
    fireEvent.click(screen.getByText(PARENT_TOUR.nav.next)); // ②
    fireEvent.click(screen.getByText(PARENT_TOUR.nav.next)); // ③ — 완성 도장 예시 일기 자동 열림(부모가 덧찍어도 흔적 0 검증)
    await screen.findByText("도장 찍어주기"); // 자동 열림 정착 대기
    vi.clearAllMocks();
    // 자동 열린 체험용 엔트리에 바로 도장 찍기(수동 탐색 불필요)
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
    for (let i = 0; i < PARENT_TOUR.stations.length - 1; i++) fireEvent.click(screen.getByText(PARENT_TOUR.nav.next)); // ⑧b(마지막)까지
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
  it("스코프 잠금에서도 ⑧ 자녀설정이 시드 카드 노출(빈 화면 아님)", async () => {
    H.params = { profileId: "real1" }; // 실서비스 라우트=항상 스코프
    await enterTour();
    const last = PARENT_TOUR.stations.length - 1; // ⑧b 설정(마지막)
    for (let i = 0; i < last; i++) fireEvent.click(screen.getByText(PARENT_TOUR.nav.next));
    expect(screen.getByText(PARENT_TOUR.stations[last])).toBeTruthy();   // ⑧b 안내
    expect(screen.getByAltText(TOUR_SEED.profile.name)).toBeTruthy();    // 시드 카드('라온' 아바타) — 빈 화면 아님
    expect(document.querySelector('[data-tour-id="tour-settings-controls"]')).toBeTruthy(); // 첫 프로필 카드 앵커
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
  it("13정거장: ③ 책장(index 2)만 인터랙션 허용, 나머지 전부 배경 inert", async () => {
    await enterTour();
    for (let step = 0; step < PARENT_TOUR.stations.length; step++) {
      if (step > 0) fireEvent.click(screen.getByText(PARENT_TOUR.nav.next));
      // ③(index 2)=도장 체험 위해 인터랙션 허용(inert 없음), 나머지 전부 읽기전용(inert)
      expect(screen.getByTestId("dash-main").hasAttribute("inert")).toBe(step !== 2);
    }
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

describe("항목2-② T1 — '아이 화면 미리보기' 런처(C 트리거)", () => {
  it("헤더에 kid-preview-btn 노출 + 클릭 시 navigate('/kids?tour=1')", async () => {
    render(<ParentDashboard />);
    await waitFor(() => expect(screen.queryByText("불러오는 중...")).toBeNull());
    const btn = screen.getByTestId("kid-preview-btn"); // 헤더 우측 그룹(둘러보기 옆)
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    expect(H.navigate).toHaveBeenCalledWith("/kids?tour=1"); // 아이 화면으로 튜토리얼 딥링크
  });
  it("투어 중엔 미리보기 런처 숨김(그룹 !tourMode 게이트)", async () => {
    await enterTour();
    expect(screen.queryByTestId("kid-preview-btn")).toBeNull();
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
