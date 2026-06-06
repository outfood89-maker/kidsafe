# KidSafe 프로젝트 컨텍스트

> 마지막 업데이트: 2026-06-07

## 프로젝트 개요

어린이를 위한 안전한 YouTube 영상 검색/추천 플랫폼.
부모가 자녀의 시청 기록을 관리하고, 아이는 안전한 영상만 검색할 수 있다.

- **GitHub**: https://github.com/outfood89-maker/kidsafe
- **개발자**: Freddie (초급 프론트엔드, 포트폴리오 목적)
- **AI 파트너**: Claude Sonnet 4.6
- **목표**: 7월 초 완성 → Vercel 배포

---

## 기술 스택

| 구분 | 기술 |
|---|---|
| 프론트엔드 | React 19, React Router v7, Tailwind CSS, Axios |
| 백엔드 | Node.js + Express 5 (ES Module 방식) |
| AI | Anthropic API — claude-haiku-4-5-20251001 (키디 챗봇 전용) |
| 영상 | YouTube Data API v3 |
| 차트 | Recharts |
| 아바타 | DiceBear API |
| 배포 예정 | Vercel (프론트) + Railway (백엔드) |

---

## 라우터 구조

| 경로 | 컴포넌트 |
|---|---|
| `/` | Landing.jsx (랜딩/인트로 페이지) |
| `/profiles` | ProfileSelect.jsx (프로필 선택) |
| `/kids` | KidHome.jsx (아이 홈) |
| `/parent` | ParentDashboard.jsx (부모 대시보드) |
| `/favorites` | Favorites.jsx (찜 목록) |
| `/badges` | BadgeCollection.jsx (배지 컬렉션) |

---

## 폴더 구조

```
kidsafe/
├── client/
│   └── src/
│       ├── pages/
│       │   ├── Landing.jsx           # 랜딩/인트로 페이지 (전면 개편 완료)
│       │   ├── ProfileSelect.jsx     # 프로필 선택
│       │   ├── KidHome.jsx           # 아이 홈 (핵심 페이지)
│       │   ├── ParentDashboard.jsx   # 부모 대시보드
│       │   ├── Favorites.jsx         # 찜 목록
│       │   └── BadgeCollection.jsx   # 배지 컬렉션
│       ├── components/
│       │   ├── NavBar.jsx            # 공통 네비게이션 바
│       │   ├── VideoModal.jsx        # 영상 상세 모달
│       │   └── PlaylistModal.jsx     # 재생목록 모달
│       └── utils/
│           ├── api.js                # 모든 API 호출 함수
│           └── safetyFilter.js       # 안전도 필터/Anti-Bias 로직
│
└── server/
    ├── index.js                      # 서버 진입점 (포트 3000, 0.0.0.0)
    ├── routes/
    │   ├── search.js                 # YouTube 검색 + 추천
    │   ├── analyze.js                # 안전도 분석 (키워드 기반)
    │   ├── history.js                # 시청 기록
    │   ├── profiles.js               # 프로필 관리
    │   ├── badges.js                 # 배지 시스템
    │   ├── favorites.js              # 찜 기능
    │   ├── search-history.js         # 검색 히스토리
    │   ├── blocked-keywords.js       # 차단 키워드
    │   ├── alerts.js                 # 위험 영상 알림
    │   └── chat.js                   # 키디 AI 챗봇
    └── data/
        ├── profiles.json             # 프로필 데이터
        ├── history.json              # 시청 기록
        ├── badges.json               # 획득 배지
        ├── favorites.json            # 찜 목록
        ├── searches.json             # 검색 히스토리
        ├── blocked-keywords.json     # 차단 키워드 (system + custom)
        ├── alerts.json               # 위험 영상 알림 목록
        └── alert-settings.json       # 알림 기준 설정
```

---

## 백엔드 API 엔드포인트 (포트 3000)

### 검색
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET/POST | `/search` | 영상(20개) + 재생목록 검색 |
| GET | `/search/recommend` | 나이별 추천 영상 |
| GET | `/search/history-recommend` | 시청 기록 기반 추천 |

