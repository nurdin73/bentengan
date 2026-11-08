---
trigger: always_on
glob: "**/*"
description: Code splitting, modularization, and SOLID refactoring guidelines requiring mandatory pre-refactoring feasibility analysis and skimmable high-level abstraction.
---

# Code Splitting, Modularization & SOLID Refactoring Rules

Whenever creating, refactoring, modifying, or reviewing code across this platform, the AI agent MUST strictly and unconditionally adhere to the following rules regarding code splitting, modularity, and clean architecture:

---

## 1. Mandatory Pre-Refactoring Feasibility Analysis (Zero Premature Fragmentation)

Before splitting or decomposing any file, the AI agent MUST first conduct an explicit feasibility assessment. **Do not split files blindly or prematurely**:

### A. When a File MUST Be Split (Decomposition Triggers)
A file qualifies for splitting if it meets **one or more** of the following conditions:
1. **Single Responsibility Principle (SRP) Violation:** The file handles multiple orthogonal concerns (e.g., mixing complex data fetching, state machine orchestration, mathematical/crypto operations, and dense visual JSX trees in a single file).
2. **High Cognitive Load / Dense SLOC Threshold:**
   - **React Components / Pages:** Exceeds **150–200 lines of code** with deeply nested JSX or multiple inline callbacks.
   - **Backend Services / Controllers:** Exceeds **250 lines of code** or bundles multiple unrelated domain workflows.
3. **Mixed Levels of Abstraction:** High-level user orchestration is interspersed with low-level bit manipulation, string parsing, manual regex, or raw DOM manipulations.
4. **Complex State & Lifecycle Side-Effects:** A component houses more than 3–4 `useState`/`useReducer` calls combined with heavy `useEffect` side-effects that can be encapsulated into an independent custom hook.
5. **Reusability & Independent Testability:** Sub-components or utility functions contain distinct logic that requires independent unit tests without rendering the entire parent tree.

### B. When a File MUST NOT Be Split (Anti-Fragmentation Guardrails)
- **High Cohesion & Tightly Coupled Logic:** If parts of the code only ever change together, share private volatile state, and splitting them creates artificial indirection with no reuse value, keep them co-located.
- **Trivial Length (< 100 lines):** Do not split small, straightforward components or files into 5–10 line micro-files that clutter the codebase ("anemic modules" / "indirection hell").
- **Premature Abstraction:** Do not create a separate utility file or generic abstraction for logic used in exactly one place that has no clear independent domain identity.

---

## 2. SOLID & Clean Code Directives

Every refactoring and modularization effort must be anchored in SOLID principles:

1. **Single Responsibility Principle (SRP):**
   - Each file, component, and function must have **one, and only one, reason to change**.
   - If UI changes, only the presentation file changes. If business rules change, only the domain service/hook changes.
2. **Separation of Concerns (SoC):**
   - **Presentation Layer (JSX/TSX):** Strictly responsible for rendering DOM structures and mapping props to child components. Zero inline business computations or direct network calls.
   - **State & Workflow Layer (Custom Hooks / Services):** Houses state machines, event handlers, and data synchronization (e.g., `useOrganizationForm`, `useAuditLogStream`).
   - **Pure Utilities / Computation (`*.utils.ts`):** Deterministic, pure functions without React hooks, DOM manipulation, or side-effects (e.g., currency formatters, date math, checksum validators).
   - **Domain Contracts (`@dms/contracts` or `*.types.ts`):** Strict type contracts separated from implementation code.
3. **Open/Closed Principle (OCP):**
   - Design components and services to be extendable via composition, props, or port adapters rather than continuous modification of monolithic `switch/case` or `if/else` ladders.
4. **Dependency Inversion Principle (DIP):**
   - High-level orchestrators must depend on abstractions (interfaces, custom hooks, port contracts), not concrete low-level implementations.

---

## 3. High-Level Skimmability & Single Level of Abstraction (SLAP)

Code must be written so that a developer can understand its intent and flow **at a glance within 5 seconds**, without having to read dense line-by-line implementations:

