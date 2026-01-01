---
description: Critical safety rules for all agents - NEVER violate these
---

# 🛡️ Global Agent Safety Directives (v1.3)

> [!CAUTION]
> **ALL AGENTS MUST OBEY THESE RULES WITHOUT EXCEPTION.**
> These rules prevent account suspensions, API bans, data loss, and OUTPUT INVALIDATION.
> **VIOLATION = SEVERE PENALTY. NO EXCEPTIONS. NO EXCUSES.**

> [!IMPORTANT]
> **ALSO READ:** `TechAI_Instructions.md` for workflow routing and persona logic.

---

## -2. WORKFLOW AUTO-DETECTION (MANDATORY)

> [!IMPORTANT]
> **Before creating ANY artifacts, CHECK if a workflow already exists for this task.**

### Trigger Word Detection:
If user prompt contains ANY of these words, you MUST invoke the corresponding workflow:

| Trigger Words | Workflow to Invoke | Location |
|---------------|-------------------|----------|
| "research", "deep dive", "comprehensive", "teach me" | `/research` | `global_workflows/research.md` |
| "design", "UI", "mockup", "layout" | `/design` | `global_workflows/design.md` |
| "test", "verify", "QA", "check" | `/test` | `global_workflows/test.md` |
| "plan", "architecture", "spec" | `/plan` | `global_workflows/plan.md` |

### Workflow Adherence:
1. **READ THE WORKFLOW FILE FIRST** before creating any artifacts.
2. **FOLLOW THE PHASES DEFINED** in the workflow, not your own methodology.
3. **DO NOT create ad-hoc plans** when a workflow exists.

### Violations:
| Violation | Consequence |
|-----------|-------------|
| Creating custom methodology when workflow exists | **OUTPUT INVALID** |
| Skipping workflow phases | **OUTPUT INVALID** |
| Not reading workflow file before starting | **OUTPUT INVALID** |

