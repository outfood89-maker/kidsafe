# 📋 작업일지 (WORKLOG)

> **목적:** 세션이 바뀌어도(새 채팅방·다른 기기) 끊김 없이 이어가기 위한 **진행상황 공유 문서**.
> **작성 규칙**
> 1. 작업이 끝날 때마다 아래 **`세션 로그`** 맨 위에 새 항목을 추가한다 (최신이 위).
> 2. 상단 **`30초 요약`·`지뢰 목록`** 은 항상 최신 상태로 **덮어쓴다** (누적 X).
> 3. **사실만 적는다.** 추측·희망사항은 "미검증"이라고 명시.
> 4. 커밋 SHA·파일 경로를 반드시 남긴다 (나중에 추적 가능하게).

---

## 🎯 30초 요약 (2026-08-01 기준)

- **개발 환경**: 맥(Apple Silicon) 신규 세팅 **완료**. 바로 실행 가능한 상태.
- **작업 폴더**: `~/Desktop/kidsafe` ← **앞으로 여기서만 작업**
- **git**: `master` = `4ef5bd1` — ⚠️ **`prompts/` 관련 미커밋 변경 있음** (아래 세션 로그 참조)
- **협업 체제**: 4인(팀장·컨트롤타워·작업자) 프롬프트 3종을 **`prompts/`** 로 정리 완료 → `prompts/README.md`
- **무게중심**: 정체성 전환 **P0** — F0 관심사 씨앗 / F1 키디 환영+체크인 / F2 부모 리포트
- **진행 중인 구현 작업**: 없음 (환경 세팅·문서 정비만 했음)

---

## 🖥 개발 환경

| 항목 | 값 |
|---|---|
| 작업 폴더 | `~/Desktop/kidsafe` |
| Node.js | v24.18.1 (Vite 7 요구: `^20.19.0 \|\| >=22.12.0`) |
| Python | 3.12.8 (`server/venv`) |
| git 계정 | `Freddie <kimkimbap@naver.com>` |
| GitHub 인증 | SSH 키 (`~/.ssh/id_ed25519`), 키체인 연동 — **비밀번호 입력 불필요** |
| 원격 | `git@github.com:outfood89-maker/kidsafe.git` |

### 실행 (터미널 2개)

```bash
# 터미널 1 — 백엔드 (⚠️ 포트 3000 고정)
cd ~/Desktop/kidsafe/server && source venv/bin/activate
uvicorn main:app --reload --port 3000

# 터미널 2 — 프론트
cd ~/Desktop/kidsafe/client && npm run dev     # → http://localhost:5173
```

```bash
# 테스트 (package.json에 test 스크립트 없음 → npx 직접 실행)
cd ~/Desktop/kidsafe/client && npx vitest run
```

```bash
# 커밋·푸시 (Freddie 방식)
git add .
git commit -m "feat: 작업 내용"
git push origin master
```

---

## 🚦 다음 할 일

**출처:** `UPDATE_1/KidSafe_ClaudeCode_작업지시서.md` (TASK 순서 그대로)

| 순서 | 작업 | 상태 |
|---|---|---|
| **F0** | 관심사 씨앗 (`InterestSeed`) | 구현 진행 중 — 현황 재확인 필요 |
| **F1** | 키디 환영 + 체크인 (`DailyCheckin`) | 구현 진행 중 — 현황 재확인 필요 |
| **F2** | 부모 리포트 (`KiddyReportCard`) | 구현 진행 중 — 현황 재확인 필요 |
| F3 | 리터러시 한 스푼 | **작게** 유지. 7세+ 자유 대화는 '다음' 단계 |

> ⚠️ F0~F2는 `CLAUDE.md`에 "구현 진행 중"으로만 적혀 있고 **어디까지 됐는지 확정 기록이 없다.**
> 다음 세션 첫 작업 = **각 컴포넌트 실제 코드를 읽고 완료 여부를 이 표에 확정**할 것.

**데모의 심장:** 키디가 묻는다 → 아이가 답한다 → 부모가 리포트를 열고 뭉클해진다.
모든 설계는 이 순간으로 수렴한다.

---

## ⚠️ 지뢰 목록 (커밋·배포 전 반드시 확인)

