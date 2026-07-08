# [마이크로 브리프] V — 프로필 연령 커스텀(4~10세 선택) + 안전 버킷 매핑

> **왜:** 현재 연령 선택지가 3/5/7/10뿐 — R 데모 프로필(하늘 6세·바다 5세) 생성이 막힘 + 실사용자도 아이 실제 나이를 못 고름. Freddie 확정: **4~10세를 세로 스크롤 리스트에서 클릭 선택**.
> **⚠️ 핵심 함정:** 안전 설정이 `AGE_THRESHOLD[age]` **정확 키 조회**라, 6세를 그냥 추가하면 기준점수가 폴백 70(=10세 수준)으로 **떨어져 더 관대해진다.** 클라·서버 양쪽 버킷 매핑 필수 — §2가 이 브리프의 본체.
> **R 선행 작업** — 이거 배포돼야 Freddie가 6세 프로필을 만들 수 있음.

---

## 1. UI — 선택지 교체 3곳 (세로 스크롤)

`AGE_OPTIONS = [3, 5, 7, 10]` → `[4, 5, 6, 7, 8, 9, 10]`:
- [ParentDashboard.jsx:45](../client/src/pages/ParentDashboard.jsx#L45) (생성 :949·수정 :2110 두 곳에서 사용)
- [ProfileFormModal.jsx:10](../client/src/components/ProfileFormModal.jsx#L10) (:109)

렌더: 기존 버튼 스타일 그대로 두고, 목록 컨테이너만 **세로 스크롤**로 (예: `max-h-40 overflow-y-auto` + 세로 나열). 선택 하이라이트·onClick 로직 무변경.
- ⚠️ 기존 3세 프로필: 표시는 그대로 동작(프로필 age 값은 유지), 수정 모달에서만 3 선택지가 사라짐 — 의도된 동작 (Freddie 확정 4~10).

## 2. 안전 버킷 매핑 — 클라·서버 동시 (이 브리프의 본체)

중간 나이(4·6·8·9)를 **보수적으로 아래 버킷에 귀속**: `10+→10 / 7~9→7 / 5~6→5 / ~4→3`.
(6세가 5세 기준 85점을 받는 방향 — 낮은 버킷일수록 엄격하므로 안전 우선.)

**클라 [safetyFilter.js](../client/src/utils/safetyFilter.js):**
```js
// 중간 나이(4·6·8·9)를 설정 버킷(3/5/7/10)에 귀속 — 보수적(아래 버킷=더 엄격) (V)
const resolveAgeBucket = (age) => (age >= 10 ? 10 : age >= 7 ? 7 : age >= 5 ? 5 : 3)
```
- `getEffectiveThreshold`(:33): `AGE_THRESHOLD[age]` → `AGE_THRESHOLD[resolveAgeBucket(age)]` (age가 null이면 기존 폴백 70 유지 — null 가드 주의)
- `:97`: `AGE_WEIGHTS[age]` → `AGE_WEIGHTS[resolveAgeBucket(age)]` (기존 `|| AGE_WEIGHTS[7]` 폴백 유지)
- AGE_THRESHOLD·AGE_WEIGHTS 테이블 자체는 **변경 금지** (3/5/7/10 키 유지)

**서버 [recommend.py:33-38](../server/routers/recommend.py#L33):** `effective_threshold`에 동일 버킷 매핑 (주석 :17 "프론트와 동일 유지" 규칙 — 양쪽 같은 로직).

**변경 불필요 (확인만):** `ageRating > age` 비교(filterByAge:49·recommend:106-108)는 정수 비교라 커스텀 나이 그대로 정확 — 6세면 ageRating 7·10 영상 숨김(오히려 더 정밀해짐). Tier2 ageRating 값 체계(3/5/7/10)도 그대로.

## 3. 서버 프로필 검증 확인

profiles.py의 age 필드가 int 자유값인지 확인 (3/5/7/10 enum 검증이 있으면 4~10 허용으로 — 있는 경우만).

## 4. 검증

- 6세 프로필 생성 성공 → 기준점수 85(5세 버킷) 적용 확인 (부모 안전 기준 UI/추천)
- 6세로 "ASMR" 검색 → 숨김 유지 (ageRating 10 > 6)
- 4세 → 90 / 8·9세 → 80 / 기존 3·5·7·10 프로필 → **기존과 완전 동일** (회귀 0)
- 세로 스크롤 UI: 생성·수정 모달 모두 7개 선택지 스크롤·선택 정상
- build ✓

## 5. 하지 말 것

- AGE_THRESHOLD·AGE_WEIGHTS 수치 변경 / Tier2 ageRating 체계 변경
- 기존 프로필 데이터 마이그레이션 (필요 없음 — 값 유지)
