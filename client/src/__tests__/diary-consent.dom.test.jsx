// B13 — 그림일기 서버 저장 동의
//
//   [A] 동의는 **명시적으로 켠 것만** 참이다 (모르면 꺼짐)
//   [B] 🔴 캐시는 병합이 아니라 **교체** — 남의 계정 동의가 남으면 안 된다
//   [C] 게이트는 두 겹 — 킬스위치 AND 동의
//   [D] 🔴 삭제는 동의와 무관하게 열려 있어야 한다
//        철회하면 "서버에 남은 일기를 영영 못 지운다"가 되는 걸 막는다
import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const H = vi.hoisted(() => ({ calls: [] }));
vi.mock("../utils/api", () => ({
  postDiaryConsent: vi.fn(async (pid, action) => {
    H.calls.push({ pid, action });
    return { diaryServerOn: action === "grant" };
  }),
}));

import DiaryConsentCard from "../components/DiaryConsentCard";
import {
  setDiaryConsentFromProfiles, setDiaryConsentOne,
  clearDiaryConsent, isDiaryConsented,
} from "../utils/diaryConsent";
import { DIARY_SERVER, isDiaryServerOn } from "../utils/diaryStore";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const STORE = readFileSync(resolve(SRC, "utils/diaryStore.js"), "utf8");

/** 파이썬이 아니라 JS — `export async function name(...) {` 부터 중괄호 매칭. */
function bodyOf(src, name) {
  const m = src.match(new RegExp(`export\\s+(?:async\\s+)?function\\s+${name}\\s*\\([^)]*\\)\\s*\\{`));
  if (!m) return "";
  let i = m.index + m[0].length - 1, depth = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}" && --depth === 0) return src.slice(i, j + 1);
  }
  return "";
}

beforeEach(() => localStorage.clear());

describe("[A] 모르면 꺼짐", () => {
  it("아무것도 담지 않으면 false", () => {
    expect(isDiaryConsented("p1")).toBe(false);
  });

  it("pid 가 없으면 false", () => {
    expect(isDiaryConsented(null)).toBe(false);
    expect(isDiaryConsented(undefined)).toBe(false);
  });

  it("서버가 diaryServerOn 을 안 보내면(구버전 DB) 꺼짐으로 본다", () => {
    setDiaryConsentFromProfiles([{ id: "p1" }]);          // 키 자체가 없음
    expect(isDiaryConsented("p1")).toBe(false);
  });

  it("문자열 'true' 같은 건 동의로 치지 않는다 (엄격 비교)", () => {
    setDiaryConsentFromProfiles([{ id: "p1", diaryServerOn: "true" }]);
    expect(isDiaryConsented("p1")).toBe(false);
  });

  it("저장소가 손상돼도 터지지 않고 꺼짐이 된다", () => {
    localStorage.setItem("diary_consent_v1", "{망가진 JSON");
    expect(isDiaryConsented("p1")).toBe(false);
  });
});

describe("[B] 🔴 캐시는 교체다 — 남의 계정 동의가 남으면 안 된다", () => {
  it("다른 계정으로 바뀌면 이전 동의가 사라진다", () => {
    setDiaryConsentFromProfiles([{ id: "kidA", diaryServerOn: true }]);
    expect(isDiaryConsented("kidA")).toBe(true);

    // 로그아웃 없이 다른 계정 프로필이 들어온 경우 (교체가 아니라 병합이면 kidA 가 살아남는다)
    setDiaryConsentFromProfiles([{ id: "kidB", diaryServerOn: false }]);
    expect(isDiaryConsented("kidA")).toBe(false);   // 🔴 핵심
    expect(isDiaryConsented("kidB")).toBe(false);
  });

  it("clearDiaryConsent 로 전부 지워진다 (로그아웃)", () => {
    setDiaryConsentFromProfiles([{ id: "p1", diaryServerOn: true }]);
    clearDiaryConsent();
    expect(isDiaryConsented("p1")).toBe(false);
  });

  it("setDiaryConsentOne 은 그 프로필만 바꾼다 (토글 직후 즉시 반영)", () => {
    setDiaryConsentFromProfiles([
      { id: "p1", diaryServerOn: true },
      { id: "p2", diaryServerOn: true },
    ]);
    setDiaryConsentOne("p1", false);
    expect(isDiaryConsented("p1")).toBe(false);
    expect(isDiaryConsented("p2")).toBe(true);
  });
});

describe("[C] 게이트는 두 겹 — 킬스위치 AND 동의", () => {
  it("킬스위치가 꺼져 있으면 동의해도 서버로 안 간다", () => {
    setDiaryConsentFromProfiles([{ id: "p1", diaryServerOn: true }]);
    expect(isDiaryServerOn("p1")).toBe(DIARY_SERVER && true);
    if (!DIARY_SERVER) expect(isDiaryServerOn("p1")).toBe(false);
  });

  it("동의가 없으면 킬스위치와 무관하게 false", () => {
    expect(isDiaryServerOn("p1")).toBe(false);
  });

  it("🔴 현재 배포 상태 — 킬스위치는 꺼져 있다", () => {
    // 008 SQL 적용 + 동의 UI 확인 + 오너 승인 전까지 false 여야 한다.
    expect(DIARY_SERVER).toBe(false);
  });
});

