// 회원 탈퇴 화면 (B4, 2026-08-10)
//
//   서버 쪽 `_verify_account_delete.py` 는 **코드가 그렇게 생겼는가**까지만 본다.
//   "비밀번호가 틀렸을 때 삭제를 정말 안 부르는가" 는 실행해봐야 안다 — 그게 이 파일이다.
//
//   [A] 🔴 대조군 먼저 — 다 채우면 **실제로 지워진다**
//        막는 것만 보면 절반이다. 안 지워지면 그건 방어가 아니라 고장이다.
//   [B] 문턱 — "탈퇴" 와 비밀번호가 **둘 다** 있어야 버튼이 눌린다
//   [C] 🔴 비밀번호가 틀리면 **삭제를 부르지 않는다** (여기가 이 화면의 심장)
//   [D] 🔴 서버가 실패하면 로그아웃·이동을 하지 않는다
//        (계정이 살아있는데 쫓아내면 사용자는 지워진 줄 안다)
//   [E] 안내 문구가 지워지는 것을 사실대로 말한다 (그림·음성 포함)
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// ── 모킹 ─────────────────────────────────────────────────────────────
const navigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigate,
    useSearchParams: () => [new URLSearchParams(""), vi.fn()],
  };
});

const signOut = vi.fn();
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { email: "parent@example.com", user_metadata: {} }, signOut }),
}));

const signInWithPassword = vi.fn();
vi.mock("../utils/supabase", () => ({
  supabase: { auth: { signInWithPassword: (...a) => signInWithPassword(...a), updateUser: vi.fn() } },
}));

const deleteAccount = vi.fn();
vi.mock("../utils/api", async () => {
  // 🔴 readErrorText 는 **진짜를 쓴다**(2026-08-11). 가짜로 만들면
  //    "429 의 detail 객체가 문자열로 바뀌는가" 라는 이 화면의 실제 계약이 검증에서 빠진다.
  //    ⚠️ 가짜 목록이 실물보다 좁으면 그 import 는 undefined 가 되어 **호출 순간 터진다** —
  //       실제로 이 테스트가 그렇게 깨져서 알았다(가짜 주입 3원칙 ①: 경계에만 끼운다).
  const actual = await vi.importActual("../utils/api");
  return { ...actual, deleteAccount: (...a) => deleteAccount(...a) };
});

const { default: Account } = await import("../pages/Account");

const setup = () => render(<MemoryRouter><Account /></MemoryRouter>);

/** 탈퇴 버튼 — 카드 안의 "탈퇴하기" 하나만 잡는다(상단 탭·다른 버튼과 구분) */
const delBtn = () => screen.getByRole("button", { name: /탈퇴하기|지우는 중|완료/ });
const wordInput = () => screen.getByPlaceholderText(/"탈퇴" 를 입력/);
const pwInput = () => screen.getByPlaceholderText(/비밀번호를 한 번 더/);

const fill = (word = "탈퇴", pw = "hunter2") => {
  if (word !== null) fireEvent.change(wordInput(), { target: { value: word } });
  if (pw !== null) fireEvent.change(pwInput(), { target: { value: pw } });
};

beforeEach(() => {
  navigate.mockReset();
  signOut.mockReset().mockResolvedValue(undefined);
  signInWithPassword.mockReset().mockResolvedValue({ error: null });
  deleteAccount.mockReset().mockResolvedValue({ ok: true });
});
afterEach(cleanup);

