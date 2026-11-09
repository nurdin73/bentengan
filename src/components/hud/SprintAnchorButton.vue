<script setup lang="ts">
import { ref, computed } from 'vue'
import { Zap } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    staminaPercentage?: number
  }>(),
  {
    staminaPercentage: 100,
  },
)

const emit = defineEmits<{
  (e: 'virtual-sprint', sprint: boolean): void
}>()

const isSprintActive = ref(false)
let sprintTouchId: number | null = null

const circumference = 289.03 // 2 * Math.PI * 46
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

// Support desktop mouse click & hold
const handleMouseDown = () => {
  isSprintActive.value = true
  emit('virtual-sprint', true)
  window.addEventListener('mouseup', handleMouseUp, { once: true })
}

const handleMouseUp = () => {
  isSprintActive.value = false
  emit('virtual-sprint', false)
}
</script>

<template>
  <div
    data-testid="hud-sprint-anchor"
    class="pointer-events-auto relative flex items-center justify-center select-none touch-none w-[100px] h-[100px]"
  >
    <!-- Circular Stamina SVG Gauge (Halo Ring around Sprint Button) -->
    <svg
      data-testid="hud-sprint-circular-bar"
      class="pointer-events-none absolute inset-0 -rotate-90 transform drop-shadow-[0_0_8px_rgba(0,0,0,0.8)]"
      viewBox="0 0 100 100"
      width="100"
      height="100"
    >
      <!-- Background Track -->
      <circle
        cx="50"
        cy="50"
        r="46"
        class="stroke-neutral-800/80"
        stroke-width="4.5"
        fill="rgba(10, 10, 10, 0.45)"
      />
      <!-- Dynamic Progress Meter -->
      <circle
        data-testid="hud-sprint-circular-progress"
        cx="50"
        cy="50"
        r="46"
        stroke-linecap="round"
        stroke-width="4.5"
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

    <!-- Core Sprint Button (82px, Tactile Raised 3D Aesthetic) -->
    <button
      data-testid="hud-touch-sprint-btn"
      type="button"
      :class="[
        'z-10 flex h-[82px] w-[82px] aspect-square cursor-pointer flex-col items-center justify-center rounded-full border-2 transition-all duration-75 select-none backdrop-blur-md',
        isSprintActive
          ? 'border-amber-400 bg-amber-500/50 text-amber-200 ring-4 ring-amber-300/80 scale-90 translate-y-0.5'
          : 'border-white/30 bg-neutral-950/85 text-neutral-200 hover:text-white shadow-2xl active:scale-90',
      ]"
      @touchstart="handleSprintStart"
      @touchend="handleSprintEnd"
      @touchcancel="handleSprintEnd"
      @mousedown="handleMouseDown"
    >
      <Zap class="h-8 w-8 fill-current stroke-[2] drop-shadow-sm" />
      <span class="font-heading text-[10px] font-black tracking-wider uppercase mt-0.5">
        SPRINT
      </span>
    </button>
  </div>
</template>

