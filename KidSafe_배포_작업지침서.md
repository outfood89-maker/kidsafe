# KidSafe 배포 작업지침서
> 작성 기준: 2026-06-13 — 회의 결과 확정

---

## 배포 구조

```
사용자 브라우저
      ↓
  Vercel (프론트 — React)
      ↓ API 요청
  Railway (백엔드 — Node.js)
      ↓
  YouTube API / Anthropic API
```

- **Vercel** — 프론트 호스팅, GitHub push 시 자동 배포, 무료
- **Railway** — 백엔드 호스팅, 월 $5 / 무료 플랜 월 500시간

---

## 확정 사항

- **데이터 초기화 문제 → A안 (그냥 두기)**
  - 포트폴리오 시연용이므로 서버 재시작 시 데이터 초기화 허용
  - MongoDB 등 외부 DB 연결은 나중에 시간 되면 추가

---

## 배포 전 코드 수정 사항

### 1. `client/src/utils/api.js` — BASE_URL 환경변수화

```js
// 변경 전
const BASE_URL = 'http://192.168.0.7:3000'

// 변경 후
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'
```

### 2. `client/.env.production` 파일 생성 (Vercel 환경변수용)

```
VITE_API_URL=https://[Railway 배포 후 확인되는 URL]
```

### 3. 백엔드 CORS 설정 수정 (`server/index.js`)

Railway 배포 후 Vercel URL을 화이트리스트에 추가:
```js
// 변경 전 (로컬 개발용)
app.use(cors())

// 변경 후
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://[vercel 배포 URL]'
  ]
}))
```

### 4. `server/package.json` — start 스크립트 확인

Railway가 실행할 명령어:
```json
"scripts": {
  "start": "node index.js"
}
```

---

## 배포 순서

### 1단계 — Railway 백엔드 배포
1. [railway.app](https://railway.app) 접속 → GitHub 계정으로 가입
2. New Project → Deploy from GitHub repo → kidsafe 선택
3. Root Directory를 `server`로 설정
4. 환경변수 추가 (Variables 탭):
   - `YOUTUBE_API_KEY` = 현재 .env 값
   - `ANTHROPIC_API_KEY` = 현재 .env 값
   - `PORT` = `3000`
5. 배포 완료 후 URL 확인 (예: `https://kidsafe-server.up.railway.app`)

### 2단계 — 코드 수정 후 GitHub push
1. `api.js` BASE_URL 환경변수화
2. CORS 설정에 Vercel URL 추가 (Vercel 배포 후 다시 수정 필요)
3. `git add . && git commit -m "feat: 배포 환경 설정" && git push`

### 3단계 — Vercel 프론트 배포
1. [vercel.com](https://vercel.com) 접속 → GitHub 계정으로 가입
2. New Project → kidsafe repo 선택
3. Root Directory를 `client`로 설정
4. Framework Preset: `Vite` 자동 감지됨
5. 환경변수 추가 (Environment Variables):
   - `VITE_API_URL` = Railway URL (예: `https://kidsafe-server.up.railway.app`)
6. Deploy 클릭
7. 배포 완료 후 URL 확인 (예: `https://kidsafe.vercel.app`)

### 4단계 — CORS 재설정 후 최종 push
1. Railway에서 확인한 Vercel URL을 백엔드 CORS에 추가
2. `git push` → Railway 자동 재배포

### 5단계 — 최종 테스트
- Vercel URL로 접속해서 전체 기능 확인
- 프로필 생성, 영상 검색, 영상 재생, 챗봇, 배지 등

---

## 주의사항

- `.env` 파일은 절대 GitHub에 push 금지 (`.gitignore` 확인)
- Railway 무료 플랜은 월 500시간 — 24시간 상시 운영 시 약 21일치
- 배포 후 api.js에 `localhost:3000` 남아있으면 프론트가 백엔드를 못 찾음
- Railway 서버 재시작 시 `server/data/*.json` 초기화됨 (A안 확정)

---

## 현재 .env 파일 위치

```
server/.env   ← YOUTUBE_API_KEY, ANTHROPIC_API_KEY 있음
```
Railway Variables 탭에 이 값들을 직접 입력해야 함.
