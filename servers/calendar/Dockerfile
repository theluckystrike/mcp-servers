# Build context: repository root (monorepo with npm workspaces).
# docker buildx build -f servers/calendar/Dockerfile .
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
COPY packages ./packages
COPY servers ./servers
RUN npm install --no-audit --no-fund \
 && npm run build --workspace @theluckystrike/mcp-license \
 && npm run build --workspace @theluckystrike/mcp-timezone \
 && npm run build --workspace @theluckystrike/mcp-calendar

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
COPY --from=build /app/packages/mcp-license/package.json ./packages/mcp-license/package.json
COPY --from=build /app/packages/mcp-license/dist ./packages/mcp-license/dist
# The calendar server reads its time zone and .ics engine from the timezone server.
COPY --from=build /app/servers/timezone/package.json ./servers/timezone/package.json
COPY --from=build /app/servers/timezone/dist ./servers/timezone/dist
COPY --from=build /app/servers/calendar/package.json ./servers/calendar/package.json
COPY --from=build /app/servers/calendar/dist ./servers/calendar/dist
RUN npm install --omit=dev --no-audit --no-fund --workspace @theluckystrike/mcp-calendar --include-workspace-root=false
CMD ["node", "servers/calendar/dist/index.js"]
