import { useState, useEffect } from "react";
import KiddyImg from "../KiddyImg";
import confettiLib from "canvas-confetti";

// 카테고리별 문제 (자동으로 category 필드 부여)
const QUESTION_BANK = {
  "과학·자연": [
    { q: "지구는 태양 주위를 돌아요", answer: true },
    { q: "달은 스스로 빛을 내요", answer: false },
    { q: "식물은 햇빛으로 음식을 만들어요", answer: true },
    { q: "물은 100도에서 끓어요", answer: true },
    { q: "무지개는 7가지 색이에요", answer: true },
    { q: "지구는 태양계에서 세 번째 행성이에요", answer: true },
    { q: "번개는 소리보다 빠르게 이동해요", answer: true },
    { q: "눈(雪)은 소금물로 만들어져요", answer: false },
    { q: "공기는 눈에 보이지 않아요", answer: true },
    { q: "지구에서 가장 큰 바다는 태평양이에요", answer: true },
    { q: "달은 지구보다 훨씬 커요", answer: false },
    { q: "비는 구름에서 내려와요", answer: true },
    { q: "태양은 별이에요", answer: true },
    { q: "화성은 파란색 행성이에요", answer: false },
    { q: "물은 얼면 부피가 커져요", answer: true },
    { q: "나무는 산소를 만들어요", answer: true },
    { q: "태양은 동쪽에서 떠요", answer: true },
    { q: "달빛은 태양빛을 반사한 거예요", answer: true },
    { q: "지구에는 7개의 대륙이 있어요", answer: true },
    { q: "바람은 공기가 움직이는 거예요", answer: true },
    { q: "화산에서는 용암이 나와요", answer: true },
    { q: "지진은 땅이 흔들리는 거예요", answer: true },
    { q: "구름은 물방울로 이루어져 있어요", answer: true },
    { q: "빛은 소리보다 빠르게 이동해요", answer: true },
    { q: "식물 뿌리는 물을 흡수해요", answer: true },
    { q: "태양계에는 행성이 8개예요", answer: true },
    { q: "금성은 태양에서 가장 가까운 행성이에요", answer: false },
    { q: "물은 기체가 되면 수증기예요", answer: true },
    { q: "선인장도 물이 있어야 살 수 있어요", answer: true },
    { q: "나무는 이산화탄소를 마시고 산소를 내뿜어요", answer: true },
    { q: "태양은 지구보다 훨씬 커요", answer: true },
    { q: "바다 물은 짜요", answer: true },
    { q: "강물은 바다로 흘러가요", answer: true },
    { q: "지구는 하루에 한 번 자전해요", answer: true },
    { q: "1년은 지구가 태양을 한 바퀴 도는 시간이에요", answer: true },
    { q: "달은 지구 주위를 돌아요", answer: true },
    { q: "용암은 아주 뜨거워요", answer: true },
    { q: "에베레스트산은 지구에서 가장 높은 산이에요", answer: true },
    { q: "태풍은 구름과 바람으로 이루어져요", answer: true },
    { q: "무지개는 비가 온 후에 볼 수 있어요", answer: true },
    { q: "식물은 물이 없어도 살 수 있어요", answer: false },
    { q: "지구의 약 70%는 바다로 덮여 있어요", answer: true },
    { q: "공기는 여러 가지 기체로 이루어져 있어요", answer: true },
    { q: "빛은 프리즘을 통과하면 여러 가지 색으로 나뉘어요", answer: true },
    { q: "태양에너지로 전기를 만들 수 있어요", answer: true },
    { q: "모든 행성은 태양 주위를 돌아요", answer: true },
    { q: "자석은 철을 끌어당겨요", answer: true },
    { q: "얼음은 물보다 가벼워서 물 위에 떠요", answer: true },
    { q: "소금은 물에 녹아요", answer: true },
    { q: "날씨는 매일 똑같아요", answer: false },
    { q: "계절이 바뀌는 이유는 지구가 기울어진 채 공전하기 때문이에요", answer: true },
    { q: "산소는 불을 태우는 데 필요해요", answer: true },
    { q: "플라스틱은 자연에서 쉽게 분해돼요", answer: false },
    { q: "사막은 낮에 매우 덥고 밤에 추울 수 있어요", answer: true },
    { q: "번개는 전기의 일종이에요", answer: true },
    { q: "식물의 줄기는 물을 운반해요", answer: true },
    { q: "해는 서쪽에서 져요", answer: true },
    { q: "달은 모양이 변해 보여요", answer: true },
    { q: "씨앗에서 식물이 자라요", answer: true },
    { q: "물은 고체·액체·기체 세 가지 상태로 존재할 수 있어요", answer: true },
    { q: "낙엽은 가을에 떨어져요", answer: true },
    { q: "사막에서는 비가 거의 오지 않아요", answer: true },
    { q: "바람은 온도 차이 때문에 생겨요", answer: true },
    { q: "소리는 공기를 통해 전달돼요", answer: true },
    { q: "소금물은 겨울에 일반 물보다 늦게 얼어요", answer: true },
    { q: "달에는 공기가 없어요", answer: true },
    { q: "태양은 기체로 이루어져 있어요", answer: true },
    { q: "봄이 되면 꽃이 피어요", answer: true },
    { q: "유리는 모래를 녹여서 만들어요", answer: true },
    { q: "식물은 뿌리, 줄기, 잎으로 이루어져 있어요", answer: true },
    { q: "지구 자전축은 기울어져 있어요", answer: true },
    { q: "무지개는 밤에도 볼 수 있어요", answer: false },
    { q: "빛은 진공 속에서도 이동할 수 있어요", answer: true },
    { q: "소리는 진공 속에서 이동할 수 없어요", answer: true },
    { q: "대기는 지구를 감싸고 있어요", answer: true },
    { q: "파도는 바람에 의해 생겨요", answer: true },
    { q: "겨울에는 낮이 여름보다 짧아요", answer: true },
    { q: "북극과 남극은 매우 추워요", answer: true },
    { q: "모든 생물은 물이 필요해요", answer: true },
    { q: "흙 속에는 작은 생물들이 살아요", answer: true },
    { q: "기름과 물은 잘 섞여요", answer: false },
    { q: "얼음을 가열하면 물이 돼요", answer: true },
    { q: "물을 계속 가열하면 수증기가 돼요", answer: true },
    { q: "공기 중에는 산소가 있어요", answer: true },
    { q: "태양빛이 없으면 식물은 자랄 수 없어요", answer: true },
    { q: "봄, 여름, 가을, 겨울은 4계절이에요", answer: true },
    { q: "눈(雪)은 구름에서 만들어져요", answer: true },
    { q: "전기는 도선을 따라 흘러요", answer: true },
    { q: "나침반은 항상 북쪽을 가리켜요", answer: true },
    { q: "달은 지구에서 아주 가까이 있어요", answer: false },
    { q: "태양은 낮에 볼 수 있어요", answer: true },
    { q: "별은 밤에 볼 수 있어요", answer: true },
    { q: "구름이 많으면 비가 올 수 있어요", answer: true },
    { q: "식물은 이산화탄소를 흡수해요", answer: true },
    { q: "지구는 혼자 우주에 있는 유일한 별이에요", answer: false },
  ],
  "동물": [
    { q: "고래는 물고기예요", answer: false },
    { q: "펭귄은 날 수 있어요", answer: false },
    { q: "곰은 겨울에 잠을 자요", answer: true },
    { q: "박쥐는 초음파로 길을 찾아요", answer: true },
    { q: "개구리는 물속과 땅 위 모두에서 살 수 있어요", answer: true },
    { q: "문어는 다리가 8개예요", answer: true },
    { q: "타조는 날 수 없는 새예요", answer: true },
    { q: "나비는 어릴 때 애벌레예요", answer: true },
    { q: "상어는 포유류예요", answer: false },
    { q: "돌고래는 물속에서 숨을 쉬어요", answer: false },
    { q: "거미는 다리가 6개예요", answer: false },
    { q: "치타는 육지에서 가장 빠른 동물이에요", answer: true },
    { q: "달팽이는 집을 등에 지고 다녀요", answer: true },
    { q: "뱀은 다리가 있어요", answer: false },
    { q: "독수리는 눈이 아주 좋아요", answer: true },
    { q: "금붕어는 포유류예요", answer: false },
    { q: "코끼리는 코로 물을 마셔요", answer: true },
    { q: "기린은 세상에서 가장 키가 큰 동물이에요", answer: true },
    { q: "고양이는 야행성이에요", answer: true },
    { q: "소는 되새김질을 해요", answer: true },
    { q: "꿀벌은 꿀을 만들어요", answer: true },
    { q: "개미는 자기 몸무게보다 훨씬 무거운 것을 들 수 있어요", answer: true },
    { q: "뱀은 알을 낳아요", answer: true },
    { q: "카멜레온은 색을 바꿀 수 있어요", answer: true },
    { q: "악어는 파충류예요", answer: true },
    { q: "모기는 피를 빨아요", answer: true },
    { q: "개구리는 알에서 태어나요", answer: true },
    { q: "거북이는 천천히 움직여요", answer: true },
    { q: "코알라는 유칼립투스 잎을 먹어요", answer: true },
    { q: "캥거루는 새끼를 주머니에 넣고 다녀요", answer: true },
    { q: "표범은 나무 위에 올라갈 수 있어요", answer: true },
    { q: "고슴도치는 위험하면 가시를 세워요", answer: true },
    { q: "앵무새는 사람 말을 따라 할 수 있어요", answer: true },
    { q: "북극곰은 흰색이에요", answer: true },
    { q: "늑대는 무리 지어 살아요", answer: true },
    { q: "사자는 아프리카에 살아요", answer: true },
    { q: "코끼리는 가장 큰 육지 동물이에요", answer: true },
    { q: "호랑이는 줄무늬가 있어요", answer: true },
    { q: "얼룩말은 검은색과 흰색 줄무늬가 있어요", answer: true },
    { q: "공작새는 수컷이 더 화려해요", answer: true },
    { q: "연어는 강에서 태어나 바다로 가요", answer: true },
    { q: "달팽이는 매우 빠르게 움직여요", answer: false },
    { q: "박쥐는 포유류예요", answer: true },
    { q: "새는 뼈 속이 비어 있어서 가벼워요", answer: true },
    { q: "벌은 집을 만들어요", answer: true },
    { q: "문어는 먹물을 뿜을 수 있어요", answer: true },
    { q: "불가사리는 잘린 팔이 다시 자라요", answer: true },
    { q: "카멜레온은 눈을 따로 움직일 수 있어요", answer: true },
    { q: "오리너구리는 알을 낳아요", answer: true },
    { q: "돌고래는 초음파로 의사소통해요", answer: true },
    { q: "개는 청각이 사람보다 좋아요", answer: true },
    { q: "뱀은 혀로 냄새를 맡아요", answer: true },
    { q: "문어는 뼈가 없어요", answer: true },
    { q: "전갈은 꼬리에 독침이 있어요", answer: true },
    { q: "나비는 맛을 발로 느껴요", answer: true },
    { q: "타조는 달리기를 잘해요", answer: true },
    { q: "플라밍고는 분홍색이에요", answer: true },
    { q: "플라밍고는 한 발로 서 있을 수 있어요", answer: true },
    { q: "고등어는 민물고기예요", answer: false },
    { q: "기린은 목이 길어서 높은 나무의 잎을 먹을 수 있어요", answer: true },
    { q: "개미는 여왕개미를 중심으로 살아요", answer: true },
    { q: "꿀벌은 꽃가루를 날라요", answer: true },
    { q: "뱀은 주기적으로 허물을 벗어요", answer: true },
    { q: "고양이는 나무를 잘 올라가요", answer: true },
    { q: "사마귀는 곤충이에요", answer: true },
    { q: "잠자리는 다리가 6개예요", answer: true },
    { q: "두더지는 땅속에서 살아요", answer: true },
    { q: "비버는 댐을 만들어요", answer: true },
    { q: "펭귄은 남극에 살아요", answer: true },
    { q: "문어는 심장이 3개예요", answer: true },
    { q: "고래는 숨을 쉬기 위해 물 위로 올라와야 해요", answer: true },
    { q: "표범은 호랑이의 다른 이름이에요", answer: false },
    { q: "사슴은 뿔을 매년 새로 길러요", answer: true },
    { q: "개구리는 겨울에 동면해요", answer: true },
    { q: "뻐꾸기는 다른 새의 둥지에 알을 낳아요", answer: true },
    { q: "도마뱀은 꼬리가 잘려도 다시 자라요", answer: true },
    { q: "거위는 발에 물갈퀴가 있어요", answer: true },
    { q: "거북이는 등껍데기를 벗을 수 있어요", answer: false },
    { q: "수달은 물속에서 살아요", answer: true },
    { q: "고릴라는 영장류예요", answer: true },
    { q: "잠자리는 날아다니면서 먹이를 잡아요", answer: true },
    { q: "기린의 혀는 진한 보라색이에요", answer: true },
    { q: "치타는 나무를 잘 올라가요", answer: false },
    { q: "스컹크는 위험하면 냄새를 뿜어요", answer: true },
    { q: "바다거북은 알을 해변 모래사장에 낳아요", answer: true },
    { q: "개미는 페로몬으로 의사소통해요", answer: true },
    { q: "하마는 물속에서 오랫동안 있을 수 있어요", answer: true },
    { q: "알바트로스는 날개폭이 매우 넓어요", answer: true },
    { q: "제비는 여름에 한국을 찾아와요", answer: true },
    { q: "파충류는 체온이 주변 온도에 따라 달라져요", answer: true },
    { q: "고양이는 어두운 곳에서도 잘 볼 수 있어요", answer: true },
    { q: "벌집은 육각형 구조로 이루어져 있어요", answer: true },
    { q: "물고기는 아가미로 숨을 쉬어요", answer: true },
    { q: "곤충은 다리가 6개예요", answer: true },
    { q: "거미는 곤충이에요", answer: false },
    { q: "날다람쥐는 하늘을 날 수 있어요", answer: false },
    { q: "고슴도치는 둥글게 말릴 수 있어요", answer: true },
    { q: "악어는 입이 매우 커요", answer: true },
  ],
  "음식·건강": [
    { q: "당근은 눈 건강에 좋아요", answer: true },
    { q: "우유에는 칼슘이 많이 들어있어요", answer: true },
    { q: "밥은 쌀로 만들어요", answer: true },
    { q: "두부는 콩으로 만들어요", answer: true },
    { q: "피자는 한국 전통 음식이에요", answer: false },
    { q: "초콜릿은 채소로 만들어요", answer: false },
    { q: "물을 많이 마시면 건강에 좋아요", answer: true },
    { q: "아침밥을 먹으면 집중이 잘 돼요", answer: true },
    { q: "김치는 한국 전통 음식이에요", answer: true },
    { q: "빵은 밀가루로 만들어요", answer: true },
    { q: "치즈는 우유로 만들어요", answer: true },
    { q: "사탕을 너무 많이 먹으면 이가 썩을 수 있어요", answer: true },
    { q: "수박은 겨울 과일이에요", answer: false },
    { q: "손을 자주 씻으면 병을 예방할 수 있어요", answer: true },
    { q: "잠을 충분히 자야 키가 커요", answer: true },
    { q: "달걀은 단백질이 풍부해요", answer: true },
    { q: "고구마는 땅속에서 자라요", answer: true },
    { q: "콜라를 많이 마시면 건강에 좋아요", answer: false },
    { q: "운동을 하면 몸이 건강해져요", answer: true },
    { q: "사과는 나무에서 자라요", answer: true },
    { q: "포도는 덩굴에서 자라요", answer: true },
    { q: "딸기는 빨간색이에요", answer: true },
    { q: "오렌지는 비타민 C가 풍부해요", answer: true },
    { q: "시금치는 철분이 풍부해요", answer: true },
    { q: "된장은 콩으로 만들어요", answer: true },
    { q: "라면은 건강식이에요", answer: false },
    { q: "채소는 건강에 좋아요", answer: true },
    { q: "국수는 밀가루로 만들어요", answer: true },
    { q: "떡은 쌀로 만들어요", answer: true },
    { q: "간장은 짠맛이 나요", answer: true },
    { q: "설탕은 단맛이 나요", answer: true },
    { q: "고추는 매운맛이 나요", answer: true },
    { q: "레몬은 신맛이 나요", answer: true },
    { q: "커피는 어린이에게 좋지 않아요", answer: true },
    { q: "탄산음료를 많이 마시면 이가 상해요", answer: true },
    { q: "밥을 천천히 씹어 먹으면 좋아요", answer: true },
    { q: "생선을 먹으면 머리가 좋아질 수 있어요", answer: true },
    { q: "아이스크림은 매일 먹어도 괜찮아요", answer: false },
    { q: "채소를 안 먹어도 건강을 유지할 수 있어요", answer: false },
    { q: "물은 하루에 8잔 정도 마시는 게 좋아요", answer: true },
    { q: "과자를 많이 먹으면 살이 쪄요", answer: true },
    { q: "꿀은 달아요", answer: true },
    { q: "소금을 너무 많이 먹으면 몸에 나빠요", answer: true },
    { q: "두유는 콩으로 만들어요", answer: true },
    { q: "초콜릿은 카카오로 만들어요", answer: true },
    { q: "현미는 백미보다 영양소가 풍부해요", answer: true },
    { q: "해조류(미역, 김)는 건강에 좋아요", answer: true },
    { q: "음식을 익혀 먹으면 더 안전해요", answer: true },
    { q: "비타민은 몸에 꼭 필요해요", answer: true },
    { q: "기름진 음식을 많이 먹으면 건강에 좋지 않아요", answer: true },
    { q: "규칙적으로 밥을 먹는 것이 좋아요", answer: true },
    { q: "밥 먹기 전에 손을 씻어야 해요", answer: true },
    { q: "음식을 오래 씹을수록 소화가 잘 돼요", answer: true },
    { q: "인스턴트 식품은 매일 먹어도 건강에 괜찮아요", answer: false },
    { q: "단백질은 근육을 만드는 데 필요해요", answer: true },
    { q: "일주일에 3번 이상 운동하면 건강에 좋아요", answer: true },
    { q: "양파는 썰 때 눈이 맵게 느껴져요", answer: true },
    { q: "생강은 감기에 도움이 돼요", answer: true },
    { q: "물을 충분히 마시면 피부에 좋아요", answer: true },
    { q: "칼슘은 뼈를 강하게 해요", answer: true },
    { q: "아이스크림은 우유로 만들어요", answer: true },
    { q: "식이섬유는 소화를 도와요", answer: true },
    { q: "유제품은 뼈를 강하게 해요", answer: true },
    { q: "단 음식을 먹은 후에는 이를 닦아야 해요", answer: true },
    { q: "옥수수는 채소예요", answer: true },
    { q: "참외는 한국 과일이에요", answer: true },
    { q: "수분이 부족하면 피곤해져요", answer: true },
    { q: "음식은 냉장고에 보관하면 더 오래 먹을 수 있어요", answer: true },
    { q: "콩나물은 콩에서 자라요", answer: true },
    { q: "고구마는 단맛이 나요", answer: true },
    { q: "블루베리는 항산화 물질이 풍부해요", answer: true },
    { q: "음식을 충분히 가열하면 식중독균이 죽어요", answer: true },
    { q: "요거트에는 유산균이 들어있어요", answer: true },
    { q: "버섯은 식물이에요", answer: false },
    { q: "감자칩은 건강식품이에요", answer: false },
    { q: "패스트푸드를 매일 먹으면 건강에 나빠요", answer: true },
    { q: "잠 자기 직전에 많이 먹으면 좋지 않아요", answer: true },
    { q: "올리브유는 건강에 좋은 지방이에요", answer: true },
    { q: "녹차에는 카페인이 들어있어요", answer: true },
    { q: "견과류는 뇌 건강에 좋아요", answer: true },
    { q: "음식 알레르기가 있으면 조심해야 해요", answer: true },
    { q: "등푸른 생선에는 오메가-3가 풍부해요", answer: true },
    { q: "통밀빵은 흰 빵보다 건강에 좋아요", answer: true },
    { q: "쑥갓과 상추는 채소예요", answer: true },
    { q: "파프리카는 피망과 비슷한 채소예요", answer: true },
    { q: "수박은 수분이 많은 과일이에요", answer: true },
    { q: "조리하지 않은 날달걀을 먹으면 위험할 수 있어요", answer: true },
    { q: "신선한 채소와 과일은 몸에 좋아요", answer: true },
    { q: "나트륨을 많이 먹으면 혈압이 높아질 수 있어요", answer: true },
    { q: "탄수화물은 우리 몸에 에너지를 줘요", answer: true },
    { q: "설탕을 너무 많이 먹으면 당뇨가 생길 수 있어요", answer: true },
    { q: "물은 칼로리가 없어요", answer: true },
    { q: "밥을 거르면 집중력이 떨어질 수 있어요", answer: true },
    { q: "과일은 비타민이 풍부해요", answer: true },
    { q: "소시지나 햄은 가공식품이에요", answer: true },
    { q: "색이 다양한 채소를 먹으면 다양한 영양소를 섭취할 수 있어요", answer: true },
  ],
  "세계·상식": [
    { q: "우리나라 수도는 서울이에요", answer: true },
    { q: "지구는 둥글어요", answer: true },
    { q: "한글을 만든 사람은 세종대왕이에요", answer: true },
    { q: "올림픽은 2년마다 열려요", answer: false },
    { q: "1년은 365일이에요", answer: true },
    { q: "1주일은 7일이에요", answer: true },
    { q: "지구에서 사람이 달에 간 적이 있어요", answer: true },
    { q: "피아노는 현악기예요", answer: false },
    { q: "빨간색과 파란색을 섞으면 보라색이 돼요", answer: true },
    { q: "태극기의 바탕색은 흰색이에요", answer: true },
    { q: "1년은 12달이에요", answer: true },
    { q: "하루는 24시간이에요", answer: true },
    { q: "봄 다음에 오는 계절은 여름이에요", answer: true },
    { q: "크리스마스는 12월 25일이에요", answer: true },
    { q: "어린이날은 5월 5일이에요", answer: true },
    { q: "한국의 국기는 태극기예요", answer: true },
    { q: "1시간은 60분이에요", answer: true },
    { q: "1분은 100초예요", answer: false },
    { q: "미국의 수도는 뉴욕이에요", answer: false },
    { q: "비행기는 하늘을 날아요", answer: true },
    { q: "잠수함은 물속을 다닐 수 있어요", answer: true },
    { q: "빨간 신호등은 멈추라는 뜻이에요", answer: true },
    { q: "병원에는 의사 선생님이 있어요", answer: true },
    { q: "대한민국의 화폐는 원이에요", answer: true },
    { q: "일본의 수도는 도쿄예요", answer: true },
    { q: "중국의 수도는 베이징이에요", answer: true },
    { q: "프랑스의 수도는 파리예요", answer: true },
    { q: "영국의 수도는 런던이에요", answer: true },
    { q: "도서관에서는 큰 소리로 떠들면 안 돼요", answer: true },
    { q: "지하철은 땅 위를 달려요", answer: false },
    { q: "색의 삼원색은 빨강, 파랑, 노랑이에요", answer: true },
    { q: "빨강과 노랑을 섞으면 주황색이에요", answer: true },
    { q: "파랑과 노랑을 섞으면 초록색이에요", answer: true },
    { q: "자동차는 기름이나 전기로 움직여요", answer: true },
    { q: "우리나라 명절에는 추석과 설날이 있어요", answer: true },
    { q: "추석은 음력 8월 15일이에요", answer: true },
    { q: "설날에는 세배를 해요", answer: true },
    { q: "쓰레기는 아무 데나 버려도 돼요", answer: false },
    { q: "글자가 없으면 지식을 전달하기 어려워요", answer: true },
    { q: "의사는 아픈 사람을 치료해요", answer: true },
    { q: "소방관은 불을 꺼요", answer: true },
    { q: "경찰관은 안전을 지켜요", answer: true },
    { q: "선생님은 학생을 가르쳐요", answer: true },
    { q: "요리사는 음식을 만들어요", answer: true },
    { q: "버스 안에서 자리를 양보하는 건 좋은 행동이에요", answer: true },
    { q: "음악은 악기나 목소리로 만들어요", answer: true },
    { q: "기타는 현악기예요", answer: true },
    { q: "드럼은 타악기예요", answer: true },
    { q: "피리는 관악기예요", answer: true },
    { q: "바이올린은 활로 연주해요", answer: true },
    { q: "신호등이 초록색이면 건너가도 돼요", answer: true },
    { q: "횡단보도로 건너야 해요", answer: true },
    { q: "인터넷은 세계 어디든 연결해줘요", answer: true },
    { q: "컴퓨터는 계산을 아주 빠르게 해요", answer: true },
    { q: "로켓은 우주로 날아가요", answer: true },
    { q: "세계에서 가장 큰 나라는 러시아예요", answer: true },
    { q: "광복절은 8월 15일이에요", answer: true },
    { q: "피카소는 유명한 화가예요", answer: true },
    { q: "베토벤은 작곡가예요", answer: true },
    { q: "이순신 장군은 임진왜란 때 나라를 지켰어요", answer: true },
    { q: "축구공은 둥글어요", answer: true },
    { q: "농구 골대는 땅에 있어요", answer: false },
    { q: "올림픽은 4년마다 열려요", answer: true },
    { q: "월드컵은 4년마다 열려요", answer: true },
    { q: "태권도는 한국 전통 무술이에요", answer: true },
    { q: "씨름은 한국 전통 스포츠예요", answer: true },
    { q: "한국의 전통 가옥을 한옥이라고 해요", answer: true },
    { q: "한복은 한국 전통 의상이에요", answer: true },
    { q: "비빔밥은 한국 음식이에요", answer: true },
    { q: "피자는 이탈리아에서 유래했어요", answer: true },
    { q: "스시는 일본 음식이에요", answer: true },
    { q: "파스타는 이탈리아 음식이에요", answer: true },
    { q: "도서관은 책을 빌릴 수 있는 곳이에요", answer: true },
    { q: "박물관은 역사 유물을 볼 수 있는 곳이에요", answer: true },
    { q: "미술관은 그림이나 조각을 볼 수 있는 곳이에요", answer: true },
    { q: "기차는 철도 위를 달려요", answer: true },
    { q: "선박은 물 위를 다녀요", answer: true },
    { q: "헬리콥터는 날개가 위에서 돌아요", answer: true },
    { q: "드론은 사람이 직접 타지 않아도 날 수 있어요", answer: true },
    { q: "지도는 땅의 모습을 그림으로 나타낸 거예요", answer: true },
    { q: "세계 지도에서 바다는 파란색으로 표시해요", answer: true },
    { q: "우리나라는 삼면이 바다로 둘러싸여 있어요", answer: true },
    { q: "한국은 아시아에 있어요", answer: true },
    { q: "영어는 세계에서 가장 많이 쓰이는 언어 중 하나예요", answer: true },
    { q: "한국전쟁은 1950년에 시작됐어요", answer: true },
    { q: "지구에는 약 80억 명의 사람이 살아요", answer: true },
    { q: "무지개는 빨·주·노·초·파·남·보 순서예요", answer: true },
    { q: "지구에서 대기가 없으면 생명이 살 수 없어요", answer: true },
    { q: "책을 많이 읽으면 지식이 늘어요", answer: true },
    { q: "한글은 세계에서 유일하게 만든 사람이 알려진 문자예요", answer: true },
    { q: "스마트폰으로 전화와 인터넷을 모두 사용할 수 있어요", answer: true },
    { q: "비행기보다 배가 더 빠르게 이동해요", answer: false },
    { q: "우주에는 공기가 없어요", answer: true },
    { q: "학교에서 선생님 말씀을 잘 들어야 해요", answer: true },
    { q: "남을 도와주는 것은 좋은 행동이에요", answer: true },
    { q: "교통사고를 막기 위해 안전벨트를 매야 해요", answer: true },
  ],
  "수학·논리": [
    { q: "삼각형의 변은 3개예요", answer: true },
    { q: "10보다 9가 더 커요", answer: false },
    { q: "5 + 5 = 11이에요", answer: false },
    { q: "정사각형의 네 변의 길이는 모두 같아요", answer: true },
    { q: "짝수는 2로 나누어 떨어져요", answer: true },
    { q: "2 + 3 = 5예요", answer: true },
    { q: "10 - 4 = 7이에요", answer: false },
    { q: "사각형의 꼭짓점은 4개예요", answer: true },
    { q: "1보다 0이 더 커요", answer: false },
    { q: "3 × 3 = 9예요", answer: true },
    { q: "원에는 꼭짓점이 없어요", answer: true },
    { q: "50은 100의 절반이에요", answer: true },
    { q: "홀수를 2로 나누면 나머지가 생겨요", answer: true },
    { q: "20보다 12가 더 커요", answer: false },
    { q: "4 + 4 + 4 = 12예요", answer: true },
    { q: "1 + 1 = 2예요", answer: true },
    { q: "10 ÷ 2 = 5예요", answer: true },
    { q: "5 × 2 = 10이에요", answer: true },
    { q: "0을 어떤 수에 더해도 그 수는 변하지 않아요", answer: true },
    { q: "사각형의 변은 4개예요", answer: true },
    { q: "오각형의 변은 5개예요", answer: true },
    { q: "육각형의 변은 6개예요", answer: true },
    { q: "3 + 4 = 8이에요", answer: false },
    { q: "7 - 3 = 4예요", answer: true },
    { q: "2 × 4 = 8이에요", answer: true },
    { q: "9 ÷ 3 = 3이에요", answer: true },
    { q: "8 + 7 = 15예요", answer: true },
    { q: "6 × 6 = 36이에요", answer: true },
    { q: "15 - 8 = 7이에요", answer: true },
    { q: "10 + 10 = 20이에요", answer: true },
    { q: "5 × 5 = 25예요", answer: true },
    { q: "모든 짝수는 0으로 끝나요", answer: false },
    { q: "1은 홀수예요", answer: true },
    { q: "2는 짝수예요", answer: true },
    { q: "0은 짝수예요", answer: true },
    { q: "100 ÷ 10 = 10이에요", answer: true },
    { q: "4 × 3 = 12예요", answer: true },
    { q: "삼각형은 꼭짓점이 3개예요", answer: true },
    { q: "원은 꼭짓점이 1개예요", answer: false },
    { q: "정삼각형은 세 변의 길이가 모두 같아요", answer: true },
    { q: "직사각형은 네 각이 모두 직각이에요", answer: true },
    { q: "마름모는 네 변의 길이가 같아요", answer: true },
    { q: "2 + 2 + 2 = 6이에요", answer: true },
    { q: "수직선에서 오른쪽이 더 큰 수예요", answer: true },
    { q: "짝수와 짝수를 더하면 항상 짝수예요", answer: true },
    { q: "홀수와 홀수를 더하면 항상 홀수예요", answer: false },
    { q: "어떤 수에 1을 곱하면 그 수가 돼요", answer: true },
    { q: "어떤 수에 0을 곱하면 0이 돼요", answer: true },
    { q: "10 × 10 = 100이에요", answer: true },
    { q: "100 - 1 = 99예요", answer: true },
    { q: "50 + 50 = 100이에요", answer: true },
    { q: "15 + 5 = 20이에요", answer: true },
    { q: "30 - 15 = 15예요", answer: true },
    { q: "20 ÷ 4 = 5예요", answer: true },
    { q: "7 × 8 = 56이에요", answer: true },
    { q: "9 × 9 = 81이에요", answer: true },
    { q: "5 + 6 = 12예요", answer: false },
    { q: "100은 10의 10배예요", answer: true },
    { q: "피자를 4조각으로 나누면 한 조각은 전체의 1/4이에요", answer: true },
    { q: "숫자 0은 양수도 음수도 아니에요", answer: true },
    { q: "더 큰 수에서 더 작은 수를 빼면 양수가 돼요", answer: true },
    { q: "정사각형은 직사각형이기도 해요", answer: true },
    { q: "12시간은 반나절이에요", answer: true },
    { q: "60초는 1분이에요", answer: true },
    { q: "24시간은 하루예요", answer: true },
    { q: "1kg은 1000g이에요", answer: true },
    { q: "1m는 100cm예요", answer: true },
    { q: "1km는 1000m예요", answer: true },
    { q: "1L는 1000mL예요", answer: true },
    { q: "가장 작은 자연수는 1이에요", answer: true },
    { q: "음수는 0보다 작아요", answer: true },
    { q: "3은 1보다 2만큼 커요", answer: true },
    { q: "홀수끼리 곱하면 홀수예요", answer: true },
    { q: "짝수끼리 곱하면 짝수예요", answer: true },
    { q: "10은 두 자리 수예요", answer: true },
    { q: "9는 한 자리 수예요", answer: true },
    { q: "99는 세 자리 수예요", answer: false },
    { q: "100은 세 자리 수예요", answer: true },
    { q: "5 × 0 = 5예요", answer: false },
    { q: "1 ÷ 1 = 1이에요", answer: true },
    { q: "8 + 8 = 16이에요", answer: true },
    { q: "13은 짝수예요", answer: false },
    { q: "20은 홀수예요", answer: false },
    { q: "수학에서 등호(=)는 양쪽이 같다는 뜻이에요", answer: true },
    { q: "6 ÷ 2 = 4예요", answer: false },
    { q: "5 + 5 + 5 = 15예요", answer: true },
    { q: "2 × 2 × 2 = 8이에요", answer: true },
    { q: "삼각형의 내각의 합은 180도예요", answer: true },
    { q: "사각형의 내각의 합은 360도예요", answer: true },
    { q: "5의 배수는 항상 0이나 5로 끝나요", answer: true },
    { q: "짝수 + 홀수 = 홀수예요", answer: true },
    { q: "12는 4의 배수예요", answer: true },
    { q: "원의 중심에서 원둘레까지의 거리를 반지름이라고 해요", answer: true },
    { q: "3 × 0 = 3이에요", answer: false },
    { q: "10 + 1 = 12예요", answer: false },
    { q: "가장 작은 두 자리 수는 10이에요", answer: true },
    { q: "999보다 1 큰 수는 1000이에요", answer: true },
  ],
};

