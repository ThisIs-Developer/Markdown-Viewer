# Use nginx as the base image for serving static files
FROM nginx:alpine

# PERF-019: Only copy necessary web files (exclude .git, desktop-app, wiki, etc.)
COPY index.html /usr/share/nginx/html/
COPY workspace-storage.js /usr/share/nginx/html/
COPY script.js /usr/share/nginx/html/
COPY styles.css /usr/share/nginx/html/
COPY sw.js /usr/share/nginx/html/
COPY RELEASE_NOTES /usr/share/nginx/html/
COPY manifest.json /usr/share/nginx/html/
COPY robots.txt /usr/share/nginx/html/
COPY sitemap.xml /usr/share/nginx/html/
COPY assets/ /usr/share/nginx/html/assets/

# Create a custom nginx configuration with compression and security
# PERF-020: Added gzip compression for text-based assets
RUN echo 'server { \
    listen 80; \
    server_name localhost; \
    root /usr/share/nginx/html; \
    index index.html; \
    \
    # Enable gzip compression (PERF-020) \
    gzip on; \
    gzip_vary on; \
    gzip_proxied any; \
    gzip_comp_level 6; \
    gzip_min_length 256; \
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml; \
    \
    # Handle client-side routing for SPA \
    location / { \
    try_files $uri $uri/ /index.html; \
    } \
    \
    # Cache static assets \
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ { \
    expires 1y; \
    add_header Cache-Control "public, immutable"; \
    } \
    \
    # Security headers \
    add_header X-Frame-Options "SAMEORIGIN" always; \
    add_header X-Content-Type-Options "nosniff" always; \
    add_header X-XSS-Protection "1; mode=block" always; \
    add_header Referrer-Policy "strict-origin-when-cross-origin" always; \
    # PERF-029: Content Security Policy for defense-in-depth \
    add_header Content-Security-Policy "default-src '"'"'self'"'"'; base-uri '"'"'self'"'"'; object-src '"'"'none'"'"'; script-src '"'"'self'"'"' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net '"'"'unsafe-inline'"'"'; worker-src '"'"'self'"'"'; connect-src '"'"'self'"'"' https://api.github.com https://raw.githubusercontent.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://kroki.io https://www.plantuml.com https://mermaid.ink https://paulrosen.github.io; img-src '"'"'self'"'"' data: blob: https:; style-src '"'"'self'"'"' '"'"'unsafe-inline'"'"' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; font-src '"'"'self'"'"' data: https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; media-src '"'"'self'"'"' blob: data:; manifest-src '"'"'self'"'"'; upgrade-insecure-requests" always; \
    }' > /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]

