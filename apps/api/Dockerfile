# Build depuis la racine du monorepo :
#   docker build -f apps/api/Dockerfile .
FROM node:22-alpine AS builder
RUN corepack enable
WORKDIR /repo

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @estimate/api

COPY apps/api apps/api
RUN pnpm --filter @estimate/api build \
  && pnpm --filter @estimate/api deploy --prod --legacy /prod/api

FROM node:22-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app

RUN addgroup -S estimate && adduser -S estimate -G estimate

COPY --from=builder --chown=estimate:estimate /prod/api/node_modules ./node_modules
COPY --from=builder --chown=estimate:estimate /prod/api/package.json ./package.json
COPY --from=builder --chown=estimate:estimate /repo/apps/api/dist ./dist

RUN mkdir -p /app/uploads && chown estimate:estimate /app/uploads
USER estimate

EXPOSE 3001

# Exécute les migrations puis démarre l'API.
CMD ["sh", "-c", "node node_modules/typeorm/cli.js migration:run -d dist/config/data-source.js && node dist/main.js"]
