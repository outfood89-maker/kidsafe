# [핫픽스 지시서] X-2 — 키디의 방 v0 리뷰 확정 결함 8건 (커밋 전 수정)

> **출처:** 컨트롤타워 4렌즈 적대적 리뷰 + 발견별 반박 검증 (19 에이전트, 전부 코드 근거로 확정).
> **핵심:** major 2계열이 **가드레일 ③(위기 자동커버 — 양보 불가)** 을 레이스 윈도우에서 관통한다. 확률이 낮아도 위기 커버는 확률로 타협 불가.
> 카피 신규 작성 금지 — 아래 지정된 기존 카피만 재사용.

---

## 🔴 M1+M2 — 늦은 응답에서 care 신호 유실 + 유령 TTS (구조 수정 1개로 두 계열 해결)

**결함:**
- `handleUtterance`의 `if (endedRef.current) return`(:95)이 care 판정·`createCareSignal`(:98-108)보다 **앞** → ① 4분 59초 위기 발화 + 5분 타이머 경합 시 **부모 안전 신호가 조용히 유실**되고, 직전 턴 기준 silent 판정이라 위기 순간에 명랑한 FAREWELL이 재생됨. ② thinking 중 '‹ 홈으로'(:171, disabled 없음) 이탈 시 endedRef가 안 서서 **언마운트 후 voice.speak 실행** — KidHome 위 유령 TTS + TTS API 추가 호출 + Blob URL 누수.

**수정 — handleUtterance 응답 처리부 재구조 (순서가 본질):**
```js
const reply = data?.reply || "키디가 잠깐 졸았나봐... 다시 말해줘! 😅";
const isCrisis = data?.care === "high";
const isSoft = data?.care === "soft";

// ① 위기 신호는 세션 종료·페이지 이탈과 무관하게 무조건 생성 (가드레일 ③ — 어떤 가드보다 먼저)
if (isCrisis) { /* 기존 createCareSignal 블록 그대로 — fire-and-forget이라 언마운트 후에도 안전 */ }

// ② 세션 종료 후 도착한 응답
if (endedRef.current) {
  //   위기 응답이고 아직 화면에 있으면(타이머 종료 케이스) → FAREWELL을 덮고 고정응답 우선
  if (isCrisis && mountedRef.current) {
    setKiddyLine(reply);
    voice.stop();               // FAREWELL 재생 중이면 끊는다 — 위기 응답이 우선
    voice.speak(reply, "calm");
  }
  return; // 비위기 늦은 응답은 기존대로 무시
}
```
- **`mountedRef` 신설:** 마운트 effect cleanup에서 `mountedRef.current = false`. 언마운트 후에는 (위기여도) 표시·TTS 금지 — **신호 생성만** 수행. 이것으로 유령 TTS·Blob 누수·불필요 TTS 호출 전부 차단.

## 🟡 m3 — care:"soft" 미처리 (톤·리추얼 비일관)

- `speak` 톤: `(isCrisis || isSoft) ? "calm" : "bright"` — soft 위로 응답("그런 마음이 들 때가 있어…")이 명랑 톤으로 나가던 것 수정.
- `lastReplyCrisisRef` → **`lastReplyCareRef = isCrisis || isSoft`** 로 확장 + 8턴 종료 판정도 `silent: isCrisis || isSoft` — 위로 직후 "진짜 재밌었어!"가 붙는 톤 충돌 방지 (soft는 **신호는 계속 안 만든다** — high만).

## 🟡 m4 — 8번째 턴 답변이 화면에 안 보임 (React 배칭)

- `setKiddyLine(reply)`와 `finishSession→setKiddyLine(FAREWELL)`이 한 렌더로 합쳐져 8번째 답변 텍스트가 유실, 음성(답변→FAREWELL 순)과 불일치.
- **수정:** 정상(비 silent) 종료 시 FAREWELL **표시를 지연** — reply 먼저 타이핑되게 두고 `setTimeout`(reply 길이 기반, 대략 `reply.length * 28ms + 800ms`, 상한 4초) 후 `setKiddyLine(FAREWELL)`. 타이머는 cleanup에서 해제, `mountedRef` 가드. 음성은 현행(enqueue) 유지 — 순서가 자연히 일치하게 됨.

## 🟡 m5 — 0턴(또는 무발화) 5분 종료 시 "오늘 이야기 진짜 재밌었어!"

