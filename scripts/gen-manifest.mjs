#!/usr/bin/env node
// Write bundles/<name>/manifest.json.
// Usage: node gen-manifest.mjs <name> <displayName> <version> <description> <keywordsJson> <toolsJson> <outPath>
import fs from "node:fs";

const [, , name, displayName, version, description, keywordsJson, toolsJson, outPath] = process.argv;

const manifest = {
  manifest_version: "0.2",
  name: `mcp-${name}`,
  display_name: displayName,
  version,
  description,
  author: { name: "theluckystrike", url: "https://github.com/theluckystrike" },
  repository: { type: "git", url: "https://github.com/theluckystrike/mcp-servers" },
  homepage: "https://mcp.zovo.one",
  license: "MIT",
  server: {
    type: "node",
    entry_point: "server/index.js",
    mcp_config: {
      command: "node",
      args: ["${__dirname}/server/index.js"],
      env: { MCP_LICENSE_KEY: "${user_config.license_key}" },
    },
  },
  user_config: {
    license_key: {
      type: "string",
      title: "License key",
      description: "Optional Pro license key (format MCPL1.xxx.yyy). Leave blank to use the free tier.",
      sensitive: true,
      required: false,
    },
  },
  tools: JSON.parse(toolsJson),
  keywords: JSON.parse(keywordsJson),
};

fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2) + "\n");
