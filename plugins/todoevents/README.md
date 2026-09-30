# Todo-Events plugin source

This is the portable package for published-event discovery and consented public event listings. The checked-in source uses the reserved `.invalid` MCP domain intentionally; the distribution builder replaces it only with explicitly supplied configuration. Source and offline-built distributions still require the release checks below before public submission. The existing website, data, and commercial license are retained.

`plugin.json` and `mcp.json` follow the portable layout. Skills are discovered in `skills/`. The package has no app references or lifecycle hooks. `ui/` is the MCP-hosted widget source; it is built for the service and excluded from the distributable plugin ZIP.

Build and release instructions are in `docs/chatgpt-plugin/README.md` at the repository root. `scripts/prepare_plugin_package.py` creates a clean distribution with explicitly supplied service and policy URLs. It does not deploy, create credentials, publish listings, or submit to a directory. Successful structural validation does not establish platform approval.

The icon is copied unchanged from `frontend/public/favicon.png`. All contents remain subject to the repository's Todo-Events Commercial License Agreement, reproduced in `LICENSE`; no MIT or other open-source license is granted.