### 안전도
| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/analyze` | 안전도 분석 (키워드 기반) |

### 시청 기록
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/history` | 전체 시청 기록 조회 |
| POST | `/history` | 시청 기록 저장 (violence, language, sexual, educational 포함) |
| DELETE | `/history/item?watchedAt=&profileId=` | 특정 기록 삭제 |
| DELETE | `/history/all?profileId=` | 전체/프로필별 기록 삭제 |

### 프로필
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/profiles` | 전체 프로필 조회 |
| POST | `/profiles` | 프로필 생성 (safetyThreshold 자동 설정) |
| PUT | `/profiles/:id` | 프로필 수정 (safetyThreshold 포함) |
| DELETE | `/profiles/:id` | 프로필 삭제 |

### 배지
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/badges/:profileId` | 배지 조회 |
| POST | `/badges/check/:profileId` | 배지 조건 체크 및 부여 |

### 찜
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/favorites` | 찜 목록 조회 |
| POST | `/favorites` | 찜 추가 |
| DELETE | `/favorites/:id` | 찜 해제 |

### 검색 히스토리
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/search-history` | 검색 히스토리 조회 |
| POST | `/search-history` | 검색 히스토리 저장 |
| DELETE | `/search-history/:id` | 1개 삭제 |
| DELETE | `/search-history/all/:profileId` | 전체 삭제 |

### 차단 키워드
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/blocked-keywords` | 전체 키워드 조회 |
| GET | `/blocked-keywords/check?keyword=` | 차단 여부 확인 |
| POST | `/blocked-keywords/custom` | 커스텀 키워드 추가 |
| DELETE | `/blocked-keywords/custom/:keyword` | 커스텀 키워드 삭제 |

### 위험 영상 알림
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/alerts` | 알림 목록 조회 |
| PATCH | `/alerts/:id/read` | 읽음 처리 |
| PATCH | `/alerts/read-all` | 전체 읽음 처리 |
| GET | `/alerts/settings` | 알림 설정 조회 |
| PUT | `/alerts/settings` | 알림 설정 저장 |

