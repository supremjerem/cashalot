# No build step (no bundler, no TypeScript) — just install production
# dependencies and copy the static assets + server alongside them.
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY server ./server
COPY src ./src
COPY vendor ./vendor
COPY index.html favicon.svg ./
USER app

EXPOSE 3000
CMD ["node", "server/index.js"]