| # | 위치 | 확인할 것 |
|---|---|---|
| 1 | `client/src/pages/KidHome.jsx:38` | `CHECKIN_TEST_PROFILE` 이 **`""`** 인가? 테스트로 이름을 넣었으면 **되돌리고 커밋**할 것 |
| 2 | `client/.env` | 모바일 테스트하려고 `VITE_API_URL`에 로컬 IP를 넣었다면 **배포 전 제거** |
| 3 | 옛 백업 폴더 | `~/Desktop/백업자료/.../Kiddy_전체백업_2026-07-23/kidsafe` 는 **git 저장소가 아니고**, `CHECKIN_TEST_PROFILE = "해인"` 이 켜진 채로 남아있다. **여기서 코드를 가져다 쓰지 말 것** |
| 4 | YouTube API | 과호출 시 429 → 서버가 500 반환. 쿼터 초기화는 **매일 오후 4시(KST)**. 프론트 안내 문구 **미구현** |

---

## 📜 세션 로그

### 2026-08-01 (2) — 역할 프롬프트 3종 복구·정리 (`prompts/`) + Claude Code 다중 창 세팅

**배경:** 맥에서 Claude Code 창을 여러 개 띄워 4인 체제로 일하려 했으나, 역할 프롬프트가 어디 있는지 불명확했음.

**한 일**

1. **`claude` CLI PATH 연결** — `~/.local/bin/claude`(v2.1.220)가 설치돼 있었으나 PATH에 없어 터미널에서 실행 불가였음 → `~/.zshrc` 신규 생성해 `export PATH="$HOME/.local/bin:$PATH"` 추가. 검증: 로그인 셸에서 `which claude` OK.
2. **IDE 안에서 창 여러 개 = `Claude Code: Open in New Tab`** (단축키 `Cmd + Shift + Esc`). 확장 `package.json` 확인해 확정. `Open in New Window` · `Create Worktree` 명령도 존재.
3. **역할 프롬프트 3종 전수조사 → `prompts/` 로 통합**

   | 역할 | 원래 위치 | 새 위치 |
   |---|---|---|
   | 팀장 | ⚠️ **git에 없었음.** 백업 폴더에만 (`백업자료/…/Kiddy_전체백업_2026-07-23/스크린샷/`) | `prompts/1_팀장_시스템프롬프트.md` |
   | 컨트롤타워 | 루트 `control-tower-role.md` | `prompts/2_컨트롤타워_시스템프롬프트.md` |
   | 작업자 | `kiddy_voice/Kiddy_작업자_시스템프롬프트_for_Opus.md` | `prompts/3_작업자_시스템프롬프트.md` |

   - 이동은 `git mv` (이력 보존). 백업본과 현재본은 **내용 동일**함을 diff로 확인.
   - `prompts/README.md` 신설 — 4인 구조도·일 흐름·창 여는 법.
4. **구조 불일치 해소** — 팀장 문서는 4인(팀장≠컨트롤타워), 작업자 문서는 3인(`팀장+컨트롤타워 겸임`)으로 **서로 다르게** 적혀 있었음. 오너 결정으로 **4인 확정** → 작업자·컨트롤타워 문서의 체인 설명을 4인으로 통일.
5. **팀장 문서의 죽은 참조 정리** — 윈도우 경로(`C:\Users\Donga\…`)를 레포 상대경로로 교체. '필독 문서' 7개 중 5개가 실재하지 않음을 확인(한글 파일명 NFC/NFD 정규화까지 감안해 재검증) → 현재 존재하는 문서 7개로 목록 교체 + '유실된 옛 참조' 섹션으로 명시.
6. **작업자 문서 사실 정정** — `KidHome.jsx:34` → 실제 `client/src/pages/KidHome.jsx:38`, 값도 현재 `""`임을 반영.
7. **깨진 링크 수정** — `kiddy_voice/ARCHIVE-dev-process.md:25`의 `../control-tower-role.md` → 새 경로.
8. **`CLAUDE.md`에 협업 체제 섹션 신설** — `prompts/` 존재를 하네스에 박아 다음 세션이 또 헤매지 않게.

**커밋:** 아직 없음 — **미커밋 상태**. 다음 세션 시작 시 `git status` 확인할 것.

**알게 된 것**

- **팀장 프롬프트가 git에 없어 유실 직전이었다.** 백업 폴더가 없었으면 사라졌음. → 역할 문서는 반드시 레포에 커밋한다.
- 루트 `control-tower-role copy.md`는 원본과 **100% 동일한 중복**. 오너 판단으로 **삭제하지 않고 그대로 둠**.
- 백업 `kiddy_voice/`에는 현재 레포에 없는 브리프 **24개**(`HANDOFF-2026-07-08`, `TUTORIAL-01~09`, `REPORT-코드위생감사` 등)가 더 있음. 가져올지 미정.
- 팀장 문서가 참조하던 옛 기획 문서 5종은 **역할을 다하고 종료돼 커밋되지 않은 것**(오너 확인). 찾지 말 것.

