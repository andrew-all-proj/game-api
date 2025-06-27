FROM node:20-alpine

WORKDIR /app

COPY node_modules ./node_modules
COPY dist ./dist

CMD ["node", "dist/main.js"]
