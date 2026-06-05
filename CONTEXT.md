# KidSafe 프로젝트 컨텍스트

## 프로젝트 개요
어린이를 위한 안전한 YouTube 영상 검색/추천 플랫폼.
부모가 자녀의 시청 기록을 관리하고, 아이는 안전한 영상만 검색할 수 있다.

- **GitHub**: https://github.com/outfood89-maker/kidsafe
- **개발자**: Freddie (초보 프론트엔드 개발자)
- **AI 파트너**: Claude Sonnet 4.6

---

## 기술 스택

| 구분 | 기술 |
|---|---|
| 프론트엔드 | React 19, Tailwind CSS, React Router, Axios |
| 백엔드 | Node.js, Express 5 |
| 외부 API | YouTube Data API v3, Anthropic API (claude-haiku — 키디 챗봇 전용) |
| 데이터 저장 | JSON 파일 기반 (DB 없음) |
| 아이콘 | react-icons (FaXxx) |
| 차트 | recharts |

---

## 폴더 구조

```
kidsafe/
├── client/                          # React 프론트엔드
│   └── src/
│       ├── pages/
│       │   ├── Landing.jsx          # 메인 랜딩 페이지
│       │   ├── ProfileSelect.jsx    # 프로필 선택
│       │   ├── KidHome.jsx          # 아이 홈 (핵심 페이지)
│       │   ├── ParentDashboard.jsx  # 부모 대시보드
│       │   ├── Favorites.jsx        # 찜 목록 페이지
│       │   └── BadgeCollection.jsx  # 배지 컬렉션 페이지
│       ├── components/
│       │   ├── NavBar.jsx           # 공통 네비게이션 바
│       │   ├── VideoModal.jsx       # 영상 상세 모달
│       │   └── PlaylistModal.jsx    # 재생목록 모달
│       └── utils/
│           ├── api.js               # 모든 API 호출 함수
│           └── safetyFilter.js      # 안전도 필터/Anti-Bias 로직
│
└── server/                          # Express 백엔드
    ├── index.js                     # 서버 진입점 (포트 3000)
    ├── routes/
    │   ├── search.js                # YouTube 검색 + 추천
    │   ├── analyze.js               # 안전도 분석 (키워드 기반)
    │   ├── history.js               # 시청 기록 저장/조회
    │   ├── profiles.js              # 프로필 CRUD
    │   ├── badges.js                # 배지 체크/조회
    │   ├── favorites.js             # 찜 CRUD
    │   ├── search-history.js        # 검색 히스토리
    │   ├── blocked-keywords.js      # 차단 키워드 관리
    │   ├── alerts.js                # 위험 영상 알림
    │   └── chat.js                  # 키디 AI 챗봇
    └── data/                        # JSON 데이터 파일
        ├── profiles.json
        ├── history.json
        ├── badges.json
        ├── favorites.json
        ├── searches.json
        ├── blocked-keywords.json
        ├── alerts.json
        └── alert-settings.json
```

---

## 라우트 목록 (App.jsx)

| 경로 | 페이지 |
|---|---|
| `/` | Landing |
| `/profiles` | ProfileSelect |
| `/kids` | KidHome |
| `/parent` | ParentDashboard |
| `/favorites` | Favorites |
| `/badges` | BadgeCollection |

---

## 서버 API 엔드포인트

| Method | 경로 | 설명 |
|---|---|---|
| GET | `/search?keyword=` | YouTube 영상+재생목록 검색 (20개) |
| GET | `/search/recommend?age=` | 나이별 추천 영상 |
| GET | `/search/history-recommend?keyword=` | 시청 기록 기반 추천 |
| POST | `/analyze` | 안전도 분석 (키워드 기반) |
| GET | `/history` | 시청 기록 조회 |
| POST | `/history` | 시청 기록 저장 + 알림 자동 생성 |
| GET/POST/DELETE | `/profiles` | 프로필 CRUD |
| GET | `/badges/:profileId` | 배지 조회 |
| POST | `/badges/check/:profileId` | 배지 체크 및 신규 부여 |
| GET/POST/DELETE | `/favorites` | 찜 CRUD |
| GET/POST/DELETE | `/search-history` | 검색 히스토리 |
| GET | `/blocked-keywords` | 차단 키워드 전체 조회 |
| GET | `/blocked-keywords/check?keyword=` | 차단 여부 확인 |
| POST | `/blocked-keywords/custom` | 커스텀 차단 키워드 추가 |
| DELETE | `/blocked-keywords/custom/:keyword` | 커스텀 차단 키워드 삭제 |
| GET | `/alerts` | 알림 목록 조회 |
| PATCH | `/alerts/:id/read` | 알림 읽음 처리 |
| PATCH | `/alerts/read-all` | 전체 읽음 처리 |
| GET/PUT | `/alerts/settings` | 알림 설정 조회/저장 |
| POST | `/chat` | 키디 AI 챗봇 |

