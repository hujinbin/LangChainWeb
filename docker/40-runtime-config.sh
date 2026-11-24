#!/bin/sh
# 容器启动时生成运行时配置与 Nginx 反代目标，修改环境变量重启即可生效。
set -eu

API_UPSTREAM="${API_UPSTREAM:-http://host.docker.internal:3000}"
ADMIN_UPSTREAM="${ADMIN_UPSTREAM:-$API_UPSTREAM}"
PUBLIC_API_BASE_URL="${PUBLIC_API_BASE_URL:-}"
SITE_ID="${SITE_ID:-}"
ADMIN_PATH="${ADMIN_PATH:-/admin}"
BRAND_NAME="${BRAND_NAME:-}"
LOGO_URL="${LOGO_URL:-}"
FAVICON_URL="${FAVICON_URL:-}"
DEFAULT_THEME="${DEFAULT_THEME:-auto}"
HELP_URL="${HELP_URL:-}"
QQ_GROUP="${QQ_GROUP:-}"

# 配置只会写入公开字段，禁止把密钥通过此文件下发到浏览器。
json_value() {
    printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}

cat > /usr/share/nginx/html/config.js <<EOF
window.__JUE_CONFIG__ = {
  apiBaseUrl: "$(json_value "$PUBLIC_API_BASE_URL")",
  siteId: "$(json_value "$SITE_ID")",
  adminPath: "$(json_value "$ADMIN_PATH")",
  brandName: "$(json_value "$BRAND_NAME")",
  logoUrl: "$(json_value "$LOGO_URL")",
  faviconUrl: "$(json_value "$FAVICON_URL")",
  defaultTheme: "$(json_value "$DEFAULT_THEME")",
  helpUrl: "$(json_value "$HELP_URL")",
  qqGroup: "$(json_value "$QQ_GROUP")",
};
EOF

sed -e "s|__API_UPSTREAM__|${API_UPSTREAM}|g" \
    -e "s|__ADMIN_UPSTREAM__|${ADMIN_UPSTREAM}|g" \
    /opt/runtime/nginx.conf > /etc/nginx/conf.d/default.conf

echo "[runtime-config] api=${PUBLIC_API_BASE_URL:-同源} api_upstream=${API_UPSTREAM} admin_upstream=${ADMIN_UPSTREAM}"
