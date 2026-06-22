"""아바타 재가공 (1회성) — 전신 캐릭터를 '상반신 + 머리 위 여백 통일' 정사각으로.

배경: 원본 8개가 1536x1024 가로형, 흰 배경, 캐릭터가 위 1~3%부터 꽉 참(머리 위 여백 0).
→ 원형 아바타에서 정수리가 잘리고, 캐릭터마다 여백이 달라 CSS로 통일 불가.

처리: 흰 배경 기준 캐릭터 감지 → 상반신만 crop → 정사각 흰 캔버스에
      머리 위 여백 TOP_MARGIN 통일, 가로 중앙 배치. (원본은 avatars_original_backup에 보존)

실행: python fix_avatars.py
"""
import glob
import os
import numpy as np
from PIL import Image

# ⚠️ 항상 원본 백업에서 읽어 결과 폴더에 씀 → 파라미터 바꿔 몇 번이고 재실행 안전
SRC = "client/public/images/avatars_original_backup"
DST = "client/public/images/avatars"
TOP_MARGIN = 0.14    # 머리 위 여백 (캔버스 높이 대비)
UPPER_BODY = 0.72    # 캐릭터 상단부터 이 비율만 사용 (클수록 더 멀리·상반신 넓게)
WHITE = 245          # 이 값 이상이면 배경(흰색)으로 간주

for p in sorted(glob.glob(os.path.join(SRC, "avatar_*.png"))):
    im = Image.open(p).convert("RGB")
    arr = np.array(im)
    mask = (arr < WHITE).any(axis=2)        # 비흰색 = 캐릭터
    ys, xs = np.where(mask)
    t, b = ys.min(), ys.max()
    l, r = xs.min(), xs.max()
    charH = b - t

    # 상반신만 crop (머리 top ~ charH*UPPER_BODY)
    crop_bottom = t + int(charH * UPPER_BODY)
    char = im.crop((l, t, r + 1, crop_bottom))
    cw, ch = char.size

    # 정사각 캔버스: 상반신 높이가 (1-TOP_MARGIN) 차지하도록. 너비도 수용.
    side = max(int(ch / (1 - TOP_MARGIN)), cw)
    canvas = Image.new("RGB", (side, side), (255, 255, 255))
    x = (side - cw) // 2
    y = int(side * TOP_MARGIN)
    canvas.paste(char, (x, y))
    out = os.path.join(DST, os.path.basename(p))
    canvas.save(out)
    print(f"{os.path.basename(p)}: {side}x{side} (머리위 {int(side*TOP_MARGIN)}px 여백)")

print("[OK] 아바타 재가공 완료")
