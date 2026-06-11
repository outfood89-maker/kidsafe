# KidSafe 다음 작업 지침서
> 작성 기준: 2026-06-12

---

## 현재 완료 상태

- [x] KidHome B안 레이아웃 (넷플릭스식 다크 배너 + 가로 캐러셀)
- [x] VideoPlayer IFrame 재생 (타이머, 시간 초과, 임베드 불가 처리)
- [x] VideoModal 바텀시트 슬라이드업 애니메이션
- [x] ChatWidget 슬라이드업 애니메이션 + KidHome 통합
- [x] ChatWidget 채팅 400 오류 수정 (messages 배열 전달)
- [x] BottomTabBar 닫기 애니메이션 수정

---

## 다음 작업 우선순위

### 1순위 — YouTube API 429 오류 안내 메시지 (빠른 작업)

**문제:** YouTube 할당량 초과 시 서버가 500을 반환하는데, 프론트에서 그냥 빈 화면으로 보임  
**목표:** "오늘 검색 횟수를 초과했어요 😢 오후 4시 이후 다시 시도해 주세요!" 안내 표시

**수정 파일:** `client/src/pages/KidHome.jsx`

**구현 방법:**
```jsx
// fetchRecommendedVideos, fetchHistoryRecommendedVideos, handleSearch 의 catch 블록에서
// 500 오류 시 특별 메시지 분기
if (err.response?.status === 500) {
  // 해당 섹션에 안내 메시지 상태 set
  setQuotaError(true);
}

// 렌더링
{quotaError && (
  <div className="text-center py-8">
    <p>😢 오늘 검색 횟수를 초과했어요</p>
    <p>매일 오후 4시에 초기화돼요!</p>
  </div>
)}
```

---

### 2순위 — VideoPlayer 모바일 전체화면 최적화

**문제:** 모바일에서 VideoPlayer가 헤더(52px) + 푸터(80px)를 차지해서 영상 화면이 좁아짐
**목표:** 모바일에서 영상이 화면 전체를 채우고, KidSafe 컨트롤은 오버레이로 최소화

**확정 방향:**
- 모바일에서는 헤더/푸터 제거
- 대신 영상 위에 반투명 오버레이로 타이머 pill + 닫기 버튼만 표시
- 탭하면 오버레이 표시/숨김 토글 (유튜브 앱처럼)
- 데스크탑은 기존 헤더/푸터 유지

**UI 구조 (모바일):**
```
┌─────────────────────────────┐
│ [X] KidSafe   ⏱ 03:24 안전 │  ← 오버레이 (탭시 토글)
│                             │
│                             │
│    YouTube 영상 전체화면     │
│                             │
│                             │
│                             │
└─────────────────────────────┘
```

**수정 파일:** `client/src/components/VideoPlayer.jsx`

---

### 3순위 — 모바일 전체 페이지 UX 점검

**목표:** 모바일에서 모든 페이지가 정상적으로 보이고 동작하는지 확인 + 수정

**점검 페이지 목록:**

| 페이지 | 파일 | 상태 |
|--------|------|------|
| KidHome | `client/src/pages/KidHome.jsx` | ✅ 완료 |
| VideoModal | `client/src/components/VideoModal.jsx` | ✅ 완료 |
| ChatWidget | `client/src/components/ChatWidget.jsx` | ✅ 완료 |
| VideoPlayer | `client/src/components/VideoPlayer.jsx` | ⚠️ 모바일 전체화면 미적용 |
| Landing | `client/src/pages/Landing.jsx` | 🔲 미확인 |
| ProfileSelect | `client/src/pages/ProfileSelect.jsx` | 🔲 미확인 |
| ParentDashboard | `client/src/pages/ParentDashboard.jsx` | 🔲 미확인 |
| Favorites | `client/src/pages/Favorites.jsx` | 🔲 미확인 |
| BadgeCollection | `client/src/pages/BadgeCollection.jsx` | 🔲 미확인 |

**모바일 테스트 방법:**
- 크롬 개발자도구 → 디바이스 모드 (iPhone 14 Pro, 390px 기준)
- 또는 핸드폰에서 직접 접속 (api.js BASE_URL을 로컬 IP로 변경 필요)