- 대화 0회에 그 카피는 사실 불일치 ('사실은 코드가' 원칙). **수정:** `finishSession`에서 `turnCountRef.current === 0`이면 `silent` 강제 (홈 버튼만).

## 🟡 m6 — 마이크 거부 시 상태 미복구 / 안내 깜빡임

- (a) `handleTap`이 start() 성공 전에 `phase="listening"`·kiddyLine을 선설정 → 거부 시 "듣고 있어!"가 영구 잔류하고 하단 "마이크를 쓸 수 없어"와 모순. (b) 전이 effect의 `speech.reset()`이 error를 지워 micDenied 안내가 한 렌더 만에 소멸.
- **수정:** ① `speech.error` 감시 effect 신설 — `"not-allowed"` 감지 시 **로컬 state에 래치**(`micBlocked=true`, reset이 지워도 유지) + `setPhase("idle")` + kiddyLine을 GREETING으로 복구. micDenied 분기는 래치 기준으로. ② 전이 effect의 reset은 transcript 소비 **후** 호출 순서 유지하되 error 래치가 선행되므로 안내 유실 없음.

## 🟡 m7 — 빈 transcript 후 "듣고 있어!" 잔류

- 탭→무발화→탭 시 phase만 idle로 돌아오고 대사가 남아 화면이 거짓말함.
- **수정:** 빈 transcript 경로(:82)에서 `setKiddyLine("아무 소리도 안 들렸어요. 다시 눌러서 말해봐요!")` — **기존 KidHome 검증 카피 재사용** (신규 카피 금지).

## 🟡 m8 — 타이머가 listening 중 발화하면 마지막 발화가 스크리닝 없이 폐기

- **수정 (M1 수정과 결합해 저비용화):** 전이 effect(:81)의 가드를 `if (t) handleUtterance(t)`로 완화 (endedRef 조건 제거). ended 상태의 발화도 서버로 가서 **스크리닝은 받는다** — 재구조된 handleUtterance가 비위기면 무시, 위기면 신호+고정응답 처리. (턴 카운트·phase 갱신은 ended 가드 뒤라 리추얼 불변.)

---

## 9. 카피 확정본 교체 (✅ 팀장 게이트 통과 — verbatim, 임의 수정 금지)

| # | 위치 | 확정본 |
|---|---|---|
| ① 인사 (GREETING) | 원안 승인 | "안녕! 나 키디야. 우리 같이 말하기 연습하자. 아래를 콕 누르고 말해봐! 🦕" |
| ② 생각 중 | **수정** | "키디가 곰곰 생각하고 있어..." (듣기/생각 상태 분리) |
| ③ 듣는 중 | **수정** | "키디가 듣고 있어! 다 말하면 다시 콕 눌러줘" (주어 추가) |
| ④ 오류 | 원안 승인 | "키디가 잠깐 쉬고 있어. 조금 뒤에 다시 말해줘!" |
| ⑤ 미지원 폴백 | **수정** | "여기서는 말하기 연습이 잘 안 돼. 어른에게 부탁해봐!" (반말 통일·'브라우저' 삭제) |
| ⑥ 진입 타일 부제 | **수정** | "콕 누르고 키디에게 말해봐!" ("탭"→"콕" 통일. 제목 "키디랑 말하기 연습 🦕" 유지) |
| ⑦ 버튼 3종 | "콕" 통일 | "🎤 콕 누르고 말해봐" / "🎙️ 듣는 중... 다 말하면 콕!" (유지) / "키디가 생각 중..." (유지) |

(m7의 무발화 재안내·마이크 거부 문구는 기존 검증 카피 재사용 — 이 표 대상 아님.)

## 검증 (기존 7종 재확인 + 신규 6)

- 4:59 위기 발화 + 5분 타이머 → **care 신호 생성** + 고정응답이 FAREWELL을 덮음(calm)
- thinking 중 홈 이탈 → KidHome에서 유령 음성 0 / 위기였다면 신호는 생성됨
- soft 발화("나만 미워해") → calm 톤 / 8턴째 soft → FAREWELL 억제
- 8턴 정상 종료 → 8번째 답변 표시 후 FAREWELL로 전환 (음성 순서와 일치)
- 입장 후 무발화 5분 → 카피 없이 조용히 홈 버튼
- 마이크 거부 → "듣고 있어" 잔류 없음 + 안내 유지 / 무발화 재탭 → 재안내 카피
- build ✓ / 회귀: 정상 8턴 루프·중간 위기 유지 흐름 기존과 동일
