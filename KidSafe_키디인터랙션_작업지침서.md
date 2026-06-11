# KidSafe 키디 인터랙션 시스템 작업지침서
> 작성 기준: 2026-06-12 — 회의 결과 확정

---

## 기획 배경

- 아이가 앱에 진입했을 때 키디가 먼저 반겨주는 경험 제공
- 시간 초과 후 갑자기 끊기는 게 아니라 키디와 대화로 자연스럽게 착지
- 도파민 급격한 차단 방지 → 부드러운 마무리 UX

---

## 기능 1 — KidHome 키디 자동 인사

### 확정 설계

- 키디가 히어로 배너 위에 **항상 고정**되어 있음
- 클릭할 때마다 **포즈가 바뀌면서 대사가 순서대로 출력**
- ChatWidget 열지 않음 — 말풍선만 표시

### 대사 순서 (클릭할 때마다 순환)
```javascript
const GREETING_DIALOGUES = [
  { pose: "wave",  text: "안녕 {name}야! 반가워~ 😊" },
  { pose: "think", text: "오늘은 뭐하고 지냈어?" },
  { pose: "happy", text: "엄마아빠 말씀 잘 듣고 있지? ^_^" },
  { pose: "cheer", text: "오늘도 재미있는 영상 찾아보자!" },
];
// {name}은 선택된 프로필 이름으로 치환
```

### UI 구조
```
히어로 배너 우측 하단 (또는 좌측 하단)
┌────────────────────────────┐
│  [말풍선: 안녕 예준이 반가워~]  │
│         키디 아바타           │
│       (클릭 시 포즈 변경)      │
└────────────────────────────┘
```

### 수정 파일
- `client/src/pages/KidHome.jsx`
  - `greetingIndex` state 추가
  - 키디 아바타 + 말풍선 컴포넌트 배너에 배치
  - 클릭 시 `greetingIndex` 순환

---

## 기능 2 — 시간 초과 후 키디 연결

### 확정 설계

- 시간 초과 화면에 키디 아바타 + 말풍선 표시
- "키디에게 소감 말해보자~!" 버튼 추가
- 버튼 클릭 시 → **시간 초과 화면 위로 ChatWidget 슬라이드업** (화면 전환 없음)
- ChatWidget 첫 메시지: 시청한 영상 제목 포함하여 자동 세팅

### 시간 초과 화면 변경사항 (VideoPlayer.jsx)

**기존:**
```jsx
<KiddyImg pose="sleep" size={160} />
// 말풍선: "다음에 봐요! 👋"
// 버튼: 확인 (1개)
```

**변경:**
```jsx
<KiddyImg pose="excited" size={160} />  // 포즈 변경
// 말풍선: "오늘 시청 시간이 끝났어! 영상 재미있었어? 😄"
// 버튼 2개:
// 1) "💬 키디에게 소감 말해보자~!"  ← 새로 추가
// 2) "확인"
```

### ChatWidget 첫 메시지 자동 세팅

```javascript
// VideoPlayer에서 ChatWidget 열 때 initialMessage 전달
<ChatWidget
  initialMessage={`아까 [${video.title}] 봤지? 어땠어? 키디한테 소감 말해봐! 😊`}
  onClose={...}
/>
```

### ChatWidget.jsx 수정
- `initialMessage` prop 추가
- prop이 있으면 기본 인사말 대신 해당 메시지로 시작

```javascript
export default function ChatWidget({ onClose, isOpen = true, initialMessage = null, ... }) {
  const [chatMessages, setChatMessages] = useState([
    {
      role: "assistant",
      content: initialMessage ?? "안녕! 나는 키디야~ 궁금한 게 있으면 뭐든지 물어봐! 😊"
    }
  ]);
  // ...
}
```

### 화면 전환 방식 — B안 확정
- 시간 초과 화면 **위에** ChatWidget 슬라이드업
- 화면 전환 없이 자연스럽게 이어짐
- VideoPlayer가 `chatMounted` + `chatOpen` state를 갖고 관리

```javascript
// VideoPlayer.jsx 추가 state
const [chatMounted, setChatMounted] = useState(false);
const [chatOpen, setChatOpen] = useState(false);

// 버튼 클릭 시
const handleKiddyChat = () => {
  setChatMounted(true);
  setChatOpen(true);
};

// 렌더링
{chatMounted && (
  <ChatWidget
    isOpen={chatOpen}
    initialMessage={`아까 [${video.title}] 봤지? 어땠어? 키디한테 소감 말해봐! 😊`}
    onClose={() => { setChatMounted(false); setChatOpen(false); }}
  />
)}
```

---

## 수정 파일 요약

| 파일 | 작업 내용 |
|---|---|
| `client/src/pages/KidHome.jsx` | 키디 자동 인사 (포즈 순환 + 말풍선) 추가 |
| `client/src/components/VideoPlayer.jsx` | 시간 초과 화면 키디 포즈/대사 변경 + 키디 버튼 추가 + ChatWidget 연결 |
| `client/src/components/ChatWidget.jsx` | `initialMessage` prop 추가 |

---

## 개발 순서

1. **ChatWidget.jsx** — `initialMessage` prop 추가 (가장 작은 작업)
2. **VideoPlayer.jsx** — 시간 초과 화면 수정 + ChatWidget 연결
3. **KidHome.jsx** — 키디 자동 인사 시스템 추가

---

## 주의사항
- 기존 파일 삭제 금지 — 수정만 할 것
- 모든 주석 한국어
- try-catch 필수
- Tailwind CSS만 사용
