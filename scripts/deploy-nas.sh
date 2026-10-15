#!/usr/bin/env bash
# FilmStudio 一键部署到群晖 NAS（纯静态站点，Web Station / 个人站点均可托管）
#
# 用法：
#   NAS_USER=yoko ./scripts/deploy-nas.sh
#   NAS_USER=yoko NAS_HOST=192.168.31.183 ./scripts/deploy-nas.sh
#
# 首次使用建议先配免密登录（之后部署不再需要输密码）：
#   ssh-copy-id "$NAS_USER@$NAS_HOST"
#
# 环境变量：
#   NAS_USER   NAS 登录用户名（默认与当前 Mac 用户同名）
#   NAS_HOST   NAS 地址（默认 192.168.31.183）
#   SITE_NAME  站点目录名（默认 filmstudio）
set -euo pipefail
cd "$(dirname "$0")/.."

NAS_USER="${NAS_USER:-$(whoami)}"
NAS_HOST="${NAS_HOST:-192.168.31.183}"
SITE_NAME="${SITE_NAME:-filmstudio}"
SSH_TARGET="$NAS_USER@$NAS_HOST"

echo "▶ 构建前端产物（apps/web/dist）…"
pnpm --filter @filmstudio/web build

DIST="$(pwd)/apps/web/dist"
[ -f "$DIST/index.html" ] || { echo "✗ 构建产物缺失：$DIST/index.html"; exit 1; }

echo "▶ 探测 NAS 部署目录（$SSH_TARGET）…"
REMOTE=$(ssh "$SSH_TARGET" '
  if [ -d /var/services/web ] && [ -w /var/services/web ]; then
    echo "site /var/services/web/'"$SITE_NAME"'"
  elif [ -d "/var/services/homes/'"$NAS_USER"'"/web ]; then
    echo "home /var/services/homes/'"$NAS_USER"'"/web/'"$SITE_NAME"'"
  else
    echo "NONE"
  fi')

MODE="${REMOTE%% *}"
REMOTE_DIR="${REMOTE#* }"

if [ "$MODE" = "NONE" ]; then
  cat <<TIP
✗ 未找到可写的部署目录。请在群晖 DSM 上做一次任选其一：
  1) 套件中心安装并打开「Web Station」（会创建 /var/services/web 并赋权）
  2) 控制面板 → 用户之家 → 启用「用户 home 服务」（创建 /var/services/homes/<用户>/web）
之后重新运行本脚本。
TIP
  exit 1
fi

echo "▶ 部署到 $SSH_TARGET:$REMOTE_DIR …"
ssh "$SSH_TARGET" "mkdir -p '$REMOTE_DIR'"
rsync -az --delete --stats "$DIST/" "$SSH_TARGET:$REMOTE_DIR/"

if [ "$MODE" = "site" ]; then
  URL="http://$NAS_HOST/$SITE_NAME/"
else
  URL="http://$NAS_HOST/~$NAS_USER/$SITE_NAME/"
fi

cat <<DONE

✓ 部署完成
  局域网访问：$URL
  （首页进入后，页内导航/底部 Tab 均为前端路由，不产生刷新请求；
    直接刷新深层路径可能触发 NAS 404，从首页进入即可）

  外网访问三选一（NAS 侧一次性配置）：
  1) DSM 控制面板 → 登录门户 → 高级 → 反向代理：
     将 https://$NAS_HOST:8443 来源代理到 http://localhost:80 目标路径 $SITE_NAME，
     QuickConnect 会生成对应分发链接，手机可直接访问
  2) 群晖 DDNS + 路由器端口转发（外网端口 → NAS 80）
  3) 设备均安装 Tailscale 组虚拟网后访问 http://$NAS_HOST/$SITE_NAME/
DONE
