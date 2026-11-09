# Bentengan 3D

[![Vue 3](https://img.shields.io/badge/Vue-3.5-4FC08D?logo=vue.js&logoColor=white)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Three.js](https://img.shields.io/badge/Three.js-r187-black?logo=three.js&logoColor=white)](https://threejs.org/)
[![Rapier 3D](https://img.shields.io/badge/Rapier-3D%20Physics-orange)](https://rapier.rs/)
[![PeerJS](https://img.shields.io/badge/PeerJS-WebRTC%20P2P-red)](https://peerjs.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Vitest](https://img.shields.io/badge/Vitest-Unit%20Tests-729B1B?logo=vitest&logoColor=white)](https://vitest.dev/)

**Bentengan 3D** is a real-time 3D multiplayer web game that adapts Indonesia's traditional playground game, *Bentengan* (Indonesian Capture-the-Flag / Tag). Players divide into two teams (**Blue** and **Red**), defending their home fortress, venturing into enemy territory, capturing opponents, rescuing jailed teammates, and attempting to touch the opposing team's base pillar to claim victory.

Built as a lightweight, zero-install, browser-based experience with full **PWA (Progressive Web App)** support, running on desktop and mobile devices.

---

## 🎮 Key Features

- **Authentic Indonesian Traditional Gameplay:** Accurately digitizes Bentengan rules including territorial safety, last-out priority hierarchy, jailbreak rescues, and base infiltration.
- **Physics-Driven 3D Action:** Third-person spring-arm camera, responsive character movement, wall-sliding collision resolution, and jump mechanics powered by [Rapier 3D](https://rapier.rs/) and [Three.js](https://threejs.org/).
- **Host-Authoritative P2P Multiplayer:** Low-latency peer-to-peer matchmaking via WebRTC using [PeerJS](https://peerjs.com/) in a star topology (4v4 or 6v6 matches, up to 12 players) with room code sharing and reconnect buffers.
- **Solo Practice Mode vs. AI Bots:** Play offline or solo against autonomous state-driven AI bots with behaviors for patrol, pursuit, rescue, and fortress attacks.
- **Cross-Platform Responsive Controls:** Seamless support for Keyboard/Mouse on desktop (with Pointer Lock) and virtual analog joysticks and action buttons on touch devices.
- **Tactile Heritage UI:** Distinctive Indonesian-inspired "timbul" tactile aesthetic, custom typography, dynamic HUD (stamina bar, compass radar, player status indicators), and PWA home-screen installation.

---

## 📜 Core Game Rules & Mechanics

The game rules faithfully recreate the traditional Indonesian game of *Bentengan*:

| Rule | Description |
|---|---|
| **1. Garis Tengah (Dividing Line)** | The arena is divided into two halves at $Z = 0$. In your home territory, you are safe from capture. As soon as you cross into enemy territory, you can be captured by active opponents. |
| **2. Siapa Terakhir Keluar (Last-Out-Wins)** | A hunter can capture an enemy only if the hunter left their home fortress **after** the target. If you exited earlier than your opponent, they hold capture priority over you. |
| **3. Penjara & Tawanan (Jail & Prisoners)** | Tagged players are detained in the enemy base's prison zone. Jailed players cannot move or interact until rescued. |
| **4. Penyelamatan (Teammate Rescue)** | An active player who reaches the enemy prison and tags a captured teammate frees them, granting both players **2 seconds of invulnerability** (`immunityUntil`) to escape back to safety. |
| **5. Rebut Benteng (Base Capture Victory)** | Any active player who successfully reaches and touches the opposing team's main fortress pillar immediately wins the match for their team. |
| **6. Eliminasi Tim (Team Elimination)** | If all players of an opposing team are simultaneously jailed, the surviving team wins by total elimination. |

### Movement & Stamina System
- **Walk Speed:** 4.5 m/s | **Sprint Speed:** 7.0 m/s | **Jump Impulse:** 6.5 m/s
- **Stamina Pool:** 100 points maximum.
- **Sprint Drain:** 25 points/second while sprinting.
- **Regeneration:** 18 points/second after stopping sprint.
- **Exhaustion Stun:** Depleting stamina to 0 triggers a mandatory **2-second stun**, leaving the player temporarily incapacitated and highly vulnerable to capture.

---

## 🕹️ Controls Guide

### Desktop (Keyboard & Mouse)

| Action | Key / Input |
|---|---|
| **Move** | `W` `A` `S` `D` or Arrow Keys |
| **Look / Aim** | Mouse movement (Click canvas for Pointer Lock) |
| **Sprint** | `Shift` (Consumes stamina) |
| **Jump** | `Spacebar` |
| **Camera Distance** | Scroll Wheel (Zoom in/out) |
| **Pause / Release Mouse** | `Escape` |

### Mobile & Tablet (Touchscreen)

- **Left Floating Joystick:** 360° analog character movement.
- **Right Screen Drag:** Orbit camera view and aim.
- **Sprint Button:** Hold to run at increased speed.
- **Jump Button:** Tap to leap over low obstacles.
- **Rotate Device Prompt:** Automatic alert to switch to landscape orientation for optimal viewing.

---

## 🏗️ Architecture & Tech Stack

```text
bentengan/
├── src/
│   ├── components/
│   │   ├── game/            # Three.js canvas wrapper & render loop lifecycle
│   │   ├── guide/           # Game rules & controls modal dialogs
│   │   ├── hud/             # Real-time game HUD, radar, touch joystick controls
│   │   ├── lobby/           # Multiplayer waiting room, team picker, room mode
│   │   ├── results/         # Post-match victory/defeat screen & statistics
│   │   └── ui/              # Tactile buttons, modal dialogs, Indonesian flag
│   ├── game/
│   │   ├── camera/          # Third-person camera with spring-arm & wall collision
│   │   ├── core/            # Engine lifecycle loop, simulation constants
│   │   ├── entities/        # PlayerController, RemotePlayerController, BotController
│   │   ├── input/           # InputManager (keyboard, mouse, virtual joystick)
│   │   ├── network/         # PeerJS WebRTC network manager & binary-friendly protocol
│   │   ├── physics/         # Rapier 3D world, character controller, greybox colliders
│   │   ├── scenes/          # Arena greybox, base pillars, lighting, shaders
│   │   └── systems/         # Authoritative gameplay rules (capture, rescue, win condition)
│   ├── stores/              # Pinia state stores (game-store, room-store)
│   ├── types/               # TypeScript contracts & network packet definitions
│   └── views/               # HomeView (Lobby), RoomView (Multiplayer), PracticeView (AI)
```

### Core Technologies
- **Frontend Framework:** [Vue 3](https://vuejs.org/) (Composition API, `<script setup lang="ts">`)
- **Language:** [TypeScript 5](https://www.typescriptlang.org/) with strict typing (0 `any` tolerance)
- **3D Graphics Engine:** [Three.js](https://threejs.org/)
- **Physics Simulation:** [@dimforge/rapier3d-compat](https://rapier.rs/) (WebAssembly 3D physics)
- **Networking:** [PeerJS](https://peerjs.com/) (WebRTC peer-to-peer data channels)
- **State Management:** [Pinia](https://pinia.vuejs.org/)
- **Routing:** [Vue Router](https://router.vuejs.org/)
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com/)
- **Icons:** [lucide-vue-next](https://lucide.dev/)
- **Validation:** [Zod](https://zod.dev/)
- **Test Framework:** [Vitest](https://vitest.dev/) & [@vue/test-utils](https://test-utils.vuejs.org/)

---

## 🚀 Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (>= 1.0 recommended) or Node.js (>= 22.18.0)

### Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/your-username/bentengan.git
cd bentengan
bun install
```

### Development Server

Start the local Vite development server with hot-module replacement (HMR):

```bash
bun dev
```

Visit `http://localhost:5173` in your browser.

---

## 🛠️ Development Scripts

| Command | Description |
|---|---|
| `bun dev` | Starts the Vite development server with HMR |
| `bun run build` | Runs full typecheck and builds optimized production bundle |
| `bun run preview` | Locally previews the production build |
| `bun run test:unit --run` | Executes all 16 Vitest unit test suites |
| `bun run type-check` | Runs `vue-tsc` to validate TypeScript across all `.vue` and `.ts` files |
| `bun run lint` | Runs Oxlint and ESLint with auto-fix |
| `bun run format` | Formats code with Prettier |

---

## 🧪 Testing & Verification

The project enforces high code quality with full test coverage over gameplay rules, networking, scale stability, camera mechanics, and mobile responsiveness:

```bash
# Run all unit tests
bun run test:unit --run

# Run type checking
bun run type-check
```

**Test Coverage Areas:**
- `gameplay-rules.spec.ts`: Territory boundary checks, Last-Out-Wins priority hierarchy, base capture, rescue buffer.
- `multiplayer-gameplay-sync.spec.ts`: PeerJS host-authoritative snapshot broadcast and client reconciliation.
- `reconnection-mechanics.spec.ts`: Host disconnect grace window and client reconnect logic.
- `stamina.spec.ts` & `player-overhead-stamina.spec.ts`: Drain, regeneration, and exhaustion stun state machine.
- `movement-mechanics.spec.ts` & `wall-sliding.spec.ts`: Rapier 3D kinematic character controller and boundary collisions.
- `camera-springarm.spec.ts`: Raycast occlusion and camera clipping prevention against arena obstacles.
- `mobile-responsive-ui.spec.ts` & `mobile-controls.spec.ts`: Virtual joystick touch coordinates, rotation prompt, responsive HUD.

---

## 📄 License

This project is open-source under the [MIT License](LICENSE).
Inspiration and game rules originate from the traditional cultural heritage of **Indonesia**.