**자주 나오는 모바일 문제 패턴:**
- 텍스트가 넘쳐서 레이아웃 깨짐 → `truncate` 또는 `line-clamp`
- 버튼이 너무 작아서 탭 불편 → 최소 44px 높이
- 가로 스크롤 의도치 않게 발생 → `overflow-x-hidden`
- 폰트 너무 작음 → 최소 14px

---

### 3순위 — 모바일 전체 페이지 UX 점검

**목표:** 모바일에서 모든 페이지가 정상적으로 보이고 동작하는지 확인 + 수정

**점검 페이지 목록:**

| 페이지 | 파일 | 상태 |
|--------|------|------|
| Landing | `client/src/pages/Landing.jsx` | 🔲 미확인 |
| ProfileSelect | `client/src/pages/ProfileSelect.jsx` | 🔲 미확인 |
| ParentDashboard | `client/src/pages/ParentDashboard.jsx` | 🔲 미확인 |
| Favorites | `client/src/pages/Favorites.jsx` | 🔲 미확인 |
| BadgeCollection | `client/src/pages/BadgeCollection.jsx` | 🔲 미확인 |

---

### 4순위 — 키디 인터랙션
> 상세 내용: KidSafe_키디인터랙션_작업지침서.md 참고

- KidHome 진입 시 키디 자동 인사 (포즈 순환 + 말풍선)
- 시간 초과 후 키디 소감 대화 연결

---

### 5순위 — 미니게임 시스템
> 상세 내용: KidSafe_미니게임_작업지침서.md 참고

- OX 퀴즈 → 수학 → 단어 → 기억력 → 스토리 순서로 개발
- 보너스 시청 시간 시스템 + 부모 대시보드 연동

---

### 6순위 — UI 디테일 개선
> 키디 인터랙션 + 미니게임 완료 후 진행

- KidHome 배너 하단 그라데이션 자연스럽게 다듬기
- 추천 캐러셀 카드 비율 모바일 최적화
- 로딩 스피너 일관성 통일
- 빈 상태(empty state) UI 추가 (검색 결과 없음, 찜 목록 비어있음 등)

---

### 7순위 — Vercel 배포 + README (최종)

**배포 전 체크리스트:**
- [ ] `client/src/utils/api.js` BASE_URL → 환경변수 처리 (`import.meta.env.VITE_API_URL`)
- [ ] `server/.env` Railway 환경변수 설정 (YOUTUBE_API_KEY, ANTHROPIC_API_KEY)
- [ ] CORS 설정 — Railway 백엔드 URL 화이트리스트 추가
- [ ] `client/vite.config.js` 프록시 설정 확인

**배포 순서:**
1. Railway에 백엔드 배포 → URL 확인
2. Vite 환경변수에 Railway URL 설정
3. Vercel에 프론트 배포
4. 최종 테스트

---

## 참고 — 현재 서버 포트 및 설정

- 프론트: `http://localhost:5173`
- 백엔드: `http://localhost:3000`
- YouTube API 쿼터 초기화: 매일 오후 4시 (한국 기준)
- Anthropic API: `chat.js`에서만 사용 (claude-haiku-4-5-20251001)

## 참고 — 주요 파일 경로

```
client/src/
├── components/
│   ├── VideoModal.jsx      ← 바텀시트 모달
│   ├── VideoPlayer.jsx     ← IFrame 플레이어
│   ├── ChatWidget.jsx      ← 키디 챗봇
│   ├── BottomTabBar.jsx    ← 모바일 하단 탭바
│   └── KiddyImg.jsx        ← 키디 이미지 컴포넌트
├── pages/
│   ├── KidHome.jsx         ← 메인 아동 화면
│   ├── Landing.jsx         ← 랜딩 페이지
│   ├── ProfileSelect.jsx   ← 프로필 선택
│   ├── ParentDashboard.jsx ← 부모 대시보드
│   ├── Favorites.jsx       ← 찜 목록
│   └── BadgeCollection.jsx ← 배지 컬렉션
└── utils/
    └── api.js              ← 모든 API 함수 모음

server/
├── routes/                 ← 각 API 라우터
└── data/                   ← JSON 데이터 파일
```
