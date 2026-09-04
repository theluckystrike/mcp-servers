# Installing mcp-image (agent instructions)

This file tells an AI coding agent exactly how to install this MCP server. No account, no API key, no network service is required.

Server: **Images** (@theluckystrike/mcp-image)
What it does: Resizes, converts, compresses, crops, thumbnails and watermarks images, and strips EXIF and other metadata by re-encoding from raw pixels. Every file stays on the local machine; inputs are never modified.
Source: https://github.com/theluckystrike/mcp-servers/tree/main/servers/image
License: MIT. Support: support@zovo.one

## Status of the npm package

The npm package `@theluckystrike/mcp-image` is not published yet. Until it is, the `npx` command below will fail with E404. Use **Alternative B - from source** further down, which is the supported path today, and keep the same client config with `"command": "node"` and the absolute path to `dist/index.js`. Everything else on this page is unchanged.

## Prerequisites

- Node.js 18 or newer on PATH (`node --version`).
- No native build tools, no ImageMagick, no libvips. The only runtime dependency beyond the MCP SDK is `jimp`, which is pure JavaScript, so `npx` works on any platform Node runs on.

## Step 1 - the run command

```sh
npx -y @theluckystrike/mcp-image
```

The server speaks MCP over stdio. It prints one readiness line to stderr and nothing to stdout except protocol traffic. Do not run it interactively as a check; the client starts it.

## Step 2 - write the client config

### Claude Desktop

File: macOS `~/Library/Application Support/Claude/claude_desktop_config.json`, Windows `%APPDATA%\Claude\claude_desktop_config.json`.
Merge this entry into the existing `mcpServers` object; do not overwrite the file.

```json
{
  "mcpServers": {
    "image": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-image"]
    }
  }
}
```

### Claude Code

```sh
claude mcp add image -- npx -y @theluckystrike/mcp-image
```

### Cursor

File: `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project). Same entry as Claude Desktop.

### Cline

File: `cline_mcp_settings.json` (VS Code: Cline panel -> MCP Servers -> Configure MCP Servers). Merge:

```json
{
  "mcpServers": {
    "image": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-image"],
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

## Step 3 - restart the client and verify

Restart the client, then call `license_status`. A successful call returns the current mode (free or pro) and proves the transport works. `tools/list` must show twelve tools: `image_info`, `image_resize`, `image_convert`, `image_compress`, `image_crop`, `image_thumbnails`, `image_watermark`, `image_strip_metadata`, `image_batch_resize`, `image_dominant_colors`, `license_status`, `license_activate`.

## Optional - Pro key

A Pro key removes the free-tier limits listed in the README (sources up to 4 MP, batches up to 5 files, watermark text limited to the shared business profile name, no dominant colours). Either add it to the config:

```json
"env": { "MCP_LICENSE_KEY": "MCPL1..." }
```

or call the `license_activate` tool once with the key. Keys are verified offline; nothing is sent anywhere. Keys: https://mcp.zovo.one/buy/image

## Alternative A - .mcpb bundle (Claude Desktop one-click)

Download `image.mcpb` from https://github.com/theluckystrike/mcp-servers/releases and open it, or drag it onto the Claude Desktop Extensions pane. This installs the server without editing JSON and without Node on PATH assumptions.

## Alternative B - from source

```sh
git clone https://github.com/theluckystrike/mcp-servers
cd mcp-servers
npm install
npm run build
```

Then use `"command": "node", "args": ["<abs path>/mcp-servers/servers/image/dist/index.js"]`.

## Alternative C - Docker

```sh
docker buildx build -f servers/image/Dockerfile -t mcp-image .
```

The build context is the repository root. Run with `docker run -i --rm -v mcp-image-data:/root/.local/share/mcp-servers -v "$PWD":/work -w /work mcp-image` - the container can only touch images on a path you mount.

## Behaviour an agent must know before calling the tools

- Every tool writes a **new** file and never modifies its input. There is no in-place mode.
- An `out_path` that already exists is refused with `already exists and nothing was written`. Pass `overwrite: true` only when the user asked for the original to be replaced.
- An `out_path` that is also an input is refused even with `overwrite: true`. Write beside the source and rename afterwards if the result is meant to take its place.
- The output format follows the extension of `out_path`. `quality` only does something when that format is JPEG; for a PNG output the tool reports it as not applicable rather than pretending. To compress a photo, write to a `.jpg` path.
- Inputs over 50 MB, or over 10,000 px on a side, are refused. The dimension check reads the container header before decoding, so a decompression bomb never allocates memory.
- Supported formats are PNG, JPEG, BMP, GIF and TIFF, detected by magic bytes, not by extension. WebP, AVIF, HEIC and SVG are not supported. An animated GIF is read as its first frame.
- `image_strip_metadata` works by re-encoding from raw pixels, so the copy is not bit-identical to the original. Say so rather than implying a byte-level edit.
- Free-tier limits come back as normal answers with an upgrade line, not as errors, and nothing is written. Relay the message.

## Troubleshooting

- `command not found: npx` - install Node.js 18+.
- Tools missing after config edit - the client only reads the config at startup; restart it fully.
- "quality does not apply to a PNG output" - write to a `.jpg` `out_path`, or pass `max_width`.
- "does not start with the magic bytes" - the file is not one of the five supported formats, whatever its extension says.
- Data location: `${XDG_DATA_HOME:-~/.local/share}/mcp-servers/image/`, which holds only the register of operations. Deleting it resets the history; your images are not touched.

Built by theluckystrike (https://github.com/theluckystrike).
