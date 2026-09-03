# Build context: repository root (monorepo with npm workspaces).
# docker buildx build -f servers/docx/Dockerfile .
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
COPY packages ./packages
COPY servers ./servers
RUN npm install --no-audit --no-fund \
 && npm run build --workspace @theluckystrike/mcp-license \
 && npm run build --workspace @theluckystrike/mcp-docx

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
COPY --from=build /app/packages/mcp-license/package.json ./packages/mcp-license/package.json
COPY --from=build /app/packages/mcp-license/dist ./packages/mcp-license/dist
COPY --from=build /app/servers/docx/package.json ./servers/docx/package.json
COPY --from=build /app/servers/docx/dist ./servers/docx/dist
RUN npm install --omit=dev --no-audit --no-fund --workspace @theluckystrike/mcp-docx --include-workspace-root=false
CMD ["node", "servers/docx/dist/index.js"]
