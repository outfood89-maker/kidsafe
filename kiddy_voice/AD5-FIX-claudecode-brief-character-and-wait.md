# [작업지시서 AD-5 시정] 인물=한국 아이·검은 머리·성별 + (a) 대기연출 3단 (전 생성 공통)

*작성: 컨트롤 타워 2026-07-06 · 근거: 팀장 AD-5 시정 회신(오너 지시) + (a) 대기연출 채택 확정 + 프롬프트 보강 2건 승인 · PoC 검증 완료(scratch/poc-char-med 10장 — 검은머리·한국아이·성별 정확, 오너 육안 통과)*
*브랜치 격리·main 무접촉·7/14 전 머지 금지·키 env 전용 불변. 서버 프롬프트 변경(behavior)은 별도 커밋 권장.*

---

## §0. 배경 (실측으로 확정된 사실)
- 현행 프롬프트에 **인물 외형 규정이 없어** 생성 모델 기본값(서구권·갈색/금발)이 나옴 → 일기 주인공은 그 아이 자신(한국 아이)이어야 함.
- **프로필에 성별 필드가 이미 존재** — `ProfileFormModal.jsx`(남자/여자, 필수), `profiles.py`(DB `gender` 컬럼). **∴ 새 필드·새 DB 컬럼 만들지 말 것.** 기존 `gender`를 이미지 생성 호출로 흘리기만 하면 된다.
- **'선택 안 함(중성)' 옵션은 이번에 만들지 않는다** (팀장 원안 철회 — 기존 필수 필드 계약 변경 회피, 고도화 백로그). 단 서버는 gender가 비거나 예상 밖 값이면 **중성으로 방어**(성별 추정 금지).
- (a) 대기연출은 **전 생성 공통 채택** — 일반 그림 생성 대기 화면도 3단 순차 멘트 + 키디 그리기 연출로.

## §1. 서버 — `server/routers/diary_image.py`

### ①-a 캐릭터 블록 신설 (성별 반영, 미설정=중성)
`GenerateRequest`에 필드 추가 (프론트가 null 보낼 수 있으니 Optional):
```python
class GenerateRequest(BaseModel):
    sentences: List[str] = []
    childPick: Optional[str] = ""
    moodEmoji: Optional[str] = ""
    weatherKey: Optional[str] = ""
    profileGender: Optional[str] = ""   # 기존 프로필 gender("남자"/"여자"). 그 외/빈값 → 중성
```
캐릭터 블록 빌더(코드가 성별을 결정 — "사실은 코드가" 계보, LLM에 추정 맡기지 말 것):
```python
def _character_block(gender: str) -> str:
    g = (gender or "").strip()
    if g in ("남자", "male", "boy"):
        main = "a Korean boy"
    elif g in ("여자", "female", "girl"):
        main = "a Korean girl"
    else:
        main = "a young Korean child"   # 미설정/예상밖 → 중성(성별 추정 금지)
    return (
        f"All people in the picture are Korean with black hair. The main character is {main} with black hair. "
        "Any family members or friends (mother, father, friends) are also Korean with black hair. "
        "This specifies HOW to draw the people — it does NOT add any new people beyond the diary."
    )
```

### ①-b SYSTEM_PROMPT에 캐릭터 블록 삽입 + SCENE_RULES 보강 2건
`SYSTEM_PROMPT`는 현재 고정 문자열. **성별별로 달라지므로 `_to_image_prompt` 안에서 요청 gender로 조립**하도록 바꿀 것(전역 상수 → 빌더 함수). 스타일 블록 **바로 뒤**에 캐릭터 블록을 넣는다:
```
[고정 스타일 블록 …] STYLE_BLOCK
[캐릭터 블록 — 스타일 블록 바로 뒤에 반드시 그대로 포함] _character_block(gender)
… SCENE_RULES …
[안전 제약 …] SAFETY_BLOCK
```
SCENE_RULES 두 줄 보강(팀장 승인):
- 미끄럼틀 등 놀이기구: **"a slide = 경사진 미끄럼판(sloped sliding surface)이 반드시 보이게. 사다리만 그리지 말 것."** (사다리-only 방지)
- 기분→표정: 기존 "😢인 날은 차분한 톤"에 더해 **"기분이 속상/슬픈 날(😢😡)은 표정도 그에 맞게(처진 눈·입). 과한 웃음 금지 — 슬픈 날 억지 웃음도 왜곡이다."** (팀장 문구 조건 verbatim 취지)

### ①-c 폴백도 캐릭터 블록 포함
`_fallback_prompt`도 gender를 받아 `_character_block(gender)`를 STYLE 뒤에 끼우고, "a young Korean child with black hair …"로. `_to_image_prompt`/`generate`가 `req.profileGender`를 폴백까지 전달.

