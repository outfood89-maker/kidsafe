# [Claude Code 작업 지시서] N — P0 2차: 배지 시스템 개편 (결정 D)

> **왜:** 현 배지의 다수가 **시청량·시청빈도를 보상** — "키디는 '더 보게 하는 장치'가 아닙니다"라는 데모 선언·서사와 정면 모순. 심사위원이 배지 화면 한 번 열면 끝나는 문제.
> **원칙:** ① 시청량·빈도 보상 전부 제거 ② 건강한 균형(마음 안부·약속·탐험)에만 보상 ③ **공유(share=true)에는 절대 보상하지 않는다**(비밀 포기 유도 구조 금지 — 팀장 불가침 원칙).
> **삭제 금지 규칙:** 정의 제거는 **주석처리로 비활성화**(복구 가능하게). — CLAUDE.md
> **막히면 임의로 우회하지 말고 멈추고 보고.**

---

## 0. 확정 사실 (코드 검증됨)

- **배지 정의(서버):** [badges.py `get_badge_definitions`](../server/routers/badges.py#L56) — 21종, `check` 람다가 history/favorites/searches/earned만 받음.
- **판정 데이터:** [`check_badges`](../server/routers/badges.py#L294)가 history·favorites·searches·earned 4테이블만 조회. → **체크인 기반 배지를 만들려면 `daily_checkins` 조회 추가 필요.**
- **⚠️ 프론트 카탈로그 중복 정의:** [BadgeCollection.jsx:34](../client/src/pages/BadgeCollection.jsx#L34) 근처에 배지 목록이 **하드코딩으로 또 있음**(이미 "Kiddy 마스터"처럼 서버와 어긋난 전례). 서버만 고치면 화면과 불일치 → **양쪽 동시 수정 필수.**
- **[ProfileSelect.jsx:16](../client/src/pages/ProfileSelect.jsx#L16)** `kidsafe_master: 9` 매핑 존재 — 용도 확인 후 제거 배지가 이 매핑에 있으면 같이 정리.
- **트리거(프론트):** `checkBadges` 호출은 KidHome 3곳뿐 — 찜([:306](../client/src/pages/KidHome.jsx#L306))·검색([:469](../client/src/pages/KidHome.jsx#L469))·시청완료([:902](../client/src/pages/KidHome.jsx#L902)) 부근. → **체크인 완료·미니게임 클리어 트리거 없음(추가 필요).**
- 개근왕 연속일 판정 로직 [`_check_attendance_king`](../server/routers/badges.py#L251)은 날짜 리스트 기반 → **체크인 연속 판정에 재사용 가능.**

---

## 1. 처분표 (21종)

### 🔴 제거(주석처리) — 시청량·빈도 보상 6종
| id | 이름 | 사유 |
|---|---|---|
| `sprout_explorer` | 새싹 탐험가 | 영상 5개 = 시청량 |
| `watch_master` | 시청 대장 | 영상 20개 = 시청량 |
| `attendance_king` | 개근왕 | **7일 연속 시청** — 최악의 모순 (아래 '마음 개근왕'으로 교체) |
| `early_bird` | 얼리버드 | 시간대 시청 빈도 |
| `evening_explorer` | 저녁 탐험가 | 시간대 시청 빈도 |
| `channel_regular` | 단골손님 | 반복 시청 보상 |

### 🟢 유지 — 안전·교육·탐험·1회성 11종
`first_step`(1회성 온보딩), `safety_guard`, `brain_power`, `perfectionist`, `safety_expert`(안전·교육 계열), `curious_explorer`, `genre_pioneer`(탐험), `fairy_tale_lover`, `dino_expert`, `science_sprout`(장르 다양성), `kidsafe_master`(메타 — 이름 변경은 M에서 처리)

### 🟡 컨트롤 타워 판단 (근거 포함 — 이의 있으면 말해줘요)
| id | 이름 | 판정 | 근거 |
|---|---|---|---|
| `fav_collector` | 찜 수집가 (3개) | **유지** | 찜=큐레이션 행위, 시청량 아님. 소량이라 수집 부추김 약함 |
| `playlist_fan` | 재생목록 팬 (3개) | **유지** | 동일 |
| `fav_master` | 찜 마스터 (10개) | **제거** | '많이 모으기' 보상 — 수집량 부추김 |
| `all_star` | 올스타 (배지 10개) | **유지 + 임계 조정** | 개편 후 카탈로그 ~15종 — 10개 유지 가능하되 **8개로 하향 권장**(달성 가능성) |

---

## 2. 신설 배지

### 2-A. 마음 개근왕 (필수 — 데이터 이미 있음)
```python
{
    "id": "heart_attendance",
    "name": "마음 개근왕",
    "emoji": "💚",
    "description": "7일 연속으로 키디에게 마음을 들려줬어요!",
    # 판정: daily_checkins 의 checkin_date 7일 연속 (기존 _check_attendance_king 날짜 로직 재사용)
}
```
- `check_badges`에서 `daily_checkins`의 `checkin_date` 목록을 조회해 클로저 주입 (favorites/searches와 같은 패턴).
- 🚨 **판정에 `share_with_parent`·`mood`·answers를 절대 쓰지 마라** — "체크인을 했다"는 사실만. (공유 무보상 + 감정 종류에 상벌 없음)

### 2-B. 미니게임 배지 / 2-C. 약속 지킴이 (조사 후 — 데이터 없으면 보류·보고)
- **미니게임 클리어 기록이 DB에 있는지 먼저 조사.** 있으면 "미니게임 클리어 N회" 배지 신설 + 클리어 시점 `checkBadges` 트리거. **없으면 만들지 말고 보고**(plays 기록 신설은 별도 결정 — 스코프 크리프 방지).
- **약속 지킴이(시청 시간 약속 준수)** — 시청 제한 준수를 판정할 데이터가 있는지 조사. 애매하면 **보류·보고** (7/14 마감 우선).
- 이름은 가칭 — 확정 카피는 팀장 검수 예정이니 배지 '이름·설명' 최종 문구는 보고 시 목록으로 정리해줄 것.

---

## 3. 트리거 추가

- **체크인 완료 시 `checkBadges` 호출**: DailyCheckin 완료 콜백(`onComplete`)을 받는 KidHome 지점에 기존 3곳과 같은 패턴으로 추가 + 신규 배지 획득 팝업 재사용.
- ⚠️ 체크인 완료 = reward 화면 진입 기준(저장 성공 후). 공유 선택과 무관하게 동일 동작.
- 미니게임 트리거는 2-B가 성립할 때만.

---

## 4. 프론트 동기화 (잊으면 화면 어긋남)

1. [BadgeCollection.jsx](../client/src/pages/BadgeCollection.jsx) 하드코딩 카탈로그를 서버 최종 목록과 **1:1 동기화** (제거 6~7종 빼고, 마음 개근왕 추가, 이모지·설명 일치).
2. [ProfileSelect.jsx:16](../client/src/pages/ProfileSelect.jsx#L16) 매핑의 용도 파악 → 제거 배지 참조가 있으면 정리.
3. 획득 팝업/컬렉션 화면에서 제거 배지가 어떻게 보이는지 확인 (아래 5번과 연결).

---

## 5. 기존 획득 데이터 처리 🚨

- DB `badges` 테이블에 **제거 대상 배지의 획득 행이 실제로 있는지 먼저 조회.**
- **있으면 지우지 말고 보고** (팀장 결정 사항 — "실데이터 있으면 보고 후 결정").
- 없으면 그대로 진행 (실사용자 없음 전제).

---

## 6. 검증

**정탐:** 체크인 7일 연속 데이터로 '마음 개근왕' 획득 팝업 / 영상 20개 봐도 시청 대장 안 나옴 / 배지 컬렉션 화면과 서버 목록 일치.
**불가침:** share=false로 체크인해도 배지 판정 동일 / 슬픔·화남 체크인도 동일.
**회귀:** 기존 유지 배지(첫 발걸음·안전 보안관 등) 정상 획득 / 찜·검색 트리거 정상 / 별(⭐) 적립은 배지와 무관하게 정상.
**보고:** 최종 카탈로그 표(이름·설명 문구 포함 — 팀장 카피 검수용) + 기존 데이터 조회 결과 + 보류 항목(2-B/2-C) 여부.

---

## 7. 막히면 멈추고 보고

- 제거 배지의 실획득 데이터 발견 → 보고 (삭제 금지).
- 미니게임/약속 지킴이 데이터가 없어서 새 테이블·기록이 필요해지면 → 만들지 말고 보고.
- BadgeCollection 구조가 예상과 다르면(카탈로그가 아닌 다른 방식) → 갈아엎지 말고 보고.
