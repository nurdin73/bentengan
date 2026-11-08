# System Design & Architecture Rules: Bentengan Online (3D Multiplayer)

Whenever designing, implementing, refactoring, or reviewing components and subsystems across this platform, the AI agent MUST strictly and unconditionally adhere to the following system design and architectural principles:

---

## 1. Domain Boundaries & Separation of Concerns (SoC)

The application architecture is strictly partitioned into four decoupled layers. Logic from one layer MUST NOT leak into another:

```text
┌────────────────────────────────────────────────────────┐
│             UI & Controls (Vue 3 + Tailwind CSS)       │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│               Application State (Pinia)                │
└──────────────┬──────────────────────────┬──────────────┘
               │                          │
┌──────────────▼─────────────┐ ┌──────────▼──────────────┐
│  Physics & 3D Scene Layer  │ │   Network / Peer Layer  │
│      (Three.js, Rapier)    │ │     (PeerJS, WebRTC)    │
└────────────────────────────┘ └─────────────────────────┘
```

### A. Presentation & UI Layer (Vue 3 + Tailwind CSS)
- **Strict Role:** Purely visual presentation of menus, lobby, HUD overlays, camera controls binding, and 2D notifications.
- **Mandatory Styling Engine:** **Tailwind CSS is mandatory** across all 2D UI elements.
- **Prohibitions:**
  - ZERO game-simulation or physics execution inside Vue reactive loops (`watch`, `computed`, or reactive re-renders).
  - ZERO direct peer networking calls or WebRTC data channel manipulation inside UI components (must go through Pinia stores or network services).

### B. Rendering & 3D Scene Graph Layer (Three.js Native)
- **Strict Role:** 3D scene graph, lighting, materials, camera tracking, character mesh presentation, and particle/visual effects.
- **Directives:**
  - Game rendering uses native Three.js driven by `requestAnimationFrame`, completely decoupled from Vue's virtual DOM.
  - Visual animations and positions are driven by states received from the simulation/network snapshot, never as the source of truth for game rules.

### C. Physics Simulation Layer (Rapier 3D / `@dimforge/rapier3d-compat`)
- **Strict Role:** Discrete rigid body simulation, collision geometry (capsules for players, cuboids/trimeshes for arena boundaries and obstacles), velocity, and impulse calculations.
- **Directives:**
  - Runs on a fixed timestep (60 Hz) on the authoritative Host (and client-side prediction where applicable).
  - Collision events and triggers (e.g., base capture zone, jail boundary, player proximity) interact with game systems via explicit callbacks or action dispatchers.
  - Use optimal primitive shapes (`capsule`, `cuboid`) rather than arbitrary trimesh geometry for dynamic player bodies.

### D. Application & Room State Layer (Pinia)
- **Strict Role:** Single source of truth for room configuration, player roster, team selection (Blue/Red), readiness, match lifecycle (`waiting`, `starting`, `playing`, `finished`), and local settings.
- **Directives:**
  - State mutations must be deterministic and executed via explicit store actions.
  - Separate ephemeral UI state from networked game session snapshots.

### E. Networking & Peer Layer (PeerJS, WebRTC)
- **Strict Role:** Host-authoritative peer-to-peer data channels, packet serialization/deserialization, room connection lifecycle, and heartbeat/latency monitoring.
- **Directives:**
  - All incoming network payloads must be validated using runtime contracts (`zod` schemas) before mutating state.
  - Decouple WebRTC transport mechanics from game simulation using clean port/service abstractions.

---

## 2. UI Design System & Styling: Tailwind CSS First

All 2D user interfaces, HUD elements, overlays, scorecards, and modal dialogs MUST strictly prioritize **Tailwind CSS** as the primary styling engine while implementing the project's signature **tactile 3D ("timbul") arcade visual identity**. Flat, lifeless, generic, or minimalist flat-design components are strictly prohibited.

### A. Mandatory Tailwind CSS-First Directive
- **Utility-First Priority:** All layout orchestration (Flexbox, Grid), spacing (`p-*`, `m-*`, `gap-*`), sizing, positioning, responsive breakpoints, typography, and interactive pseudo-states (`hover:`, `active:`, `focus:`) must be constructed using Tailwind CSS utility classes.
- **Prohibition of Ad-Hoc & Inline CSS:**
  - ZERO inline `style="..."` attributes (with the sole exception of high-frequency runtime transforms like real-time 3D-to-2D projected nameplate screen coordinates).
  - ZERO unorganized, separate `.css` files scattered across components. Reusable custom component styles (such as tactile button variants, text strokes, and depth shadows) must be centralized and authored via `@layer components` or `@layer utilities` within Tailwind CSS configuration or the primary `tailwind.css` entry.
