# Build context: repository root (monorepo with npm workspaces).
# docker buildx build -f servers/mileage-log/Dockerfile .
#
# mcp-license is copied and built too, because this server is assembled with it (the
# offline key verification and the license_status / license_activate tools). Nothing is
# fetched over the network beyond npm install.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
COPY packages ./packages
COPY servers ./servers
RUN npm install --no-audit --no-fund \
 && npm run build --workspace @theluckystrike/mcp-license \
 && npm run build --workspace @theluckystrike/mcp-mileage-log

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
COPY --from=build /app/packages/mcp-license/package.json ./packages/mcp-license/package.json
COPY --from=build /app/packages/mcp-license/dist ./packages/mcp-license/dist
COPY --from=build /app/servers/mileage-log/package.json ./servers/mileage-log/package.json
COPY --from=build /app/servers/mileage-log/dist ./servers/mileage-log/dist
RUN npm install --omit=dev --no-audit --no-fund --workspace @theluckystrike/mcp-mileage-log --include-workspace-root=false
CMD ["node", "servers/mileage-log/dist/index.js"]
