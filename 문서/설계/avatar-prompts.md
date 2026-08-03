# KidSafe 아바타 이미지 생성 프롬프트

## 공통 스타일 가이드
- GPT(DALL-E 3) 사용
- 모든 이미지: **1024×1024px, PNG, 흰색 또는 투명 배경**
- 저장 위치: `client/public/images/avatars/`
- 파일명: `avatar_01.png` ~ `avatar_08.png` 순서대로

---

## 공통 스타일 설명 (모든 프롬프트에 포함)
아래 스타일 키워드는 모든 프롬프트에 공통 적용됩니다:

> 3D rendered chibi character, Pixar-style, smooth glossy surface, big round shiny eyes with white highlight, pink blush cheeks, cute chubby proportions (big head, small body), friendly happy expression, full body standing pose, white background, no shadow, high quality render, kid-friendly

---

## 01. 백인 남자 — `avatar_01.png`

```
A cute 3D rendered chibi boy character with fair/light skin tone, short brown hair, wearing a simple colorful t-shirt and shorts. Pixar-style, smooth glossy surface, big round shiny eyes with white highlight, pink blush cheeks, chubby proportions with big head and small body, friendly happy smile, full body standing pose, white background, no shadow, high quality render, kid-friendly cartoon style.
```

---

## 02. 백인 여자 — `avatar_02.png`

```
A cute 3D rendered chibi girl character with fair/light skin tone, light brown pigtails tied with colorful ribbons, wearing a simple pastel dress. Pixar-style, smooth glossy surface, big round shiny eyes with white highlight, pink blush cheeks, chubby proportions with big head and small body, friendly happy smile, full body standing pose, white background, no shadow, high quality render, kid-friendly cartoon style.
```

---

## 03. 흑인 남자 — `avatar_03.png`

```
A cute 3D rendered chibi boy character with dark brown skin tone, short curly black hair, wearing a simple colorful t-shirt and shorts. Pixar-style, smooth glossy surface, big round shiny eyes with white highlight, pink blush cheeks, chubby proportions with big head and small body, friendly happy smile, full body standing pose, white background, no shadow, high quality render, kid-friendly cartoon style.
```

---

## 04. 흑인 여자 — `avatar_04.png`

```
A cute 3D rendered chibi girl character with dark brown skin tone, black curly puff hairstyle with colorful hair ties, wearing a simple bright-colored dress. Pixar-style, smooth glossy surface, big round shiny eyes with white highlight, pink blush cheeks, chubby proportions with big head and small body, friendly happy smile, full body standing pose, white background, no shadow, high quality render, kid-friendly cartoon style.
```

---

## 05. 황인(동아시아) 남자 — `avatar_05.png`

```
A cute 3D rendered chibi boy character with East Asian features, light golden skin tone, straight black hair with a small tuft on top, wearing a simple colorful t-shirt and shorts. Pixar-style, smooth glossy surface, big round shiny eyes with white highlight, pink blush cheeks, chubby proportions with big head and small body, friendly happy smile, full body standing pose, white background, no shadow, high quality render, kid-friendly cartoon style.
```

---

## 06. 황인(동아시아) 여자 — `avatar_06.png`

```
A cute 3D rendered chibi girl character with East Asian features, light golden skin tone, straight black hair in two small buns, wearing a simple pastel-colored dress. Pixar-style, smooth glossy surface, big round shiny eyes with white highlight, pink blush cheeks, chubby proportions with big head and small body, friendly happy smile, full body standing pose, white background, no shadow, high quality render, kid-friendly cartoon style.
```

---

## 07. 공룡 남자 — `avatar_07.png`

```
A cute 3D rendered chibi baby dinosaur character, blue-green scaly skin, small spikes on top of head and back, wearing a tiny blue superhero cape with a silver star emblem on chest, big round shiny black eyes with white highlight, pink blush cheeks, chubby round body with tiny arms and legs, friendly happy smile showing small teeth, full body standing pose, white background, no shadow, high quality render, kid-friendly cartoon style, similar to a Pixar mascot dinosaur.
```

---

## 08. 공룡 여자 — `avatar_08.png`

```
A cute 3D rendered chibi baby dinosaur character, purple-pink scaly skin, small spikes on top of head with a tiny pink bow, wearing a tiny pink superhero cape with a heart emblem on chest, big round shiny black eyes with white highlight, pink blush cheeks, chubby round body with tiny arms and legs, friendly happy smile showing small teeth, full body standing pose, white background, no shadow, high quality render, kid-friendly cartoon style, similar to a Pixar mascot dinosaur.
```

---

## 생성 팁

- 결과물이 마음에 안 들면 **Vary (Strong)** 으로 재생성
- 배경이 흰색이 아니면 프롬프트 끝에 `pure white background, isolated character` 추가
- 비율이 어색하면 `chibi proportions, 1:3 head-to-body ratio` 추가
- 스타일이 키디랑 너무 다르면 `glossy 3D render, smooth plastic-like surface` 강조

## 완성 후 할 일

이미지 준비되면 `client/public/images/avatars/` 폴더에 넣고 알려주세요.
그러면 바로 코드 작업 시작할게요!
