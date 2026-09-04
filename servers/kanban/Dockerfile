# Build context: repository root (monorepo with npm workspaces).
# docker buildx build -f servers/kanban/Dockerfile .
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
COPY packages ./packages
COPY servers ./servers
RUN npm install --no-audit --no-fund \
 && npm run build --workspace @theluckystrike/mcp-license \
 && npm run build --workspace @theluckystrike/mcp-kanban

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
COPY --from=build /app/packages/mcp-license/package.json ./packages/mcp-license/package.json
COPY --from=build /app/packages/mcp-license/dist ./packages/mcp-license/dist
COPY --from=build /app/servers/kanban/package.json ./servers/kanban/package.json
COPY --from=build /app/servers/kanban/dist ./servers/kanban/dist
RUN npm install --omit=dev --no-audit --no-fund --workspace @theluckystrike/mcp-kanban --include-workspace-root=false
CMD ["node", "servers/kanban/dist/index.js"]
