# AD-9 — 가족 책장 '앨범 그리드' + 수정/삭제 (컨트롤타워 → 작업자 브리프)

> feature/diary-v0 **브랜치 전용** (7/14 전 main 머지 금지). 커밋 태그 `[브랜치 전용]`, Co-Authored-By 푸터 필수. 커밋은 **diff 리뷰 후** (보류).
> 오너 확정 7/6: 레이아웃 = **앨범 그리드(2열 썸네일 타일)**. (진짜 달력/썸네일칸 안은 반려 — 모바일 칸 뭉갬 + 데모 시 빈 칸 허전.)

## 배경 / 목표
현재 월별 페이지 목록([FamilyShelf.jsx:280-300](../client/src/pages/FamilyShelf.jsx#L280-L300))은 **텍스트 리스트**(기분 이모지 + 첫 문장 + `›`). 이걸 **그림 썸네일이 크게 보이는 2열 앨범 그리드**로 바꾸고, **수정 모드에서 일기 삭제**를 넣는다. 그림일기의 심장(그림)을 앞세우고, 부모가 정리할 수 있게.

---

## §0 원칙·불변식 (반드시 보존)
- 저장 = **localStorage(diaryStore)** / 그림 = **IndexedDB(diaryImageStore)**. **서버·DB 무접촉.** (읽기전용 getTodayCheckin 외 신규 서버 호출 금지)
- 엔트리 직렬화 불변식 유지: 저장물 = `{ id, date, sentences[], moodEmoji, childPick, keptAt }` + 선택 `imageId`·`drawingId`(있을 때만). §3에서 `weather` 추가 시 **동일 규칙(있을 때만) + 테스트 갱신**.
- **기존 동작 무접촉**: 페이지 상세(setOpenId 경로)·미체크인 브릿지·이어그리기·홈 쓰기 흐름 **그대로**. (아이 삭제 UX도 유지 — 단 §2.5로 '찢기→지우기' **문구만** 완화.) 이 브리프는 **월 목록 렌더 교체 + 삭제 액션 추가 + 지우기 문구 통일**.
- KidHome 무관 → **해인 스위치 절차 불필요**. (단 커밋 시 다른 파일 섞이지 않게.)
- ⚠️ CLAUDE.md: 기존 코드/섹션 삭제·대변경 전 확인. 여기선 **월 목록 리스트 블록만** 그리드로 교체(그 외 조건부 로직 보존).

---

## §1 앨범 그리드 (교체 대상 = [FamilyShelf.jsx:284-298](../client/src/pages/FamilyShelf.jsx#L284-L298)의 페이지 리스트 `.map`)
`openMonth` 뷰 안에서, 그 달 `pages`를 **2열 그리드 크림 타일**로 렌더. (상단 월-북 2열 그리드와 톤 통일)

- 컨테이너: `grid grid-cols-2 gap-3` (기존 `flex flex-col gap-2.5` → 그리드로). `‹ {SHELF_NAME}` 뒤로가기 + `{monthLabel}` 헤더는 **유지**.
- 타일(각 `e`) = `<button>` 크림 카드(`#FBF6E9`, 기존 월-북 타일 style 재사용):
  1. **썸네일** — 상단 `aspectRatio: "4 / 3"` 박스, `rounded-xl overflow-hidden`, bg `#F1E9D2`.
     - `thumbs[e.id]` 있으면 `<img … objectFit: "cover">` (4:3 이미지=4:3 박스 → 크롭 없음. 옛 세로/정사각은 약간 크롭되나 탭하면 상세서 full).
     - 없으면(그림 미보유 엔트리) faint 플레이스홀더(예: 큰 `📔` 또는 `IMAGE_PLACEHOLDER` 축약)로.
  2. **캡션 줄** — 썸네일 아래 `flex items-center justify-between`:
     - 좌: 짧은 날짜 `"5일 일"` (예: `${d.getDate()}일 ${WEEKDAYS[d.getDay()]}`; 기존 `dateLabel`은 길어서 타일엔 축약형 하나 추가).
     - 우: `기분 이모지`(`e.moodEmoji`) (+ §3 적용 시 날씨 이모지 앞에).
  3. `onClick` → `setOpenId(e.id); setTorn(false);` — **기존 상세 그대로**(수정모드 아닐 때만, §2 참조).
- **썸네일 로딩**: `openMonth`(또는 pages) 바뀔 때 useEffect로 그 달 pages의 `imageId`들을 `getImage`로 병렬 로드해 `const [thumbs, setThumbs] = useState({})` 맵에 채움. **alive 가드**(언마운트/월 전환 시 setState 방지). 실패는 조용히 무시(플레이스홀더).

---

## §2 수정 모드 + 삭제  ✅ **오너 승인 완료(7/7) — 바로 착수**
- `const [editMode, setEditMode] = useState(false)` — `openMonth` 헤더 우측에 **[✏️ 수정] ↔ [완료]** 토글 버튼. (월 나가면 false로 리셋)
- `editMode === true`:
  - 각 타일 **우상단에 🗑 배지**(absolute, 탭 타깃 충분히 크게 ~40px).
  - 타일 **본문 탭은 상세 안 열림**(오삭제·오진입 방지) — editMode 땐 onClick 상세 진입 무시, 🗑만 반응.
  - 🗑 탭 → **삭제 확인 다이얼로그**(제목/설명/[삭제][취소]) → 확인 시:
    - `diary.tearEntry(profile.id, e.id)` 호출 (⚠️ 이미 존재: 엔트리 제거 + `imageId`·`drawingId` **IDB 완전삭제**까지 함 — 새 삭제 함수 만들지 말 것).
    - `setEntries(diary.getEntries(profile.id))`로 갱신. 그 달 pages 0개면 openMonth 유지하되 "이 달 일기가 없어요" 빈 상태 or 자동 뒤로(택1, 팀장 copy).
  - 확인 다이얼로그 copy = **부모 전용 스탬프**(§2.5 `SHELF_DELETE`): 제목 "이 일기를 지울까요?" / 본문 **"아이가 직접 만든 일기예요. 한 번 지우면 되돌릴 수 없어요."**(⚠️ 팀장 스탬프 verbatim — '아이가 직접 만든'이 개정 균형추, **문구 변경 금지**) / 버튼 [지우기]·[취소]. 부모 삭제엔 별도 done 문구 불필요.
- 삭제 후 편집 계속 가능(editMode 유지).

---

## §2.5 '찢기' → '지우기' 전면 통일 (오너 확정 7/7 — "'찢다'가 폭력적")
> 기존 아이 삭제 = "찢어버리기"(찢을까/찢으면/찢었어) → **'찢다' 표현 전면 제거**, 부드러운 '지우기'로. 상세의 아이 삭제 UX 자체는 **유지**(문구만 완화). export 이름 `TEAR`는 그대로(리플 방지), **값만** 교체.
- [diaryCopy.js:120-125](../client/src/utils/diaryCopy.js#L120-L125) `TEAR` 값 교체 + `desc` 필드 추가:
  - `confirm: "이 일기를 지울까요?"` (제목 · 오너 확정)
  - `desc: "한 번 지우면 되돌릴 수 없어요."` (설명 · 신규 필드 · 오너 확정)
  - `yes: "응, 지울래"` (구 "응, 찢을래" → 완화, 4~7세 구어체 유지)
  - `no: "아니야, 둘래"` (변경 없음 — 폭력 표현 아님)
  - `done: "응, 지웠어. 괜찮아!"` (구 "찢었어" → 완화 · **죄책감 유발 금지 톤 유지**)
- **부모 삭제용 신규 상수** `SHELF_DELETE`(§2 그리드 팝업 전용 — 아이용 TEAR와 분리):
  - `confirm: "이 일기를 지울까요?"`
  - `desc: "아이가 직접 만든 일기예요. 한 번 지우면 되돌릴 수 없어요."` (⚠️ 팀장 스탬프 verbatim — **한 글자도 바꾸지 말 것**)
  - `yes: "지우기"` / `no: "취소"`
- [FamilyShelf.jsx:355](../client/src/pages/FamilyShelf.jsx#L355) 버튼 라벨 `🗑️ 찢어버리기` → `🗑️ 지우기`. [:354](../client/src/pages/FamilyShelf.jsx#L354) 주석의 "부모 삭제 불가"도 갱신(부모 삭제는 §2 그리드로 허용됨).
- [FamilyShelf.jsx:364](../client/src/pages/FamilyShelf.jsx#L364) 다이얼로그에 **desc 줄 추가**(title+desc를 `gap-1` div로 묶고 그 아래 버튼):
  ```jsx
  <div className="flex flex-col gap-1">
    <p className="text-base font-bold text-center" style={{ color: "#EAF5F1" }}>{TEAR.confirm}</p>
    <p className="text-sm text-center" style={{ color: "#90A9A8" }}>{TEAR.desc}</p>
  </div>
  ```
- **하드코딩 테스트 문자열 갱신**(상수참조 테스트는 자동 통과): [diary.dom.test.jsx:92](../client/src/__tests__/diary.dom.test.jsx#L92) · [diary-entry.dom.test.jsx:227](../client/src/__tests__/diary-entry.dom.test.jsx#L227) 의 `"🗑️ 찢어버리기"` → `"🗑️ 지우기"`. (describe/it 제목의 '찢기'는 라벨이라 무해 — 원하면 정리.)

---

## §3 (선택·권장, 나중 가능) 날씨 아이콘 저장
> 기분은 이미 저장(moodEmoji)돼 **§1에서 바로 표시 가능**. 날씨는 **미저장** → 아이콘 넣으려면 데이터 추가 필요. 데모 여유 없으면 **기분만으로 충분**(오너: "날씨나 기분").
- [DiaryFlow.jsx:286](../client/src/components/DiaryFlow.jsx#L286) `entry`에 `weather` 추가 (그 스코프의 `weather` state = 날씨 키. 없으면 넣지 않음 = 불변식).
- [diaryStore.js `saveEntry`](../client/src/utils/diaryStore.js) 화이트리스트에 `if (entry.weather) clean.weather = entry.weather;` (imageId 패턴 동일).
- **직렬화 불변식 테스트**(`diaryStore.test.mjs`) — weather 있음/없음 케이스 갱신.
- 타일 렌더: 날씨 키→이모지는 [DiaryFlow.jsx:321](../client/src/components/DiaryFlow.jsx#L321)과 동일하게 `WEATHER_CHIPS` 조회(중복 로직이면 diaryCopy에 `weatherEmoji(key)` 헬퍼 추출 권장). 옛 엔트리(weather 없음)=기분만.

---

## §4 검증 (기존 그린 유지 + 신규)
- 신규 DOM 테스트(`FamilyShelf` 또는 새 파일): (a) 월 열람 시 pages 수만큼 타일 렌더 + 썸네일/플레이스홀더 분기, (b) 수정 토글 시 🗑 노출·본문탭 무시, (c) 삭제 확인→`tearEntry` 호출→엔트리 수 감소.
- **기존 86 PASS 회귀 0** (DOM 36 + 조립기 14 + 스토어 36; §3 하면 스토어 테스트 +케이스).
- 실기기: 앨범 그리드 가로 썸네일 보임 / 삭제 후 사라짐 / 상세 진입 정상.

## §5 보존 체크리스트 (diff 자기점검)
- [ ] 상세(openEntry) 렌더·다시그리기·다시만들기 동작 **무변경** (삭제 문구만 §2.5로 완화, 삭제 동작·tearEntry 무변경)
- [ ] 미체크인 브릿지 / 홈 '오늘 쓰기' / 이어그리기 **무변경**
- [ ] 서버 신규 호출 0 · localStorage/IDB만
- [ ] 삭제 = `tearEntry` 재사용(신규 삭제로직 금지)
- [ ] 커밋 보류(리뷰 대기) · `[브랜치 전용]` · Co-Authored-By

---

## 📨 팀장 통지 (참고 — 승인 불요, 오너 결정 완료 7/7)
1. **부모(오너) 삭제 허용** — 기존 "부모 삭제 불가(아이 전용 삭제권)" 원칙을 오너 권한으로 **개정**. 그림일기=가족 공유 책장이므로 오너 정리 허용, 삭제 확인 팝업 필수.
2. **'찢기' 문구 폐기** — '찢다'가 폭력적이라는 오너 판단으로 전 문구를 '지우기'로 완화(§2.5). export명 `TEAR`만 유지, 값 전량 교체.

## §6 검증 추가(§2.5분)
- `TEAR` 상수 참조 테스트(diary.dom `getByText(TEAR.confirm/yes/done)`)는 값 교체만으로 자동 통과. 하드코딩 버튼 문자열 2곳만 갱신하면 **기존 86 PASS 유지**.
- 삭제 확인에 desc 줄 노출되는지 DOM 1케이스 추가 권장.