// 카테고리 이모지·색상
const CAT_META = {
  "과학·자연": { icon: "🔬", color: "#4ECDC4" },
  "동물":      { icon: "🐾", color: "#6DAB60" },
  "음식·건강": { icon: "🍎", color: "#FF9600" },
  "세계·상식": { icon: "🌏", color: "#5B9BD5" },
  "수학·논리": { icon: "🧩", color: "#C084FC" },
};

// 전체 문제 배열 (category 필드 자동 포함)
const OX_QUESTIONS = Object.entries(QUESTION_BANK).flatMap(
  ([category, qs]) => qs.map((q) => ({ ...q, category }))
);

const TOTAL = 10;
const TIMER_SEC = 10;

// 애니메이션 주입
if (typeof document !== "undefined" && !document.getElementById("ox-quiz-style")) {
  const s = document.createElement("style");
  s.id = "ox-quiz-style";
  s.textContent = `
    @keyframes oxSlideDown {
      from { opacity: 0; transform: translateY(-24px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes oxBounceIn {
      0%   { transform: scale(1); }
      30%  { transform: scale(1.08); }
      60%  { transform: scale(0.96); }
      100% { transform: scale(1); }
    }
    @keyframes oxShake {
      0%,100% { transform: translateX(0); }
      20%     { transform: translateX(-8px); }
      40%     { transform: translateX(8px); }
      60%     { transform: translateX(-5px); }
      80%     { transform: translateX(5px); }
    }
    @keyframes oxFlash {
      0%   { opacity: 0.45; }
      100% { opacity: 0; }
    }
    @keyframes oxConfetti {
      0%   { transform: translateY(0) rotate(0deg); opacity: 1; }
      100% { transform: translateY(80px) rotate(360deg); opacity: 0; }
    }
    @keyframes oxFloat {
      0%,100% { transform: translateY(0) rotate(0deg); opacity: 0.18; }
      50%     { transform: translateY(-18px) rotate(15deg); opacity: 0.32; }
    }
    @keyframes oxStreakPop {
      0%   { transform: scale(0) translateY(20px); opacity: 0; }
      60%  { transform: scale(1.2) translateY(-4px); opacity: 1; }
      100% { transform: scale(1) translateY(0); opacity: 1; }
    }
    @keyframes oxStreakFade {
      0%   { opacity: 1; transform: scale(1) translateY(0); }
      100% { opacity: 0; transform: scale(0.85) translateY(-24px); }
    }
    @keyframes oxCompletePop {
      0%   { transform: scale(0.3) rotate(-12deg); opacity: 0; }
      65%  { transform: scale(1.1) rotate(3deg); opacity: 1; }
      100% { transform: scale(1) rotate(0); }
    }
    .ox-slide-down { animation: oxSlideDown 0.35s ease both; }
    .ox-bounce     { animation: oxBounceIn 0.4s ease both; }
    .ox-shake      { animation: oxShake 0.4s ease both; }
    .ox-streak-pop { animation: oxStreakPop 0.4s cubic-bezier(.34,1.56,.64,1) both; }
    .ox-streak-fade { animation: oxStreakFade 0.6s ease forwards; }
  `;
  document.head.appendChild(s);
}

