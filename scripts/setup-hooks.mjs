/**
 * pre-commit 훅 자동 활성화 — GD-S0 S8 (2026-08-05)
 *
 * 왜 있나:
 *   훅은 `.git/hooks` 안에 살기 때문에 **git 으로 전파되지 않는다.**
 *   그래서 새 기기에서는 훅이 없는 채로 커밋이 그냥 된다 — 아무 경고도 없이.
 *   CLAUDE.md 에 "설치하세요"라고 적어두는 건 '규칙'이지 '장치'가 아니다(사람이 기억해야 함).
 *
 *   → client 에서 `npm install` 을 하면 postinstall 로 이 파일이 돌아 훅이 자동 활성화된다.
 *     새 기기 세팅은 반드시 npm install 을 거치므로, 잊을 수가 없다.
 *
 * 안전장치:
 *   - git 저장소가 아니거나 git 이 없어도 **절대 설치를 실패시키지 않는다**(조용히 넘어감).
 *   - 이미 설정돼 있으면 아무 일도 하지 않는다.
 *   - Windows(Git Bash) 에서도 동작한다. 훅 본문은 sh 스크립트이고 Git for Windows 가 sh 를 제공한다.
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = dirname(dirname(fileURLToPath(import.meta.url))); // scripts/ 의 상위 = 레포 루트
const HOOKS_DIR = "scripts/hooks";

const git = (...args) =>
  execFileSync("git", args, { cwd: REPO, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();

try {
  git("rev-parse", "--is-inside-work-tree");

  if (!existsSync(join(REPO, HOOKS_DIR, "pre-commit"))) {
    console.log("ℹ️  pre-commit 훅 파일이 없어 활성화를 건너뜁니다.");
    process.exit(0);
  }

  let current = "";
  try {
    current = git("config", "core.hooksPath");
  } catch {
    /* 미설정 — 정상 */
  }

  if (current === HOOKS_DIR) {
    console.log("✅ pre-commit 훅 이미 활성화됨");
  } else {
    git("config", "core.hooksPath", HOOKS_DIR);
    console.log(`✅ pre-commit 훅 활성화 (core.hooksPath = ${HOOKS_DIR})`);
    console.log("   커밋 시 바뀐 영역만 검사합니다 — 문서만 고쳤으면 그냥 통과.");
  }
} catch {
  // git 저장소가 아니거나 git 이 없다 → 설치를 막지 않는다
  console.log("ℹ️  git 저장소가 아니라 훅 활성화를 건너뜁니다.");
}