> ⚠️ 인증(`get_current_user`)·실패 시 `{ok:false}`(500 금지)·키 env전용·로그는 `type(e).__name__`만 — 전부 현행 유지.

## §2. 프론트 — 기존 gender를 이미지 호출로 연결 (2곳)
- [DiaryFlow.jsx:192](client/src/components/DiaryFlow.jsx#L192) `generateDiaryImage({ … })` 에 `profileGender: profile?.gender` 추가.
- [FamilyShelf.jsx:157](client/src/pages/FamilyShelf.jsx#L157) `generateDiaryImage({ … })` 에 `profileGender: profile?.gender` 추가.
- `profile`은 두 곳 다 `selectedProfile`(생성 시 gender 포함)에서 오므로 값 존재. 없으면 서버가 중성 방어(§1-a).
- **UI·프로필 폼·DB 무변경.** (새 필드/컬럼 만들지 말 것 — 이미 있음)

## §3. (a) 대기연출 — 일반 생성 3단 순차 (전 생성 공통)
현재 [DiaryFlow.jsx:188-190](client/src/components/DiaryFlow.jsx#L188-L190)는 `IMG_WAIT` 한 줄만 표시. 이를 **3단 순차 멘트 + 키디 그리기 연출**로 교체:

- 새 상태 `waitStage`(0..2). `imgState==="wait"` 진입 시 `waitStage=0`, 타이머로 **약 5초마다 +1, 마지막 단(2)에서 정지(clamp)**. `done`/`fail`/언마운트 시 타이머 정리(mountedRef 패턴 + cleanup — X-2 유령 TTS 교훈 준수).
- 표시 문구 = `WAIT_SEQ[waitStage]`(§5 카피). 단이 바뀔 때마다 `voice.enqueue(WAIT_SEQ[i], "bright")`(기존 IMG_WAIT enqueue 대체).
- 대기 화면 렌더([DiaryFlow.jsx:364](client/src/components/DiaryFlow.jsx#L364)의 `imgState==="wait" ? IMG_WAIT : …`)도 `WAIT_SEQ[waitStage]`로.
- **키디 그리기 연출**: 대기 중 키디에 그리기 느낌 애니(전용 그리기 포즈 자산이 없으면 기존 `float`/살짝 흔들 애니로 충분 — 카피가 핵심). ※로딩 키디 투명영상([[project_kiddy_loading_videos]])이 준비되면 그때 교체(지금은 의존 금지).
- 생성이 빨리 끝나면(13~17s) 마지막 단에서 자연히 `done`으로 전환 — 문제없음.
- 기존 `IMG_WAIT` 상수는 폴백/플레이스홀더용으로 존치(삭제 금지).

## §4. 검증 (AD5FIX-V)
| # | 확인 |
|---|---|
| V1 | 서버: `profileGender="남자"/"여자"/""/null` 각각 → 프롬프트에 boy/girl/neutral 캐릭터 블록 포함(단위 or 수동). 인증 필수·500 금지 유지 |
| V2 | 프론트 2곳 호출에 profileGender 실림(코드 확인). UI·폼·DB diff 0 |
| V3 | DOM: 대기 진입 → WAIT_SEQ[0]("크레용 골랐어") 표시 → 타이머 진행 시 [1]→[2] 전환(가짜 타이머), done 시 IMG_DONE. 언마운트 시 타이머 정리(유령 TTS 0) |
| V4 | 기존 전체 PASS 유지(노드+DOM) + build ✓ |
| V5 | (PoC 재현·오너 육안은 완료 — scratch/poc-char-med. 실기기 캡처는 머지 시점 패킷) |

## §5. 카피 (팀장 스탬프 verbatim)
| 상수 | 값 |
|---|---|
| `WAIT_SEQ` (일반 3단) | `["키디가 크레용을 골랐어! 🖍", "쓱쓱… 열심히 그리는 중이야", "거의 다 됐어!"]` |

- 이 표 외 신규 아동 노출 문구 0. 기존 `IMG_WAIT`·`IMG_DONE`·`IMG_FAIL`·`REGEN`·`REGEN_OUT` 불변(존치).
- AD-8 이어그리기 전용 **4단** 대기연출은 별도 브리프(AD-8 본구현)에서 `WAIT_SEQ`를 첫 단 추가해 확장.

## §6. 보고
커밋 해시(`[브랜치 전용]`, 서버 프롬프트 변경은 별도 커밋 권장) + V1~V4 + KidHome 접촉 시 해인 절차(이번 변경은 KidHome 무접촉 예상 → 불요) + 키 유출 grep 0(`git diff --staged | grep -ci "sk-"` = 0). 완료 시 컨트롤타워 리뷰→정순서.
