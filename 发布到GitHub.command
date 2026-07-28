#!/bin/zsh
set -e

cd "/Users/huihui/Documents/飞飞子的旅游世界"

repo="feifei-life-cockpit"

if ! gh auth status >/dev/null 2>&1; then
  echo "还没有登录 GitHub。"
  echo "请先运行：gh auth login"
  echo "登录完成后，再双击这个脚本。"
  read -k 1 "?按任意键退出..."
  exit 1
fi

owner="$(gh api user -q .login)"

if ! git remote get-url origin >/dev/null 2>&1; then
  gh repo create "$repo" --public --source=. --remote=origin --push
else
  git push -u origin main
fi

if gh api "repos/$owner/$repo/pages" >/dev/null 2>&1; then
  printf '{"source":{"branch":"main","path":"/"}}' | gh api --method PUT "repos/$owner/$repo/pages" --input - >/dev/null
else
  printf '{"source":{"branch":"main","path":"/"}}' | gh api --method POST "repos/$owner/$repo/pages" --input - >/dev/null
fi

url="https://$owner.github.io/$repo/"
echo ""
echo "发布已提交。GitHub Pages 通常需要 1-3 分钟生效："
echo "$url"
echo ""

python3 - <<PY
import qrcode
from PIL import Image, ImageDraw, ImageFont
url = "$url"
img = qrcode.make(url).convert("RGB").resize((720, 720))
canvas = Image.new("RGB", (900, 1040), "#f2efe8")
canvas.paste(img, (90, 90))
draw = ImageDraw.Draw(canvas)
try:
    font_title = ImageFont.truetype("/System/Library/Fonts/PingFang.ttc", 42)
    font_copy = ImageFont.truetype("/System/Library/Fonts/PingFang.ttc", 24)
except Exception:
    font_title = ImageFont.load_default()
    font_copy = ImageFont.load_default()
draw.text((90, 835), "飞飞子的生活工作台", fill="#222522", font=font_title)
draw.text((90, 900), "GitHub Pages 公网链接，手机扫码打开", fill="#2f765e", font=font_copy)
draw.text((90, 940), url, fill="#6f756f", font=font_copy)
canvas.save("github-pages-qr.png")
PY

open github-pages-qr.png
echo "二维码已生成：github-pages-qr.png"
read -k 1 "?按任意键退出..."
