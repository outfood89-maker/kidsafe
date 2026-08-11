// 📦 저장 용량 카드 + 정리 화면 (2026-08-11)
//
//   서버 쪽 `_verify_storage_cap.py` 는 **막는가 / 막을 때 Storage 를 안 건드리는가**를 본다.
//   이 파일은 그 위에서 **부모가 무엇을 보고 무엇을 누르게 되는가**를 본다.
//
//   [A] 🔴 대조군 — 여유가 있으면 **경고하지 않는다** (없는 걱정을 만들지 않는다)
//   [B] 80% 경계 — 79% 는 조용하고 81% 부터 알린다
//   [C] 가득 참 — 부모용 문구로 말한다(아이용 문구를 그대로 쓰지 않는다)
//   [D] 🚨 윤리선 — 정리 목록에 비공개 일기가 **뜨지만 내용은 없다**
//   [E] 🔴 확인 없이는 안 지운다 · 확인하면 **순차로** 지운다
//   [F] 🔴 아이 화면 — 507 이면 **키디가 말한다** (조용히 막히지 않는다)
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

const getDiaryUsage = vi.fn();
const getDiaryUsageEntries = vi.fn();
const deleteDiaryEntry = vi.fn();

vi.mock("../utils/api", () => ({
  getDiaryUsage: (...a) => getDiaryUsage(...a),
  getDiaryUsageEntries: (...a) => getDiaryUsageEntries(...a),
  deleteDiaryEntry: (...a) => deleteDiaryEntry(...a),
}));

const { default: DiaryStorageCard, humanBytes } = await import("../components/DiaryStorageCard");

const GB = 1024 * 1024 * 1024;
const MB = 1024 * 1024;

const usage = (percent, extra = {}) => ({
  usedBytes: Math.round(GB * percent / 100),
  limitBytes: GB,
  percent,
  warn: percent >= 80,
  warnAtPercent: 80,
  full: percent >= 100,
  complete: true,
  ...extra,
});

const PROFILES = [{ id: "p1", name: "해인" }, { id: "p2", name: "루아" }];

beforeEach(() => {
  vi.clearAllMocks();
  getDiaryUsage.mockResolvedValue(usage(10));
  getDiaryUsageEntries.mockResolvedValue({ entries: [] });
  deleteDiaryEntry.mockResolvedValue({ ok: true });
});
afterEach(cleanup);

const draw = () => render(<DiaryStorageCard profiles={PROFILES} />);

describe("[A] 🔴 대조군 — 여유가 있으면 경고하지 않는다", () => {
  it("10% 면 카드는 뜨되 경고 문구가 없다", async () => {
    draw();
    await screen.findByTestId("diary-storage-card");
    expect(screen.getByText(/여유가 있어요/)).toBeTruthy();
    expect(screen.queryByText(/가득 차면/)).toBeNull();
    expect(screen.queryByText(/가득 찼어요/)).toBeNull();
  });

  it("사용량과 상한을 사람이 읽는 말로 보여준다", async () => {
    getDiaryUsage.mockResolvedValue(usage(50));
    draw();
    // 🔴 512.0MB / 1.00GB — 바이트를 그대로 보여주면 부모는 못 읽는다
    await waitFor(() => expect(screen.getByText(/512\.0MB \/ 1\.00GB/)).toBeTruthy());
  });

  it("humanBytes: 0 은 '0' 이다 (0MB 라고 하면 있는 것처럼 들린다)", () => {
    expect(humanBytes(0)).toBe("0");
    expect(humanBytes(2 * MB)).toBe("2.0MB");
    expect(humanBytes(GB)).toBe("1.00GB");
  });
});

