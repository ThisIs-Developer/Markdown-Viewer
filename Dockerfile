# Use nginx as the base image for serving static files
FROM nginx:alpine

# PERF-019: Only copy necessary web files (exclude .git, desktop-app, wiki, etc.)
COPY index.html /usr/share/nginx/html/
COPY workspace-storage.js /usr/share/nginx/html/
COPY visual-settings-adapters.js /usr/share/nginx/html/
COPY visual-settings-store.js /usr/share/nginx/html/
COPY script.js native-markdown-source.js browser-drop-source.js preview-worker.js /usr/share/nginx/html/
COPY sharing-crypto.js sharing-media.js sharing-live.js sharing-recovery.js /usr/share/nginx/html/
COPY styles.css /usr/share/nginx/html/
COPY sw.js /usr/share/nginx/html/
COPY RELEASE_NOTES sample.md /usr/share/nginx/html/
COPY manifest.json /usr/share/nginx/html/
COPY robots.txt /usr/share/nginx/html/
COPY sitemap.xml /usr/share/nginx/html/
COPY assets/ /usr/share/nginx/html/assets/
COPY seo/locales.mjs /usr/share/nginx/html/seo/
COPY seo/welcome-content.mjs /usr/share/nginx/html/seo/

COPY nginx.conf /etc/nginx/conf.d/default.conf
RUN nginx -t
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