// ══════════════════════════════════════════════════════════════════════
describe("[A] 🔴 대조군 — 다 채우면 실제로 지워진다", () => {
  it("비밀번호 확인 → 삭제 → 로그아웃 → 첫 화면", async () => {
    setup();
    fill();
    fireEvent.click(delBtn());

    await waitFor(() => expect(deleteAccount).toHaveBeenCalledTimes(1));
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "parent@example.com",
      password: "hunter2",
    });
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/", { replace: true }));
    expect(signOut).toHaveBeenCalled();
  });

  it("🔴 비밀번호 확인이 삭제보다 **먼저** 불린다", async () => {
    const order = [];
    signInWithPassword.mockImplementation(async () => { order.push("pw"); return { error: null }; });
    deleteAccount.mockImplementation(async () => { order.push("del"); return { ok: true }; });
    setup();
    fill();
    fireEvent.click(delBtn());
    await waitFor(() => expect(order).toEqual(["pw", "del"]));
  });

  it("🔴 비밀번호를 우리 서버로 보내지 않는다 (인자 없이 호출)", async () => {
    setup();
    fill();
    fireEvent.click(delBtn());
    await waitFor(() => expect(deleteAccount).toHaveBeenCalled());
    expect(deleteAccount.mock.calls[0]).toEqual([]);
  });
});

// ══════════════════════════════════════════════════════════════════════
describe("[B] 문턱 — 둘 다 있어야 눌린다", () => {
  it("아무것도 없으면 비활성", () => {
    setup();
    expect(delBtn().disabled).toBe(true);
  });

  it('"탈퇴"만 입력하면 비활성 — 비밀번호가 빠졌다', () => {
    setup();
    fill("탈퇴", null);
    expect(delBtn().disabled).toBe(true);
  });

  it("비밀번호만 넣으면 비활성 — 확인 문구가 빠졌다", () => {
    setup();
    fill(null, "hunter2");
    expect(delBtn().disabled).toBe(true);
  });

  it('비슷한 말("탈퇴할래")로는 안 된다 — 정확히 일치해야 한다', () => {
    setup();
    fill("탈퇴할래", "hunter2");
    expect(delBtn().disabled).toBe(true);
  });

  it("둘 다 채우면 활성", () => {
    setup();
    fill();
    expect(delBtn().disabled).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════
describe("[C] 🔴 비밀번호가 틀리면 삭제를 부르지 않는다", () => {
  it("signInWithPassword 가 error 를 주면 deleteAccount 는 0회", async () => {
    signInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    setup();
    fill("탈퇴", "wrong");
    fireEvent.click(delBtn());

    await screen.findByText(/비밀번호가 맞지 않아요/);
    expect(deleteAccount).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("틀린 뒤에도 화면에 남아 다시 시도할 수 있다", async () => {
    signInWithPassword.mockResolvedValue({ error: { message: "nope" } });
    setup();
    fill("탈퇴", "wrong");
    fireEvent.click(delBtn());
    await screen.findByText(/비밀번호가 맞지 않아요/);
    expect(delBtn().disabled).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════
describe("[D] 🔴 서버가 실패하면 쫓아내지 않는다", () => {
  it("deleteAccount 가 던지면 로그아웃·이동을 하지 않는다", async () => {
    deleteAccount.mockRejectedValue({ response: { data: { detail: "계정을 지우지 못했어요" } } });
    setup();
    fill();
    fireEvent.click(delBtn());

    await screen.findByText(/계정을 지우지 못했어요/);
    expect(signOut).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("서버가 이유를 안 주면 일반 안내를 보여준다", async () => {
    deleteAccount.mockRejectedValue(new Error("network"));
    setup();
    fill();
    fireEvent.click(delBtn());
    await screen.findByText(/탈퇴 처리 중 문제가 생겼어요/);
  });
});

// ══════════════════════════════════════════════════════════════════════
describe("[E] 안내 문구 — 지워지는 것을 사실대로", () => {
  it("그림일기의 그림·음성까지 지워진다고 적혀 있다", () => {
    setup();
    // ⚠️ '시청기록'만 적으면 아이 그림·음성은 남는 줄 안다
    expect(screen.getByText(/그림일기의 그림과 음성까지/)).toBeTruthy();
  });

  it("되돌릴 수 없다고 적혀 있다", () => {
    setup();
    expect(screen.getByText(/되돌릴 수 없어요/)).toBeTruthy();
  });
});