describe("[D] 🔴 삭제는 동의와 무관하게 열려 있다", () => {
  // 철회 = "더 올리지 않는다" 이지 "이미 올라간 걸 못 지운다" 가 아니다.
  // 삭제 경로에 동의 게이트를 끼우면 정반대가 되므로, 소스에서 직접 확인한다.
  it("tearEntry 의 서버 삭제는 동의를 보지 않는다", () => {
    const b = bodyOf(STORE, "tearEntry");
    expect(b, "tearEntry 본문을 못 찾았다").toBeTruthy();
    expect(b).toContain("deleteEntryOnServer");
    expect(b).not.toContain("isDiaryServerOn");
  });

  it.each(["deleteEntryOnServer", "flushPendingDeletes"])(
    "%s 는 동의를 보지 않는다", (fn) => {
      const b = bodyOf(STORE, fn);
      expect(b, `${fn} 본문을 못 찾았다`).toBeTruthy();
      expect(b).not.toContain("isDiaryServerOn");
      expect(b).toContain("DIARY_SERVER");     // 킬스위치는 본다
    },
  );

  it("🔴 hydrateDiary 는 동의 게이트보다 **먼저** 밀린 삭제를 보낸다", () => {
    // 순서가 뒤집히면 철회한 순간 삭제 큐가 영영 안 나간다.
    const b = bodyOf(STORE, "hydrateDiary");
    expect(b, "hydrateDiary 본문을 못 찾았다").toBeTruthy();
    const flush = b.indexOf("flushPendingDeletes");
    const gate = b.indexOf("isDiaryServerOn");
    expect(flush, "flushPendingDeletes 호출이 없다").toBeGreaterThan(-1);
    expect(gate, "동의 게이트가 없다").toBeGreaterThan(-1);
    expect(flush).toBeLessThan(gate);          // 🔴 핵심
  });
});

describe("[E] 동의 카드 — 켜기는 묻고, 끄기는 안 묻는다", () => {
  const KID = { id: "p1", name: "하늘", diaryServerOn: false };
  const toggle = () => screen.getByRole("button", { name: "어디서나 열리는 가족 책장" });

  beforeEach(() => { H.calls = []; });

  it("꺼져 있을 때 켜면 **바로 안 보내고** 무엇이 저장되는지 먼저 보여준다", async () => {
    render(<DiaryConsentCard profile={KID} />);
    await userEvent.click(toggle());
    expect(H.calls, "확인도 없이 동의를 보냈다").toHaveLength(0);
    expect(screen.getByText("켜기 전에 알려드릴게요")).toBeTruthy();
    // 정직해야 할 3가지가 확인 화면에 있다
    expect(screen.getByText(/미국에 있는 서버/)).toBeTruthy();
    expect(screen.getByText(/글자로 옮기지 않아요/)).toBeTruthy();
    expect(screen.getByText(/서버에서도 함께 지워져요/)).toBeTruthy();
  });

  it("'동의하고 켜기'를 눌러야 grant 가 나간다", async () => {
    render(<DiaryConsentCard profile={KID} />);
    await userEvent.click(toggle());
    await userEvent.click(screen.getByText("동의하고 켜기"));
    await waitFor(() => expect(H.calls).toEqual([{ pid: "p1", action: "grant" }]));
  });

  it("'나중에'를 누르면 아무것도 안 보낸다", async () => {
    render(<DiaryConsentCard profile={KID} />);
    await userEvent.click(toggle());
    await userEvent.click(screen.getByText("나중에"));
    expect(H.calls).toHaveLength(0);
    expect(screen.queryByText("켜기 전에 알려드릴게요")).toBeNull();
  });

  it("🔴 켜져 있을 때 끄면 **묻지 않고 즉시** 꺼진다 (되돌리기를 어렵게 하지 않는다)", async () => {
    render(<DiaryConsentCard profile={{ ...KID, diaryServerOn: true }} />);
    await userEvent.click(toggle());
    await waitFor(() => expect(H.calls).toEqual([{ pid: "p1", action: "revoke" }]));
  });

  it("🔴 끈 뒤 '이미 올려둔 일기는 남아 있다'를 알린다", async () => {
    // 철회는 '더 올리지 않는다'까지다. 안 알리면 "껐으니 다 지워졌겠지"로 오해한다.
    render(<DiaryConsentCard profile={{ ...KID, diaryServerOn: true }} />);
    await userEvent.click(toggle());
    await waitFor(() => expect(screen.getByText(/이미 올려둔 일기는 그대로 있어요/)).toBeTruthy());
  });

  it("처리방침으로 가는 길이 확인 화면에 있다", async () => {
    render(<DiaryConsentCard profile={KID} />);
    await userEvent.click(toggle());
    expect(screen.getByText("개인정보 처리방침 보기").getAttribute("href")).toBe("/privacy");
  });
});
