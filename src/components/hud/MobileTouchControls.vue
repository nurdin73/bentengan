<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { Maximize2 } from 'lucide-vue-next'
import type { VirtualMovementInput } from '../../game/input/input-manager'
import type { SkillId } from '../../game/skills/skill-types'
import {
  checkIsMobileTouchDevice,
  requestFullscreenAndLandscape,
  toggleFullscreen,
} from './mobile-device.utils'
import SprintAnchorButton from './SprintAnchorButton.vue'
import ActionSkillArc from './ActionSkillArc.vue'
import ActionUtilityCluster from './ActionUtilityCluster.vue'

export interface MobileTouchControlsProps {
  forceShow?: boolean
  canRescue?: boolean
  isStunned?: boolean
  staminaPercentage?: number
  rescueCooldownSeconds?: number
  showRestore?: boolean
}

const props = withDefaults(defineProps<MobileTouchControlsProps>(), {
  forceShow: false,
  canRescue: false,
  isStunned: false,
  staminaPercentage: 100,
  rescueCooldownSeconds: 0,
  showRestore: false,
})

const emit = defineEmits<{
  (e: 'virtual-move', movement: VirtualMovementInput): void
  (e: 'virtual-sprint', sprint: boolean): void
  (e: 'virtual-jump', jump: boolean): void
  (e: 'virtual-look', delta: { deltaX: number; deltaY: number }): void
  (e: 'virtual-interact'): void
  (e: 'trigger-skill', skillId: SkillId): void
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
const JOYSTICK_DEADZONE = 0.2
const isDraggingJoystick = ref(false)
let joystickTouchId: number | null = null

watch(
  () => props.isStunned,
  (stunned) => {
    if (stunned) {
      emit('virtual-move', {
        forward: false,
        backward: false,
        left: false,
        right: false,
      })
    } else if (joystickTouchId !== null) {
      const normX = knobX.value / maxRadius
      const normY = knobY.value / maxRadius
      emit('virtual-move', {
        forward: normY < -JOYSTICK_DEADZONE,
        backward: normY > JOYSTICK_DEADZONE,
        left: normX < -JOYSTICK_DEADZONE,
        right: normX > JOYSTICK_DEADZONE,
      })
    }
  },
)

const handleJoystickStart = (e: TouchEvent) => {
  triggerAutoFullscreen()
  if (joystickTouchId !== null) return
  const touch = e.changedTouches[0]
  if (!touch || !baseRef.value) return

  joystickTouchId = touch.identifier
  isDraggingJoystick.value = true
  updateJoystickFromTouch(touch.clientX, touch.clientY)
}

const handleJoystickMove = (e: TouchEvent) => {
  if (joystickTouchId === null) return

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
      isDraggingJoystick.value = false
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

const updateJoystickFromTouch = (clientX: number, clientY: number) => {
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

  if (props.isStunned) {
    emit('virtual-move', {
      forward: false,
      backward: false,
      left: false,
      right: false,
    })
    return
  }

  const normX = dx / maxRadius
  const normY = dy / maxRadius

  emit('virtual-move', {
    forward: normY < -JOYSTICK_DEADZONE,
    backward: normY > JOYSTICK_DEADZONE,
    left: normX < -JOYSTICK_DEADZONE,
    right: normX > JOYSTICK_DEADZONE,
  })
}

// 2. Touch Drag Camera Look Zone
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

const updateDeviceDetection = () => {
  isDetectedMobile.value = checkIsMobileTouchDevice()
}

onMounted(() => {
  updateDeviceDetection()
  window.addEventListener('resize', updateDeviceDetection)
  window.addEventListener('orientationchange', updateDeviceDetection)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateDeviceDetection)
  window.removeEventListener('orientationchange', updateDeviceDetection)
  joystickTouchId = null
  isDraggingJoystick.value = false
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
        :class="[
          'relative flex h-32 w-32 items-center justify-center rounded-full border-2 bg-neutral-950/80 shadow-2xl backdrop-blur-md transition-colors overflow-hidden',
          props.isStunned
            ? 'border-amber-500/80 shadow-[0_0_20px_rgba(245,158,11,0.35)]'
            : 'border-neutral-700/80',
        ]"
        @touchstart.prevent="handleJoystickStart"
        @touchmove.prevent="handleJoystickMove"
        @touchend.prevent="handleJoystickEnd"
        @touchcancel.prevent="handleJoystickEnd"
      >
        <!-- Stylized Joystick Base Plate Graphic -->
        <img
          :src="'/assets/ui/controls/analog-base.png'"
          alt="Analog Base"
          :class="[
            'pointer-events-none absolute inset-0 h-full w-full object-contain select-none transition-all duration-200',
            props.isStunned ? 'opacity-85 sepia hue-rotate-15' : 'opacity-90',
          ]"
        />

        <!-- Center Knob -->
        <div
          data-testid="hud-joystick-knob"
          :class="[
            'absolute flex h-14 w-14 items-center justify-center rounded-full shadow-2xl select-none',
            isDraggingJoystick ? 'transition-none' : 'transition-transform duration-100 ease-out',
            props.isStunned ? 'ring-2 ring-amber-400/80 opacity-80' : 'ring-1 ring-sky-400/40',
          ]"
          :style="{
            transform: `translate3d(${knobX}px, ${knobY}px, 0)`,
          }"
        >
          <img
            :src="'/assets/ui/controls/analog-knob.png'"
            alt="Analog Knob"
            class="pointer-events-none h-full w-full object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.6)]"
          />
        </div>
      </div>
    </div>

    <!-- Bottom Right: Radial Action Cluster (3 Modular Decomposed Components) -->
    <div
      data-testid="hud-action-wheel"
      class="pointer-events-none absolute right-3 bottom-3 w-80 h-80 touch-none select-none z-30 flex items-end justify-end"
    >
      <!-- Component 2: Action Utility Cluster (Rescue & Restore to the left of Skill 1, collinear with Skill 1) -->
      <div
        data-testid="hud-utility-cluster-anchor"
        class="pointer-events-auto absolute"
        style="right: 240px; bottom: 41px"
      >
        <ActionUtilityCluster
          :can-rescue="props.canRescue"
          :rescue-cooldown-seconds="props.rescueCooldownSeconds"
          :show-restore="props.showRestore"
          @virtual-interact="emit('virtual-interact')"
          @trigger-restore="emit('trigger-skill', 'dash')"
        />
      </div>

      <!-- Component 1 & 3: Sprint Anchor with Radial Skill Arc surrounding it -->
      <div
        data-testid="hud-sprint-arc-group"
        class="relative flex items-center justify-center w-[100px] h-[100px] right-4 bottom-4"
      >
        <!-- Component 1: Action Skill Arc (Curved Arc: Skill 1, Skill 2, Skill 3, Lompat) -->
        <ActionSkillArc
          :is-mobile="true"
          @trigger-skill="emit('trigger-skill', $event)"
          @virtual-jump="emit('virtual-jump', $event)"
        />

        <!-- Component 3: Sprint Anchor Button (Central Primary Button with Circular Stamina Ring) -->
        <SprintAnchorButton
          :stamina-percentage="props.staminaPercentage"
          :is-stunned="props.isStunned"
          @virtual-sprint="emit('virtual-sprint', $event)"
        />
      </div>
    </div>
  </div>
</template>
