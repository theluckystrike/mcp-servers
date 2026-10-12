# Build context: repository root (monorepo with npm workspaces).
# docker buildx build -f servers/hourly-rate/Dockerfile .
#
# No siblings are copied into the runtime image: the server is pure arithmetic,
# so the only workspace dependency is mcp-license and nothing is fetched.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
COPY packages ./packages
COPY servers ./servers
RUN npm install --no-audit --no-fund \
 && npm run build --workspace @theluckystrike/mcp-license \
 && npm run build --workspace @theluckystrike/mcp-hourly-rate

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
COPY --from=build /app/packages/mcp-license/package.json ./packages/mcp-license/package.json
COPY --from=build /app/packages/mcp-license/dist ./packages/mcp-license/dist
COPY --from=build /app/servers/hourly-rate/package.json ./servers/hourly-rate/package.json
COPY --from=build /app/servers/hourly-rate/dist ./servers/hourly-rate/dist
RUN npm install --omit=dev --no-audit --no-fund --workspace @theluckystrike/mcp-hourly-rate --include-workspace-root=false
CMD ["node", "servers/hourly-rate/dist/index.js"]
