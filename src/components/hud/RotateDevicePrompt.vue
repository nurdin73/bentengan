<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { RotateCcw, Lightbulb } from 'lucide-vue-next'
import { checkIsMobileTouchDevice, requestFullscreenAndLandscape } from './mobile-device.utils'
import { useGameStore } from '../../stores/game-store'

export interface RotateDevicePromptProps {
  forceShow?: boolean
  forceMobile?: boolean
}

const props = withDefaults(defineProps<RotateDevicePromptProps>(), {
  forceShow: false,
  forceMobile: false,
})

const emit = defineEmits<{
  (e: 'update:active', active: boolean): void
}>()

const gameStore = useGameStore()

const isMobile = ref(false)
const isPortrait = ref(false)

const shouldDisplay = computed(() => {
  if (props.forceShow) return true
  const effectiveMobile = isMobile.value || props.forceMobile
  return effectiveMobile && isPortrait.value
})

watch(
  shouldDisplay,
  (active) => {
    gameStore.setPaused(active)
    emit('update:active', active)
  },
  { immediate: true },
)

const updateOrientation = () => {
  if (typeof window === 'undefined') return
  isMobile.value = checkIsMobileTouchDevice()
  isPortrait.value = window.innerHeight > window.innerWidth
}

updateOrientation()

const handleDismissOrRotate = () => {
  requestFullscreenAndLandscape()
}

onMounted(() => {
  updateOrientation()
  window.addEventListener('resize', updateOrientation)
  window.addEventListener('orientationchange', updateOrientation)
  screen.orientation?.addEventListener?.('change', updateOrientation)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateOrientation)
  window.removeEventListener('orientationchange', updateOrientation)
  screen.orientation?.removeEventListener?.('change', updateOrientation)
  if (shouldDisplay.value) {
    gameStore.setPaused(false)
    emit('update:active', false)
  }
})
</script>

<template>
  <transition
    enter-active-class="transition duration-300 ease-out"
    enter-from-class="opacity-0 scale-95"
    enter-to-class="opacity-100 scale-100"
    leave-active-class="transition duration-200 ease-in"
    leave-from-class="opacity-100 scale-100"
    leave-to-class="opacity-0 scale-95"
  >
    <div
      v-if="shouldDisplay"
      data-testid="rotate-device-prompt"
      class="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 bg-neutral-950/95 backdrop-blur-lg text-center select-none pointer-events-auto"
      @click="handleDismissOrRotate"
    >
      <!-- Animated Phone Rotation Icon -->
      <div class="relative flex items-center justify-center w-28 h-28 mb-6">
        <div class="absolute inset-0 rounded-full bg-blue-500/20 animate-ping" />
        <div class="relative flex items-center justify-center animate-bounce">
          <RotateCcw class="w-14 h-14 text-blue-400" />
        </div>
      </div>

      <div class="font-heading font-black text-2xl uppercase tracking-wider text-white">
        Miringkan Layar Anda
      </div>

      <p class="font-sans text-sm text-neutral-300 font-medium max-w-xs mt-2 leading-relaxed">
        Bentengan dioptimalkan untuk tampilan mendatar (<span class="text-amber-400 font-bold"
          >Landscape</span
        >). Silakan putar ponsel Anda untuk mulai bermain.
      </p>

      <div
        class="mt-6 flex items-center gap-2 text-xs font-mono font-bold text-neutral-400 bg-neutral-900 px-4 py-2 rounded-xl border border-neutral-800"
      >
        <Lightbulb class="w-4 h-4 text-amber-400 shrink-0" />
        <span>Pastikan Kunci Rotasi (Auto-Rotate) aktif</span>
      </div>
    </div>
  </transition>
</template>
