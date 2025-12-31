---
description: Educational research mode - answers questions with comprehensive reports
matches: "^/ask"
---

# TechAsk Educational Research Workflow

> [!CAUTION]
> **🔒 ABSOLUTE READ-ONLY MODE**
> When `/ask` is detected, you are in **STRICT READ-ONLY MODE**.
> You MUST NOT modify, create, delete, or change ANY file in ANY project.
> This is ABSOLUTE and UNCONDITIONAL. No exceptions. No follow-up action allowed.
> **This overrides TURBO MODE and all other autonomy rules.**

---

## 🚨 FORBIDDEN ACTIONS (NO EXCEPTIONS)

These tools are **COMPLETELY BANNED** during `/ask` mode:

| Banned Tool | Reason |
|-------------|--------|
| `write_to_file` (on project paths) | Modifies project files |
| `replace_file_content` | Modifies files |
| `multi_replace_file_content` | Modifies files |
| `run_command` (with side effects) | Could modify project state |
| `mcp_*_deploy_*` | Deployment actions |
| `mcp_firebase-mcp-server_firebase_init` | Project configuration |
| Any file creation in project directories | Modifies project |

> [!IMPORTANT]
> **EVEN IF THE USER SAYS "go ahead" or "yes" AFTER an /ask prompt:**
> You MUST inform them that `/ask` mode is read-only.
> Tell them: *"To execute these changes, please start a new prompt without `/ask`."*

---

## ✅ ALLOWED ACTIONS (Research Only)

### Research Tools
| Tool | Purpose |
|------|---------|
| `view_file` | Read file contents |
| `view_file_outline` | Understand file structure |
| `view_code_item` | Inspect specific functions/classes |
| `grep_search` | Search codebase for patterns |
| `find_by_name` | Locate files/directories |
| `list_dir` | Explore directory structure |
| `search_web` | Research external information |
| `read_url_content` | Read documentation/articles |
| `browser_subagent` | Browse for research (read-only) |

### Safe Run Commands
| Allowed | Example |
|---------|---------|
| ✅ Read-only queries | `flutter --version`, `git status`, `npm list` |
| ✅ Help commands | `flutter doctor`, `dart analyze` |
| ❌ Build/install commands | `flutter build`, `npm install` |
| ❌ Git modifications | `git commit`, `git push` |

---

## ✅ ARTIFACT CREATION (Brain Folder ONLY)

You MAY create files **only** in the artifacts folder:

**Path:** `C:\Users\MBCJ\.gemini\antigravity\brain\<conversation-id>\`

| Artifact Type | Examples |
|---------------|----------|
| Reports | `research_report.md`, `analysis.md` |
| Implementation Plans | `implementation_plan.md` (proposal, not execution) |
| Comparison Tables | `comparison.md`, `options.md` |
| Diagrams | Generated images via `generate_image` |
| Data exports | `.csv`, `.json` for analysis |

---

## ✅ ALLOWED OUTPUT FORMATS

Be thorough and resourceful in your **informational** response:

1. **Direct Text Answers** — In-chat explanations
2. **Markdown Reports** — `.md` files in artifacts folder
3. **Implementation Proposals** — Detailed plans (proposals, not executed)
4. **Code Examples** — Illustrative snippets in code blocks (NOT written to files)
5. **Generated Images** — Diagrams, flowcharts, UI mockups
6. **Comparison Tables** — Feature analysis, pros/cons
7. **External Links** — Documentation, tutorials, references

---

## 🎯 Workflow Steps

### 1. Activate /ask Mode
- If prompt contains `/ask` or `@ask` → **STRICT READ-ONLY**
- Mental check: *"I will ONLY answer with information. I will NOT touch any project."*

### 2. Research & Analyze
- Parse the question carefully
- Use read-only research tools
- Prioritize accuracy and thoroughness

### 3. Respond with Information
- Answer the question directly in text
- If changes would be beneficial, **describe them in your response**
- Create artifacts (reports, proposals) in the brain folder only
- Use code blocks to show what code *would* look like (don't write it)

### 4. End of Response
- Your response is complete
- If user wants actions taken → They must start a NEW prompt without `/ask`
- There is NO second step where you execute changes

---

## 🛡️ Quick Reference

```
User prompt contains /ask?
├── YES → STRICT READ-ONLY MODE
│   ├── Read/research tools ✅
│   ├── Create brain folder artifacts ✅
│   ├── Show code examples in chat ✅
│   ├── Propose changes in text ✅
│   ├── Modify project files ❌ NEVER
│   ├── Run build/install commands ❌ NEVER
│   └── Execute proposals ❌ NEVER (even if user says "yes")
└── NO → Normal operation
```

---

## 💬 Response Template

When responding to `/ask` prompts, consider this structure:

```markdown
## Answer
[Direct answer to the question]

## Analysis
[Deeper explanation, context, research findings]

## Proposed Solution (if applicable)
[What WOULD need to change - code examples in blocks]

## Next Steps
To implement these changes, start a new prompt without `/ask`.
```

> [!IMPORTANT]
> **This workflow CANNOT be overridden.**
> `/ask` = Read-only. Full stop.
> Questions deserve answers, not actions.
