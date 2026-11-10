FROM node:22-alpine AS build

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages
COPY scripts ./scripts

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @craft/tokens build \
  && pnpm --filter @craft/ui build \
  && pnpm --filter @craft/web build \
  && pnpm --filter @craft/admin build

FROM node:22-alpine AS runtime

RUN apk add --no-cache ffmpeg
ENV FFMPEG_PATH="/usr/bin/ffmpeg"

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NODE_ENV="production"
ENV COMMUNITY_DATA_PATH="/var/data/community.json"
ENV COMMUNITY_MEDIA_DIRECTORY="/var/data/audio"
ENV WEB_DIST_DIRECTORY="/app/apps/web/dist"
ENV ADMIN_DIST_DIRECTORY="/app/apps/admin/dist"

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY apps/admin/package.json ./apps/admin/package.json
COPY packages/icons/package.json ./packages/icons/package.json
COPY packages/tokens/package.json ./packages/tokens/package.json
COPY packages/ui/package.json ./packages/ui/package.json
RUN pnpm install --prod --frozen-lockfile --filter @craft/api

COPY apps/api/src ./apps/api/src
COPY docs/guides ./docs/guides
COPY --from=build /app/apps/web/dist ./apps/web/dist
COPY --from=build /app/apps/admin/dist ./apps/admin/dist

EXPOSE 10000
CMD ["node", "apps/api/src/server.mjs"]
