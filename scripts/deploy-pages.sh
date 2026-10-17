#!/usr/bin/env bash
# 部署前端到 GitHub Pages（gh-pages 分支模式，无需 workflow scope）
# 用法：./scripts/deploy-pages.sh   （域名 https://dimples-wiki.github.io/apa/）
set -euo pipefail
cd "$(dirname "$0")/.."

BASE="${VITE_BASE:-/apa/}"
OWNER="dimples-wiki"

echo "▶ 构建前端（base=${BASE}）…"
# 关键：①Pages 产物输出到独立目录，避免覆盖 apps/web/dist（本地 4310 服务的开发产物）
#       ②清 vite 持久缓存——否则 base 变化会被热缓存吞掉，产出仍是默认 base（已踩坑）
rm -rf apps/web/dist-pages apps/web/node_modules/.vite
VITE_BASE="$BASE" pnpm --filter @dimples/apa-web exec vp build --outDir dist-pages
cp apps/web/dist-pages/index.html apps/web/dist-pages/404.html

DEPLOY_DIR=$(mktemp -d)
trap 'git worktree remove --force "$DEPLOY_DIR" 2>/dev/null || rm -rf "$DEPLOY_DIR"' EXIT

git fetch origin gh-pages 2>/dev/null || true
if git show-ref --verify --quiet refs/heads/gh-pages; then
  git worktree add "$DEPLOY_DIR" gh-pages
else
  git worktree add --orphan -b gh-pages "$DEPLOY_DIR"
  (cd "$DEPLOY_DIR" && git rm -rfq . 2>/dev/null || true)
fi

echo "▶ 同步构建产物…"
rsync -a --delete --exclude .git "$PWD/apps/web/dist-pages/" "$DEPLOY_DIR/"
cd "$DEPLOY_DIR"
git add -A
git commit -qm "deploy: $(date -u '+%Y-%m-%d %H:%M') UTC ${1:-}" || echo "无变更，跳过提交"
git push -u origin gh-pages

echo "✓ 已发布：https://$OWNER.github.io/apa/"
