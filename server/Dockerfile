# Build context must be the repository root (see docker-compose.yml),
# because the server injects the userscripts that live one level above server/.
# Jammy ships Node 20, which has the best prebuilt coverage for the sqlite3 driver.
FROM mcr.microsoft.com/playwright:v1.61.1-jammy

ENV NODE_ENV=production

WORKDIR /app/server

# Build toolchain so the sqlite3 native module compiles if no prebuilt binary matches.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

# Install dependencies first for better layer caching.
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev

# Server source (node_modules/.env/data excluded via .dockerignore).
COPY server/ ./

# Userscripts the server reads from the repo root (config.repoRoot === /app).
COPY *.user.js /app/

# SQLite data directory; mounted as a volume at runtime for persistence.
RUN mkdir -p /app/server/data && chown -R pwuser:pwuser /app

USER pwuser

CMD ["node", "src/index.js"]
