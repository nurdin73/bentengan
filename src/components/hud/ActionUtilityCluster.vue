<script setup lang="ts">
import { ref } from 'vue'
import { HeartHandshake, RotateCcw } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    canRescue?: boolean
    rescueCooldownSeconds?: number
    showRestore?: boolean
  }>(),
  {
    canRescue: false,
    rescueCooldownSeconds: 0,
    showRestore: false,
  },
)

const emit = defineEmits<{
  (e: 'virtual-interact'): void
  (e: 'trigger-restore'): void
}>()

const isRescueActive = ref(false)
const isRestoreActive = ref(false)

const handleRescueTouchStart = (e: TouchEvent) => {
  e.preventDefault()
  if (props.rescueCooldownSeconds > 0) return
  isRescueActive.value = true
  emit('virtual-interact')
}

const handleRescueTouchEnd = (e: TouchEvent) => {
  e.preventDefault()
  isRescueActive.value = false
}

const handleRescueClick = () => {
  if (props.rescueCooldownSeconds > 0) return
  emit('virtual-interact')
}

const handleRestoreTouchStart = (e: TouchEvent) => {
  e.preventDefault()
  isRestoreActive.value = true
  emit('trigger-restore')
}

const handleRestoreTouchEnd = (e: TouchEvent) => {
  e.preventDefault()
  isRestoreActive.value = false
}

const handleRestoreClick = () => {
  emit('trigger-restore')
}
</script>

<template>
  <div
    data-testid="hud-utility-cluster"
    class="pointer-events-auto flex items-center gap-2 select-none touch-none"
  >
    <!-- Slot 1: Restore Button (Hidden by default, structured for immediate activation in future) -->
    <div v-if="props.showRestore" class="flex flex-col items-center">
      <button
        data-testid="hud-utility-restore-btn"
        type="button"
        :class="[
          'flex h-[50px] w-[50px] aspect-square cursor-pointer flex-col items-center justify-center rounded-full border transition-all duration-75 select-none backdrop-blur-md active:scale-90',
          isRestoreActive
            ? 'border-indigo-400 bg-indigo-500/50 text-indigo-200 ring-2 ring-indigo-400 scale-90'
            : 'border-white/20 bg-neutral-950/80 text-neutral-300 hover:text-white shadow-lg',
        ]"
        title="Restore (Pulang / Pulihkan)"
        @touchstart.prevent="handleRestoreTouchStart"
        @touchend="handleRestoreTouchEnd"
        @touchcancel="handleRestoreTouchEnd"
        @click="handleRestoreClick"
      >
        <RotateCcw class="h-5 w-5 stroke-[2.2] drop-shadow-sm" />
        <span class="font-heading text-[7.5px] font-black tracking-wider uppercase mt-0.5">
          RESTORE
        </span>
      </button>
    </div>

    <!-- Slot 2: Compact Rescue Button (~50px, tactile, highlights when near jailed ally) -->
    <div class="flex flex-col items-center">
      <button
        data-testid="hud-touch-rescue-btn"
        type="button"
        :disabled="props.rescueCooldownSeconds > 0"
        :class="[
          'flex h-[50px] w-[50px] aspect-square flex-col items-center justify-center rounded-full border transition-all duration-75 select-none backdrop-blur-md active:scale-90',
          props.rescueCooldownSeconds > 0
            ? 'border-amber-500/40 bg-neutral-950/85 text-amber-300 opacity-80 cursor-not-allowed'
            : isRescueActive
              ? 'cursor-pointer border-emerald-300 bg-emerald-500/50 text-emerald-200 ring-2 ring-emerald-300 scale-90'
              : props.canRescue
                ? 'cursor-pointer border-emerald-300 bg-emerald-500 text-white shadow-2xl animate-pulse ring-2 ring-emerald-400/80'
                : 'cursor-pointer border-white/20 bg-neutral-950/80 text-neutral-300 hover:text-white shadow-lg',
        ]"
        title="Rescue (Bebaskan Kawan)"
        @touchstart="handleRescueTouchStart"
        @touchend="handleRescueTouchEnd"
        @touchcancel="handleRescueTouchEnd"
        @click="handleRescueClick"
      >
        <template v-if="props.rescueCooldownSeconds > 0">
          <span
            data-testid="hud-rescue-cooldown-badge"
            class="font-mono text-xs font-black text-amber-300 drop-shadow-md leading-none"
          >
            {{ props.rescueCooldownSeconds }}
          </span>
          <span
            class="font-heading text-[6.5px] font-black tracking-widest text-neutral-400 uppercase mt-0.5"
          >
            CD
          </span>
        </template>
        <template v-else>
          <HeartHandshake class="h-5 w-5 stroke-[2.2] drop-shadow-sm" />
          <span class="font-heading text-[7.5px] font-black tracking-wider uppercase mt-0.5">
            RESCUE
          </span>
        </template>
      </button>
    </div>
  </div>
</template>
