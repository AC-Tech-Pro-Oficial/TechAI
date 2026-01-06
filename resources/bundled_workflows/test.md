---
description: Runs comprehensive QA and security checks.
matches: "^/test"
---
// turbo-all

> [!IMPORTANT]
> **RUN ALL TESTS VIA CLI** - Do NOT use browser to verify test results.
> - Flutter: `flutter test`
> - Node: `npm test`
> - Python: `pytest`
> - PowerShell: Run script directly in terminal
>
> **EXHAUSTIVE MODE**: Do not stop at the first error. Find ALL errors. Verify ALL edge cases.

1.  **Static Analysis**:
    *   Agent: `TechTest`
    *   Action: Analyze target files for syntax errors, unused variables, and type mismatches.

2.  **Pattern Compliance (Knowledge Base)**:
    *   Agent: `TechTest`
    *   Action: Check for language-specific anti-patterns.
    *   **Rule**: If PowerShell (`.ps1`), READ `patterns/powershell-patterns.md`.
    *   Audit code against:
        *   **Hang Risks** (e.g., bare `Add-Type`).
        *   **Loop Safety** (e.g., waiting loops without fail-fast).
        *   **Idempotency** (e.g., cleanup before install).

3.  **Security Audit**:
    *   Agent: `TechTest`
    *   Action: Scan for:
        *   Hardcoded credentials.
        *   Injection vulnerabilities.
        *   Unsafe path handling.

4.  **Logic Probe**:
    *   Agent: `TechTest`
    *   Action: "Devil's Advocate" review. Ask "How would I break this?" and simulate those conditions.

5.  **Report**:
    *   Output: A Pass/Fail report with specific remediation steps.
