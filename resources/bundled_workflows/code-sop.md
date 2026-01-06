---
description: Deep code improvement with self-repairing loop (alias for code.md)
matches: "^/code-sop"
---

# Self-Feeding Coding Loop SOP
This is an alias for `/code`. The canonical workflow is `code.md`.

// turbo-all

1.  **Analysis**: Agent TechPlan analyzes the request.
2.  **Implementation Loop**:
    *   TechCode applies changes.
    *   TechTest verifies.
    *   If errors -> TechCode fixes -> Loop.
    *   If success -> Break.
3.  **Finalization**: Commit.