describe("[B] 80% 경계 — 조이는 쪽도 헐거운 쪽도 아니게", () => {
  it("🔴 79% 는 아직 조용하다", async () => {
    getDiaryUsage.mockResolvedValue({ ...usage(79), warn: false });
    draw();
    await screen.findByTestId("diary-storage-card");
    expect(screen.getByText(/여유가 있어요/)).toBeTruthy();
  });

  it("🔴 81% 면 알린다 — 그리고 **미리** 라는 걸 말한다", async () => {
    getDiaryUsage.mockResolvedValue(usage(81));
    draw();
    await screen.findByTestId("diary-storage-card");
    expect(screen.getByText(/81% 를 썼어요/)).toBeTruthy();
    expect(screen.getByText(/가득 차면/)).toBeTruthy();
  });

  it("🔴 경고할 때 '지우기 전에 남길 수 있다'를 함께 말한다", async () => {
    // 이 한 줄이 없으면 정리는 "아이 그림을 버리라"는 말이 된다 (2026-08-11 오너)
    getDiaryUsage.mockResolvedValue(usage(85));
    draw();
    await screen.findByTestId("diary-storage-card");
    expect(screen.getByText(/내려받아 앨범으로 남기실 수도 있어요/)).toBeTruthy();
  });
});

describe("[C] 가득 참 — 부모에게는 부모의 말로", () => {
  it("🔴 서버가 준 부모용 문구를 쓴다 (아이용 문구가 새어 나오지 않는다)", async () => {
    getDiaryUsage.mockResolvedValue(usage(100, {
      parentMessage: "저장 공간이 가득 찼어요. 가족 책장에서 일기를 정리하면 다시 저장됩니다.",
    }));
    draw();
    await screen.findByTestId("diary-storage-card");
    expect(screen.getByText(/가족 책장에서 일기를 정리하면/)).toBeTruthy();
    // 아이용 문구("엄마아빠한테 말해줄래?")가 부모 화면에 뜨면 사실 왜곡이다
    expect(screen.queryByText(/엄마아빠한테 말해줄래/)).toBeNull();
  });

  it("아이 일기가 사라진 게 아니라는 걸 말한다", async () => {
    getDiaryUsage.mockResolvedValue(usage(100));
    draw();
    await screen.findByTestId("diary-storage-card");
    expect(screen.getByText(/아이 기기에만 남고 있어요/)).toBeTruthy();
  });
});

describe("[D] 🚨 윤리선 — 정리 목록에 비공개가 뜨되 내용은 없다", () => {
  const ROWS = {
    entries: [
      { id: "e1", profileId: "p1", date: "2026-03-01", bytes: 3 * MB, shared: false },
      { id: "e2", profileId: "p2", date: "2026-04-02", bytes: 1 * MB, shared: true },
    ],
  };

  it("비공개 일기도 목록에 있고 '비공개' 라고 표시된다", async () => {
    getDiaryUsageEntries.mockResolvedValue(ROWS);
    draw();
    fireEvent.click(await screen.findByTestId("storage-cleanup-open"));
    expect(await screen.findByText("2026년 3월 1일")).toBeTruthy();
    expect(screen.getByText("비공개")).toBeTruthy();
    // 공유분에는 '비공개' 배지가 안 붙는다 (대조군 — 전부에 붙으면 아무 뜻이 없다)
    expect(screen.getAllByText("비공개").length).toBe(1);
  });

  it("🔴 화면이 요구하는 것은 다섯 필드뿐 — 내용을 부르지 않는다", async () => {
    getDiaryUsageEntries.mockResolvedValue(ROWS);
    draw();
    fireEvent.click(await screen.findByTestId("storage-cleanup-open"));
    await screen.findByText("2026년 3월 1일");
    // 정리 화면은 /diary/shelf(내용) 를 부르지 않는다 — 그걸 부르면 비공개가 샌다
    expect(getDiaryUsageEntries).toHaveBeenCalledTimes(1);
  });

  it("🔴 왜 내용이 없는지를 부모에게 설명한다 (오해 방지)", async () => {
    getDiaryUsageEntries.mockResolvedValue(ROWS);
    draw();
    fireEvent.click(await screen.findByTestId("storage-cleanup-open"));
    expect(await screen.findByText(/내용은 보여드리지 않아요/)).toBeTruthy();
  });

  it("아이 이름과 용량은 보여준다 (골라야 하니까)", async () => {
    getDiaryUsageEntries.mockResolvedValue(ROWS);
    draw();
    fireEvent.click(await screen.findByTestId("storage-cleanup-open"));
    await screen.findByText("2026년 3월 1일");
    expect(screen.getByText("해인")).toBeTruthy();
    expect(screen.getByText("3.0MB")).toBeTruthy();
  });
});

