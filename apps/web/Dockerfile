# Build depuis la racine du monorepo :
#   docker build -f apps/web/Dockerfile --build-arg NEXT_PUBLIC_API_URL=... .
# Les variables NEXT_PUBLIC_* sont figées au moment du build de l'image :
# tout changement (URL API, config Firebase) impose un rebuild.
FROM node:22-alpine AS builder
RUN corepack enable
WORKDIR /repo

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter @estimate/web

COPY apps/web apps/web

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_APP_ID
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY \
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN \
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID \
    NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID

RUN pnpm --filter @estimate/web build

FROM node:22-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app

RUN addgroup -S estimate && adduser -S estimate -G estimate

# Sortie standalone : serveur autonome + assets statiques.
COPY --from=builder --chown=estimate:estimate /repo/apps/web/.next/standalone ./
COPY --from=builder --chown=estimate:estimate /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=estimate:estimate /repo/apps/web/public ./apps/web/public

USER estimate
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0

CMD ["node", "apps/web/server.js"]
