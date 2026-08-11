// 🔴 서버 오류를 화면에 그릴 때 — `detail` 은 문자열일 때도 **객체**일 때도 있다 (2026-08-11)
//
//   FastAPI 의 HTTPException detail 은 두 모양이다:
//     · 대부분:                  detail="프로필을 찾을 수 없어요"          → 문자열
//     · 🔴 quota.py 429 / diary.py 507: detail={"code":…, "message":…}   → **객체**
//
//   호출부가 `err.response?.data?.detail || "기본문구"` 로 받아 그대로 JSX 에 넣으면,
//   객체일 때 React 가 "Objects are not valid as a React child" 로 **throw** 한다.
//   그리고 이 레포에는 **ErrorBoundary 가 0건**이라 루트까지 올라가 **화면 전체가 하얘진다.**
//
//   실제 사고(🔬 정밀검수 발견): 부모가 AI 코치를 하루 세 번째로 누르면 429 →
//   ParentDashboard 가 백지. KiddyRoom·ChatWidget 은 `.detail?.message` 로
//   한 단계 더 들어가 무사했다 — **거기만 빠져 있었다.**
//
//   [A] 🔴 대조군 — React 는 객체를 자식으로 받으면 정말 던지는가 (전제부터 실물로)
//   [B] readErrorText 가 두 모양을 모두 문자열로 바꾸는가
//   [C] 🔴 화면에 그리는 자리가 전부 헬퍼를 거치는가 (소스 전수 — 다음에 또 안 나게)
//   [D] ErrorBoundary 가 없다는 전제가 아직 사실인가
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readErrorText } from "../utils/api";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(resolve(SRC, p), "utf8");

/** src 아래 .js/.jsx 전수 (테스트 제외). */
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name !== "__tests__") walk(p, out);
    } else if (/\.jsx?$/.test(name)) out.push(p);
  }
  return out;
}

const QUOTA_DETAIL = {
  code: "QUOTA_EXCEEDED", kind: "report_coach", scope: "day",
  limit: 2, used: 2, message: "AI 코치는 하루 한 번 새로 분석해요.",
};
const err = (detail) => ({ response: { status: 429, data: { detail } } });

describe("[A] 🔴 대조군 — 전제가 실제로 참인가", () => {
  it("React 는 객체를 자식으로 받으면 던진다 (이게 사실이 아니면 이 검사 전체가 무의미)", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<p>{QUOTA_DETAIL}</p>)).toThrow();
    spy.mockRestore();
  });

  it("문자열은 정상 렌더된다 (조이는 쪽 오작동이 없다)", () => {
    const { container } = render(<p>{"평범한 오류 문구"}</p>);
    expect(container.textContent).toBe("평범한 오류 문구");
  });
});

describe("[B] readErrorText — 두 모양을 모두 문자열로", () => {
  it("객체면 message 를 꺼낸다", () => {
    expect(readErrorText(err(QUOTA_DETAIL), "기본")).toBe(QUOTA_DETAIL.message);
  });

  it("문자열이면 그대로 (기존 동작 보존)", () => {
    expect(readErrorText(err("프로필을 찾을 수 없어요"), "기본")).toBe("프로필을 찾을 수 없어요");
  });

  it("🔴 message 가 없는 객체면 기본 문구로 — 절대 객체를 돌려주지 않는다", () => {
    expect(readErrorText(err({ code: "X" }), "기본")).toBe("기본");
    expect(readErrorText(err({ message: "   " }), "기본")).toBe("기본");
  });

  it("detail 이 없거나 응답 자체가 없어도 죽지 않는다", () => {
    expect(readErrorText(err(undefined), "기본")).toBe("기본");
    expect(readErrorText(new Error("network"), "기본")).toBe("기본");
    expect(readErrorText(undefined, "기본")).toBe("기본");
  });

  it("🔴 반환은 **항상 문자열**이다 (이 한 줄이 흰 화면을 막는다)", () => {
    for (const d of [QUOTA_DETAIL, "문자열", { code: "X" }, null, undefined, 42, ["a"]]) {
      expect(typeof readErrorText(err(d), "기본")).toBe("string");
    }
  });
});