- **Tailwind Arbitrary Values:** Where custom dimensions or precise tactile offsets are required, use standard Tailwind arbitrary value syntax (e.g. `border-b-[4px]`, `rounded-[28px]`, `active:translate-y-[2px]`, `active:border-b-[2px]`).

### B. Tactile 3D ("Timbul") Card & Container Standards
- Every modal, scorecard, panel, and HUD container MUST use tactile raised aesthetics:
  - Solid background fill (e.g., cream `#fdfbf7`, slate, or vibrant team colors).
  - Pronounced bottom border (`border-b-[4px]` to `border-b-[6px]`) in a deeper, contrasting shade.
  - Generous corner radii (`rounded-2xl` to `rounded-3xl` or `rounded-[28px]`).
  - Warm, subtle drop shadows (`shadow-xl` or `0 6px 12px -2px rgba(0, 0, 0, 0.15)`).

### C. Mechanical Raised Button ("Tombol Timbul") Specifications
All clickable buttons MUST feel like physical, spring-loaded arcade buttons:
- **Baseline Structure:**
  - High-contrast, vibrant color fills (`bg-amber-400`, `bg-blue-500`, `bg-red-500`, `bg-emerald-500`, etc.).
  - Heavy bottom border giving the illusion of physical extrusion (`border-b-[4px]` to `border-b-[6px]` darker shade).
- **Mandatory Press Displacement (Tactile Depression):**
  - Active states MUST physically depress:
    ```css
    active:translate-y-[2px] active:border-b-[2px]
    ```
  - Smooth transitions (`transition-all duration-100 ease-out`).

### D. Typography & Visual Identity
- **Headings & Action Buttons:**
  - Must use playful, arcade-legible fonts (`Fredoka` or similar bold rounded display font) with bold/black font weight (`font-black`).
  - High-contrast text outlines (cartoon stroke classes like `.text-stroke-black`) for readable HUD titles over dynamic 3D gameplay.
- **Informational & Body Copy:**
  - Clean, high-legibility sans-serif (`font-sans`, e.g., `DM Sans` or system sans) with `font-bold` or `font-semibold`.

---

## 3. Performance & Real-Time Loop Optimization

Interactive WebGL and Rapier physics run at 60 FPS. Performance degradation directly breaks gameplay:

### A. Zero Allocations in Fixed Simulation & Render Loops
- **Strict Rule:** Never instantiate objects (`new THREE.Vector3()`, `new THREE.Matrix4()`, `new THREE.Quaternion()`, object literals `{...}`, or arrays `[...]`) inside per-frame tick loops (`tick(dt)` or `requestAnimationFrame`).
- **Mandatory Pattern:** Allocate reusable math objects in module scope and mutate in place via `.set()`, `.copy()`, or `.add()`.

### B. Asset & GPU Resource Lifecycle
- Geometries and materials must be shared wherever possible across player character models and arena props.
- When unmounting the 3D scene, ensure textures, geometries, renderers, and Rapier physics worlds are explicitly disposed to prevent memory leaks in the browser.

---

## 4. Network Synchronization & Multiplayer Architecture

### A. Host-Authoritative Simulation
- The Host runs the authoritative fixed-timestep simulation (60 Hz) and broadcasts snapshots at 20 Hz.
- Victory conditions (base capture, team elimination), capture validation (1.5m radius), rescue confirmation, stamina drain, stun (2s), and immunity (2s) are resolved strictly by the Host.
- Non-host clients run local interpolation and optional prediction, reconciling against incoming authoritative snapshots.

### B. Strict Payload Validation
- Every incoming and outgoing message across WebRTC data channels must be strictly typed and validated using runtime contracts (`zod` schemas).
- Unknown or malformed packets must be dropped immediately with a logged warning, preventing corrupt state propagation.

---

## 5. Extensibility & Clean Modularity

- Modules must communicate through clean interfaces, not concrete Three.js canvas instances.
- Adding new obstacle types, arena layouts, or sound effects must be achievable by composition without modifying the core network protocol or fixed-timestep physics loop.
