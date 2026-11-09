<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ChevronsUp, Zap, HeartHandshake, Maximize2 } from 'lucide-vue-next'
import type { VirtualMovementInput } from '../../game/input/input-manager'
import {
  checkIsMobileTouchDevice,
  requestFullscreenAndLandscape,
  toggleFullscreen,
} from './mobile-device.utils'

export interface MobileTouchControlsProps {
  forceShow?: boolean
  canRescue?: boolean
  staminaPercentage?: number
  rescueCooldownSeconds?: number
}

const props = withDefaults(defineProps<MobileTouchControlsProps>(), {
  forceShow: false,
  canRescue: false,
  staminaPercentage: 100,
  rescueCooldownSeconds: 0,
})

const emit = defineEmits<{
  (e: 'virtual-move', movement: VirtualMovementInput): void
  (e: 'virtual-sprint', sprint: boolean): void
  (e: 'virtual-jump', jump: boolean): void
  (e: 'virtual-look', delta: { deltaX: number; deltaY: number }): void
  (e: 'virtual-interact'): void
}>()

const isDetectedMobile = ref(false)
const isActive = computed(() => props.forceShow || isDetectedMobile.value)

let hasAttemptedAutoFullscreen = false
const triggerAutoFullscreen = () => {
  if (!hasAttemptedAutoFullscreen) {
    hasAttemptedAutoFullscreen = true
    requestFullscreenAndLandscape()
  }
}

// 1. Virtual Joystick State
const baseRef = ref<HTMLDivElement | null>(null)
const knobX = ref(0)
const knobY = ref(0)
const maxRadius = 45
let joystickTouchId: number | null = null

const handleJoystickStart = (e: TouchEvent) => {
  triggerAutoFullscreen()
  if (joystickTouchId !== null) return
  const touch = e.changedTouches[0]
  if (!touch || !baseRef.value) return

  joystickTouchId = touch.identifier
  updateJoystickFromTouch(touch.clientX, touch.clientY)
}

const handleJoystickMove = (e: TouchEvent) => {
  if (joystickTouchId === null || !baseRef.value) return

  for (let i = 0; i < e.changedTouches.length; i++) {
    const touch = e.changedTouches[i]
    if (touch && touch.identifier === joystickTouchId) {
      updateJoystickFromTouch(touch.clientX, touch.clientY)
      break
    }
  }
}

const handleJoystickEnd = (e: TouchEvent) => {
  if (joystickTouchId === null) return

  for (let i = 0; i < e.changedTouches.length; i++) {
    const touch = e.changedTouches[i]
    if (touch && touch.identifier === joystickTouchId) {
      joystickTouchId = null
      knobX.value = 0
      knobY.value = 0
      emit('virtual-move', {
        forward: false,
        backward: false,
        left: false,
        right: false,
      })
      break
    }
  }
}

function updateJoystickFromTouch(clientX: number, clientY: number): void {
  if (!baseRef.value) return

  const rect = baseRef.value.getBoundingClientRect()
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2

  let dx = clientX - centerX
  let dy = clientY - centerY

  const distance = Math.sqrt(dx * dx + dy * dy)
  if (distance > maxRadius) {
    const ratio = maxRadius / distance
    dx *= ratio
    dy *= ratio
  }

  knobX.value = dx
  knobY.value = dy

  const normX = dx / maxRadius
  const normY = dy / maxRadius

  emit('virtual-move', {
    forward: normY < -0.25,
    backward: normY > 0.25,
    left: normX < -0.25,
    right: normX > 0.25,
  })
}

// 2. Sprint Button State & Circular Stamina Bar Computations
const isSprintActive = ref(false)
let sprintTouchId: number | null = null

const circumference = 251.33 // 2 * Math.PI * 40
const strokeDashoffset = computed(() => {
  const clamped = Math.max(0, Math.min(100, props.staminaPercentage))
  return circumference * (1 - clamped / 100)
})

const staminaRingColor = computed(() => {
  if (props.staminaPercentage > 50) return 'stroke-amber-400'
  if (props.staminaPercentage > 25) return 'stroke-orange-500'
  return 'stroke-rose-500'
})

const isLowStamina = computed(() => props.staminaPercentage < 25)

