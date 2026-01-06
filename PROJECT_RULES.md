# Project Rules: TechAI IDE Extension

## Metadata
- **Type**: VS Code/Antigravity Extension
- **Path**: D:\TechAI\IDE Extension
- **Parent**: D:\TechAI

## Naming Conventions
- **Package Name**: `techai-ide`
- **Display Name**: `TechAI`
- **Commands**: `techai.*` (e.g., `techai.openMCPPanel`)
- **Configuration**: `techai.*` (e.g., `techai.enabled`)
- **Views**: `techai*` (e.g., `techaiMCP`)
- **Output Channel**: `TechAI`

## Core Directives
1. Follow parent rules in `D:\TechAI\PROJECT_RULES.md`.
2. All commands, configurations, and views use `techai` prefix.
3. Output channel name is `TechAI`.
4. VSIX output format: `techai-ide-X.X.X.vsix`
5. **CLI-First for Extension Dev**:
   - Build: `npm run compile`
   - Package: `npx vsce package`
   - Test: `npm test`
   - Lint: `npm run lint`
   - Install VSCE: `npm install -g @vscode/vsce` if missing
6. **Exhaustive Execution**: Agents must be exhaustive, aim for perfection, and ignore time/complexity constraints. Solve ALL identified problems.

## Deployment
Build directly to `D:\IDE Extensions\TechAI.vsix`:

```powershell
npm run compile && npx vsce package --out "D:\IDE Extensions\TechAI.vsix"
```

Then install in Antigravity IDE via "Install from VSIX".

## MCP Configuration
- Config Path: `~/.gemini/antigravity/mcp_config.json`
- Manager: `MCPManager` class
- Auto-Apply: Controlled by `mcp.autoApplyBestPicks` global state

<!-- MANUAL -->

<!-- /MANUAL -->
