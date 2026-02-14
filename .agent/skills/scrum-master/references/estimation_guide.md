# Estimation Guide: T-Shirt Sizing

We use T-Shirt sizing for high-level planning to avoid false precision.

| Size | Estimated Tool Calls | complexity | Example |
| :--- | :--- | :--- | :--- |
| **S** | 1-5 | Trivial | "Fix a typo", "Add a console log", "Update README" |
| **M** | 5-15 | Routine | "Add a new basic component", "Write a new CLI script" |
| **L** | 15-30 | Complex | "Implement a full new Agent flow", "Refactor Auth system" |
| **XL** | 30+ | Epic | "Migration to Next.js", "Create the SahayakAI Core" |

## Usage
When planning a new Feature (Epic), assign a size.
*   If unexpected complexity arises (e.g., **S** turns into **L**), stop and re-negotiate the plan with the user.
