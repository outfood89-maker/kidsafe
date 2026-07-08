# [작업지시서 AD-8b] 이어 그리기 — 대기 중 이탈 → 완성본 복귀 노출 (AD-8 후속)

*작성: 컨트롤 타워 2026-07-06 · 근거: 팀장 [B] 채택 회신 — "복귀 노출은 미룸이지 드롭 아님을 브리프 번호로 박제"(조건 3). AD-8 본구현(코어) 커밋 후 착수.*
*브랜치 격리·main 무접촉·7/14 전 머지 금지·키 env 전용 불변. AD-8 확정 설정(input_fidelity:high·quality:medium·size:auto) 승계.*

---

## §0. 위치 (AD-8 코어와의 경계)
- **AD-8 코어(선행 커밋)의 이탈 동작:** 대기 중 이탈 = **생성 중단(클라이언트 폐기)·쿼터 미소비·같은 날 재시도 가능.** 어중간한 미완성 상태 없음(깨끗한 중단). — 팀장 조건 2.
- **AD-8b(이 브리프)가 하는 일:** 그 '깨끗한 중단'을 **'이탈해도 생성은 계속 → 완성본을 잃지 않고 복귀 시 아이가 채택'** 으로 격상. 즉 이탈이 손실이 아니라 '나중에 받기'가 되게.
- ⚠️ **팀장이 못박은 위험(단독 검증 대상):** 이 기능의 핵심 = **생성 promise가 컴포넌트 언마운트 후에도 살아남아** 완성본을 저장하는 것. 이는 기존 유령 TTS 방어(`mountedRef`=언마운트 후 폐기) 패턴을 **부분적으로 뒤집는 동작 변경**이라, 반드시 이 커밋에서 **단독으로 검증**한다(그래서 코어와 분리).

## §1. 동작 설계

### 이탈 시 (대기 중 '‹ 그만하기' 등)
- 진행 중인 이어 그리기 생성 promise를 **컴포넌트 생명주기에서 분리**해 계속 진행(모듈/ref 보유 detached task). 완성 시:
  - 완성본 PNG → IDB 저장(`imageId`), 원본 낙서 → IDB(`drawingId`)도 보관.
  - `meta.pendingContinue = { date: todayKST(), drawingId, imageId, sentences, childPick, moodEmoji }` 기록(채택 시 entry 조립에 필요한 최소 재료만 — 위기 텍스트·transcript 등 금지, 저장 불변식 그대로).
- ⚠️ **화면·음성은 절대 갱신 금지:** 언마운트 후엔 `voice.enqueue`·`setState` 0. detached task는 **오직 IDB + meta 쓰기만**(유령 TTS·유령 렌더 0 — `mountedRef` 가드는 UI/음성에 그대로 유지, 저장 경로만 예외적으로 살림).
- 실패 시(§AD-8 §0-4 자동 재시도 1회 후에도 실패): pendingContinue 미기록 + 쿼터 미소비 → 조용히 종료(아이에게 실패 노출 없음, 같은 날 재시도 가능).

### 복귀 시 (책장/그림일기 홈 진입)
- `meta.pendingContinue`가 있고 `date === todayKST()`이면 **배너** 노출: `CONTINUE_RETURN.banner`("키디가 다 그렸어! 보러 갈래?").
- 배너 탭 → **선택 화면 재개**(AD-8 코어의 `CONTINUE_PICK.ask`: [내 그림] [키디랑 같이 그린 그림]) — pending 완성본으로 렌더.
  - 채택 → **이 때 쿼터 소비**(팀장 조건 1: 채택 시 소비) + entry 간직(선택에 따라 imageId만 / drawingId+imageId 둘 다, AD-8 코어 저장 규칙 동일) + `pendingContinue` clear.
  - 배너/선택 화면에서 '안 볼래'(닫기) → pendingContinue clear + orphan IDB(imageId·drawingId) 삭제 + 쿼터 미소비(재시도 가능).

### 만료·청소 (어중간 상태 금지 — 팀장 조건 2 계승)
- `pendingContinue.date !== todayKST()`(다음날 등) → **자동 무효화**: meta에서 제거 + orphan IDB 이미지·낙서 삭제. (배너 미노출)
- 청소는 책장/홈 진입 시 1회 점검으로 충분(별도 스케줄러 불필요).

## §2. 검증 (AD8b-V)
| # | 확인 |
|---|---|
| V1 | DOM: 대기 중 언마운트 → (detached 완성 모킹) → **voice.enqueue 증가 0·setState 경고 0**(유령 방어) 이면서 IDB+meta.pendingContinue 기록됨 |
| V2 | DOM: 복귀(책장 재마운트) → 배너 노출 → 탭 → 선택 화면 → 채택 → entry 저장(imageId/drawingId 규칙) + **쿼터 이때 소비** + pending clear |
| V3 | DOM: 배너 '안 볼래' → pending clear + orphan IDB 삭제 + 쿼터 미소비 |
| V4 | 노드/DOM: pendingContinue.date=어제 → 배너 미노출 + orphan 청소(만료) |
| V5 | 쿼터: 이탈만 하고 미채택 → 소비 0(같은 날 재시도 가능). 채택 시 1회 소비(regen 2회와 독립) |
| V6 | 찢기: 채택된 entry 찢기 → drawingId·imageId 모두 IDB 삭제(AD-8 코어 회귀 유지) |
| V7 | 기존 전체 PASS 유지 + build ✓ + 키 grep 0 |

## §3. 카피 (팀장 스탬프 verbatim — 2026-07-06)
| 상수 | 값 |
|---|---|
| `CONTINUE_RETURN.banner` | `키디가 다 그렸어! 보러 갈래?` |

이 표 외 신규 아동 노출 문구 0. 선택 화면·채택 카피는 AD-8 코어(`CONTINUE_PICK`·`CONTINUE_DONE`) 재사용.

## §3b. 겸사 — '내 그림' 채택 엔트리엔 AI 다시그리기 미제안 (MINOR, 팀장 승인 7/6)
- 현행 결함(AD-8 코어): 책장에서 '이어 그리기 채택' 중 **'내 그림'(mine)·failadopt**로 담은 엔트리(imageId=아이 낙서, drawingId 없음)에 AI '다시 그리기(regen)' 버튼이 뜸 → 아이가 고른 raw 낙서를 AI 그림으로 덮어쓸 수 있음.
- 원칙(팀장): **아이가 '내 그림'을 최종 선택한 엔트리는 AI가 다시 덮어쓰기를 제안하지 않는다** — 최종 선택권 원칙의 연장(선택 존중).
- 구현: 엔트리에 구분 플래그(예: `imgSource: "ai" | "continue" | "mine"`)를 저장 → FamilyShelf regen 게이트를 `imgSource === "ai"`일 때만 노출(현행 `!drawingId`는 both만 막아 mine/failadopt가 새는 문제 해소). 저장 불변식(선택 필드)·직렬화 유지.
- 검증: mine/failadopt 채택 엔트리 상세에 regen 버튼 미노출(DOM) / AI 생성 엔트리는 기존대로 노출 / both도 미노출(현행 유지).

## §4. 보고
커밋 해시(`[브랜치 전용]`) + V1~V7 + '언마운트 후 promise 생존'이 유령 TTS/렌더를 유발하지 않음을 V1로 단독 입증 + 키 유출 grep 0. 컨트롤타워 리뷰→정순서.