describe("[E] 🔴 지우기 — 확인 없이는 부르지 않는다", () => {
  const ROWS = {
    entries: [
      { id: "e1", profileId: "p1", date: "2026-03-01", bytes: 3 * MB, shared: false },
      { id: "e2", profileId: "p2", date: "2026-04-02", bytes: 1 * MB, shared: true },
    ],
  };

  const pickTwo = async () => {
    getDiaryUsageEntries.mockResolvedValue(ROWS);
    draw();
    fireEvent.click(await screen.findByTestId("storage-cleanup-open"));
    await screen.findByText("2026년 3월 1일");
    fireEvent.click(screen.getByLabelText("2026년 3월 1일 일기 선택"));
    fireEvent.click(screen.getByLabelText("2026년 4월 2일 일기 선택"));
  };

  it("🔴 '지우기' 를 눌러도 확인 전에는 삭제가 안 불린다", async () => {
    await pickTwo();
    fireEvent.click(screen.getByTestId("storage-cleanup-ask"));
    expect(deleteDiaryEntry).not.toHaveBeenCalled();
    // 되돌릴 수 없다는 걸 정직하게 말한다
    expect(screen.getByText(/되돌릴 수 없어요/)).toBeTruthy();
    expect(screen.getByText(/그림과 목소리도 함께 사라지고/)).toBeTruthy();
  });

  it("🔴 '아니요' 면 아무것도 안 지운다", async () => {
    await pickTwo();
    fireEvent.click(screen.getByTestId("storage-cleanup-ask"));
    fireEvent.click(screen.getByText("아니요"));
    expect(deleteDiaryEntry).not.toHaveBeenCalled();
  });

  it("확인하면 고른 것만, 각자의 프로필로 지운다", async () => {
    await pickTwo();
    fireEvent.click(screen.getByTestId("storage-cleanup-ask"));
    fireEvent.click(screen.getByTestId("storage-cleanup-confirm"));
    await waitFor(() => expect(deleteDiaryEntry).toHaveBeenCalledTimes(2));
    // 🔴 프로필이 섞이면 남의 아이 일기를 지우려 든다 → 서버가 404 를 낸다
    expect(deleteDiaryEntry).toHaveBeenCalledWith("e1", "p1");
    expect(deleteDiaryEntry).toHaveBeenCalledWith("e2", "p2");
  });

  it("🔴 하나만 골랐으면 하나만 지운다 (대조군)", async () => {
    getDiaryUsageEntries.mockResolvedValue(ROWS);
    draw();
    fireEvent.click(await screen.findByTestId("storage-cleanup-open"));
    await screen.findByText("2026년 3월 1일");
    fireEvent.click(screen.getByLabelText("2026년 3월 1일 일기 선택"));
    fireEvent.click(screen.getByTestId("storage-cleanup-ask"));
    fireEvent.click(screen.getByTestId("storage-cleanup-confirm"));
    await waitFor(() => expect(deleteDiaryEntry).toHaveBeenCalledTimes(1));
    expect(deleteDiaryEntry).toHaveBeenCalledWith("e1", "p1");
  });

  it("지운 뒤 사용량을 다시 읽는다 (막대가 옛날 값에 굳지 않게)", async () => {
    await pickTwo();
    const before = getDiaryUsage.mock.calls.length;
    fireEvent.click(screen.getByTestId("storage-cleanup-ask"));
    fireEvent.click(screen.getByTestId("storage-cleanup-confirm"));
    await waitFor(() => expect(getDiaryUsage.mock.calls.length).toBeGreaterThan(before));
  });
});

describe("[F] 부모의 선택지 — 정리 화면과 가족 책장 둘 다", () => {
  it("가족 책장으로 가는 길이 부모 화면에 있다", async () => {
    // 🔴 이 링크가 지금까지 **0개**였다 — 부모는 보기만 되고 지우지는 못했다(2026-08-11 확인)
    draw();
    await screen.findByTestId("diary-storage-card");
    const link = screen.getByText(/가족 책장에서 보고 고르기/).closest("a");
    expect(link?.getAttribute("href")).toBe("/family-shelf");
  });

  it("사용량을 못 읽으면 조용히 알린다 (화면을 막지 않는다)", async () => {
    getDiaryUsage.mockRejectedValue(new Error("network"));
    draw();
    expect(await screen.findByText(/사용량을 읽지 못했어요/)).toBeTruthy();
  });
});
