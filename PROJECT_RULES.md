# Project Rules: TechAI

## Metadata
- **Type**: Hub
- **Path**: D:\TechAI
- **Account**: contato@ac-tech.pro

## Core Directives
1.  **Language Mirroring**: **ALWAYS** match the user's prompt language for output/artifacts.
2.  Follow global rules in `D:\TechAI\TechAI_Manifesto.md`.
3.  **CLI-First**: Always use CLI tools before browser.
4.  Install missing CLIs automatically. Try solving autonomously before asking.
5.  **Exhaustive Execution**: Agents must be exhaustive, aim for perfection, and ignore time/complexity constraints. Solve ALL identified problems.

## Directory Structure
```
D:\TechAI\
├── Contexts/             # Context files for AI agents
│   ├── Context_Global.txt
│   ├── Context_AC Tech.txt
│   ├── Context_Moacir.txt
│   ├── Context_Vinicyus.txt
│   ├── Context_TechAI.txt
│   ├── Context_TechAir.txt
│   ├── Context_Microsoft Ultimate Installer.txt
│   └── Context_Portal Educacional.txt
├── Credentials/          # API keys (NEVER commit)
├── IDE Extension/        # TechAI IDE Extension (Antigravity)
├── Prompts/              # Agent prompts and templates
├── Research Results/     # Research and analysis outputs
├── assets/               # Images and media
├── docs/                 # Documentation
├── tools/                # CLI tools and utilities
├── Context_Loader.txt
├── PROJECT_RULES.md
├── TechAI_Manifesto.md
└── README.md
```

## Context Files
Load relevant context files from `D:\TechAI\Contexts\` when working on projects:
- `Context_Global.txt` - Company-wide information
- `Context_{ProjectName}.txt` - Project-specific details

## IDE Extension Rules
The IDE Extension at `D:\TechAI\IDE Extension`:
- **Package Name**: `techai-ide`
- **Display Name**: `TechAI`
- **Commands Prefix**: `techai.*`
- **Configuration Prefix**: `techai.*`
- **Output Channel**: `TechAI`
- **Deployment**: Copy VSIX to `D:\Assets\IDE Extensions\TechAI.vsix`

## Assets Location
- **Images**: `D:\Assets\Images\TechAI\`
- **Videos**: `D:\Assets\Videos\TechAI\`
- **IDE Extensions**: `D:\Assets\IDE Extensions\`

## Operational Safety (GitHub Limits)
> **CRITICAL: ANTI-SPAM PROTECTION**
> To prevent account suspension (Error 404/Flagged), ALL agents must adhere to:

1.  **Serial Processing Only**: Never update more than 1 repository in parallel. Finish one completely before starting the next.
2.  **Rate Limiting**:
    *   Maximum 3 repository `git push` operations per 5 minutes.
    *   Mandatory 60-second "cool-down" between switching project contexts during bulk updates.
3.  **Human Verification**: For changes affecting >3 repositories, PAUSE and ask for user confirmation before proceeding with the batch.
4.  **No "Bot-Like" Activity**: Avoid exact duplicate commit messages across multiple repos in rapid succession. Vary the messages to be context-specific.

## MCP Configuration
- **Config Path**: `%USERPROFILE%\.gemini\antigravity\mcp_config.json`
- Managed by the IDE Extension's MCP Panel

<!-- MANUAL -->

<!-- /MANUAL -->
