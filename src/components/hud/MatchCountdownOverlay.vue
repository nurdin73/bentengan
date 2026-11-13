<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { uiSound } from '../../game/audio/ui-sound'

const emit = defineEmits<{
  (e: 'started'): void
  (e: 'finished'): void
}>()

const currentCount = ref<number | 'MULAI!'> (3)
const isVisible = ref(true)
let timer: ReturnType<typeof setTimeout> | null = null

onMounted(() => {
  uiSound.playCountdownTick()

  timer = setTimeout(() => {
    currentCount.value = 2
    uiSound.playCountdownTick()

    timer = setTimeout(() => {
      currentCount.value = 1
      uiSound.playCountdownTick()

      timer = setTimeout(() => {
        currentCount.value = 'MULAI!'
        uiSound.playWhistleStart()
        emit('started')

        timer = setTimeout(() => {
          isVisible.value = false
          emit('finished')
        }, 350)
      }, 850)
    }, 850)
  }, 850)
})

onUnmounted(() => {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
})
</script>

<template>
  <div
    v-if="isVisible"
    data-testid="match-countdown-overlay"
    class="pointer-events-none fixed inset-0 z-40 flex items-center justify-center select-none transition-colors duration-200"
    :class="currentCount !== 'MULAI!' ? 'bg-black/40 backdrop-blur-[2px]' : 'bg-transparent'"
  >
    <div
      :key="String(currentCount)"
      data-testid="countdown-number"
      class="flex flex-col items-center justify-center font-heading font-black text-6xl sm:text-8xl drop-shadow-[0_8px_20px_rgba(0,0,0,0.9)]"
      :class="currentCount === 'MULAI!' ? 'animate-mula-pop text-emerald-400 scale-110' : 'animate-ping-once text-amber-400'"
    >
      <span
        class="bg-gradient-to-b from-white via-neutral-100 to-amber-300 bg-clip-text text-transparent px-6 py-1 tracking-wider"
      >
        {{ currentCount }}
      </span>
      <span
        v-if="currentCount !== 'MULAI!'"
        class="text-xs sm:text-sm font-bold tracking-widest text-neutral-200 uppercase mt-1 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]"
      >
        Bersiap!
      </span>
    </div>
  </div>
</template>

<style scoped>
@keyframes pingOnce {
  0% {
    transform: scale(0.6);
    opacity: 0;
  }
  40% {
    transform: scale(1.15);
    opacity: 1;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes mulaPop {
  0% {
    transform: scale(0.95);
    opacity: 1;
  }
  50% {
    transform: scale(1.15);
    opacity: 0.9;
  }
  100% {
    transform: scale(1.35);
    opacity: 0;
  }
}

.animate-ping-once {
  animation: pingOnce 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
}

.animate-mula-pop {
  animation: mulaPop 0.35s ease-out forwards;
}
</style>
