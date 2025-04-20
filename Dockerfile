FROM node:20

WORKDIR /app

COPY node_modules node_modules

COPY dist dist

CMD ["node", "dist/index.js"]
