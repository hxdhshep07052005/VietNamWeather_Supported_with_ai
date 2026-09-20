FROM node:24.18.0-alpine3.24@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd AS build

WORKDIR /workspace
RUN corepack enable && corepack prepare pnpm@11.9.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/web/package.json apps/web/tsconfig.json apps/web/tsconfig.node.json ./apps/web/
COPY packages/contracts/package.json packages/contracts/tsconfig.json ./packages/contracts/
RUN pnpm install --frozen-lockfile

COPY packages/contracts/src ./packages/contracts/src
COPY apps/web ./apps/web
RUN pnpm --filter @vietnam-weather/contracts build
RUN pnpm --filter @vietnam-weather/web build

FROM nginx:1.27.4-alpine@sha256:4ff2238051edd940d384045582e343636122a6a32cc00803695345498a349b10 AS runtime

COPY infra/nginx/nginx.conf /etc/nginx/nginx.conf
COPY --from=build /workspace/apps/web/dist /usr/share/nginx/html

RUN touch /tmp/nginx.pid && \
    chown -R nginx:nginx /tmp/nginx.pid /usr/share/nginx/html /var/cache/nginx /var/log/nginx

USER nginx
EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
