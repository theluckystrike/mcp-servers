# Build context: repository root (monorepo with npm workspaces).
# docker buildx build -f servers/pdf/Dockerfile .
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
COPY packages ./packages
COPY servers ./servers
RUN npm install --no-audit --no-fund \
 && npm run build --workspace @theluckystrike/mcp-license \
 && npm run build --workspace @theluckystrike/mcp-pdf

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
COPY --from=build /app/packages/mcp-license/package.json ./packages/mcp-license/package.json
COPY --from=build /app/packages/mcp-license/dist ./packages/mcp-license/dist
COPY --from=build /app/servers/pdf/package.json ./servers/pdf/package.json
COPY --from=build /app/servers/pdf/dist ./servers/pdf/dist
RUN npm install --omit=dev --no-audit --no-fund --workspace @theluckystrike/mcp-pdf --include-workspace-root=false
CMD ["node", "servers/pdf/dist/index.js"]
