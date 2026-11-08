---
trigger: always_on
glob: "**/*"
description: Mandatory planning workflow rule requiring an implementation plan and explicit user approval before executing any code modifications or fixes.
---

# Mandatory Planning & Approval Workflow Rules

Whenever receiving a new request, feature implementation, bug fix, refactoring, or code change across this platform, the AI agent MUST strictly and unconditionally adhere to the following workflow rules:

---

## 1. Mandatory Planning Before Execution (Zero Exceptions)

The AI agent is strictly prohibited from immediately modifying code, generating new application files, or executing mutating actions upon receiving a task or bug fix request.

- **Prohibited:** Modifying source files, creating new modules, or running destructive shell commands during the initial response to a change/fix request without an approved plan.
- **Mandatory Workflow:**
  1. **Read-Only Research & Analysis:** Inspect the relevant files, existing architectures, types, and dependencies using read-only tools (`view_file`, `grep_search`, `list_dir`).
  2. **Formulate Implementation Plan:** Present a clear, structured implementation plan (using `implementation_plan.md` artifact or detailed planning document).
  3. **Explicit User Approval Gate:** STOP and wait for the user's explicit review and confirmation before executing any code changes.

---

## 2. Required Structure for Implementation Plans

Every implementation plan presented to the user must include:

1. **Problem Analysis & Scope:** Summary of what is being requested or the root cause of the issue being fixed.
2. **Proposed Changes by Component/File:**
   - Specific file paths to create (`[NEW]`), modify (`[MODIFY]`), or delete (`[DELETE]`).
   - Clear description of the exact changes, logic, state, or UI elements being introduced or altered.
3. **Rule Compliance Verification:**
   - Explicit check against platform constraints (e.g., Two-Font Rule, Swiss Monochromatic palette, prohibition of `any`, `data-testid` injection, dedicated API modules).
4. **Verification & Testing Strategy:**
   - Typecheck command (`bun run --cwd apps/web typecheck` or workspace typecheck).
   - Unit tests to run or add (`bun run test` / `vitest`).
   - Manual UI / integration verification steps.
5. **Clarifications & Open Questions:** List any assumptions or architectural decisions that need user feedback before execution.

---

## 3. Strict Execution Boundary

Once the plan is created:
- Do NOT begin executing file edits in the same response.
- Present the plan clearly and explicitly request the user's approval.
- Only proceed with edits after the user gives their approval (e.g., "proceed", "lanjut", "setuju", "approved", or feedback adjustments).

---

## 4. Permitted Exceptions (Purely Informational Queries)

The only exception where a formal plan is not required is when the user's request is purely informational/read-only with no expected code changes:
- Explaining how existing code works (e.g., "bagaimana alur X?", "di mana fungsi Y didefinisikan?").
- Answering theoretical or architecture questions that do not ask for implementations or fixes.
- If an informational query turns into an action item or fix request, rule #1 immediately applies.
