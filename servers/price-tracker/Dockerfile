FROM node:22-alpine AS build
WORKDIR /app
COPY package.json tsconfig.json ./
COPY src ./src
RUN npm install --no-audit --no-fund && npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY --from=build /app/dist ./dist
CMD ["node", "dist/index.js"]