**남은 것 / 판단 필요**

- ⚠️ **작업자 문서의 브랜치 규정이 낡음** — `prompts/3_작업자_시스템프롬프트.md`의 "feature/diary-v0 브랜치 전용, 7/14 전 main 머지 금지"와 커밋 푸터 `Co-Authored-By: Claude Opus 4.8`. 현재 브랜치는 `master`이고 diary-v0는 이미 머지됨(`a401a89`). **프로젝트 결정 사항이라 임의로 안 고침 — 오너 판단 필요.**
- 백업 전용 브리프 24개를 레포로 가져올지 결정

---

### 2026-08-01 — 맥 개발 환경 신규 세팅 + README 갱신 + 저장소 정리

**배경:** Freddie가 맥에서 이 프로젝트를 처음 열었음. 개발 도구가 하나도 없는 상태에서 시작.

**한 일**

1. **개발 환경 구축**
   - Node.js v24.18.1 · Python 3.12.8 설치 (Homebrew 없이 공식 `.pkg` 설치 — Windows 방식과 동일하게)
   - `client` npm 패키지 319개, `server` venv + requirements 35개 설치
   - 검증: 백엔드 `/docs` 200 OK · 라우터 24개 로드 · `vitest` 통과

2. **의존성 전수 조사 → 추가 설치 필요 없음을 확인**
   - OpenAI(그림일기)·CLOVA(음성)·Supabase 모두 **전용 SDK 없이 `httpx`로 직접 호출** → `requirements.txt`가 전부
   - `scripts/*.mjs` 6개는 Node 내장 모듈만 사용 → npm install 불필요

3. **`README.md` 전면 재작성** — 실제 코드 기준으로 정정
   - 백엔드 Express → **FastAPI(venv, 포트 3000)**
   - Supabase·OpenAI 이미지·CLOVA 음성·Vitest를 기술 스택에 반영
   - **Tier 0~2 검수 아키텍처** 섹션 신설
   - 미니게임 보너스를 현행 규칙(**한 판 완료 +3분**, 하루 최대 20분)으로 정정 — 옛 README의 "8개 이상 정답 시" 표는 폐기된 규칙이었음
   - 환경변수 전체 목록(필수/선택) · 모바일 테스트 절차 · 참고 문서 인덱스 추가

4. **유령 파일 3개 정리**
   - 루트 `package.json` · `package-lock.json` — 어디서도 참조되지 않음(Vercel 루트는 `client/`). 삭제
   - `server/{` — 오타로 생긴 0바이트 파일. 삭제

5. **`server/routers/schedules.py:30`** 주석의 모델명 `claude-sonnet-4-6` → `claude-sonnet-5`

6. **git 환경 구축**
   - 이 프로젝트에는 **git 저장소가 아예 없었음**(백업 폴더였기 때문) → `~/Desktop/kidsafe`에 새로 clone
   - `.env` 2개 복사 + gitignore 처리 확인 (**키 유출 없음**)
   - SSH 키 생성 → GitHub 등록 → push 성공

**커밋:** `8316177` `docs: README 전면 갱신 + 미사용 파일 정리` (195줄 추가 / 483줄 삭제)

**알게 된 것 (중요)**

- **옛 백업 폴더와 GitHub는 사실상 동일했다.** 처음엔 파일 199개가 다른 것처럼 보였지만, 대부분 **CRLF 줄바꿈**(백업이 Windows산)과 **한글 파일명 유니코드 정규화(NFC/NFD)** 차이였음. 줄바꿈 무시하고 비교하니 **실제로 다른 파일은 2개뿐**.
  → 교훈: 맥↔윈도우 폴더 비교 시 `diff`를 그대로 믿지 말고 **CR 제거 후 비교**할 것.
- 그 2개 중 하나가 `KidHome.jsx`의 **`CHECKIN_TEST_PROFILE = "해인"`** (테스트 플래그 켜짐). GitHub은 이미 `""`이라 **커밋에 포함시키지 않았음.**

**남은 것 / 다음 세션에 할 것**

- F0~F2 실제 구현 현황 파악 후 위 '다음 할 일' 표 확정
- `CONTEXT.md` 마지막 업데이트가 **2026-06-23**이라 낡음 — 갱신 여부 판단 필요
- YouTube 429 프론트 안내 문구 미구현 (지뢰 #4)

---

<!-- 새 세션 기록은 이 줄 바로 위에 추가하세요 -->