const handleSprintStart = (e: TouchEvent) => {
  e.preventDefault()
  triggerAutoFullscreen()
  if (sprintTouchId !== null) return
  const touch = e.changedTouches[0]
  if (!touch) return

  sprintTouchId = touch.identifier
  isSprintActive.value = true
  emit('virtual-sprint', true)
}

const handleSprintEnd = (e: TouchEvent) => {
  if (sprintTouchId === null) return

  for (let i = 0; i < e.changedTouches.length; i++) {
    const touch = e.changedTouches[i]
    if (touch && touch.identifier === sprintTouchId) {
      sprintTouchId = null
      isSprintActive.value = false
      emit('virtual-sprint', false)
      break
    }
  }
}

// 3. Jump Button State
const isJumpActive = ref(false)
let jumpTouchId: number | null = null

const handleJumpStart = (e: TouchEvent) => {
  e.preventDefault()
  triggerAutoFullscreen()
  if (jumpTouchId !== null) return
  const touch = e.changedTouches[0]
  if (!touch) return

  jumpTouchId = touch.identifier
  isJumpActive.value = true
  emit('virtual-jump', true)
}

const handleJumpEnd = (e: TouchEvent) => {
  if (jumpTouchId === null) return

  for (let i = 0; i < e.changedTouches.length; i++) {
    const touch = e.changedTouches[i]
    if (touch && touch.identifier === jumpTouchId) {
      jumpTouchId = null
      isJumpActive.value = false
      emit('virtual-jump', false)
      break
    }
  }
}

// 4. Rescue / Interact Button State
const isRescueActive = ref(false)

const handleRescueTouchStart = (e: TouchEvent) => {
  e.preventDefault()
  triggerAutoFullscreen()
  if (props.rescueCooldownSeconds > 0) return
  isRescueActive.value = true
  emit('virtual-interact')
}

const handleRescueTouchEnd = () => {
  isRescueActive.value = false
}

const handleRescueClick = () => {
  if (props.rescueCooldownSeconds > 0) return
  emit('virtual-interact')
}

// 5. Camera Touch Drag Zone (Right Screen Half)
let lookTouchId: number | null = null
let lastLookX = 0
let lastLookY = 0

const handleLookStart = (e: TouchEvent) => {
  triggerAutoFullscreen()
  if (lookTouchId !== null) return
  const touch = e.changedTouches[0]
  if (!touch) return

  lookTouchId = touch.identifier
  lastLookX = touch.clientX
  lastLookY = touch.clientY
}

const handleLookMove = (e: TouchEvent) => {
  if (lookTouchId === null) return

  for (let i = 0; i < e.changedTouches.length; i++) {
    const touch = e.changedTouches[i]
    if (touch && touch.identifier === lookTouchId) {
      const deltaX = (touch.clientX - lastLookX) * 1.5
      const deltaY = (touch.clientY - lastLookY) * 1.5
      lastLookX = touch.clientX
      lastLookY = touch.clientY

      emit('virtual-look', { deltaX, deltaY })
      break
    }
  }
}

const handleLookEnd = (e: TouchEvent) => {
  if (lookTouchId === null) return

  for (let i = 0; i < e.changedTouches.length; i++) {
    const touch = e.changedTouches[i]
    if (touch && touch.identifier === lookTouchId) {
      lookTouchId = null
      break
    }
  }
}

onMounted(() => {
  isDetectedMobile.value = checkIsMobileTouchDevice()
})

onUnmounted(() => {
  joystickTouchId = null
  sprintTouchId = null
  jumpTouchId = null
  lookTouchId = null
  isRescueActive.value = false
})
</script>

