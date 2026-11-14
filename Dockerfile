# Serve the privacy-first Markdown Viewer web application with Nginx.
# Public HTTPS is terminated by an optional Caddy reverse proxy.
FROM nginx:alpine

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
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
