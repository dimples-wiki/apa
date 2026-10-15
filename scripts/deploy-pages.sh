#!/usr/bin/env bash
# 部署前端到 GitHub Pages（gh-pages 分支模式，无需 workflow scope）
# 用法：./scripts/deploy-pages.sh   （域名 https://dimples-wiki.github.io/apa/）
set -euo pipefail
cd "$(dirname "$0")/.."

BASE="${VITE_BASE:-/apa/}"
OWNER="dimples-wiki"

echo "▶ 构建前端（base=${BASE}）…"
VITE_BASE="$BASE" pnpm --filter @dimples/apa-web build
cp apps/web/dist/index.html apps/web/dist/404.html

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
rsync -a --delete --exclude .git "$PWD/apps/web/dist/" "$DEPLOY_DIR/"
cd "$DEPLOY_DIR"
git add -A
git commit -qm "deploy: $(date -u '+%Y-%m-%d %H:%M') UTC ${1:-}" || echo "无变更，跳过提交"
git push -u origin gh-pages

echo "✓ 已发布：https://$OWNER.github.io/apa/"