const pickRandom = (arr, n) => [...arr].sort(() => Math.random() - 0.5).slice(0, n);

const CONFETTI_COLORS = ["#FFD700","#FF6B6B","#6DAB60","#5B9BD5","#FF8C42","#C084FC"];
function Confetti() {
  const items = Array.from({ length: 18 }, (_, i) => ({
    id: i, color: CONFETTI_COLORS[i % 6],
    left: `${Math.random() * 100}%`, delay: `${Math.random() * 0.3}s`,
    size: `${8 + Math.random() * 8}px`,
  }));
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ zIndex: 20 }}>
      {items.map((c) => (
        <div key={c.id} style={{
          position: "absolute", top: "30%", left: c.left,
          width: c.size, height: c.size, borderRadius: "2px",
          backgroundColor: c.color,
          animation: `oxConfetti 0.8s ${c.delay} ease-out both`,
        }} />
      ))}
    </div>
  );
}

// 작은 점 별 (우주 배경)
const STAR_DOTS = Array.from({ length: 50 }, (_, i) => ({
  id: i,
  left: `${Math.random() * 98}%`,
  top: `${Math.random() * 98}%`,
  size: `${1 + Math.random() * 3}px`,
  color: ["#ffffff", "#fffbe0", "#c8d8ff", "#e0d4ff"][Math.floor(Math.random() * 4)],
  opacity: 0.3 + Math.random() * 0.6,
  duration: `${2 + Math.random() * 5}s`,
  delay: `${Math.random() * 4}s`,
}));

