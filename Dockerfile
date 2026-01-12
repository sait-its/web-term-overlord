FROM node:trixie-slim AS base
WORKDIR /app

FROM base AS install
RUN apt-get update && apt-get install -y python3 build-essential && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
RUN npm ci || npm install

FROM base AS release
COPY --from=install /app/node_modules ./node_modules
COPY src ./src
COPY package.json tsconfig.json ./

EXPOSE 8080

ENV BACKEND_SSH_HOST=host.docker.internal
ENV BACKEND_SSH_PORT=2222

CMD ["node", "--loader", "ts-node/esm", "src/server/index.ts"]
