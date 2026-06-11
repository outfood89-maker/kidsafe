# KidSafe IFrame Player 작업 지침서
> Claude Code에게 전달하는 실행 문서

---

## 작업 목표

YouTube 영상을 새 탭으로 여는 방식(`window.open`)을 제거하고,
KidSafe 안에서 직접 재생하는 IFrame Player 방식으로 전환한다.

이를 통해:
- 정확한 시청 시간 측정 (초 단위)
- 시간 초과 시 영상 강제 정지
- 영상 종료 후 자동으로 KidSafe 화면 복귀
- 시청 시간 백엔드 저장

---

## 기술 스택

- 라이브러리: `react-youtube` (YouTube IFrame Player API React 래퍼)
- 설치 명령어: `npm install react-youtube` (client 폴더에서 실행)
- 공식 문서: https://www.npmjs.com/package/react-youtube

---

## 아키텍처 설계 (확정)

```
영상 카드 클릭
    ↓
VideoModal 열림 (안전도 점수 확인 — 기존과 동일)
    ↓
[재생하기] 버튼 클릭
    ↓
VideoModal 닫힘
    ↓
VideoPlayer.jsx 열림 (신규 컴포넌트)
├── YouTube IFrame 재생 시작
├── 타이머 시작 (1초마다 카운트)
├── 시간 초과 감지 → 영상 강제 정지 → 키디 시간종료 화면
└── 영상 종료 감지 → 시청 시간 저장 → 화면 닫힘
```

---

## 작업 1 — react-youtube 설치

client 폴더에서 실행:
```bash
npm install react-youtube
```

---

## 작업 2 — VideoPlayer.jsx 신규 생성

파일 위치: `client/src/components/VideoPlayer.jsx`

### 컴포넌트 props
```javascript
// 받아야 할 props
{
  video: {
    videoId: string,      // YouTube 영상 ID
    title: string,
    channelTitle: string,
    totalScore: number,
    profileId: string,
  },
  timeLimit: number,        // 프로필 시청 시간 제한 (분 단위, 없으면 null)
  usedMinutes: number,      // 오늘 이미 시청한 시간 (분 단위)
  onClose: function,        // 플레이어 닫기
  onWatchComplete: function // 시청 완료 시 부모에게 알림 (시청 시간 전달)
}
```

### 핵심 기능 구현

**1. YouTube IFrame 플레이어:**
```javascript
import YouTube from 'react-youtube'

const opts = {
  width: '100%',
  height: '100%',
  playerVars: {
    autoplay: 1,        // 자동 재생
    rel: 0,             // 관련 영상 숨김 (다른 영상으로 새는 것 방지)
    modestbranding: 1,  // YouTube 로고 최소화
    fs: 0,              // 전체화면 버튼 숨김
  }
}

<YouTube
  videoId={video.videoId}
  opts={opts}
  onReady={handleReady}
  onPlay={handlePlay}
  onPause={handlePause}
  onEnd={handleEnd}
  onError={handleError}
/>
```

**2. 타이머 구현 (초 단위):**
```javascript
const [watchSeconds, setWatchSeconds] = useState(0)
const [isPlaying, setIsPlaying] = useState(false)
const timerRef = useRef(null)

// 재생 시작 시 타이머 시작
const handlePlay = () => {
  setIsPlaying(true)
  timerRef.current = setInterval(() => {
    setWatchSeconds(prev => prev + 1)
  }, 1000)
}

// 일시정지/종료 시 타이머 멈춤
const handlePause = () => {
  setIsPlaying(false)
  clearInterval(timerRef.current)
}

// 컴포넌트 언마운트 시 타이머 정리
useEffect(() => {
  return () => clearInterval(timerRef.current)
}, [])
```

**3. 시간 초과 감지:**
```javascript
useEffect(() => {
  if (!timeLimit) return

  // 오늘 총 시청 시간 (이미 본 것 + 지금 보는 것)
  const totalSeconds = (usedMinutes * 60) + watchSeconds
  const limitSeconds = timeLimit * 60

  if (totalSeconds >= limitSeconds) {
    // 영상 강제 정지
    playerRef.current.stopVideo()
    setTimeLimitReached(true)
  }
}, [watchSeconds])
```

**4. 영상 종료 처리:**
```javascript
const handleEnd = async () => {
  clearInterval(timerRef.current)

  // 시청 시간 백엔드 저장
  await saveWatchTime({
    profileId: video.profileId,
    videoId: video.videoId,
    watchSeconds: watchSeconds,
  })

  // 부모에게 완료 알림
  onWatchComplete(watchSeconds)
  onClose()
}
```

