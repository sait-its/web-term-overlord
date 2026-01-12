FROM oven/bun:1 AS base
WORKDIR /app

FROM base AS install
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile || bun install

FROM base AS release
COPY --from=install /app/node_modules ./node_modules
COPY src ./src
COPY package.json tsconfig.json ./

EXPOSE 8080

ENV BACKEND_SSH_HOST=host.docker.internal
ENV BACKEND_SSH_PORT=2222

CMD ["bun", "run", "src/server/index.ts"]
