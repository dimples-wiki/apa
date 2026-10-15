#!/usr/bin/env bash
# 部署 FilmStudio/APA 前端到 GitHub Pages（gh-pages 分支模式）
# 用法：./scripts/deploy-pages.sh   （VITE_BASE 默认 /apa/）
set -euo pipefail
cd "$(dirname "$0")/.."

BASE="${VITE_BASE:-/apa/}"
echo "▶ 构建前端（base=$BASE）…"
pnpm --filter @dimples/apa-web build
env VITE_BASE="$BASE" pnpm --filter @dimples/apa-web exec vite build --base="$BASE"
cp apps/web/dist/index.html apps/web/dist/404.html

echo "▶ 推送 gh-pages …"
cd apps/web/dist
if git rev-parse --verify gh-pages >/dev/null 2>&1; then
  git switch gh-pages
else
  git switch --orphan gh-pages
  git rm -rfq . 2>/dev/null || true
fi
cp -R "$(cd ../.. && pwd)/apps/web/dist/." .
git add -A
git commit -qm "deploy: $(date -u '+%Y-%m-%d %H:%M') ${1:-}"
git push -u origin gh-pages --force
git switch -
echo "✓ 已发布：https://dimples-wiki.github.io/apa/"
