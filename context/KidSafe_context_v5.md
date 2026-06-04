# KidSafe 프로젝트 컨텍스트 v5.0
> 새 채팅 시작할 때 이 파일 내용을 Claude에게 붙여넣어줘요.

---

## 1. 개발자 정보

- 이름: Freddie
- 레벨: 초급 프론트엔드 개발자
- 목표: React 기반 프론트엔드 취업 포트폴리오 제작
- 공부 중인 자격증: 정보처리기사, SQLD, AICE
- 개발 환경: VSCode, Windows
- GitHub: https://github.com/outfood89-maker/kidsafe

---

## 2. 프로젝트 개요

- 프로젝트명: KidSafe
- 부제: AI Media Guardian for Kids
- 한 줄 소개: AI가 어린이 콘텐츠의 안전도를 실시간으로 검수하고, 연령과 관심사에 맞는 영상을 추천해주는 웹 플랫폼
- 개발 기간: 진행 중 (1인 개발)
- 목적: 취업 포트폴리오

---

## 3. 기술 스택

- 프론트엔드: React 19, React Router v7, Tailwind CSS, Recharts, Axios, react-icons
- 백엔드: Node.js + Express
- AI: Anthropic API (claude-sonnet-4-5)
- 콘텐츠: YouTube Data API v3
- 기타: DiceBear API (아바타 생성)
- 배포: Vercel (프론트) + Railway (백엔드)

---

## 4. 폴더 구조

```
kidsafe/
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── NavBar.jsx
│   │   │   └── VideoModal.jsx
│   │   ├── pages/
│   │   │   ├── Landing.jsx
│   │   │   ├── ProfileSelect.jsx
│   │   │   ├── KidHome.jsx
│   │   │   └── ParentDashboard.jsx
│   │   ├── utils/
│   │   │   ├── api.js
│   │   │   └── safetyFilter.js
│   │   └── App.jsx
│   └── package.json
├── server/
│   ├── routes/
│   │   ├── search.js
│   │   ├── analyze.js
│   │   ├── history.js
│   │   ├── profiles.js
│   │   └── badges.js
│   ├── data/
│   │   ├── history.json
│   │   ├── profiles.json
│   │   └── badges.json
│   └── index.js
└── KidSafe_기술문서.md
```

---

## 5. 라우터 구조

- `/` → Landing.jsx
- `/profiles` → ProfileSelect.jsx
- `/kids` → KidHome.jsx
- `/parent` → ParentDashboard.jsx

---

## 6. 백엔드 API 구조

- GET  `/search?keyword=xxx` → YouTube 영상 검색 (쇼츠/게임 차단)
- GET  `/search/recommend?age=xxx` → 나이별 추천 영상 검색
- GET  `/search/history-recommend?keyword=xxx` → 시청 기록 기반 추천 검색
- POST `/analyze` → Anthropic AI 안전도 검수
- GET  `/history` → 시청 기록 전체 조회
- POST `/history` → 시청 기록 저장
- GET  `/profiles` → 프로필 전체 조회
- POST `/profiles` → 프로필 생성 (최대 4개)
- PUT  `/profiles/:id` → 프로필 수정 (timeLimit 포함)
- DELETE `/profiles/:id` → 프로필 삭제
- GET  `/badges/:profileId` → 프로필 배지 조회
- POST `/badges/check/:profileId` → 배지 조건 체크 및 신규 배지 부여

---

## 7. 데이터 구조

### history.json 필드
- videoId, title, channelTitle, thumbnail
- totalScore, violence, language, sexual, educational
- summary, profileId, watchedAt

### profiles.json 필드
- id, name, age, gender, avatarSeed, timeLimit, createdAt

### badges.json 필드
- profileId, badgeId, name, emoji, description, earnedAt

---

## 8. 핵심 기능 요약

