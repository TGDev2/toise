# Build depuis la racine du monorepo :
#   docker build -f apps/api/Dockerfile .
FROM node:22-alpine AS builder
RUN corepack enable
WORKDIR /repo

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @chiffreo/api

COPY apps/api apps/api
RUN pnpm --filter @chiffreo/api build \
  && pnpm --filter @chiffreo/api deploy --prod --legacy /prod/api

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

# Exécute les migrations puis démarre l'API. Le passage par `dist/scripts/migrate.js`
# plutôt que par la CLI TypeORM apporte deux choses que le `CMD` seul ne pouvait
# pas donner : un verrou consultatif Postgres (plusieurs réplicas qui démarrent
# ensemble n'appliquent pas deux fois le même ALTER TABLE) et un code de sortie
# dédié, qui distingue « la migration a échoué » de « l'application a crashé »
# dans une boucle `restart: unless-stopped`. Cf. src/scripts/migrate.ts.
CMD ["sh", "-c", "node dist/scripts/migrate.js && node dist/main.js"]
