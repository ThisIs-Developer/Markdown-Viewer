FROM node:22-alpine
ARG SOURCE_REVISION=unknown
ARG SOURCE_URL=https://github.com/ThisIs-Developer/Markdown-Viewer
LABEL org.opencontainers.image.title="Markdown Viewer cloud edition" \
      org.opencontainers.image.source=$SOURCE_URL \
      org.opencontainers.image.revision=$SOURCE_REVISION
WORKDIR /app/self-hosted/connector
COPY self-hosted/connector/package*.json ./
RUN npm ci --omit=dev --ignore-scripts
WORKDIR /app
COPY *.js *.html *.css *.json RELEASE_NOTES /app/
COPY assets/ /app/assets/
COPY seo/ /app/seo/
COPY self-hosted/connector/ /app/self-hosted/connector/
RUN mkdir /data && chown node:node /data
USER node
ENV PORT=80
EXPOSE 80
CMD ["node", "self-hosted/connector/server.mjs"]