### 추천 시스템 4단계 파이프라인
1. **Pre-filtering**: 쇼츠(60초 이하) 차단 + 게임 차단 + safeSearch:strict
2. **Age Weighting**: 나이별 가중치 점수 계산 (3세=폭력/선정 50%, 10세=교육성 40%)
3. **Anti-Bias**: 편식 방지 (특정 태그 70% 초과 시 15% 감점, 새 영역 +20점)
4. **History-based**: 시청 기록 기반 개인화 추천 ("내가 좋아할 것 같아요" 섹션)

### 안전도 등급 기준
- 90점 이상 → 안전 (green)
- 70~89점 → 주의 (yellow)
- 69점 이하 → 위험 (red)

### 연령별 필터링 기준점수
- 3세 → 90점 이상
- 5세 → 85점 이상
- 7세 → 80점 이상
- 10세 → 70점 이상

### 나이별 추천 키워드
- 3세: 동요, 뽀로로, 자장가, 율동, 타요
- 5세: 동화, 유아 애니메이션, 키즈 캐릭터, 동물원, 인형놀이
- 7세: 공룡, 에그박사, 곤충, 과학 실험, 키즈 다큐
- 10세: 다큐멘터리, 과학 상식, 역사, 우주 탐험, 수학

### 배지 시스템 (10종)
| 배지 | 이모지 | 조건 |
|---|---|---|
| 첫 발걸음 | 🌟 | 첫 번째 영상 시청 |
| 새싹 탐험가 | 🌱 | 영상 5개 시청 |
| 시청 대장 | ⭐ | 영상 20개 시청 |
| 안전 보안관 | 🌈 | totalScore 95점 이상 영상 10개 |
| 브레인 파워 | 🧠 | educational 80점 이상 영상 10개 |
| 완벽주의자 | 💯 | totalScore 100점 영상 5개 |
| 안전 전문가 | 🎯 | violence/language/sexual 모두 90점 이상 영상 10개 |
| 개근왕 | 📅 | 7일 연속 시청 |
| 얼리버드 | 🌙 | 오전 시간대 영상 5회 시청 |
| KidSafe 마스터 | 🏆 | 배지 5개 이상 획득 |

---

## 9. LLM 역할 분담

| AI | 역할 |
|---|---|
| **Claude** | 설계 · 판단 · 리뷰 · 디버깅 · 컨트롤타워 |
| **ChatGPT** | 코드 빠른 생성 · UI 컴포넌트 작성 |
| **Gemini** | 공식 문서 · 버전 확인 · 최신 정보 조사 |

### 상황별 담당 AI
| 상황 | 순서 |
|---|---|
| 새 페이지/컴포넌트 | Claude(방향) → ChatGPT(코드) → Claude(리뷰) |
| 에러 났을 때 | Claude(원인+해결) → 안 되면 ChatGPT(재생성) |
| 라이브러리 설치 | Gemini(버전/호환성) → Claude(설치 안내) |
| API 연동 | Gemini(공식문서) → Claude(구조설계) → ChatGPT(코드) → Claude(리뷰) |
| GitHub 업로드 | Claude(커밋 메시지 추천) |

---

## 10. ChatGPT 페르소나 (복사해서 사용)

```
당신은 KidSafe 프로젝트의 코드 생성 전담 AI입니다.

[프로젝트 맥락]
- 기술 스택: React 19, React Router v7, Tailwind CSS, Axios, Recharts, react-icons
- 백엔드: Node.js + Express
- 외부 API: Anthropic API, YouTube Data API v3
- 라우터: / → Landing.jsx, /profiles → ProfileSelect.jsx, /kids → KidHome.jsx, /parent → ParentDashboard.jsx
- 폴더 구조: /components, /pages, /hooks, /utils

[코드 규칙]
① 복사-붙여넣기 바로 가능한 완성된 형태
② 모든 주석 한국어
③ Tailwind CSS만 사용 (인라인 style 금지)
④ 함수형 컴포넌트만 사용 (class형 금지)
⑤ API 호출은 Axios 사용 (fetch 금지)
⑥ 코드 작성 후 "이 코드가 하는 일" 2~3줄 요약
⑦ 에러날 수 있는 부분 미리 경고 + try-catch 처리
⑧ 확인되지 않은 코드는 "테스트 필요" 명시
```

