# 多阶段构建：Node 只负责产出静态资源，运行镜像仅包含 Nginx。
# 运行镜像使用官方非 root 变体，监听 8080，由 compose 映射到宿主机 80。
FROM --platform=$BUILDPLATFORM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY extension/package.json ./extension/
RUN npm ci --no-audit --no-fund
COPY . .
ARG WXT_STUDIO_ORIGIN
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

USER root
COPY docker/nginx.conf /opt/runtime/nginx.conf
COPY docker/40-runtime-config.sh /docker-entrypoint.d/40-runtime-config.sh
RUN test -s /etc/ssl/certs/ca-certificates.crt || apk add --no-cache ca-certificates
RUN chmod +x /docker-entrypoint.d/40-runtime-config.sh \
    && chown -R nginx:nginx /etc/nginx/conf.d /usr/share/nginx/html
COPY LICENSE /usr/share/doc/langchainweb/LICENSE
COPY --from=build --chown=nginx:nginx /app/build/ /usr/share/nginx/html/

USER nginx
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null 2>&1 || exit 1
