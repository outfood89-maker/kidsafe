# AD-10 — 체크인→일기 연속 제거 + 일기 음성입력 확장(4세·날씨) (컨트롤타워 → 작업자 브리프)

> feature/diary-v0 **브랜치 전용**(7/14 전 main 머지 금지). 커밋 태그 `[브랜치 전용]`, Co-Authored-By 푸터. 커밋은 **diff 리뷰 후**(보류).
> **삭제 금지 — 전부 주석처리로 비활성**(복구 가능, CLAUDE.md). 각 접점을 `/* AD-10 제거: … (복구 가능) */` 라벨로 감싸 복구 지점을 한눈에.
> **§1과 §2는 독립 → 커밋 2개로 분리**(§1 연속제거 / §2 음성확장). AD-9(책장)와도 별개 커밋.

## 배경 / 목표 (오너 확정 2026-07-07)
1. **§1 체크인→일기 '자연스러운 연속' 전면 제거.** 일기는 오직 **그림일기 타일 / 가족책장**에서만 진입. 체크인 리워드는 항상 영상으로만 끝난다.
2. **§2 일기 음성입력 확장(C 확정)** — (A) 날씨 단계에도 🎤 추가 + (B) 연령 게이트 `age>=6 → age>=4` 완화.

---

## §0 원칙·불변식 (⚠️ efadd94 재발방지 — 삭제(−)된 줄 반드시 검토)
- **주석처리로만 비활성.** 삭제 금지. export명·상수(TEAR/BRIDGE/ENTRY 등)는 존치.
- **아래는 절대 무접촉**(일기와 무관, 큰 diff에 휩쓸리지 말 것):
  - DailyCheckin 코어: greeting/questions/share/reward ⭐·confetti(295-306)·비밀약속(SECRET_PROMISE_LINE 45·chooseShare 517-530)·**`onComplete?.({ watchKeyword })` 완료 경로**·negativeMood·watchKeyword 세팅(343)
  - KidHome: **CHECKIN_TEST_PROFILE(해인 스위치, 34행)**·F1 체크인 자동오픈(207-217)·openChat 폴백(271-277)·onComplete의 watchKeyword 검색·checkBadges(1565-1579)
  - 위기 스크리닝(P): screenText/fixedResponse/isHigh/createCareSignal — **연령 무분기 무조건 실행 유지**, 음성 원문·위기 텍스트 일기 미유입 불변식
  - 칩 폴백: 모든 스텝에서 칩은 항상 렌더(음성은 '추가'만, 칩 대체 금지)
- feature/diary-v0 전용. DiaryFlow는 `diary.DIARY_V0` 게이트 뒤.

---

## §1 체크인→일기 연속 완전 제거  ✅ 오너 확정

### §1-A `DailyCheckin.jsx` — 제안(경로A) + 브릿지연속(경로B)의 실체를 모두 비활성
> 연속의 두 경로가 전부 이 파일에 있음: (A) reward 제안 `diaryPropose`→"일기 쓸래?"→좋아!→DiaryFlow, (B) `diaryIntent`→`diaryFinish`→DiaryFlow. 둘 다 죽이고, reward엔 **항상 "영상 보러 가자! 🚀"→`onComplete`** 만 남긴다.

| 라인 | 현재 | 조치(주석) |
|---|---|---|
| 9-10 | `import DiaryFlow` | 주석 (마운트와 함께) |
| 11 | `import * as diaryStore` | 주석 (이 파일 diaryStore 참조 546·547·555·562·570·960·963 전부 배선 → 잔존 0) |
| 12 | `import { ENTRY, SAD_MOODS }` | 주석 (제안 UI 전용). ⚠️ **13행 `kidTopics` import는 '볼 것' 검색용 — 무접촉** |
| 91-95 | state `diaryOpen`·`diaryPropose`·`diaryStartAt` | 주석 |
| 532-539 | `diaryDidToday()` 헬퍼 | 주석 (호출부 965뿐). answers 자체는 무접촉 |
| 540-551 | 제안 노출 effect(`shouldProposeToday`→`setDiaryPropose`) | **effect 전체 주석** → 제안 안 뜸. ⚠️ 별개인 295-306 confetti는 무접촉 |
| 553-564 | `acceptDiaryProposal`·`declineDiaryProposal` | 주석 (제안 UI 사라져 호출부 0) |
| 566-577 | `diaryFinish` | **diaryIntent 분기(≈569-575)만 주석** → 함수가 `onComplete?.({ watchKeyword })` 한 줄로 축소. **함수명·onComplete 호출은 반드시 유지**(948 버튼이 계속 참조·유일 완료 경로) |
| 932-955 | reward 삼항 `{diaryPropose ? (제안UI) : (영상 버튼)}` | **제안 분기(932-947)+`)}`(955)만 주석**, 완료 버튼(948-954) **항상 렌더**로 남김 |
| 959-970 | `{DIARY_V0 && diaryOpen && <DiaryFlow …/>}` 마운트 | **블록 전체 주석**. 뒤 `</div>` 구조 유지 |
| 89 | `diaryIntent = false` prop | 기본값이라 무해 — 유지 권장(최소변경) |

