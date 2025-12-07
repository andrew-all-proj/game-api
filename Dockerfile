# syntax=docker/dockerfile:1.7   # нужно для RUN --mount=type=ssh

FROM node:20-alpine AS base
WORKDIR /app

# -------- deps ----------
FROM base AS deps
RUN apk add --no-cache git && corepack enable || true
ENV YARN_NODE_LINKER=node-modules

COPY package.json ./
COPY yarn.lock* ./
COPY .yarnrc.yml .yarnrc.yml
COPY .yarn ./.yarn

RUN if [ -f .yarnrc.yml ]; then \
      yarn install --immutable; \
    else \
      yarn install --frozen-lockfile; \
    fi

# -------- build ----------
FROM deps AS build
COPY . .
RUN yarn build

# -------- prod-deps ----------
FROM base AS prod-deps
RUN apk add --no-cache git && corepack enable || true
ENV NODE_ENV=production
ENV YARN_NODE_LINKER=node-modules

COPY package.json ./
COPY yarn.lock* ./
COPY .yarnrc.yml .yarnrc.yml
COPY .yarn ./.yarn

RUN if [ -f .yarnrc.yml ]; then \
      yarn install --immutable --mode=skip-build; \
    else \
      yarn install --frozen-lockfile --production=true; \
    fi \
 && yarn cache clean

# -------- runtime ----------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build     /app/dist         ./dist
CMD ["node", "dist/main.js"]
