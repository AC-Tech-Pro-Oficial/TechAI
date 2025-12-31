---
description: Autonomous troubleshooting for Windows, IDE, and hardware issues.
matches: "^/support"
---
// turbo-all

# TechAssist Support Workflow

## 1. Immediate Diagnostics (Auto-Run)
*   Agent: `TechAssist`
*   Actions (Run ALL in parallel, do NOT ask):
    // turbo
    *   `systeminfo | Select-String "OS Name","Total Physical Memory","Processor"`
    // turbo
    *   `Get-Process | Sort-Object CPU -Descending | Select-Object -First 10`
    // turbo
    *   `Get-EventLog -LogName System -EntryType Error -Newest 20`
    // turbo
    *   `nvidia-smi` (if GPU issue suspected)
    // turbo
    *   `Get-ChildItem "$env:USERPROFILE\.gemini\logs" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 5`

## 2. Proactive Questioning (If Needed)
*   Agent: `TechAssist`
*   Condition: If the initial problem description ("{{input}}") is vague.
*   Action: Generate 2-4 targeted clarifying questions:
    *   "When did this start happening?"
    *   "Does it happen with a specific file or all files?"
    *   "Any recent software installations?"

## 3. Root Cause Analysis
*   Agent: `TechAssist`
*   Action: Cross-reference diagnostics with known issues (Event IDs, common Antigravity bugs).
*   Output: A concise "Diagnosis" artifact (Markdown) if findings are complex.

## 4. Solution Proposal
*   **Minor Fix (Safe)**: Apply immediately. Examples: Clear temp files, restart service.
*   **Major Fix (Risky)**: Generate `implementation_plan.md` artifact for user review.
    *   Example: Driver rollback, Registry edit, System Restore.

## 5. Execution & Verification
*   Agent: `TechAssist`
*   Action: Apply the fix.
*   Verification: Re-run relevant diagnostics to confirm resolution.
*   Output: "Issue Resolved" confirmation or "Escalation Needed" if unresolved.
