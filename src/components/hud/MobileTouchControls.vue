<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { VirtualMovementInput } from '../../game/input/input-manager'
import {
  checkIsMobileTouchDevice,
  requestFullscreenAndLandscape,
  toggleFullscreen,
} from './mobile-device.utils'

export interface MobileTouchControlsProps {
  forceShow?: boolean
}

const props = withDefaults(defineProps<MobileTouchControlsProps>(), {
  forceShow: false,
})

const emit = defineEmits<{
  (e: 'virtual-move', movement: VirtualMovementInput): void
  (e: 'virtual-sprint', sprint: boolean): void
  (e: 'virtual-jump', jump: boolean): void
  (e: 'virtual-look', delta: { deltaX: number; deltaY: number }): void
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

// 2. Sprint Button State
const isSprintActive = ref(false)
let sprintTouchId: number | null = null

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

// 4. Camera Touch Drag Zone (Right Screen Half)
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

    <!-- Top Right: Fullscreen Quick Toggle Button -->
    <button
      data-testid="hud-fullscreen-btn"
      type="button"
      class="pointer-events-auto absolute top-4 right-4 flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-neutral-700 bg-neutral-900/80 text-base font-bold text-white shadow-lg backdrop-blur-sm transition-all active:scale-95"
      title="Toggle Fullscreen"
      @click="toggleFullscreen"
    >
      ⛶
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

    <!-- Bottom Right Action Cluster: Jump Button -->
    <div
      class="pointer-events-auto absolute right-8 bottom-28 flex flex-col items-center gap-1 touch-none"
    >
      <button
        data-testid="hud-touch-jump-btn"
        type="button"
        :class="[
          'timbul-btn flex h-15 w-15 cursor-pointer flex-col items-center justify-center rounded-full border-b-[5px] transition-all duration-75 select-none active:translate-y-1',
          isJumpActive
            ? 'border-sky-700 bg-sky-400 text-sky-950 ring-4 ring-sky-300/60 translate-y-1'
            : 'border-sky-800 bg-sky-500 text-sky-950 shadow-2xl',
        ]"
        @touchstart="handleJumpStart"
        @touchend="handleJumpEnd"
        @touchcancel="handleJumpEnd"
      >
        <span class="text-lg">🦘</span>
        <span class="font-heading text-[10px] font-black tracking-wider uppercase">LOMPAT</span>
      </button>
    </div>

    <!-- Bottom Right Action Cluster: Sprint Button -->
    <div
      class="pointer-events-auto absolute right-6 bottom-8 flex flex-col items-center gap-1 touch-none"
    >
      <button
        data-testid="hud-touch-sprint-btn"
        type="button"
        :class="[
          'timbul-btn flex h-18 w-18 cursor-pointer flex-col items-center justify-center rounded-full border-b-[5px] transition-all duration-75 select-none active:translate-y-1',
          isSprintActive
            ? 'border-amber-700 bg-amber-400 text-amber-950 ring-4 ring-amber-300/60 translate-y-1'
            : 'border-amber-800 bg-amber-500 text-amber-950 shadow-2xl',
        ]"
        @touchstart="handleSprintStart"
        @touchend="handleSprintEnd"
        @touchcancel="handleSprintEnd"
      >
        <span class="text-xl">⚡</span>
        <span class="font-heading text-[11px] font-black tracking-wider uppercase">SPRINT</span>
      </button>
    </div>
  </div>
</template>
