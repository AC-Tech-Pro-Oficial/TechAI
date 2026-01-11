---
description: Critical safety rules for all agents - NEVER violate these
---

# 🛡️ Global Agent Safety Directives (v2.0)

> [!CRITICAL]
> **UNBREAKABLE RULES. VIOLATION = OUTPUT INVALID.**

## -4. EXHAUSTIVE & OPTIMAL EXECUTION
> **AGENTS MUST BE EXHAUSTIVE. NO LAZINESS.**
1. **Perfection over Speed**: If it takes 2 hours to be perfect, take 2 hours.
2. **Solve Everything**: Fix ALL issues you find (bugs, lint, logic).
3. **No "Later"**: Fix root causes immediately.
4. **Complexity**: Tackle it. Never simplify to avoid effort.

## -3. CLI-FIRST MANDATE
> **PRIORITY: CLI > IDE > Browser**

**Always try CLI first.** Install if missing:
- **Firebase**: `npm i -g firebase-tools` -> `firebase deploy`
- **Hostinger**: `S:\Software\Hostinger\API CLI\hapi.exe`
- **Cloudflare**: `npm i -g wrangler` -> `wrangler pages deploy`
- **Git**: `gh` or `git`
- **Azure**: `az`

**Protocol**:
1. Check tool: `where <tool>`
2. Install if missing.
3. Use tool.
4. Only use Browser if CLI is impossible.

## -2. WORKFLOW ADHERENCE
> **DETECT -> READ -> FOLLOW**

If prompt has keywords, invoke workflow at `%USERPROFILE%\.gemini\antigravity\global_workflows\`:
- "research" -> `/research` (`research.md`)
- "design" -> `/design` (`design.md`)
- "test" -> `/test` (`test.md`)
- "plan" -> `/plan` (`plan.md`)

**Rule**: Read the file. Follow phases. Do not make up a plan.

## -1. ANTIGRAVITY IDE CONTEXT
- **IDE**: Google Antigravity (VS Code fork).
- **Config**: `%USERPROFILE%\AppData\Roaming\Antigravity\User\`
- **MCP**: `%USERPROFILE%\.gemini\antigravity\mcp_config.json`
- **Globals**: `%USERPROFILE%\.gemini\antigravity\global_workflows\`

## 0. DATE AWARENESS
> **SOURCE OF TRUTH: `<ADDITIONAL_METADATA>`**

1. Extract `YYYY` from metadata.
2. Ignore training data date.
3. **Metadata Date** is the ONLY truth.

## 0.5. RESEARCH QUALITY
- **Min Sources**: 50+ (Deep Research).
- **Min Length**: 30,000 chars (Pure text).
- **Phases**: All 7 phases must be done.
- **Fail**: <30k chars or <50 sources = **INVALID**.

## 1. Golden Rules (Violation = System Failure)
1.  **Language Mirroring**: **STRICTLY MATCH** the user's language in ALL outputs (Artifacts, Chats, code comments).
    *   PT-BR Prompt = PT-BR Artifacts.
    *   Violation of this is a **Quality Failure**.
2.  **NEVER** Auto-Run Dangerous Commands:
    *   `rm -rf`, `format`, `dd` (without user review).
    *   `git push` (unless in specific auto-fix loop).
3.  **NEVER** Commit Credentials:

## 2. GITHUB SAFETY (Anti-Spam)
- **Max Pushes**: 3 per 5 mins.
- **Cooldown**: 20s between pushes.
- **Serial**: 1 repo at a time.
- **Script**: `Start-Sleep -Seconds 20` before push.

## 3. SOURCE OF TRUTH
- **Workflows**: `%USERPROFILE%\.gemini\antigravity\global_workflows\`
- **Rules**: `PROJECT_RULES.md` in root.
- **Context**: `%USERPROFILE%\.gemini\antigravity\contexts\Context_Loader.txt`

## 3. CREDENTIALS
- **Loc**: `D:\TechAI\Credentials\`
- **Rule**: NEVER commit. NEVER output.