// 이모지 별 (크게 떠다니는 것들)
const EMOJI_STARS = Array.from({ length: 10 }, (_, i) => ({
  id: i,
  shape: ["⭐","✨","💫","🌟"][Math.floor(Math.random() * 4)],
  left: `${Math.random() * 88 + 2}%`,
  top: `${Math.random() * 88 + 2}%`,
  size: `${10 + Math.random() * 22}px`,
  duration: `${3 + Math.random() * 4}s`,
  delay: `${Math.random() * 3}s`,
}));

function FloatingParticles() {
  return (
    <div className="pointer-events-none absolute inset-0" style={{ zIndex: 0, overflow: "hidden" }}>
      {STAR_DOTS.map((s) => (
        <div key={`dot-${s.id}`} style={{
          position: "absolute", left: s.left, top: s.top,
          width: s.size, height: s.size, borderRadius: "50%",
          backgroundColor: s.color, opacity: s.opacity,
          animation: `oxFloat ${s.duration} ${s.delay} ease-in-out infinite`,
        }} />
      ))}
      {EMOJI_STARS.map((p) => (
        <div key={`star-${p.id}`} style={{
          position: "absolute", left: p.left, top: p.top,
          fontSize: p.size, userSelect: "none", opacity: 0.7,
          animation: `oxFloat ${p.duration} ${p.delay} ease-in-out infinite`,
        }}>
          {p.shape}
        </div>
      ))}
    </div>
  );
}

