# syntax=docker/dockerfile:1.7
# Build NGINX 1.31.9 from a pinned upstream source commit without TLS modules.
# Markdown Viewer runs HTTP-only; no OpenSSL libraries are needed at runtime.
# This is deliberately a two-stage build: compilers and git never reach the image.
FROM alpine:3.24 AS nginx-builder
# Keep compiler downloads cached when only the NGINX source pin changes.
RUN apk add --no-cache build-base git pcre2-dev zlib-dev
ARG NGINX_REVISION=c2c44702c2fbc572e4cfb0a52331061d7fcaca16
RUN git clone --quiet --depth 1 --branch release-1.31.9 \
        https://github.com/nginx/nginx.git /src/nginx \
    && test "$(git -C /src/nginx rev-parse HEAD)" = "$NGINX_REVISION" \
    && cd /src/nginx \
    && ./auto/configure \
        --prefix=/usr/share/nginx \
        --sbin-path=/usr/sbin/nginx \
        --conf-path=/etc/nginx/nginx.conf \
        --error-log-path=/var/log/nginx/error.log \
        --http-log-path=/var/log/nginx/access.log \
        --pid-path=/run/nginx.pid \
        --lock-path=/run/nginx.lock \
        --http-client-body-temp-path=/var/cache/nginx/client_temp \
        --http-proxy-temp-path=/var/cache/nginx/proxy_temp \
        --http-fastcgi-temp-path=/var/cache/nginx/fastcgi_temp \
        --http-uwsgi-temp-path=/var/cache/nginx/uwsgi_temp \
        --http-scgi-temp-path=/var/cache/nginx/scgi_temp \
        --with-pcre-jit \
    && make -j2 \
    && strip objs/nginx

FROM alpine:3.24
LABEL org.opencontainers.image.component.nginx.version="1.31.9" \
      org.opencontainers.image.component.nginx.source="https://github.com/nginx/nginx" \
      org.opencontainers.image.component.nginx.commit="c2c44702c2fbc572e4cfb0a52331061d7fcaca16" \
      org.opencontainers.image.component.nginx.license="BSD-2-Clause"
# Supported Alpine stable packages only; SSL/crypto shared libraries are absent.
# Alpine's package manager and BusyBox TLS helper depend on OpenSSL, but
# neither is needed to serve static HTTP. Remove them through APK itself so
# the remaining APK database accurately lists the installed runtime packages.
RUN apk upgrade --no-cache \
    && apk add --no-cache pcre2 zlib \
    && apk del apk-tools ssl_client openssl libssl3 libcrypto3 \
    && addgroup -S nginx \
    && adduser -S -G nginx nginx \
    && mkdir -p /etc/nginx/conf.d /etc/nginx/snippets /var/cache/nginx /var/log/nginx /run /usr/share/nginx/html /usr/share/licenses/nginx /usr/share/doc/nginx /usr/local/share/sbom \
    && ln -sf /dev/stdout /var/log/nginx/access.log \
    && ln -sf /dev/stderr /var/log/nginx/error.log
COPY --from=nginx-builder /src/nginx/objs/nginx /usr/sbin/nginx
COPY --from=nginx-builder /src/nginx/conf/mime.types /etc/nginx/mime.types
COPY --from=nginx-builder /src/nginx/LICENSE /usr/share/licenses/nginx/LICENSE
COPY docker/nginx-main.conf /etc/nginx/nginx.conf

# PERF-019: Only copy necessary web files (exclude .git, desktop-app, wiki, etc.)
COPY index.html /usr/share/nginx/html/
COPY workspace-storage.js /usr/share/nginx/html/
COPY visual-settings-adapters.js /usr/share/nginx/html/
COPY visual-settings-store.js /usr/share/nginx/html/
COPY script.js /usr/share/nginx/html/
COPY browser-drop-source.js /usr/share/nginx/html/
COPY native-markdown-source.js /usr/share/nginx/html/
COPY preview-worker.js /usr/share/nginx/html/
COPY styles.css /usr/share/nginx/html/
COPY sw.js /usr/share/nginx/html/
COPY RELEASE_NOTES /usr/share/nginx/html/
COPY manifest.json /usr/share/nginx/html/
COPY robots.txt /usr/share/nginx/html/
COPY sitemap.xml /usr/share/nginx/html/
COPY sample.md /usr/share/nginx/html/
COPY assets/ /usr/share/nginx/html/assets/
COPY seo/locales.mjs /usr/share/nginx/html/seo/
COPY seo/welcome-content.mjs /usr/share/nginx/html/seo/

# Reviewable HTTP server and security-header configuration
COPY docker/nginx-server.conf /etc/nginx/conf.d/default.conf
COPY docker/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY docker/check-runtime.sh /usr/local/bin/check-docker-runtime
COPY docker/nginx-component.spdx.json /usr/share/doc/nginx/component.spdx.json
# BuildKit Syft indexes embedded SPDX supplements in the image filesystem.
COPY docker/nginx-component.spdx.json /usr/local/share/sbom/nginx.spdx.json
RUN chmod 0755 /usr/local/bin/check-docker-runtime \
    && /usr/local/bin/check-docker-runtime

# Expose port 80
EXPOSE 80

STOPSIGNAL SIGQUIT
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:80/ || exit 1
# Start nginx
CMD ["nginx", "-g", "daemon off;"]