1. **The "Newspaper / Table of Contents" Principle:**
   - The root function or orchestrator component must read like a clear table of contents in high-level prose.
   - Example (React Orchestrator):
     ```tsx
     export function DocumentReviewPage({ documentId }: DocumentReviewPageProps) {
       const { document, status, actions } = useDocumentReview(documentId);

       if (status.isLoading) return <DocumentReviewSkeleton />;
       if (status.isError) return <DocumentReviewError error={status.error} onRetry={actions.retry} />;

       return (
         <div data-testid="doc-review-layout" className="flex flex-col gap-6">
           <DocumentReviewHeader document={document} onExport={actions.exportPdf} />
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
             <DocumentViewerPane className="lg:col-span-2" content={document.content} />
             <ConsensusApprovalSidebar consensus={document.consensus} onApprove={actions.approve} />
           </div>
         </div>
       );
     }
     ```
2. **Function Length & Declarative Naming:**
   - Pure logic functions should ideally be **under 25–35 lines**.
   - Orchestrator components should ideally be **under 80–100 lines**.
   - Function and variable names must be descriptive and convey *intent*, not mechanical steps (e.g., `assertEligibleForSigning()` instead of `checkDoc()`).

---

## 4. Standardized Co-Location Directory Architecture

When a file is split, organize the resulting files using co-location within a feature-specific directory. Do not scatter tightly coupled private sub-components into global folders:

### A. Frontend Component Decomposition Pattern
```text
components/[feature-name]/
├── [feature-name].tsx              # Clean orchestrator / main export
├── [feature-name]-header.tsx       # Focused visual sub-component
├── [feature-name]-sidebar.tsx      # Focused visual sub-component
├── use-[feature-name].ts           # Extracted state, effects, and handlers
├── [feature-name].utils.ts         # Pure calculations / formatting helpers
├── [feature-name].types.ts         # Local UI-only types (if not in @dms/contracts)
├── [feature-name].test.tsx         # Component unit tests (isolated with mocks)
└── index.ts                        # Clean barrel export of public API
```

### B. Backend Domain Decomposition Pattern
```text
core/services/[domain]/
├── [domain].service.ts             # Orchestrator implementing inbound port
├── helpers/[domain]-calculator.ts  # Pure algorithmic / computational logic
├── helpers/[domain]-validator.ts   # Domain rule assertions
└── [domain].service.test.ts        # Unit tests with in-memory stubs
```

### C. Public Contract Preservation
- When breaking down an existing file, **never break consumers' import paths**.
- Maintain backward compatibility via the original file path or clean barrel re-exports (`index.ts` / original module name re-exporting the primary unit).

---

## 5. Non-Negotiable Platform Guardrails

Every file created or modified during refactoring must satisfy all platform rules:

1. **Absolute Prohibition of `any` (Zero Exceptions):**
   - New sub-components, extracted hooks, and utility functions must define explicit typed interfaces or use domain DTOs from `@dms/contracts`. Never fallback to `any`.
2. **Mandatory `data-testid` on Visual Elements:**
   - Every newly extracted JSX sub-component must contain semantic `data-testid="[feature]-[element]-[role]"` attributes to support deterministic unit testing.
3. **Isolated Testability:**
   - Extracted hooks (`use[Feature]`) and pure utilities must be tested independently without relying on real DOM or live APIs.
4. **No Circular Dependencies:**
   - Ensure a strict unidirectional dependency graph:
     - `Orchestrator` -> `Sub-components / Hooks` -> `Utils` -> `Types / Contracts`.
     - Sub-components must never import back from their parent orchestrator.

---

## 6. Verification Checklist for Refactored Code

Before completing any refactoring task:
1. **Pre-check Justification:** Can you clearly articulate why the split was necessary and how it improves cohesion?
2. **Skimmability Test:** Can a reviewer understand what the orchestrator does in 10 seconds?
3. **Typecheck Verification:** Run `bun run --cwd apps/web typecheck` or `bun run --cwd apps/api typecheck` (0 errors).
4. **Test Suite Verification:** Run `bun test` to ensure zero regressions in existing tests and verify new unit tests pass.
