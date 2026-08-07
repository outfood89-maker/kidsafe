// B1 — 개인정보 처리방침 페이지
//
//   이 테스트가 지키는 것은 화면 모양이 아니라 **방침이 참인 상태**다.
//   방침에 쓴 내용과 실제 코드가 어긋나면 그 자체가 위반이 된다(B1 초안 부록 B 서문).
//
//   [A] 🔴 로그인 없이 열려야 한다 — 가입 전에 못 보면 동의가 성립하지 않는다
//   [B] 🔴 그림일기 서버 저장 플래그와 방침 문구가 **함께 움직여야** 한다
//        → DIARY_SERVER 를 켜면서 Privacy.jsx 를 안 고치면 방침이 거짓말을 한다
//   [C] 받지도 않은 동의를 받았다고 주장하지 않는다 (동의 절차는 미구현 — 부록 B2·B13)
//   [D] 방침에 닿는 길이 실제로 있어야 한다 (페이지만 있고 링크가 없으면 없는 것과 같다)
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Privacy from "../pages/Privacy";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(resolve(SRC, p), "utf8");

const APP = read("App.jsx");
const PRIVACY = read("pages/Privacy.jsx");
const STORE = read("utils/diaryStore.js");

/** 주석을 지운 본문만 본다 — 주석 속 금지어를 코드로 오판하면 거짓 경보가 난다. */
function stripComments(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("[A] 🔴 처리방침은 로그인 없이 열려야 한다", () => {
  it("/privacy 라우트가 존재한다", () => {
    expect(APP).toMatch(/path="\/privacy"/);
  });

  it("/privacy 가 ProtectedRoute 로 감싸여 있지 않다", () => {
    const line = stripComments(APP)
      .split("\n")
      .find((l) => l.includes('path="/privacy"') && !l.includes("privacy-policy"));
    expect(line, "/privacy 라우트 줄을 못 찾았다").toBeTruthy();
    expect(line).not.toContain("ProtectedRoute");
  });

  it("로그인 정보 없이도 렌더된다 (AuthProvider 없이 그려본다)", () => {
    render(<MemoryRouter><Privacy /></MemoryRouter>);
    expect(screen.getByText("개인정보 처리방침")).toBeTruthy();
  });
});

describe("[B] 🔴 서버 저장 플래그와 방침 문구는 함께 움직인다", () => {
  const flagOf = (src, name) => {
    const m = stripComments(src).match(new RegExp(`${name}\\s*=\\s*(true|false)`));
    expect(m, `${name} 상수를 못 찾았다 — 이름이 바뀌었으면 이 검사도 함께 고쳐라`).toBeTruthy();
    return m[1] === "true";
  };

  it("Privacy.DIARY_SERVER_LIVE === diaryStore.DIARY_SERVER", () => {
    const live = flagOf(PRIVACY, "DIARY_SERVER_LIVE");
    const real = flagOf(STORE, "DIARY_SERVER");
    expect(
      live,
      real
        ? "🔴 서버 저장을 켰는데 방침은 '기기에만 저장'이라고 말하고 있다 — 허위 기재다. Privacy.jsx 의 DIARY_SERVER_LIVE 를 true 로 바꿔라."
        : "🔴 방침은 서버 저장을 안내하는데 실제 저장은 꺼져 있다 — 없는 기능을 안내하고 있다.",
    ).toBe(real);
  });

  it("꺼져 있는 동안에는 '서버로 보내지 않는다'가 화면에 보인다", () => {
    if (flagOf(STORE, "DIARY_SERVER")) return;   // 켜지면 이 문구는 사라지는 게 맞다
    render(<MemoryRouter><Privacy /></MemoryRouter>);
    // 요약 카드와 제5조 두 곳에 나온다(의도된 중복 — 훑어보는 사람과 읽는 사람 둘 다 봐야 한다)
    expect(screen.getAllByText(/서버로 보내지 않습니다/).length).toBeGreaterThan(0);
  });
});

describe("[C] 받지 않은 동의를 받았다고 하지 않는다", () => {
  it("'동의한 것으로 본다' 류의 간주 동의 문구가 없다 (동의 절차 미구현 — 부록 B2·B13)", () => {
    const body = stripComments(PRIVACY) + stripComments(read("pages/Login.jsx"));
    for (const bad of ["동의한 것으로", "동의하신 것으로", "동의로 간주"]) {
      expect(body, `간주 동의 문구 발견: "${bad}"`).not.toContain(bad);
    }
  });

  it("확정되지 않은 항목을 지어내지 않는다 (운영주체·보호책임자·시행일은 비어 있어야 한다)", () => {
    const body = stripComments(PRIVACY);
    for (const name of ["OPERATOR_NAME", "DPO_NAME", "EFFECTIVE_DATE"]) {
      expect(body, `${name} 이 임의로 채워졌다 — 실제로 확정된 값인지 확인하고 이 검사를 갱신하라`)
        .toMatch(new RegExp(`${name}\\s*=\\s*null`));
    }
  });

  it("시행일이 없으면 '준비 중'이라고 화면에 밝힌다", () => {
    render(<MemoryRouter><Privacy /></MemoryRouter>);
    expect(screen.getByText(/준비 중인 방침입니다/)).toBeTruthy();
  });
});

describe("[E] 불편한 사실이 맨 위에 있다", () => {
  // 요약이 좋은 소식만 담으면 그건 고지가 아니라 홍보다.
  // 부모가 나중에 놀랄 만한 3가지가 첫 화면에 있어야 한다.
  it("‘먼저 알려드립니다’ 3가지가 있다", () => {
    render(<MemoryRouter><Privacy /></MemoryRouter>);
    expect(screen.getByText("먼저 알려드립니다")).toBeTruthy();
    expect(screen.getByText(/저장하지 않아도 외부로 전송됩니다/)).toBeTruthy();
    expect(screen.getByText(/‘그날의 기분’은 보호자에게 보입니다/)).toBeTruthy();
    expect(screen.getByText(/이 기기에서만 보입니다/)).toBeTruthy();
  });

  it("🔴 기기 간 미연동을 아이폰만의 문제로 쓰지 않는다", () => {
    // 7일 삭제는 iOS 한정이지만, '다른 기기에서 안 보인다'는 안드로이드·PC 도 똑같다.
    // 아이폰만 언급하면 안드로이드 쓰는 부모가 자기는 해당 없다고 읽는다.
    render(<MemoryRouter><Privacy /></MemoryRouter>);
    expect(screen.getByText(/아이폰이든 안드로이드든 PC든 마찬가지입니다/)).toBeTruthy();
    expect(screen.getAllByText(/아이폰·안드로이드·PC 모두 해당합니다/).length).toBeGreaterThan(0);
    // 세 가지 손실 경로가 다 적혀 있어야 한다 (하나만 적으면 나머지를 안전하다고 읽는다)
    expect(screen.getAllByText(/보호자 휴대전화에서 보이지 않습니다/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/기기를 바꾸/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/7일/).length).toBeGreaterThan(0);
  });

  it("🔴 요약의 앵커가 실제 조문을 가리킨다 (조문 번호가 바뀌면 링크가 헛돈다)", () => {
    const { container } = render(<MemoryRouter><Privacy /></MemoryRouter>);
    const anchors = [...container.querySelectorAll('a[href^="#s"]')].map((a) => a.getAttribute("href"));
    expect(anchors.length, "요약 앵커가 하나도 없다").toBeGreaterThan(0);
    for (const href of anchors) {
      expect(container.querySelector(`#${href.slice(1)}`), `${href} 가 가리키는 조문이 없다`).toBeTruthy();
    }
  });

  it("‘비밀이야 = 저장 안 함’ 과 ‘전송됨’ 을 구분해 적는다 (부록 A #3)", () => {
    render(<MemoryRouter><Privacy /></MemoryRouter>);
    expect(screen.getByText(/‘비밀이야’와 ‘전송’은 다른 이야기입니다/)).toBeTruthy();
    expect(screen.getByText(/저장 여부와 관계없이 이미 Anthropic으로 전송된 뒤/)).toBeTruthy();
  });
});

describe("[F] 🔴 기능 이름이 방침과 화면에서 같다", () => {
  // 2026-08-07 발견 — 방침은 '가족과 함께 보기', 화면은 '어디서나 열리는 가족 책장' 이었다.
  // 이름이 다르면 부모가 방침에서 그 항목을 찾지 못한다. 고지했다고 말할 수 없다.
  const FEATURE = "어디서나 열리는 가족 책장";

  it.each([
    ["pages/Privacy.jsx", "처리방침"],
    ["components/DiaryConsentCard.jsx", "동의 카드"],
  ])("%s 가 '어디서나 열리는 가족 책장' 이라 부른다 (%s)", (file) => {
    expect(read(file)).toContain(FEATURE);
  });

  it("옛 이름('가족과 함께 보기')이 남아 있지 않다", () => {
    for (const f of ["pages/Privacy.jsx", "components/DiaryConsentCard.jsx", "pages/ParentDashboard.jsx"]) {
      expect(read(f), `${f} 에 옛 이름이 남아 있다`).not.toContain("가족과 함께 보기");
    }
  });
});

describe("[D] 방침에 닿는 길이 있다", () => {
  it.each([
    ["pages/Landing.jsx", "랜딩 푸터 — 로그인 전 경로"],
    ["pages/Login.jsx", "가입 화면 — 동의가 필요한 지점"],
    ["pages/Account.jsx", "내 계정 — 가입 후 다시 보는 경로"],
  ])("%s 에 /privacy 링크가 있다 (%s)", (file) => {
    expect(stripComments(read(file))).toContain("/privacy");
  });
});