**5. 임베드 불가 영상 처리:**
```javascript
const handleError = (error) => {
  // 에러 코드 5 = 임베드 불가 영상
  setEmbedError(true)
}

// 에러 시 UI
{embedError && (
  <div>
    <p>이 영상은 KidSafe에서 바로 볼 수 없어요.</p>
    <button onClick={() => window.open(`https://www.youtube.com/watch?v=${video.videoId}`, '_blank')}>
      YouTube에서 보기
    </button>
  </div>
)}
```

### UI 구조
```
┌─────────────────────────────────┐
│ [X 닫기]         KidSafe        │  ← 상단 헤더
├─────────────────────────────────┤
│                                 │
│     YouTube IFrame 플레이어     │  ← 16:9 비율 유지
│                                 │
├─────────────────────────────────┤
│ ⏱ 시청 시간: 03:24             │  ← 현재 시청 시간
│ 제한: 60분 중 23분 사용         │  ← 남은 시간 (timeLimit 있을 때만)
├─────────────────────────────────┤
│ 채널명                          │
│ 영상 제목                       │
│ 안전 96점 🟢                    │
└─────────────────────────────────┘
```

### 시간 초과 화면
```
┌─────────────────────────────────┐
│                                 │
│      키디 이미지 (지친 표정)     │
│                                 │
│    오늘 시청 시간이 끝났어요!   │
│    내일 또 만나요 🦕            │
│                                 │
│      [확인] 버튼                │
└─────────────────────────────────┘
```

---

## 작업 3 — VideoModal.jsx 수정

기존 "영상 보러가기" 버튼의 동작 변경:

**기존:**
```javascript
// window.open으로 새 탭 열기
const handleWatchClick = () => {
  onWatch(video)  // → window.open 호출
}
```

**변경:**
```javascript
// VideoPlayer 열기
const handleWatchClick = () => {
  onPlayInApp(video)  // → VideoPlayer 컴포넌트 열기
}
```

버튼 텍스트 변경:
- 기존: "🎬 영상 보러가기"
- 변경: "▶ KidSafe에서 보기"

---

## 작업 4 — KidHome.jsx 수정

### 추가할 state
```javascript
const [playingVideo, setPlayingVideo] = useState(null) // 현재 재생 중인 영상
```

### VideoPlayer 렌더링 추가
```javascript
{playingVideo && (
  <VideoPlayer
    video={playingVideo}
    timeLimit={selectedProfile?.timeLimit || null}
    usedMinutes={todayMinutes}
    onClose={() => setPlayingVideo(null)}
    onWatchComplete={(seconds) => {
      // 시청 완료 후 시청 시간 업데이트
      checkTimeLimit(selectedProfile)
      checkBadges(selectedProfile.id)
      setPlayingVideo(null)
    }}
  />
)}
```

### VideoModal onPlayInApp 연결
```javascript
{selectedVideo && (
  <VideoModal
    video={selectedVideo}
    onClose={() => setSelectedVideo(null)}
    onPlayInApp={(video) => {
      setSelectedVideo(null)
      setPlayingVideo(video)  // VideoPlayer 열기
    }}
  />
)}
```

### window.open 제거
기존 `handleVideoClick` 함수에서 `window.open` 코드 제거.
VideoPlayer가 대신 처리하므로 더 이상 필요 없음.

---

## 작업 5 — 백엔드 시청 시간 저장 (선택)

현재 history.json에 시청 시간(초)을 추가로 저장하면 나중에 부모 대시보드에서 "실제 시청 시간"을 보여줄 수 있음.

`server/routes/history.js` POST 라우터에 `watchSeconds` 필드 추가:
```javascript
// history.json 필드에 추가
{
  ...기존 필드,
  watchSeconds: number  // 실제 시청 시간 (초)
}
```

---

## 작업 순서 (이 순서로 진행)

1. `client` 폴더에서 `npm install react-youtube` 실행
2. `VideoPlayer.jsx` 신규 생성
3. `VideoModal.jsx` 버튼 수정 (window.open → onPlayInApp)
4. `KidHome.jsx` VideoPlayer 연결
5. `history.js` watchSeconds 필드 추가 (선택)
6. 브라우저에서 테스트:
   - 영상 클릭 → VideoModal → 재생 → 타이머 동작 확인
   - 시간 초과 시 강제 정지 확인
   - 영상 종료 후 화면 복귀 확인
   - 임베드 불가 영상 에러 처리 확인

---

## 주의사항

- 기존 파일 삭제 금지 — 수정만 할 것
- 백엔드 코드는 history.js watchSeconds 추가 외 건드리지 말 것
- ES Module 방식 유지 (import/export)
- 모든 주석 한국어
- try-catch 필수
- Tailwind CSS만 사용

---

## 참고 — 현재 관련 파일

```
client/src/
├── components/
│   ├── VideoModal.jsx   ← 수정 필요
│   └── VideoPlayer.jsx  ← 신규 생성
├── pages/
│   └── KidHome.jsx      ← 수정 필요
└── utils/
    └── api.js           ← saveHistory 함수 활용
server/routes/
└── history.js           ← watchSeconds 추가 (선택)
```