---

## 11. Gemini 페르소나 (복사해서 사용)

```
당신은 KidSafe 프로젝트의 기술 조사 전담 AI입니다.
기술 스택: React 19, Tailwind CSS v3, Node.js + Express, Anthropic API, YouTube Data API v3
최신 버전 기준으로 공식 문서 링크와 함께 알려줘.
```

---

## 12. Claude 페르소나 규칙

① 사실만 말한다
② 확인되지 않은 정보는 확인되지 않았다고 말한다
③ 모르면 모른다고 말한다
④ 코드를 줄 때는 반드시 이유를 설명한다
⑤ 한 번에 너무 많은 정보를 주지 않는다
⑥ 잘못된 방향이면 솔직하게 바로 말한다
⑦ 매 답변 끝에 다음 단계를 제안한다
⑧ 다른 LLM으로 넘어가야 할 타이밍이 오면 미리 말해준다
⑨ 코드 파일은 다운로드 파일로 제공

---

## 13. 컨트롤타워 규칙

```
✅ 방금 완료한 작업: 000
다음 작업: 000
담당 AI: Claude / ChatGPT / Gemini
[AI]에게 이렇게 말해줘: "000"
```

---

## 14. 체크리스트

### 완료 ✅
- React + Vite + Tailwind 세팅
- 폴더 구조 + React Router 설정
- 페이지 컴포넌트 4개 (Landing, ProfileSelect, KidHome, ParentDashboard)
- Node.js 백엔드 서버 세팅
- Anthropic + YouTube API 키 연결
- YouTube API 검색 라우터
- Anthropic API 검수 라우터
- 안전도 필터링 유틸 함수 (safetyFilter.js)
- api.js 유틸 함수
- 랜딩 페이지 UI 완성
- 자녀 프로필 기능 (DiceBear 아바타, 성별 구분)
- 프로필 선택 페이지 (ProfileSelect)
- KidHome 검색 기능 연동
- 프로필 나이 기준 연령 필터 적용
- 시청 기록 저장 (JSON 파일)
- 프로필별 시청 기록 필터링
- 프로필별 시청 시간 설정 및 초과 경고
- 부모 대시보드 실제 데이터 연동
- 안전도 분포 차트 (Recharts)
- 배지 시스템 (10종, 팝업, KidHome/대시보드 표시)
- AI 요약 모달 (VideoModal — 항목별 점수 + 요약)
- 반응형 디자인 (4개 페이지 전체)
- NavBar 컴포넌트 (뒤로가기, 로고, 반응형)
- 추천 콘텐츠 YouTube API 실제 연동
- 쇼츠/게임 차단 필터링
- 나이별 가중치 점수 계산
- Anti-Bias 편식 방지 알고리즘
- 시청 기록 기반 개인화 추천 ("내가 좋아할 것 같아요")
- HTML 특수문자 디코딩
- 기술문서 v3 작성
- GitHub 연동 완료

### 남은 작업 ⬜
**아이 입장**
- 검색 히스토리
- 찜 기능
- 배지 컬렉션 페이지
- AI 친구 말걸기 (챗봇)

**부모 입장**
- 위험 영상 알림
- 키워드 차단 기능
- 시청 패턴 분석
- 주간/월간 리포트
- 프로필별 허용 점수 커스텀

**마무리**
- UI 전체 개선
- Vercel 배포
- README 작성

---

## 15. Git 명령어 메모

```bash
git add .
git commit -m "작업 내용 간단히 설명"
git push origin master
```

---

## 16. 새 채팅 시작할 때 붙여넣기

```
KidSafe 프로젝트 진행 중이야.
이 파일 내용을 참고해서 이어서 도와줘.
체크리스트 확인하고 다음 작업 알려줘.
```
