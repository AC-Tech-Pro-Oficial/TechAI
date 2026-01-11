---
description: Autonomous coding loop with self-verification
matches: "^/code"
---
// turbo-all

1.  **Analysis**:
    *   Agent: `TechPlan`
    *   Action: Analyze the request "{{input}}" and identify relevant CLI tools.
    *   **CLI Check**: Verify installed CLI tools (`npm`, `flutter`, `gcloud`, `firebase`, etc.)
    *   Output: A brief technical strategy prioritizing CLI execution.

2.  **Implementation Loop (The Vortex)**:
    *   **Start Loop**:
        *   Agent: `TechCode`
        *   Action: Apply changes to the code. MUST be exhaustive (fix root causes, no lazy patches). Solve all identified problems.
        *   Agent: `TechTest`
        *   Action: Run verification (including `patterns/` audit and `/test`).
        *   *Decision*: If Errors Found -> `TechCode` FIXES them and RESTARTS Loop.
        *   *Decision*: If Success -> BREAK Loop.
    *   **End Loop**

3.  **Finalization**:
    *   Agent: `TechRules`
    *   Action: Verify commit message format (<emoji> <pt-BR>).
    *   Agent: `TechCode`
    *   Action: Commit and Push (if acting on a repo).
    > [!CAUTION]
    > **SAFETY**: Before pushing, verify `SAFETY.md` rate limits (20s cooldown between pushes).

