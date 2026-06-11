# KidSafe 미니게임 시스템 작업지침서
> 작성 기준: 2026-06-12 — 회의 결과 확정

---

## 기획 배경

- 아이들이 자극적인 미디어에 노출되어 도파민에 절여지는 것을 예방
- 시간 제한 후 자연스럽게 착지할 수 있는 경험 제공
- 교육적 게임으로 추가 시청 시간을 보상 → 학습 동기 부여

---

## 확정된 설계

### 게임 종류 (5종)
| 순서 | 게임 | 교육 효과 | 개발 난이도 |
|---|---|---|---|
| 1 | OX 퀴즈 | 상식, 과학 | ⭐ 쉬움 (먼저 개발) |
| 2 | 간단한 덧셈/뺄셈 | 수학 | ⭐ 쉬움 |
| 3 | 그림 보고 단어 맞추기 | 언어, 어휘 | ⭐⭐ 보통 |
| 4 | 기억력 카드 뒤집기 | 집중력 | ⭐⭐ 보통 |
| 5 | 순서 맞추기 (스토리) | 논리 | ⭐⭐⭐ 어려움 (나중에) |

### 등장 방식 — C안 확정
1. **탭바에 게임 버튼 상시 존재** → 아이가 원할 때 언제든 접근
2. **시간 초과 후 자동 유도** → "키디랑 퀴즈 풀면 시간이 더 생겨요!" 안내

### 보상 시스템 — A안 확정
| 정답 수 | 추가 시청 시간 |
|---|---|
| 3문제 맞춤 | +3분 |
| 5문제 전부 맞춤 | +7분 |

### 하루 보너스 상한선
- 기본값: **20분**
- 부모가 **프로필별로 개별 설정 가능** (ParentDashboard에서)
- 상한에 도달하면 게임 플레이는 가능하지만 추가 시간은 미지급

---

## 아키텍처 설계

```
미니게임 플레이 완료
    ↓
보상 계산 (정답 수 → 보너스 분 결정)
    ↓
오늘 보너스 시간 누적 (bonusMinutes)
    ↓
최대 보너스 상한 체크 (profile.maxBonusMinutes, 기본 20분)
    ↓
KidHome의 todayMinutes에서 bonusMinutes 차감 반영
    ↓
VideoPlayer 시간 제한 자동 연장
```

---

## 데이터 설계

### profiles.json 필드 추가
```json
{
  "id": "profile_1",
  "name": "예준",
  "timeLimit": 60,
  "maxBonusMinutes": 20
}
```

### 게임 보너스 기록 (game-bonus.json 신규)
```json
[
  {
    "profileId": "profile_1",
    "date": "2026-06-12",
    "bonusMinutes": 7,
    "game": "ox-quiz",
    "correctCount": 5
  }
]
```

---

## 신규 파일 목록

```
client/src/
├── pages/
│   └── MiniGame.jsx              ← 게임 허브 (게임 선택 화면)
├── components/games/
│   ├── OXQuiz.jsx                ← OX 퀴즈 (1순위 개발)
│   ├── MathQuiz.jsx              ← 덧셈/뺄셈 (2순위)
│   ├── WordMatch.jsx             ← 단어 맞추기 (3순위)
│   ├── MemoryCard.jsx            ← 기억력 카드 (4순위)
│   └── StoryOrder.jsx            ← 순서 맞추기 (5순위)
└── utils/
    └── api.js                    ← getGameBonus, saveGameBonus 함수 추가

server/
├── routes/
│   └── game-bonus.js             ← GET/POST 보너스 API
└── data/
    └── game-bonus.json           ← 보너스 기록 저장
```

### App.jsx 라우터 추가
```jsx
<Route path="/games" element={<MiniGame />} />
```

---

## 수정 파일 목록

### BottomTabBar.jsx
- 게임 탭 아이콘 추가 (🎮 또는 FaGamepad)
- `/games` 라우터 연결

### VideoPlayer.jsx (시간 초과 화면)
- "키디랑 퀴즈 풀면 시간이 더 생겨요!" 버튼 추가
- 버튼 클릭 시 `/games`로 이동

### KidHome.jsx
- `bonusMinutes` state 추가
- `todayMinutes`에서 `bonusMinutes` 차감하여 실질 남은 시간 계산
- 게임 완료 후 복귀 시 보너스 반영

### ParentDashboard.jsx
- 프로필 설정에 `maxBonusMinutes` 슬라이더 추가
- 기본값 20분, 범위 0~60분

---

## 개발 순서

1. **백엔드** — `game-bonus.js` 라우터 + `game-bonus.json` 생성
2. **api.js** — `getGameBonus`, `saveGameBonus` 함수 추가
3. **profiles.json** — `maxBonusMinutes` 필드 추가
4. **OXQuiz.jsx** — 첫 번째 게임 구현 (5문제, 문제 데이터 하드코딩)
5. **MiniGame.jsx** — 게임 허브 화면 (현재는 OX 퀴즈만, 나중에 추가)
6. **App.jsx** — `/games` 라우터 추가
7. **BottomTabBar.jsx** — 게임 탭 추가
8. **VideoPlayer.jsx** — 시간 초과 후 게임 유도 버튼 추가
9. **KidHome.jsx** — 보너스 시간 반영 로직 추가
10. **ParentDashboard.jsx** — maxBonusMinutes 설정 UI 추가
11. 나머지 게임 순서대로 추가

---

## OX 퀴즈 문제 데이터 (초안)

```javascript
const OX_QUESTIONS = [
  { q: "지구는 태양 주위를 돌아요", answer: true },
  { q: "고래는 물고기예요", answer: false },
  { q: "사과는 과일이에요", answer: true },
  { q: "달은 스스로 빛을 내요", answer: false },
  { q: "식물은 햇빛으로 음식을 만들어요", answer: true },
  { q: "펭귄은 날 수 있어요", answer: false },
  { q: "물은 100도에서 끓어요", answer: true },
  { q: "곰은 겨울에 잠을 자요", answer: true },
  { q: "무지개는 7가지 색이에요", answer: true },
  { q: "박쥐는 눈으로 길을 찾아요", answer: false },
];
```

---

## 주의사항
- 기존 파일 삭제 금지 — 수정만 할 것
- 백엔드는 ES Module 방식 (`import/export`) — `require()` 절대 금지
- 모든 주석 한국어
- try-catch 필수
- Tailwind CSS만 사용 (인라인 style 불가피한 경우만 허용)
