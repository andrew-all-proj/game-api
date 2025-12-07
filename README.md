# Game API

Бэкенд для игры с GraphQL API: управление пользователями, монстрами, боями, инвентарём и файлами. Используются NestJS 11, Apollo GraphQL, Redis для кеша/сессий, S3 для хранения файлов, JWT‑аутентификация и Winston с отправкой логов в Elasticsearch.

## Возможности
- GraphQL endpoint `/graphql` (playground и интроспекция включаются через переменные окружения).
- JWT и отдельный internal-JWT для сервисных запросов.
- Вебсокеты (Socket.IO) для игровых событий.
- Загрузка файлов и сохранение в S3 с префиксами окружений.
- Логирование в консоль и Elasticsearch.

## Требования
- Node.js 20, Yarn 4 (corepack enable).
- Доступ по SSH к приватному репозиторию `game-db` (dependency git+ssh).
- PostgreSQL и Redis (параметры задаются через env).

## Переменные окружения
Создайте `.env` в корне. Минимальный пример:
```
BOT_TOKEN=telegram-bot-token
JWT_SECRET=public-api-jwt
INTERNAL_JWT_SECRET=internal-jwt
PORT=3000
NODE_ENV=development

REDIS_HOST=localhost
REDIS_PORT=6379

S3_KEY=xxx
S3_SECRET=xxx
S3_BUCKET=game-bucket
S3_PREFIX=testing

FILE_URL_PREFIX=https://cdn.example.com
BOT_SERVICE_URL=https://bot-service.example.com
BOT_SERVICE_TOKEN=secret

GQL_PLAYGROUND=true
GQL_INTROSPECTION=true
ELASTICSEARCH_NODE=http://localhost:9200
ELASTIC_USERNAME=
ELASTIC_PASSWORD=
MAX_UPLOAD_MB=20
```
Переменная `BOT_TOKEN` обязательна, без неё приложение не стартует.

## Локальный запуск
```bash
corepack enable
yarn install        # требует SSH-доступ к GitHub
yarn start          # dev режим с watch
# или yarn start:debug для запуска с инспектором
```
GraphQL доступен на `http://localhost:3000/graphql`. В прод-режиме интроспекция и playground отключены, включайте через `GQL_PLAYGROUND=true` и `GQL_INTROSPECTION=true` при необходимости.

## Тесты
```bash
yarn test          # unit
yarn test:e2e      # e2e
yarn test:cov      # покрытие
```

## Сборка и прод-запуск без Docker
```bash
yarn build
NODE_ENV=production yarn start:prod
```
Перед стартом убедитесь, что заполнены все переменные для БД, Redis, S3, JWT и логов.

## Docker
Используется многоэтапный `Dockerfile` с установкой приватной зависимости через SSH.
```bash
docker build --ssh default -t game-api .
docker run --env-file .env -p 3000:3000 game-api
```
Контейнер слушает порт из `PORT` (по умолчанию 3000) и запускает `node dist/main.js`.
