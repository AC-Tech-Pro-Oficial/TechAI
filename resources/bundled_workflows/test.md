---
description: Runs comprehensive QA and security checks adapting to the project type (Flutter/Web).
matches: "^/test"
---
// turbo-all

> [!IMPORTANT]
> **RUN ALL TESTS VIA CLI** - Do NOT use browser to verify test results.
> **EXHAUSTIVE MODE**: Do not stop at the first error. Find ALL errors. Verify ALL edge cases.

1.  **Environment Detection**:
    *   **Action**: Check if `pubspec.yaml` (Flutter) or `package.json` (Node/Web) exists to determine the project type.

2.  **Static Analysis & Linting**:
    *   **IF Flutter**:
        *   Run: `flutter analyze`
        *   Run: `dart format --output=none --set-exit-if-changed .`
    *   **IF Node/Web**:
        *   Run: `npm run lint` (if available, otherwise check `package.json` scripts)
    *   **IF Python**:
        *   Run: `pylint` or `flake8`
    *   **IF PowerShell**:
        *   Check for `PSScriptAnalyzer` compliance.

3.  **Unit & Integration Tests**:
    *   **IF Flutter**:
        *   Run: `flutter test`
    *   **IF Node/Web**:
        *   Run: `npm test`
    *   **IF Python**:
        *   Run: `pytest`

4.  **Pattern Compliance (Knowledge Base)**:
    *   Agent: `TechTest`
    *   Action: Check for language-specific anti-patterns.
    *   **Rule**: If PowerShell (`.ps1`), READ `patterns/powershell-patterns.md`.

5.  **Security Audit**:
    *   Agent: `TechTest`
    *   Action: Scan for:
        *   Hardcoded credentials.
        *   Injection vulnerabilities.
        *   Unsafe path handling.
    *   **IF Firebase**:
        *   Check `firestore.rules` for overlapping wildcards or open permissions.
        *   Check `firebase.json` for public indices or insecure rewrites.

6.  **Logic Probe**:
    *   Agent: `TechTest`
    *   Action: "Devil's Advocate" review. Ask "How would I break this?" and simulate those conditions.

7.  **Report**:
    *   Output: A Pass/Fail report with specific remediation steps.
