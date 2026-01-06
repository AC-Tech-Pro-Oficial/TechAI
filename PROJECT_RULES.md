# Project Rules: TechAI

## Metadata
- **Type**: Hub
- **Path**: D:\TechAI

## Core Directives
1. **Source of Truth**: This repository is the central hub for all TechAI projects and context.
2. **IDE Extension**: Located at `D:\TechAI\IDE Extension` - managed as a subdirectory.
3. Follow global rules in `D:\TechAI\Personal Context Memory.txt` (Context Loader).
4. **CLI-First**: Always use CLI tools before browser. Install missing CLIs automatically. Try solving autonomously before asking.
5. **Exhaustive Execution**: Agents must be exhaustive, aim for perfection, and ignore time/complexity constraints. Solve ALL identified problems.

## Directory Structure
```
D:\TechAI\
├── Credentials/          # API keys (NEVER commit)
├── IDE Extension/        # TechAI IDE Extension (Antigravity)
├── Prompts/              # Agent prompts and templates
├── Research Results/     # Research and analysis outputs
├── assets/               # Images and media
├── docs/                 # Documentation
├── tools/                # CLI tools and utilities
├── Personal Context Memory.txt
├── PROJECT_RULES.md
└── README.md
```

## IDE Extension Rules
The IDE Extension at `D:\TechAI\IDE Extension`:
- **Package Name**: `techai-ide`
- **Display Name**: `TechAI`
- **Commands Prefix**: `techai.*`
- **Configuration Prefix**: `techai.*`
- **Output Channel**: `TechAI`
- **Deployment**: Copy VSIX to `D:\IDE Extensions\TechAI.vsix`

## 4. Operational Safety (GitHub Limits)
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
