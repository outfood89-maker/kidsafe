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

/** 소스에서 `const NAME = true|false` 를 읽는다. [B]·[C] 양쪽이 쓰므로 모듈 최상단에 둔다. */
const flagOf = (src, name) => {
  const m = stripComments(src).match(new RegExp(`${name}\\s*=\\s*(true|false)`));
  expect(m, `${name} 상수를 못 찾았다 — 이름이 바뀌었으면 이 검사도 함께 고쳐라`).toBeTruthy();
  return m[1] === "true";
};

/** 서버 저장이 켜져 있는가. 방침 문구가 갈리는 자리들의 기준점. */
const SERVER_LIVE = () => flagOf(STORE, "DIARY_SERVER");

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

  // 🔴 2026-08-08 신설 — 기존 검사는 '요약 카드'와 '제5조' 두 곳만 봤다.
  //    그런데 방침 **맨 위**의 「먼저 알려드립니다」 는 분기 없이 하드코딩돼 있었다.
  //    켰다면 맨 위는 "이 기기에서만 보입니다" 라고 단정하는데 제5조는 "서버에 저장됩니다" 라고 한다.
  //    같은 문서가 서로 다른 말을 하는 것이라, 부모가 먼저 읽는 쪽이 거짓이 된다.
  //    ⇒ 문구가 갈리는 자리를 **빠짐없이** 검사한다. 자리를 새로 만들면 여기에도 추가할 것.
  it("🔴 '먼저 알려드립니다'(맨 위)도 함께 움직인다 — 제5조와 다른 말을 하면 안 된다", () => {
    render(<MemoryRouter><Privacy /></MemoryRouter>);
    if (SERVER_LIVE()) {
      expect(
        screen.queryByText(/^그림일기는 지금 이 기기에서만 보입니다$/),
        "🔴 서버 저장을 켰는데 방침 맨 위는 여전히 '지금 이 기기에서만'이라고 단정한다 — 제5조와 모순이다",
      ).toBeNull();
      expect(
        screen.getAllByText(/켜지 않으면 그림일기는 이 기기에서만/).length,
        "켠 상태의 안내('켜지 않으면 이 기기에서만')가 맨 위에 없다",
      ).toBeGreaterThan(0);
    } else {
      expect(
        screen.getAllByText(/^그림일기는 지금 이 기기에서만 보입니다$/).length,
        "꺼진 상태인데 맨 위에 '지금 이 기기에서만'이 없다",
      ).toBeGreaterThan(0);
    }
  });
});

describe("[C] 받지 않은 동의를 받았다고 하지 않는다", () => {
  it("'동의한 것으로 본다' 류의 간주 동의 문구가 없다 (동의 절차 미구현 — 부록 B2·B13)", () => {
    const body = stripComments(PRIVACY) + stripComments(read("pages/Login.jsx"));
    for (const bad of ["동의한 것으로", "동의하신 것으로", "동의로 간주"]) {
      expect(body, `간주 동의 문구 발견: "${bad}"`).not.toContain(bad);
    }
  });

  // 🔴 2026-08-08 전환 — 원래는 "셋 다 null 이어야 한다"(지어내기 금지)였다.
  //    방침을 시행하면서 오너 확정값으로 채웠으므로 검사를 **뒤집는다**: 켰다면 비어 있으면 안 된다.
  //    법 제30조는 보호책임자(성명 **또는** 담당부서 명칭)와 연락처를 필수 기재사항으로 정한다.
  //    ⚠️ '지어내기 금지'가 사라진 게 아니다 — 값은 오너가 정한 것이고(2026-08-08 '실명 없이'),
  //       바꾸려면 오너 확인을 다시 받아야 한다. 특히 없는 부서 이름을 만들지 말 것.
  it("🔴 서버 저장을 켰다면 보호책임자·시행일이 비어 있으면 안 된다 (법 제30조)", () => {
    const body = stripComments(PRIVACY);
    const isNull = (name) => new RegExp(`${name}\\s*=\\s*null`).test(body);
    if (SERVER_LIVE()) {
      expect(isNull("DPO_NAME"), "🔴 보호책임자가 비어 있다 — 법정 필수 기재사항이다").toBe(false);
      expect(isNull("EFFECTIVE_DATE"), "🔴 시행일이 비어 있다 — '준비 중' 배너가 뜬 채로 서버 저장이 도는 셈이다").toBe(false);
      expect(isNull("OPERATOR_NAME"), "🔴 운영 주체가 비어 있다").toBe(false);
    }
    // 켜든 껐든 연락처는 항상 있어야 한다 — 없으면 열람·삭제 요구를 넣을 곳이 없다(법 제35·36조)
    expect(body, "문의 연락처가 비어 있다").toMatch(/CONTACT_EMAIL\s*=\s*"[^"]+@[^"]+"/);
  });

  // 🔴 2026-08-08 — 시행일을 채우면서 **양방향** 검사로 바꿨다.
  //    배너는 `{!EFFECTIVE_DATE && ...}` 라 시행일이 생기면 자동으로 사라진다.
  //    한 방향만 검사하면 반대 사고(시행일을 적어놓고 '준비 중'이라고도 하는 것)를 못 잡는다.
  it("시행일 유무와 '준비 중' 배너가 어긋나지 않는다", () => {
    const noDate = /EFFECTIVE_DATE\s*=\s*null/.test(stripComments(PRIVACY));
    render(<MemoryRouter><Privacy /></MemoryRouter>);
    if (noDate) {
      expect(screen.getByText(/준비 중인 방침입니다/),
        "시행일이 없는데 '준비 중'이라고 밝히지 않았다 — 시행 중인 방침처럼 보인다").toBeTruthy();
    } else {
      expect(screen.queryByText(/준비 중인 방침입니다/),
        "🔴 시행일을 적어놓고 '준비 중'이라고도 한다 — 어느 쪽이 참인지 부모가 알 수 없다").toBeNull();
    }
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
    // ⚠️ 문장의 끝맺음("마찬가지입니다" / "아래가 그대로 적용됩니다")은 서버 저장 on·off 로 갈린다.
    //    이 검사가 지키는 것은 어미가 아니라 **세 기기를 나란히 적었는가** 다. 거기까지만 못박는다.
    expect(screen.getByText(/아이폰이든 안드로이드든 PC든/)).toBeTruthy();
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