---

## 구현 완료 기능

### 아이 홈 (KidHome.jsx)
- YouTube 영상 검색 (검색 버튼 클릭 시에만 실행)
- 차단 키워드 검색 방지 (키워드 차단 시 친절한 메시지)
- 나이별 안전도 필터링 (filterByAge)
- Anti-Bias 편식 방지 로직 (applyAntiBias)
- 오늘의 추천 영상 (나이별 키워드 기반)
- 내가 좋아할 것 같아요 (시청 기록 기반 추천)
- 재생목록 검색 및 모달
- 더보기 기능 (검색 9개씩, 추천 6개씩)
- 검색 결과 sessionStorage 유지 (페이지 이탈 후 복귀 시 유지)
- 찜(하트) 버튼 — outline/filled 시각 피드백 + 애니메이션
- 검색 히스토리 (최근 검색어, 삭제 가능)
- 배지 획득 시 팝업 알림
- 배지 컬렉션 버튼 (획득 수 표시)
- 키디 AI 챗봇 플로팅 버튼 (빠른 질문 3개 선택지)

### 배지 시스템 (badges.js) — 총 21개
**시청 기반:** 첫 발걸음, 새싹 탐험가, 시청 대장, 단골손님, 저녁 탐험가, 얼리버드, 개근왕
**안전/교육:** 안전 보안관, 브레인 파워, 완벽주의자, 안전 전문가
**장르:** 동화 왕국, 공룡 박사, 과학 꿈나무
**찜 기반:** 찜 수집가, 찜 마스터, 재생목록 팬
**검색 기반:** 호기심 탐험가, 장르 개척자
**마스터:** KidSafe 마스터, 올스타

### 키디 AI 챗봇 (chat.js)
- 모델: claude-haiku-4-5-20251001 (비용 절약)
- 어린이 눈높이 맞춤 응답
- 마크다운 금지 (일반 텍스트만)
- 영상 키워드 추천, 퀴즈, 궁금증 답변

### 부모 대시보드 (ParentDashboard.jsx)
- 프로필 생성/삭제/시청 시간 제한 설정
- 시청 기록 조회 (프로필별 필터)
- 안전도 분포 차트 (recharts)
- 배지 현황 조회
- **위험 영상 알림**: 심각도 2단계(🔴위험/🟡주의), 반복 시청 감지, 기준 점수 슬라이더, 늦은 시간 알림 토글, 채널 바로 차단
- **차단 키워드 관리**: 시스템 기본 키워드 + 부모 커스텀 추가/삭제

---

## 중요 설정/정책

### 안전도 분석 (analyze.js)
- **현재**: 키워드 기반 (Anthropic API 크레딧 절약)
- **AI 버전으로 복원 방법**: console.anthropic.com에서 크레딧 충전 후 Anthropic SDK 버전으로 교체
- analyze.js는 키워드 분석만, chat.js는 Anthropic API 사용

### 검색 설정 (search.js)
- 기본 20개 검색 후 게임 콘텐츠 필터링, 60초 미만 쇼츠 제거
- safeSearch: 'strict', 60초 이하 영상 제외
- 나이별 키워드: 3세(동요/뽀로로), 5세(동화/유아애니), 7세(공룡/과학), 10세(다큐/역사)

### Git 커밋 방식 (Freddie 선호)
```bash
git add .
git commit -m "feat: 작업 내용"
git push origin master
```

---

## 남은 작업 목록

| 기능 | 설명 |
|---|---|
| 시청 패턴 분석 | 시청 기록 통계 시각화 |
| 주간/시간 리포트 | 부모용 주간 리포트 |
| UI 전체 개선 | 전반적인 디자인 다듬기 |
| Vercel 배포 | 실서버 배포 |
| README 작성 | 포트폴리오용 문서 |

---

## 서버 실행 방법

```bash
# 서버 (포트 3000)
cd server
node index.js

# 클라이언트 (포트 5173)
cd client
npm run dev
```

## 환경변수 (.env)
```
YOUTUBE_API_KEY=...
ANTHROPIC_API_KEY=...
```
