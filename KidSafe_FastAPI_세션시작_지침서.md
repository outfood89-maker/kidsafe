# KidSafe FastAPI 전환 — 세션 시작 지침서

> Claude Code에게 전달하는 문서. 이 파일을 읽고 바로 작업을 시작하면 된다.

---

## 현재 상태

- 프론트 배포 완료: https://kidsafe-eight.vercel.app (Vercel)
- 백엔드 배포 완료: https://kidsafe-production.up.railway.app (Railway, 현재 Node.js)
- GitHub: https://github.com/outfood89-maker/kidsafe

**지금 할 일: Node.js Express 백엔드 → FastAPI (Python)으로 전환**

---

## 전환 원칙

- API 엔드포인트 주소 완전히 동일하게 유지 → 프론트 코드 수정 불필요
- `server/` → `server_backup/` 복사 후 작업 (기존 서버 삭제 금지)
- 기존 `server/data/*.json` 파일 구조 그대로 유지
- 모든 주석 한국어, try-catch 필수

---

## 1단계 — 백업 및 폴더 준비

```powershell
# 1. 기존 Node.js 서버 백업
Copy-Item "server" "server_backup" -Recurse

# 2. 새 server 폴더 구성 (기존 파일은 그대로 두고 Python 파일 추가)
cd server
mkdir routers
New-Item routers/__init__.py -Type File
```

---

## 2단계 — requirements.txt + Procfile 작성

**`server/requirements.txt`**
```
fastapi==0.115.0
uvicorn==0.30.0
httpx==0.27.0
python-dotenv==1.0.0
anthropic==0.34.0
```

**`server/Procfile`**
```
web: uvicorn main:app --host 0.0.0.0 --port $PORT
```

---

## 3단계 — 파일 작성 순서

상세 코드는 `KidSafe_FastAPI_전환_지침서_v2.md` 참고.

1. `routers/__init__.py` (빈 파일)
2. `routers/analyze.py` — 키워드 기반, 단순
3. `routers/chat.py` — **AsyncAnthropic 필수** (핵심)
4. `routers/history.py`
5. `routers/profiles.py`
6. `routers/search_history.py`
7. `routers/badges.py`
8. `routers/favorites.py`
9. `routers/blocked_keywords.py`
10. `routers/alerts.py`
11. `routers/alert_settings.py`
12. `routers/game_bonus.py`
13. `routers/search.py` — YouTube API, 제일 복잡
14. `main.py` — 마지막

---

## 4단계 — 로컬 테스트

```powershell
cd server
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 3000
```

확인 순서:
1. `http://localhost:3000` → "KidSafe 서버 작동 중!" 메시지
2. `http://localhost:3000/docs` → Swagger UI 자동 문서
3. `http://localhost:3000/test-env` → API 키 연결 확인
4. 프론트 실행 후 검색 / 챗봇 / 미니게임 테스트

---

## 5단계 — Railway 배포

Railway 대시보드에서:
- Language → Python으로 변경
- 환경변수 동일하게 유지 (`YOUTUBE_API_KEY`, `ANTHROPIC_API_KEY`)
- 배포 후 Vercel 환경변수 `VITE_API_URL` → 새 Railway URL로 업데이트

---

## ⚠️ 핵심 주의사항

| 항목 | 내용 |
|------|------|
| Railway JSON 초기화 | 서버 재시작 시 파일 날아감 → `main.py`의 `ensure_data_files()`로 해결 |
| 한글 인코딩 | JSON 읽기/쓰기 시 반드시 `encoding="utf-8"` 명시 |
| Anthropic 비동기 | FastAPI에서는 반드시 `AsyncAnthropic` 사용 (sync 쓰면 블로킹) |
| analyze.js 로직 | Python 변환 전 기존 파일 반드시 읽고 동일하게 구현 |
| badges.js 배지 21개 | 조건이 복잡함 → 꼼꼼히 읽고 변환 |
| history.js 알림 로직 | 시청 기록 저장 시 알림 자동 생성 로직 포함 → 동일하게 구현 |
| YouTube 쿼터 | 로컬 테스트 시 검색 최소화 (매일 오후 4시 초기화) |

---

## 전환 완료 후 다음 작업

**회원가입 기능** 구현 (FastAPI 전환 이후로 미뤄둔 항목)

---

> 상세 코드 및 파일별 명세: `KidSafe_FastAPI_전환_지침서_v2.md`