<template>
  <div
    v-if="isActive"
    data-testid="mobile-touch-controls"
    class="pointer-events-none fixed inset-0 z-40 select-none overflow-hidden touch-none"
  >
    <!-- Right Screen Half: Touch Look Drag Zone -->
    <div
      data-testid="hud-touch-look-zone"
      class="pointer-events-auto absolute top-16 right-0 bottom-48 w-1/2 cursor-grab touch-none"
      @touchstart.passive="handleLookStart"
      @touchmove.passive="handleLookMove"
      @touchend.passive="handleLookEnd"
      @touchcancel.passive="handleLookEnd"
    />

    <!-- Top Right: Fullscreen Quick Toggle Button (Positioned closely alongside HUD toggle with tight gap) -->
    <button
      data-testid="hud-fullscreen-btn"
      type="button"
      class="pointer-events-auto absolute top-3 right-[92px] sm:top-5 sm:right-[100px] flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-neutral-700 bg-neutral-900/80 text-white shadow-lg backdrop-blur-sm transition-all active:scale-95 hover:bg-neutral-800"
      title="Toggle Fullscreen"
      @click="toggleFullscreen"
    >
      <Maximize2 class="h-3.5 w-3.5 text-neutral-200" />
    </button>

    <!-- Bottom Left: Virtual Analog Joystick -->
    <div
      class="pointer-events-auto absolute bottom-6 left-6 flex items-center justify-center touch-none"
    >
      <div
        ref="baseRef"
        data-testid="hud-virtual-joystick"
        class="relative flex h-32 w-32 items-center justify-center rounded-full border-2 border-neutral-700/80 bg-neutral-950/70 shadow-2xl backdrop-blur-md"
        @touchstart.prevent="handleJoystickStart"
        @touchmove.prevent="handleJoystickMove"
        @touchend.prevent="handleJoystickEnd"
        @touchcancel.prevent="handleJoystickEnd"
      >
        <!-- Directional Helper Crosshair Markers -->
        <div class="pointer-events-none absolute top-2 text-[10px] font-bold text-neutral-500">▲</div>
        <div class="pointer-events-none absolute bottom-2 text-[10px] font-bold text-neutral-500">▼</div>
        <div class="pointer-events-none absolute left-2 text-[10px] font-bold text-neutral-500">◀</div>
        <div class="pointer-events-none absolute right-2 text-[10px] font-bold text-neutral-500">▶</div>

        <!-- Center Knob -->
        <div
          data-testid="hud-joystick-knob"
          class="absolute flex h-14 w-14 items-center justify-center rounded-full border border-neutral-400/80 bg-gradient-to-b from-neutral-200 to-neutral-400 shadow-lg transition-transform duration-75"
          :style="{
            transform: `translate3d(${knobX}px, ${knobY}px, 0)`,
          }"
        >
          <div class="h-5 w-5 rounded-full border border-neutral-400 bg-neutral-300 shadow-inner" />
        </div>
      </div>
    </div>

    <!-- Bottom Right: Radial Action Wheel (Arc Layout matching MOBA / Action Mobile) -->
    <div
      data-testid="hud-action-wheel"
      class="pointer-events-none absolute right-2 bottom-2 w-60 h-60 touch-none select-none z-30"
    >
      <!-- Satellite 1 (Left-Top on Arc): Rescue Button -->
      <div
        class="pointer-events-auto absolute flex flex-col items-center touch-none"
        style="left: 76px; top: 76px;"
      >
        <button
          data-testid="hud-touch-rescue-btn"
          type="button"
          :disabled="props.rescueCooldownSeconds > 0"
          :class="[
            'flex h-15 w-15 aspect-square flex-col items-center justify-center rounded-full border transition-all duration-75 select-none backdrop-blur-md active:scale-90',
            props.rescueCooldownSeconds > 0
              ? 'border-amber-500/40 bg-neutral-950/85 text-amber-300 opacity-80 cursor-not-allowed'
              : isRescueActive
                ? 'cursor-pointer border-emerald-300 bg-emerald-500/40 text-emerald-200 ring-4 ring-emerald-300/70 scale-90'
                : props.canRescue
                  ? 'cursor-pointer border-emerald-300 bg-emerald-500 text-white shadow-2xl animate-pulse ring-4 ring-emerald-400/60'
                  : 'cursor-pointer border-white/20 bg-neutral-950/75 text-neutral-300 hover:text-white shadow-xl',
          ]"
          @touchstart="handleRescueTouchStart"
          @touchend="handleRescueTouchEnd"
          @touchcancel="handleRescueTouchEnd"
          @click="handleRescueClick"
        >
          <template v-if="props.rescueCooldownSeconds > 0">
            <span
              data-testid="hud-rescue-cooldown-badge"
              class="font-mono text-base font-black text-amber-300 drop-shadow-md leading-none"
            >
              {{ props.rescueCooldownSeconds }}
            </span>
            <span class="font-heading text-[7px] font-black tracking-widest text-neutral-400 uppercase mt-0.5">
              COOLDOWN
            </span>
          </template>
          <template v-else>
            <HeartHandshake class="h-6 w-6 stroke-[2.2] drop-shadow-sm" />
            <span class="font-heading text-[8px] font-black tracking-wider uppercase mt-0.5">BEBASKAN</span>
          </template>
        </button>
      </div>

      <!-- Satellite 2 (Top on Arc): Jump Button -->
      <div
        class="pointer-events-auto absolute flex flex-col items-center touch-none"
        style="left: 140px; top: 50px;"
      >
        <button
          data-testid="hud-touch-jump-btn"
          type="button"
          :class="[
            'flex h-15 w-15 aspect-square cursor-pointer flex-col items-center justify-center rounded-full border transition-all duration-75 select-none backdrop-blur-md active:scale-90',
            isJumpActive
              ? 'border-sky-300 bg-sky-500/40 text-sky-200 ring-4 ring-sky-300/70 scale-90'
              : 'border-white/20 bg-neutral-950/75 text-neutral-300 hover:text-white shadow-xl',
          ]"
          @touchstart="handleJumpStart"
          @touchend="handleJumpEnd"
          @touchcancel="handleJumpEnd"
        >
          <ChevronsUp class="h-6 w-6 stroke-[2.5] drop-shadow-sm" />
          <span class="font-heading text-[8px] font-black tracking-wider uppercase mt-0.5">LOMPAT</span>
        </button>
      </div>

      <!-- Center Anchor (Large Main Action Button): Sprint Button with Circular Stamina Bar -->
      <div
        class="pointer-events-auto absolute flex items-center justify-center touch-none"
        style="left: 130px; top: 130px;"
      >
        <div class="relative flex h-22 w-22 items-center justify-center select-none">
          <!-- Circular Stamina SVG Gauge (Halo Ring around Sprint Button) -->
          <svg
            data-testid="hud-sprint-circular-bar"
            class="pointer-events-none absolute inset-0 -rotate-90 transform drop-shadow-[0_0_8px_rgba(0,0,0,0.8)]"
            viewBox="0 0 88 88"
            width="88"
            height="88"
          >
            <!-- Background Track -->
            <circle
              cx="44"
              cy="44"
              r="40"
              class="stroke-neutral-800/80"
              stroke-width="3.5"
              fill="rgba(10, 10, 10, 0.4)"
            />
            <!-- Dynamic Progress Meter -->
            <circle
              data-testid="hud-sprint-circular-progress"
              cx="44"
              cy="44"
              r="40"
              stroke-linecap="round"
              stroke-width="3.5"
              fill="transparent"
              :class="[
                'transition-[stroke-dashoffset,stroke] duration-100 ease-out',
                staminaRingColor,
                isLowStamina ? 'animate-pulse' : '',
              ]"
              :stroke-dasharray="circumference"
              :stroke-dashoffset="strokeDashoffset"
            />
          </svg>

          <!-- Core Sprint Button -->
          <button
            data-testid="hud-touch-sprint-btn"
            type="button"
            :class="[
              'z-10 flex h-18 w-18 aspect-square cursor-pointer flex-col items-center justify-center rounded-full border-2 transition-all duration-75 select-none backdrop-blur-md active:scale-90',
              isSprintActive
                ? 'border-amber-400 bg-amber-500/40 text-amber-300 ring-4 ring-amber-300/70 scale-90'
                : 'border-white/25 bg-neutral-950/75 text-neutral-200 hover:text-white shadow-2xl',
            ]"
            @touchstart="handleSprintStart"
            @touchend="handleSprintEnd"
            @touchcancel="handleSprintEnd"
          >
            <Zap class="h-7 w-7 fill-current stroke-[2] drop-shadow-sm" />
            <span class="font-heading text-[9px] font-black tracking-wider uppercase mt-0.5">SPRINT</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
