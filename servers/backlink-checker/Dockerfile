# Build context: repository root (monorepo with npm workspaces).
# docker buildx build -f servers/backlink-checker/Dockerfile .
#
# No siblings are copied into the runtime image: the only workspace dependency is
# mcp-license, and nothing is fetched over the network except the URL the user asks
# to check.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
COPY packages ./packages
COPY servers ./servers
RUN npm install --no-audit --no-fund \
 && npm run build --workspace @theluckystrike/mcp-license \
 && npm run build --workspace @theluckystrike/mcp-backlink-checker

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
COPY --from=build /app/packages/mcp-license/package.json ./packages/mcp-license/package.json
COPY --from=build /app/packages/mcp-license/dist ./packages/mcp-license/dist
COPY --from=build /app/servers/backlink-checker/package.json ./servers/backlink-checker/package.json
COPY --from=build /app/servers/backlink-checker/dist ./servers/backlink-checker/dist
RUN npm install --omit=dev --no-audit --no-fund --workspace @theluckystrike/mcp-backlink-checker --include-workspace-root=false
CMD ["node", "servers/backlink-checker/dist/index.js"]
