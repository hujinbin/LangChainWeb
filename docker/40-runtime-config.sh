#!/bin/sh
set -eu

API_UPSTREAM="${API_UPSTREAM:-https://jue.leheavengame.com}"
PARTNER_UPSTREAM="${PARTNER_UPSTREAM:-https://jue.leheavengame.com}"
PARTNER_PATH="${PARTNER_PATH:-/partner/}"
DEFAULT_THEME="${DEFAULT_THEME:-auto}"
PUBLIC_SCHEME="${PUBLIC_SCHEME:-}"
export PARTNER_PATH DEFAULT_THEME

# With no URI in proxy_pass, Nginx keeps /api, /outputs or /partner in the path.
origin() {
    value="${1%/}"
    case "$value" in *[!a-zA-Z0-9.:/\[\]-]*) return 1 ;; esac
    printf '%s\n' "$value" | grep -Eq '^https?://([a-zA-Z0-9][a-zA-Z0-9.-]*|\[[0-9a-fA-F:]+\])(:[0-9]{1,5})?$' || return 1
    printf '%s' "$value"
}
API_UPSTREAM="$(origin "$API_UPSTREAM")" || { echo 'API_UPSTREAM must be an HTTP(S) origin' >&2; exit 1; }
PARTNER_UPSTREAM="$(origin "$PARTNER_UPSTREAM")" || { echo 'PARTNER_UPSTREAM must be an HTTP(S) origin' >&2; exit 1; }
case "$PUBLIC_SCHEME" in http|https) ;; '') PUBLIC_SCHEME='$scheme' ;; *) echo 'PUBLIC_SCHEME must be http or https' >&2; exit 1 ;; esac

# Read strings directly from ENVIRON to preserve literal backslashes and control characters.
LC_ALL=C awk '
    function quote(value,  out, char, i) {
        out = "\""
        for (i = 1; i <= length(value); ++i) {
            char = substr(value, i, 1)
            if (char == "\"" || char == "\\") out = out "\\" char
            else if (char in escaped) out = out escaped[char]
            else out = out char
        }
        return out "\""
    }
    BEGIN {
        for (i = 1; i < 32; ++i) escaped[sprintf("%c", i)] = sprintf("\\u%04x", i)
        n = split("apiBaseUrl siteId partnerPath brandName logoUrl faviconUrl defaultTheme helpUrl qqGroup", keys)
        split("PUBLIC_API_BASE_URL SITE_ID PARTNER_PATH BRAND_NAME LOGO_URL FAVICON_URL DEFAULT_THEME HELP_URL QQ_GROUP", names)
        print "window.__JUE_CONFIG__ = {"
        for (i = 1; i <= n; ++i) print "  " quote(keys[i]) ": " quote(ENVIRON[names[i]]) (i < n ? "," : "")
        print "};"
    }
' > /usr/share/nginx/html/config.js

partner_alias=''
case "$PARTNER_PATH" in
    /partner|/partner/) ;;
    /*)
        alias_path="${PARTNER_PATH%/}"
        case "$alias_path" in /api|/api/*|/static|/static/*|/outputs|/outputs/*|/admin|/admin/*|/partner/*|/docs|/usage|/api-reference|/api-reference/*|/healthz|/config.js|'') echo 'PARTNER_PATH conflicts with a reserved route' >&2; exit 1 ;; esac
        case "$alias_path" in *[!a-zA-Z0-9/_-]*|*//*|//*) echo 'Invalid local PARTNER_PATH' >&2; exit 1 ;; esac
        partner_alias="location = $alias_path { return 302 /partner/\$is_args\$args; } location = $alias_path/ { return 302 /partner/\$is_args\$args; }"
        ;;
    *) echo 'PARTNER_PATH must be a local path' >&2; exit 1 ;;
esac
sed -e "s|__API_UPSTREAM__|$API_UPSTREAM|g" \
    -e "s|__PARTNER_UPSTREAM__|$PARTNER_UPSTREAM|g" \
    -e "s|__PARTNER_ALIAS__|$partner_alias|g" \
    -e "s|__PUBLIC_SCHEME__|$PUBLIC_SCHEME|g" \
    /opt/runtime/nginx.conf > /etc/nginx/conf.d/default.conf
