# Official Apify Node base image (https://docs.apify.com/sdk/js/docs/guides/docker-images).
# Single stage: the Actor is plain ESM JavaScript, there is no TypeScript build step.
# The wrapped MCP server is vendored in ./server (compiled dist of the satellite repo), so
# there is no git clone, no npx and no runtime download.
FROM apify/actor-node:22

COPY --chown=myuser:myuser package*.json ./

RUN npm --quiet set progress=false \
    && npm install --omit=dev --omit=optional --no-audit \
    && echo "Installed NPM packages:" \
    && (npm list --omit=dev --depth=0 || true) \
    && node --version \
    && npm --version \
    && rm -rf ~/.npm

COPY --chown=myuser:myuser . ./

CMD ["node", "src/main.js"]
