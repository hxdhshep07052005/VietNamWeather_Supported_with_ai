FROM node:24.18.0-alpine3.24@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd AS build

WORKDIR /workspace
RUN corepack enable && corepack prepare pnpm@11.9.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY apps/worker/package.json apps/worker/tsconfig.json ./apps/worker/
COPY packages/config/package.json packages/config/tsconfig.json ./packages/config/
COPY packages/contracts/package.json packages/contracts/tsconfig.json ./packages/contracts/
RUN pnpm install --frozen-lockfile

COPY apps/worker/src ./apps/worker/src
COPY packages/config/src ./packages/config/src
COPY packages/contracts/src ./packages/contracts/src
RUN pnpm --filter @vietnam-weather/worker... build

FROM node:24.18.0-alpine3.24@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd AS runtime

ENV NODE_ENV=production
WORKDIR /workspace

COPY --from=build --chown=node:node /workspace/node_modules ./node_modules
COPY --from=build --chown=node:node /workspace/apps/worker/package.json ./apps/worker/package.json
COPY --from=build --chown=node:node /workspace/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=build --chown=node:node /workspace/apps/worker/dist ./apps/worker/dist
COPY --from=build --chown=node:node /workspace/packages/config/package.json ./packages/config/package.json
COPY --from=build --chown=node:node /workspace/packages/config/dist ./packages/config/dist
COPY --from=build --chown=node:node /workspace/packages/contracts/package.json ./packages/contracts/package.json
COPY --from=build --chown=node:node /workspace/packages/contracts/dist ./packages/contracts/dist

USER node
CMD ["node", "apps/worker/dist/index.js"]
