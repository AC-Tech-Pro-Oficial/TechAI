# TechQuotas Antigravity - Project-Specific Rules

## Project Overview
- **Name**: TechQuotas Antigravity (VS Code Extension)
- **Repository**: https://github.com/ACTechPRO/TechQuotas-Antigravity
- **Local Path**: `D:\TechQuotas Antigravity`
- **Purpose**: Manage and visualize AI API quotas (OpenAI, Anthropic, etc.) directly in reusable panels.

## Tech Stack
- **Runtime**: Node.js / Bun
- **Language**: TypeScript
- **Framework**: VS Code Extension API
- **Build Tool**: `vsce` (Visual Studio Code Extensions), `npm`/`bun`.

## Key Features
- **Quota Visualization**: Bars/Charts showing API usage.
- **Multi-Provider**: Supports OpenAI, Anthropic, Gemini, Groq.
- **Settings**: Configurable via `settings.json`.
- **Alerts**: Notifications when quotas approach limits.

## Development Constraints
- Use `npm run compile` to build.
- Manifest `package.json` drives the activation events.
- Keep `CHANGELOG.md` updated with every release.
