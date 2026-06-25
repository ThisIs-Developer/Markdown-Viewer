# Build Neutralinojs desktop app binaries
#
# Context: repo root (see docker-compose.yml)
# Output: /output/ contains dist/ artifacts

FROM node:lts-alpine AS build

WORKDIR /app

# Copy the entire repo (context is the repo root)
COPY . .

WORKDIR /app/desktop-app

# Setup (download binaries + prepare resources) and build all variants
RUN npm run build

# Final stage: Export the dist artifacts
FROM alpine:latest

WORKDIR /output

COPY --from=build /app/desktop-app/dist/ .

CMD ["echo", "Build artifacts are in /output. Use 'docker cp' to extract them."]