// 원형 타이머
function TimerCircle({ timeLeft }) {
  const r = 26;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - timeLeft / TIMER_SEC);
  const color = timeLeft > 6 ? "#6DAB60" : timeLeft > 3 ? "#FFD700" : "#FF4B4B";
  return (
    <div style={{ position: "relative", width: 68, height: 68, flexShrink: 0 }}>
      <svg width="68" height="68" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="34" cy="34" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="6" />
        <circle cx="34" cy="34" r={r} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.9s linear, stroke 0.3s" }} />
      </svg>
      <div style={{
        position: "absolute", inset: 0, display: "flex",
        alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ fontSize: "22px", fontWeight: 900, color }}>{timeLeft}</span>
      </div>
    </div>
  );
}

export default function OXQuiz({ onComplete }) {
  const [questions, setQuestions] = useState(() => pickRandom(OX_QUESTIONS, TOTAL));
  const [current, setCurrent] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [selected, setSelected] = useState(null); // true | false | "TIMEOUT" | null
  const [showResult, setShowResult] = useState(false);
  const [questionKey, setQuestionKey] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIMER_SEC);
  const [streak, setStreak] = useState(0);
  const [streakVisible, setStreakVisible] = useState(false);
  const [streakFading, setStreakFading] = useState(false);

  const handleRestart = () => {
    setQuestions(pickRandom(OX_QUESTIONS, TOTAL));
    setCurrent(0); setCorrectCount(0); setSelected(null);
    setShowResult(false); setStreak(0); setStreakVisible(false); setStreakFading(false);
  };

  const question = questions[current];
  const answered = selected !== null;
  const isCorrect = selected === question?.answer;

  // 타이머
  useEffect(() => {
    if (answered || showResult) return;
    if (timeLeft <= 0) {
      setSelected("TIMEOUT");
      setStreak(0);
      return;
    }
    const id = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(id);
  }, [timeLeft, answered, showResult]);

  // 문제 바뀔 때 타이머 리셋
  useEffect(() => {
    setTimeLeft(TIMER_SEC);
  }, [current]);

  // 스트릭 팝업 자동 숨김
  useEffect(() => {
    if (!streakVisible) return;
    const id = setTimeout(() => {
      setStreakFading(true);
      setTimeout(() => { setStreakVisible(false); setStreakFading(false); }, 600);
    }, 1200);
    return () => clearTimeout(id);
  }, [streakVisible]);

  const handleAnswer = (choice) => {
    if (answered) return;
    setSelected(choice);
    const correct = choice === question.answer;
    if (correct) {
      setCorrectCount((c) => c + 1);
      const newStreak = streak + 1;
      setStreak(newStreak);
      if (newStreak >= 2) { setStreakVisible(true); setStreakFading(false); }
    } else {
      setStreak(0);
    }
  };

  const handleNext = () => {
    if (current + 1 >= TOTAL) {
      setShowResult(true);
    } else {
      setCurrent((c) => c + 1);
      setSelected(null);
      setQuestionKey((k) => k + 1);
    }
  };

  // 결과 화면 진입 시 confetti
  useEffect(() => {
    if (!showResult || correctCount < 8) return;
    const end = Date.now() + 2500;
    const burst = () => {
      confettiLib({ particleCount: 5, angle: 60,  spread: 55, origin: { x: 0, y: 0.6 } });
      confettiLib({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1, y: 0.6 } });
      if (Date.now() < end) requestAnimationFrame(burst);
    };
    burst();
  }, [showResult]);

  // ── 결과 화면 ──
  if (showResult) {
    const bonusMinutes = correctCount >= 8 ? 3 : 0;
    const isWin = bonusMinutes > 0;
    return (
      <div style={{ position: "fixed", inset: 0, background: "linear-gradient(160deg, #060618 0%, #130826 50%, #0a1535 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, overflow: "hidden", zIndex: 20 }}>
        <FloatingParticles />
        <div style={{ background: "white", borderRadius: 28, padding: "28px 28px 32px", textAlign: "center", maxWidth: 320, width: "100%", boxShadow: "0 8px 32px rgba(0,0,0,0.35)", position: "relative", zIndex: 10, animation: "oxCompletePop 0.6s ease-out" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 4 }}>
            <KiddyImg pose={isWin ? "success" : "sad"} size={120} bg="transparent" />
          </div>
          <div style={{ fontSize: 36, margin: "4px 0 6px" }}>{isWin ? "🎉" : "😢"}</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#2C3528", marginBottom: 4 }}>
            {correctCount >= 10 ? "완벽해요!" : isWin ? "잘했어요!" : "아쉬워요~"}
          </div>
          <div style={{ fontSize: 14, color: "#AAA", marginBottom: 14 }}>
            {TOTAL}문제 중 {correctCount}문제 정답
          </div>
          <div style={{ display: "flex", gap: 3, justifyContent: "center", flexWrap: "nowrap", marginBottom: 18 }}>
            {Array.from({ length: 10 }).map((_, i) => (
              <span key={i} style={{ fontSize: "17px", filter: i < correctCount ? "none" : "grayscale(1) opacity(0.3)" }}>⭐</span>
            ))}
          </div>
          {bonusMinutes > 0 ? (
            <div style={{ background: "linear-gradient(90deg, #2E9E50, #6DAB60)", borderRadius: 16, padding: "14px 20px", marginBottom: 20 }}>
              <div style={{ fontSize: 13, color: "white", fontWeight: 700 }}>보너스 시간 획득!</div>
              <div style={{ fontSize: 32, fontWeight: 900, color: "white" }}>+{bonusMinutes}분 ⏰</div>
            </div>
          ) : (
            <div style={{ background: "#FFF0F0", border: "2px solid #FFCCCC", borderRadius: 16, padding: "12px 20px", marginBottom: 20 }}>
              <div style={{ fontSize: 13, color: "#FF5C5C", fontWeight: 700 }}>8문제 이상 맞혀야 보너스를 얻어요!</div>
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center", width: "100%" }}>
            <button onClick={handleRestart}
              style={{ background: "linear-gradient(90deg, #a8edea, #b8d4ff)", border: "none", borderRadius: 14, padding: "12px 0", fontSize: 14, fontWeight: 800, color: "#5C3D9E", cursor: "pointer", width: "100%" }}>
              다시 하기
            </button>
            <button onClick={() => onComplete(correctCount)}
              style={{ background: "none", border: "none", fontSize: 13, fontWeight: 700, color: "#B0B0B0", cursor: "pointer", textDecoration: "underline" }}>
              게임 허브로 돌아가기
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 버튼 스타일
  const getBtnStyle = (btnValue) => {
    if (!answered) return { bg: btnValue ? "#5B9BD5" : "#E03C3C", shadow: btnValue ? "0 6px 0 #3a72a8" : "0 6px 0 #a02020", opacity: 1, translateY: 0 };
    if (btnValue === question.answer) return { bg: "#2E9E50", shadow: "0 6px 0 #1a6e36", opacity: 1, translateY: 0 };
    if (btnValue === selected) return { bg: "#C84B47", shadow: "0 3px 0 #8a2020", opacity: 1, translateY: 3 };
    return { bg: "rgba(255,255,255,0.08)", shadow: "none", opacity: 0.3, translateY: 0 };
  };
  const oSt = getBtnStyle(true);
  const xSt = getBtnStyle(false);
  const catMeta = CAT_META[question.category] || { icon: "📚", color: "#888" };

  return (
    <div className="flex flex-col min-h-full" style={{ background: "linear-gradient(160deg, #060618 0%, #130826 50%, #0a1535 100%)", minHeight: "100%", position: "relative" }}>
      <FloatingParticles />

      {/* 플래시 오버레이 */}
      {answered && (
        <div className="pointer-events-none fixed inset-0" style={{
          backgroundColor: selected === "TIMEOUT" ? "#555" : isCorrect ? "#2E9E50" : "#C84B47",
          animation: "oxFlash 0.5s ease-out both", zIndex: 15,
        }} />
      )}
      {answered && isCorrect && <Confetti />}

      {/* 스트릭 팝업 */}
      {streakVisible && (
        <div style={{ position: "fixed", top: "20%", left: 0, right: 0, display: "flex", justifyContent: "center", zIndex: 50, pointerEvents: "none" }}>
          <div className={streakFading ? "ox-streak-fade" : "ox-streak-pop"}
            style={{
              background: "linear-gradient(135deg,#FF6B35,#FFD700)",
              borderRadius: "20px", padding: "12px 24px", textAlign: "center",
              boxShadow: "0 8px 32px rgba(255,150,0,0.5)",
            }}>
            <p style={{ fontSize: "28px", fontWeight: 900, color: "white" }}>🔥 {streak}연속 정답!</p>
            <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.85)", marginTop: 2 }}>대단한걸요?!</p>
          </div>
        </div>
      )}

      {/* 상단 진행바 */}
      <div style={{ backgroundColor: "rgba(0,0,0,0.35)", padding: "12px 20px 10px", position: "relative", zIndex: 1 }}>
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            {streak >= 2 && (
              <div style={{ background: "linear-gradient(90deg,#FF6B35,#FFD700)", borderRadius: "12px", padding: "2px 10px" }}>
                <span style={{ fontSize: "13px", fontWeight: 800, color: "white" }}>🔥 {streak}연속</span>
              </div>
            )}
          </div>
          <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "13px", fontWeight: 700 }}>{current + 1} / {TOTAL}</span>
        </div>
        <div className="w-full rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.12)", height: "8px" }}>
          <div className="rounded-full transition-all duration-500" style={{
            width: `${(current / TOTAL) * 100}%`, height: "8px",
            background: "linear-gradient(90deg,#6DAB60,#A8E09A)",
            boxShadow: "0 0 8px rgba(109,171,96,0.6)",
          }} />
        </div>
        <div className="flex gap-1.5 mt-2 justify-center">
          {Array.from({ length: TOTAL }).map((_, i) => (
            <div key={i} style={{
              width: "26px", height: "26px", borderRadius: "50%",
              backgroundColor: i < current ? "#6DAB60" : i === current ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.12)",
              border: i === current ? "3px solid #FFD700" : "none",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "11px", fontWeight: 800,
              color: i === current ? "#2C3528" : "transparent",
              transition: "all 0.3s",
            }}>
              {i === current ? current + 1 : ""}
            </div>
          ))}
        </div>
      </div>

      {/* 타이머 */}
      <div className="flex items-center px-5 pt-3" style={{ position: "relative", zIndex: 1 }}>
        <TimerCircle timeLeft={timeLeft} />
      </div>

      {/* 키디 마스코트 - 문제 카드 바로 위, 중앙 */}
      <div className="flex justify-center" style={{ position: "relative", zIndex: 1, marginTop: "-4px", marginBottom: "-16px" }}>
        <div style={{ animation: "kiddyFloat 2.5s ease-in-out infinite" }}>
          <KiddyImg
            pose={!answered ? "hello" : (selected === "TIMEOUT" ? "sad" : isCorrect ? "success" : "sad")}
            size={340}
            bg="transparent"
          />
        </div>
      </div>

      {/* 문제 카드 */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-2" style={{ position: "relative", zIndex: 1 }}>
        <div key={questionKey} className="ox-slide-down w-full rounded-3xl px-6 py-6 text-center" style={{
          background: "rgba(255,255,255,0.08)",
          border: "2px solid rgba(255,255,255,0.15)",
          backdropFilter: "blur(8px)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        }}>
          {/* 카테고리 태그 */}
          <div className="flex justify-center mb-3">
            <span style={{
              backgroundColor: `${catMeta.color}30`,
              border: `1.5px solid ${catMeta.color}`,
              color: catMeta.color,
              borderRadius: "20px", padding: "3px 12px",
              fontSize: "12px", fontWeight: 800,
            }}>
              {catMeta.icon} {question.category}
            </span>
          </div>
          <p className="text-xl font-extrabold leading-snug text-white">{question.q}</p>
          {answered && (
            <p className="mt-4 text-base font-bold" style={{ color: (selected === "TIMEOUT" || !isCorrect) ? "#FF9090" : "#A8E09A" }}>
              {selected === "TIMEOUT" ? `⏰ 시간 초과! 정답은 "${question.answer ? "O" : "X"}"예요` : isCorrect ? "✅ 정답!" : `❌ 정답은 "${question.answer ? "O" : "X"}"예요`}
            </p>
          )}
        </div>
      </div>

      {/* O / X 버튼 */}
      <div className="flex gap-4 px-5 pb-3" style={{ position: "relative", zIndex: 1 }}>
        {[
          { value: true, label: "O", st: oSt, anim: answered && selected === true ? (isCorrect ? "ox-bounce" : "ox-shake") : "" },
          { value: false, label: "X", st: xSt, anim: answered && selected === false ? (isCorrect ? "ox-bounce" : "ox-shake") : "" },
        ].map(({ value, label, st, anim }) => (
          <button key={label} onClick={() => handleAnswer(value)}
            className={`flex-1 flex items-center justify-center font-black text-white ${anim}`}
            style={{
              height: "90px", borderRadius: "20px", fontSize: "52px",
              backgroundColor: st.bg, boxShadow: st.shadow,
              opacity: st.opacity, transform: `translateY(${st.translateY}px)`,
              transition: "opacity 0.2s, transform 0.1s",
              cursor: answered ? "default" : "pointer", letterSpacing: "-2px",
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* 다음 버튼 */}
      {answered && (
        <div className="px-5 pb-5" style={{ position: "relative", zIndex: 1 }}>
          <button onClick={handleNext}
            className="w-full rounded-2xl py-4 text-lg font-black text-white"
            style={{ background: "linear-gradient(90deg,#5B9BD5,#3a72a8)", boxShadow: "0 4px 0 #2a5280, 0 6px 16px rgba(0,0,0,0.3)" }}>
            {current + 1 >= TOTAL ? "결과 보기 🎯" : "다음 문제 →"}
          </button>
        </div>
      )}
    </div>
  );
}
