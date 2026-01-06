---
description: Generates an implementation plan for new features.
matches: "^/plan"
---
// turbo-all
// EXCEPTION: Implementation plans ALWAYS require user approval before execution

1.  **Preparation**:
    *   Agent: `TechRules`
    *   Action: Ensure valid context (Global Rules, Manifesto) is loaded.

2.  **Drafting**:
    *   Agent: `TechPlan`
    *   Action: Draft `implementation_plan.md` based on "{{input}}".
    *   Constraint: Must adhere to "Hub & Spoke" architecture. Must be EXHAUSTIVE and OPTIMAL (ignore complexity/time).

3.  **Review**:
    *   Agent: `TechPlan`
    *   Action: Present plan to user for manual review.
    *   *Wait*: Stop and wait for user approval.