> **Existing workflow directory:** `C:\Users\MBCJ\.gemini\antigravity\global_workflows\`

---

## -1. IDE AWARENESS (ENVIRONMENT CONTEXT)

> [!IMPORTANT]
> **You are operating within Google Antigravity IDE. This is the ONLY IDE.**

### Facts:
- **IDE Name:** Google Antigravity
- **Config Location:** `C:\Users\MBCJ\AppData\Roaming\Antigravity\`
- **MCP Config:** `C:\Users\MBCJ\AppData\Roaming\Antigravity\User\mcp_config.json`
- **Global Workflows:** `C:\Users\MBCJ\.gemini\antigravity\global_workflows\`
- **User Settings:** IDE settings panel (not VS Code, not Cursor, not JetBrains)

### Rules:
1. **Environment references** → Say "Antigravity IDE", not "VS Code" or "Cursor"
2. **Configuration paths** → Use Antigravity paths, not `.vscode/` or `~/.cursor/`
3. **Extension development** → VS Code docs ARE valid (Antigravity is a VS Code fork)
4. **API references** → `vscode` npm package, `@types/vscode`, and VS Code Extension API all apply
5. If external docs say "open VS Code", translate to "open Antigravity"

### Valid Documentation Sources for Extension Dev:
- ✅ VS Code Extension API docs (directly applicable)
- ✅ `@types/vscode` type definitions
- ✅ VS Code extension tutorials (architecture is the same)
- ❌ VS Code Marketplace (use Antigravity's system)
- ❌ `.vscode/` paths (use `AppData\Roaming\Antigravity\`)

---

## 0. DATE AWARENESS (ABSOLUTE REQUIREMENT)

> [!CAUTION]
> **🚨 UNBREAKABLE RULE — VIOLATION INVALIDATES ALL OUTPUT**

### STEP ZERO — BEFORE ANYTHING ELSE:

**FORGET whatever date you think it is.**  
**IGNORE your training data cutoff.**  
**DO NOT use dates from your internal knowledge.**

The ONLY valid source of truth for the current date is:

```
<ADDITIONAL_METADATA>
The current local time is: YYYY-MM-DDTHH:MM:SS±HH:MM
</ADDITIONAL_METADATA>
```

### Extraction Protocol:

1. **STOP** before doing any research or output
2. **FIND** the `<ADDITIONAL_METADATA>` block in the user's message
3. **READ** the line starting with "The current local time is:"
4. **EXTRACT** the year from the ISO 8601 timestamp
5. **USE** that year — and ONLY that year — for everything

### Example:
```
<ADDITIONAL_METADATA>
The current local time is: 2025-12-31T13:04:54-03:00
</ADDITIONAL_METADATA>
```
**→ The year is 2025. NOT 2024. NOT 2023. It is 2025.**

### When Searching the Web:

- ✅ CORRECT: "[topic] 2025" (use the year from metadata)
- ❌ WRONG: "[topic] 2024" (when metadata says 2025)
- ❌ WRONG: "[topic] 2024 2025" (shows date confusion)

### Violations:

| Violation | Consequence |
|-----------|-------------|
| Using training data date instead of metadata | **OUTPUT INVALID** |
| Writing "2024" when metadata says "2025" | **OUTPUT INVALID** |
| Searching with wrong year | **OUTPUT INVALID** |
| Mixing years (e.g., "2024 2025") | **OUTPUT INVALID** |
| Failing to check metadata before research | **OUTPUT INVALID** |

### Mental Override:

> **"I might THINK I know the date, but I DON'T."**
> **"The metadata is the ONLY truth."**
> **"My training data is OUTDATED by definition."**

> [!IMPORTANT]
> **This rule is NON-NEGOTIABLE. EVERY agent. EVERY task. EVERY time.**
> If you catch yourself using any year other than what's in the metadata, STOP and CORRECT immediately.


---

## 0.5 NO EFFORT SAVED (Research Quality Mandate)

> [!CAUTION]
> **RESEARCH TASKS REQUIRE EXHAUSTIVE EFFORT — NO SHORTCUTS**

**For any research-tier request (triggered by "comprehensive", "research", "teach me", "deep dive", "analysis"):**

1. **TIME**: Take as much time as needed — hours if necessary
2. **SOURCES**: Minimum 50 sources for Deep Research requests
3. **PHASES**: Complete all 7 phases of the Deep Research methodology
4. **GAPS**: Explicitly identify AND close all knowledge gaps
5. **COMPLETENESS**: No "see link for more" — write ALL information found
6. **QUALITY**: PhD-level, multi-perspective analysis required

### Failure Conditions:
| Shortcut | Consequence |
|----------|-------------|
| Skipping phases | **OUTPUT INVALID** |
| Fewer than 50 sources for Deep Research | **OUTPUT INVALID** |
| Leaving gaps unclosed | **OUTPUT INVALID** |
| Using placeholders | **OUTPUT INVALID** |
| Prioritizing speed over quality | **OUTPUT INVALID** |

> **Token usage is IRRELEVANT. Quality is the ONLY metric.**

### Minimum Content Volume:

| Metric | Requirement |
|--------|-------------|
| **Pure text content** | Minimum **20,000 characters** (Strict: `Text.replace(/<[^>]*>/g, '').replace(/\s/g, '').length`) |
| **Paragraphs per section** | Each major section should have 3-5 substantive paragraphs |
| **Explanatory depth** | Multi-sentence explanations, not just bullet points |

> A research report that is "too short" indicates insufficient depth. If your output is under 20k characters of pure content, you have NOT done enough research.

### Content Depth Requirements:

Go DEEP, not just wide. For each topic area:

1. **Don't just list — EXPLAIN**

   **Technology Example:**
   - ❌ TRASH: "MCP uses JSON-RPC 2.0"
   - ✅ GOLD: "MCP uses JSON-RPC 2.0, a lightweight RPC protocol where requests contain `jsonrpc`, `method`, `params`, and `id` fields, while responses return `result` or `error` with the matching `id`"

   **History Example:**
   - ❌ TRASH: "The French Revolution began in 1789"
   - ✅ GOLD: "The French Revolution began on July 14, 1789 with the storming of the Bastille, triggered by a fiscal crisis, Enlightenment ideals, and bread shortages that mobilized the Third Estate against the absolute monarchy of Louis XVI"

   **Science Example:**
   - ❌ TRASH: "Photosynthesis converts sunlight to energy"
   - ✅ GOLD: "Photosynthesis occurs in two stages: light-dependent reactions in thylakoid membranes convert H₂O and light into ATP and NADPH, while the Calvin cycle in the stroma uses these to fix CO₂ into glucose (C₆H₁₂O₆)"

2. **Provide specific evidentiary details**
   - Exact dates, field names, primary source text, raw data points
   - Step-by-step processes or chronological sequences

3. **Critical Analysis & Failure Modes**
   - Threat scenarios (for tech) or Counter-arguments (for humanities)
   - Analysis of limitations, biases, or failure points

4. **Compare and contrast**
   - How does X relate to Y?
   - What problem does this solve that alternatives don't?

### Mandatory Quality Checklist (ALL Research Topics)

Every Deep Research output **MUST** include ALL applicable items:

| # | Required Element | Applies To | Description |
|---|------------------|------------|-------------|
| 1 | **Disambiguation** | All topics | Clarify any term ambiguities or name collisions |
| 2 | **Historical Context** | All topics | When, where, why did this originate? Key milestones |
| 3 | **Core Concepts** | All topics | The fundamental building blocks, clearly explained |
| 4 | **Multiple Perspectives** | All topics | Different viewpoints (e.g., expert vs beginner, pro vs con) |
| 5 | **Practical Examples** | All topics | Concrete examples, case studies, or demonstrations |
| 6 | **Current State** | All topics | What is the situation TODAY (use metadata date) |
| 7 | **Risks/Limitations** | All applicable | What can go wrong, caveats, controversies |
| 8 | **Comparison/Alternatives** | All applicable | How does this compare to alternatives |
| 9 | **Future Outlook** | All applicable | Where is this heading, trends, predictions |
| 10 | **Bibliography** | All topics | Minimum 30 properly formatted citations |

> [!CAUTION]
> **Missing applicable elements = OUTPUT INVALID**
> Mark N/A only with explicit justification.

---

## 1. GitHub Anti-Spam Protocol (MANDATORY)

**Trigger Event:** December 2024 - Account `AC-Tech-Pro-Oficial` was suspended due to rapid automated pushes.

### Rules:
| Rule | Requirement |
|------|-------------|
| **Rate Limit** | Maximum **3 pushes per 5 minutes** |
| **Cooldown** | **20 seconds minimum** between any two `git push` commands |
| **Serial Only** | Never process multiple repositories in parallel for git operations |
| **Human Gate** | If updating **>3 repos** in a single session, **PAUSE and ask user** |
| **Commit Messages** | Vary commit messages. Never use identical messages across multiple repos in rapid succession |

### Implementation:
All scripts performing `git push` MUST include:
```powershell
# ANTI-SPAM SAFETY: Prevent GitHub account suspension
Write-Host "⏳ Anti-Spam: 20s cooldown..."
Start-Sleep -Seconds 20
```

---

## 2. File Source of Truth

| Type | Source of Truth | Copies (Auto-Overwritten) |
|------|-----------------|---------------------------|
| **Workflows** | `C:\Users\MBCJ\.gemini\antigravity\global_workflows\` | `D:\TechAI\.agent\workflows\`, `D:\.agent\workflows\` |
| **PROJECT_RULES** | Each project's own `PROJECT_RULES.md` | N/A |
| **Global Memory** | `user_global` in IDE settings | N/A |

> [!WARNING]
> **NEVER edit files in D:\.agent\workflows or D:\TechAI\.agent\workflows directly.**
> The `/sync` workflow will OVERWRITE them from `C:\Users\MBCJ\.gemini\antigravity\global_workflows\`.
> Always edit the SOURCE in the C:\ directory.

---

## 3. Credential Security

- **NEVER** read or output credentials outside of their designated use case.
- **NEVER** commit files from `D:\TechAI\Credentials\` or any `secrets/` folder.
- Verify `.gitignore` is correctly configured before any `git add`.

---

## 4. API Rate Limits (General)

| API | Limit |
|-----|-------|
| GitHub | 3 pushes / 5 min |
| Hostinger | 10 requests / min |
| Vercel | 20 deployments / hour |
| Firebase | Defer to plan limits |

---

*Created: 2025-12-31 after AC-Tech-Pro-Oficial suspension incident.*