### 키디 챗봇
| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/chat` | Anthropic API 호출 (claude-haiku-4-5-20251001) |

---

## 구현 완료 기능

### 아이 화면 (KidHome.jsx)
- 나이별 YouTube 영상 검색 + 안전도 필터링
- Anti-Bias 편식 방지 로직 (70% 초과 시 감점, 새 영역 +20점)
- 오늘의 추천 영상 (나이별 키워드)
- 시청 기록 기반 추천 영상
- 재생목록 검색 + 모달
- 더보기 기능 (검색 9개씩, 추천 6개씩)
- 검색 결과 sessionStorage 유지 (이탈 후 복귀 시 복원)
- 찜(하트) 버튼 시각 피드백
- 검색 히스토리 (최근 검색어 표시/삭제)
- 차단 키워드 검색 자동 차단
- 배지 시스템 21개 (시청/안전/장르/찜/탐험/마스터)
- 배지 컬렉션 페이지 (카테고리 탭, 진행도 바)
- 키디 AI 챗봇 (플로팅 버튼, 빠른 질문 3개)
- ?q= 파라미터로 데모 키워드 지정 가능 (랜딩 미리보기용)

### 부모 화면 (ParentDashboard.jsx)
- 프로필 관리 (생성/삭제/수정)
- 시청 시간 제한 설정
- 프로필별 안전도 기준점수 커스텀 (슬라이더, 50~95점)
- 시청 기록 조회 (프로필 탭 필터)
  - 10개씩 더보기
  - 개별 삭제 / 전체 삭제
  - 영상 클릭 시 상세 모달 (VideoModal 재활용)
- 시청 패턴 분석 (프로필별 독립 탭)
  - 안전도 분포 PieChart
  - 최다 시청 채널 TOP5 HorizontalBarChart
  - 시간대별 시청 BarChart
  - 최근 7일 시청 추이 LineChart
- 위험 영상 알림 (심각도 2단계, 반복 시청 감지, 채널 차단 연동)
- 알림 설정 (기준 점수 슬라이더, 심야 알림 토글)
- 차단 키워드 관리 (시스템 기본 + 커스텀 추가/삭제)

### 랜딩 페이지 (Landing.jsx)
- Hero 섹션 (그라데이션 애니메이션, 방패 floating, fadeInUp)
- 스크롤 reveal 애니메이션 (IntersectionObserver 기반)
- 기능 소개 4개 카드 + 학부모용 "왜 필요한가요?" 설명
- 앱 미리보기 섹션
  - 아이 화면: 스마트폰 모형 iframe (/kids)
  - 부모 화면: 브라우저 모형 iframe (/parent)
- 숫자 카운트업 애니메이션 (21개 배지, 3단계, 4명)
- 4단계 사용법 플로우 (연결선 포함)
- 회원가입 버튼 (준비 중 배지)
- 영상 배경 준비됨 (주석 처리 — /public/intro.mp4 넣고 해제)
- 푸터

---

## 안전도 기준

| 점수 | 등급 | 색상 |
|---|---|---|
| 90점 이상 | 안전 | green |
| 70~89점 | 주의 | yellow |
| 69점 이하 | 위험 | red |

### 나이별 기본 safetyThreshold
| 나이 | 기본값 |
|---|---|
| 3세 | 90점 |
| 5세 | 85점 |
| 7세 | 80점 |
| 10세 | 70점 |

---

## 배지 시스템 (21개)

| 카테고리 | 배지 |
|---|---|
| 시청 | 첫 영상 🎬, 10개 달성 🎯, 50개 달성 🏆, 100개 달성 👑, 다양한 장르 🌈 |
| 안전 | 안전 수호자 🛡️, 완벽한 선택 ⭐, 위험 없는 하루 ✅ |
| 장르 | 동요 마스터 🎵, 과학 탐험가 🔬, 공룡 박사 🦕, 동화 왕국 📚 |
| 찜 | 찜 수집가 💝, 찜 마스터 💖, 재생목록 팬 🎬 |
| 탐험 | 호기심 탐험가 🔍, 장르 개척자 🗺️, 단골손님 📺, 저녁 탐험가 🌙 |
| 마스터 | 올스타 🌠, 과학 꿈나무 🔬 |

---

## 중요 설정 및 주의사항

### 안전도 분석 (analyze.js)
- 현재: 키워드 기반 (Anthropic 크레딧 절약 목적)
- chat.js만 Anthropic API 사용 (claude-haiku-4-5-20251001)

### 모바일 테스트
- `api.js` BASE_URL을 PC 로컬 IP로 변경 (예: http://192.168.0.x:3000)
- 서버는 `0.0.0.0`으로 바인딩되어 있어 모바일 접속 가능
- 배포 전 BASE_URL 반드시 `http://localhost:3000` 확인

### 랜딩페이지 영상 배경 연결 방법
1. `/client/public/intro.mp4` 파일 추가
2. `Landing.jsx` Hero 섹션 video 태그 주석 해제

### Git 커밋 방식 (Freddie 선호)
```bash
git add .
git commit -m "feat: 작업 내용"
git push origin master
```

---

## 남은 작업

1. **UI 전체 개선** — 랜딩/아이/부모 화면 전반적인 디자인 고도화
2. **회원가입/로그인** — 현재 준비 중 상태 (추후 구현)
3. **랜딩 배경 영상** — 직접 제작 후 `/client/public/intro.mp4` 추가
4. **Vercel 배포** — 프론트 배포 + Railway 백엔드 배포
5. **README 작성** — 포트폴리오용 문서화

---

## 코드 규칙 (필수)

- 모든 주석과 답변은 한국어
- 함수형 컴포넌트만 사용 (class형 금지)
- Axios만 사용 (fetch 금지)
- Tailwind CSS만 사용 (인라인 style 불가피한 경우만 허용)
- try-catch 필수
- 백엔드는 ES Module 방식 (`import/export`) — `require()` 절대 금지
- 기존 파일 절대 삭제 금지 (VideoModal.jsx 삭제 사고 전례 있음)