- **리스크(사수):** import는 '사용처 전부와 함께' 주석(불일치 시 빌드깨짐/undefined). 커밋 전 `git grep "diaryStore\|DiaryFlow\|ENTRY" -- DailyCheckin.jsx`로 잔존 참조 0 확인.

### §1-B `KidHome.jsx` — 연속 트리거(diaryAfter/diaryIntent) 무력화
| 라인 | 현재 | 조치 |
|---|---|---|
| 153 | `const diaryAfterRef = useRef(false)` | 주석 (아래 참조도 함께) |
| 279-287 | `location.state.diaryAfter → diaryAfterRef.current=true` effect | **effect 전체 주석** → 연속 의도 안 심김. ⚠️ 위 271-277 openChat effect·207-217 F1 자동오픈 무접촉 |
| 1561 | `diaryIntent={diaryAfterRef.current}` | `diaryIntent={false}` 로 (또는 prop 주석) |
| 1562 | `onSkip={()=>{ diaryAfterRef.current=false; setCheckinOpen(false); }}` | `diaryAfterRef.current=false;` 만 제거, **`setCheckinOpen(false)` 유지** |
| 1564 | onComplete 첫 줄 `diaryAfterRef.current=false;` | 그 한 줄만 제거. **아래 setCheckinOpen·watchKeyword 검색·checkBadges 전부 유지** |

### §1-C `FamilyShelf.jsx` — **무접촉** (AD-9 충돌 회피)
- 타일→체크인있음→DiaryFlow(=정당한 분리 진입)는 **그대로 산다**. 미체크인 브릿지도 **그대로 둔다**.
- `goBridge`(126)가 `navigate("/kids",{state:{diaryAfter:true}})`로 여전히 보내지만, §1-B로 **KidHome이 그 플래그를 무시** → 자동 연속만 죽고 브릿지(체크인 유도)는 살아있음(플래그는 무해한 死데이터). **FamilyShelf 코드 변경 0** → AD-9와 충돌 없음.

### §1 결과 흐름 (오너 "돌아와서 타일 다시")
- 체크인만 함 → reward "영상 보러 가자! 🚀" → 영상. **일기 얘기 0.**
- 일기 타일 → 체크인 있음 → 바로 DiaryFlow. / 체크인 없음 → 브릿지 "체크인 먼저" → 체크인 → (자동 일기 진입 없이) 영상 → 아이가 **타일 다시** 눌러 일기.

---

## §2 일기 음성입력 확장 (C 확정) — 전부 `DiaryFlow.jsx`

### §2-B 연령 게이트 완화 (한 줄)
- **46행** `const canSpeak = age >= 6 && speech.supported;` → **`age >= 4`**. 주석 "4~5세 칩만/6세+" → **"4세+ 칩+말하기 / 4세 미만 칩만"**. ⚠️ `&& speech.supported` 유지(미지원 브라우저는 age 무관 칩만). 이 한 줄이 rotating·pick·weather 3곳 🎤를 동시 좌우.

### §2-A 날씨 단계 음성 추가
1. **매핑 헬퍼 신설**(모듈 스코프, 순수함수 — 저장 0):
   ```js
   // AD-10: 자유발화 → 날씨 키(닫힌 5보기). 내부 STT 힌트(아동 비노출)라 카피게이트 무관 — 자유 튜닝 가능.
   const WEATHER_KEYWORDS = [
     { key: "snowy",  words: ["눈", "함박눈", "눈사람"] },
     { key: "rainy",  words: ["비", "소나기", "장마", "빗"] },
     { key: "sunny",  words: ["맑", "화창", "햇", "해가", "해 떴", "해났"] },
     { key: "cloudy", words: ["구름", "흐림", "흐렸", "흐린", "먹구름"] },
   ]; // 우선순위 snowy→rainy→sunny→cloudy→unknown ('비'/'눈' 오탐 최소화)
   const matchWeatherKey = (text) => {
     const t = (text || "").replace(/\s+/g, "");
     for (const { key, words } of WEATHER_KEYWORDS)
       if (words.some((w) => t.includes(w.replace(/\s+/g, "")))) return key;
     return "unknown"; // 미매칭 → 모르겠어(R3로 날씨 문장 생략, 무해)
   };
   ```