describe("[C] 🔴 화면에 그리는 자리가 전부 헬퍼를 거치는가 (소스 전수)", () => {
  // 객체를 **객체로 쓰는** 곳은 예외다 — 이유를 함께 적는다(이유 없는 면제는 구멍).
  const EXEMPT = {
    "utils/api.js": "헬퍼 자신 + readStorageFull(507 객체를 객체로 쓴다)",
    "components/DiaryFlow.jsx": "detail.scope 로 day/minute 를 가른다 — 화면에 그리지 않는다",
    "components/VideoModal.jsx": "detail.limit(숫자)를 페이월 표시에 쓴다 — detail 자체를 그리지 않는다",
    "components/ChatWidget.jsx": "detail?.message 로 한 단계 더 들어간다 (이미 안전)",
    "pages/KiddyRoom.jsx": "detail?.message 로 한 단계 더 들어간다 (이미 안전)",
  };

  const files = walk(SRC);
  const offenders = [];
  for (const p of files) {
    const rel = p.slice(SRC.length + 1);
    if (EXEMPT[rel]) continue;
    const src = readFileSync(p, "utf8");
    // `data?.detail` / `data.detail` 뒤에 `.message` 나 `.scope` 같은 접근이 **안 붙은** 것
    for (const m of src.matchAll(/data\??\.detail(?!\s*[.?[])/g)) {
      offenders.push(`${rel} :: ${src.slice(Math.max(0, m.index - 40), m.index + 40).replace(/\n/g, " ")}`);
    }
  }

  it("🔴 대조군 — 파서가 헛돌지 않았다 (파일을 실제로 훑었다)", () => {
    // "0건이라 통과"를 막는다 (WORKLOG 지뢰 #13: `"X" not in ""` 은 항상 참)
    expect(files.length).toBeGreaterThan(50);
    expect(Object.keys(EXEMPT).every((f) => files.some((p) => p.endsWith(f)))).toBe(true);
  });

  it("detail 을 **그대로** 쓰는 곳이 없다 — 전부 readErrorText 를 거친다", () => {
    expect(offenders, `헬퍼를 안 거친 자리:\n${offenders.join("\n")}`).toEqual([]);
  });
});

describe("[D] 이 검사가 딛고 선 전제", () => {
  it("🔴 ErrorBoundary 가 여전히 0건이다 — 있으면 흰 화면 대신 폴백이 뜬다(전제가 바뀐다)", () => {
    // 🔴 **코드 형태**로만 찾는다. 처음엔 `ErrorBoundary` 라는 **단어**를 찾았는데,
    //    바로 이 사고를 설명하려고 내가 쓴 **주석**이 걸렸다(ParentDashboard.jsx·api.js).
    //    ⇒ 검사가 자기 문서를 잡았다. 문서를 파싱하는 검사는 늘 이 함정이 있다.
    const hits = walk(SRC).filter((p) =>
      /componentDidCatch\s*\(|getDerivedStateFromError\s*\(|<ErrorBoundary[\s/>]/.test(readFileSync(p, "utf8")));
    // 🔴 생기면 이 검사를 지우는 게 아니라 **이 줄을 고치고 위 [C] 는 유지**한다.
    //    폴백이 있어도 대시보드가 통째로 사라지는 건 마찬가지다.
    expect(hits.map((p) => p.slice(SRC.length + 1))).toEqual([]);
  });

  it("서버가 실제로 객체 detail 을 낸다 (quota.py) — 없으면 이 검사가 무의미하다", () => {
    const quota = readFileSync(resolve(SRC, "../../server/quota.py"), "utf8");
    expect(quota).toContain('"code": "QUOTA_EXCEEDED"');
    expect(quota).toContain('"message"');
  });

  it("ParentDashboard 가 헬퍼를 실제로 import 한다", () => {
    expect(read("pages/ParentDashboard.jsx")).toContain("readErrorText");
  });
});
