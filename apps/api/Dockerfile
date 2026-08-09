FROM node:24.18.0-alpine3.24@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd AS build

WORKDIR /workspace
RUN corepack enable && corepack prepare pnpm@11.9.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/tsconfig.json ./apps/api/
COPY packages/config/package.json packages/config/tsconfig.json ./packages/config/
RUN pnpm install --frozen-lockfile

COPY apps/api/src ./apps/api/src
COPY packages/config/src ./packages/config/src
RUN pnpm --filter @vietnam-weather/api... build

FROM node:24.18.0-alpine3.24@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd AS runtime

ENV NODE_ENV=production
WORKDIR /workspace

COPY --from=build --chown=node:node /workspace/node_modules ./node_modules
COPY --from=build --chown=node:node /workspace/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=node:node /workspace/apps/api/node_modules ./apps/api/node_modules
COPY --from=build --chown=node:node /workspace/apps/api/dist ./apps/api/dist
COPY --from=build --chown=node:node /workspace/packages/config/package.json ./packages/config/package.json
COPY --from=build --chown=node:node /workspace/packages/config/dist ./packages/config/dist

USER node
CMD ["node", "apps/api/dist/index.js"]