2. **STT 종료 effect 정상분기(116-119)에 weather 케이스 추가:** `else if (slot === "weather") chooseWeather(matchWeatherKey(t));` — `chooseWeather`는 칩 클릭과 동일 경로라 재사용만. ⚠️ 위 104-114 위기 스크리닝은 **슬롯 이전 무조건 실행** → 날씨 음성도 자동 커버(추가 코드 0). weather는 원문 대신 **키만** 저장 → 음성 원문 미유입(오히려 rotating R6 인용보다 안전).
3. **weather step 렌더(404-412)를 rotating(415-426) 구조로 미러링:** 바깥 `flex flex-col gap-2.5`로 감싸 상단 `<SafetyBanner />`(위기 고정응답 표시 — 필수), 기존 `grid grid-cols-2` 칩 유지, 말미에 `<SpeakButton slot="weather" />`(col-span-2). ⚠️ **칩은 그대로**(다수 테스트가 '맑음' 텍스트 클릭 의존).
4. **96행 주석 정정:** `'weather' 불가` → `'weather'(→matchWeatherKey)`.
- `startSpeak`/`SpeakButton`은 이미 슬롯 제네릭 → 신규 배선 불필요. `age>=4`로 4~5세도 자동 노출.

---

## §3 테스트 갱신 (기존 그린 유지 원칙)
| 파일:라인 | 무엇 | 조치 |
|---|---|---|
| diary-entry `141-154` V4 | diaryIntent→"영상 보러 가자"→DiaryFlow 자동진입 | **§1 제거대상 동작** → describe 제거 또는 반전('영상'클릭→`onComplete` 호출·DiaryFlow 미노출) |
| diary-entry `185-195` A1#1 | 제안 ENTRY.base→좋아!→DiaryFlow | 제거 또는 반전(제안 미노출·'영상 보러 가자'만) |
| diary-entry `196-205` A1#2 | 제안 안 할래→rejectStreak | 제거 |
| diary-entry `170-181` V6 | `age:4` = canSpeak=false 전제(pick 스킵) | **§2B로 깨짐** → `age:4`→**`age:3`**(주석·제목도 '4세 미만'). 방어의도는 age<4로 이동 |
| diary-entry `56` | `import ENTRY` | V4/A1 제거 후 미사용이면 정리 |
| **무영향(유지)** | V3(110-139 브릿지 navigate)·diary-invite(브릿지/startWrite)·diary.dom AD2 '🎤'(age7)·모든 날씨 칩 클릭·A2 img 1개 | §1-C 무접촉·칩 유지라 **그대로 통과** |
| **신규** | §2A 날씨음성: weather에 '🎤 말로 할래' 노출 + `utter('비 왔어')`→'오늘은 비가 왔어요.' + 위기(`'죽고 싶어'`)→고정응답·`createCareSignal('high')`·미유입·SafetyBanner | 추가 |
| **신규** | §2B: `age:4`(또는 5) → rotating/pick에 '🎤 말로 할래' 노출(이전 미노출) | 추가 |

- 기존 86 PASS 기준: §1은 V4·A1 3건만, §2는 V6 1건만 손대면 회귀 0. 나머지 신규는 순증.

## §4 검증
- `cd client && npx vitest run diary` 그린 + 노드(조립기/스토어) 그린. 신규 §2A/§2B 포함.
- 실기기: (1) 체크인만 하면 일기 안 뜸·"영상"만. (2) 타일→일기 진입 정상. (3) 4~5세 프로필에서 🎤 뜸. (4) 날씨에서 "비 왔어" 음성→비 확정. (5) 날씨 음성 위기어→고정응답+칩복귀.

## §5 보존 체크리스트 (diff 자기점검)
- [ ] `onComplete?.({ watchKeyword })` 완료 경로 생존(체크인 안 닫히면 실패)
- [ ] 해인 스위치(34)·F1 자동오픈·watchKeyword 검색·checkBadges 무변경
- [ ] 위기 스크리닝 무조건·무연령분기 실행 유지, 음성 원문 미저장
- [ ] 칩 항상 렌더(음성은 추가만)
- [ ] FamilyShelf 무접촉(AD-9 충돌 0)
- [ ] 삭제 아닌 주석 · `[브랜치 전용]` · §1/§2 커밋 분리 · Co-Authored-By

## §6 문서 정합 (팀장 원칙 — 코드-문서 동기)
- **설계회의록 ② 개정 기록 추가**: 현재 [설계회의록_v1.md:82](../kiddy_voice/그림일기/Kiddy_일기_설계회의록_v1.md#L82) "생성 = 체크인 공유 선택 후 →…"는 연속 전제 → **"[개정 2026-07-07·오너] 체크인→일기 자동 연속 폐기. 진입은 타일/가족책장 단독. 체크인 리워드는 영상 종료만."** 한 줄 추가.
- **연령 사다리 갱신**: 회의록/대본에 '6세+ 말하기'류 표기 있으면 **'4세+'**로 정정.
