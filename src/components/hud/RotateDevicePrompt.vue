<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { checkIsMobileTouchDevice, requestFullscreenAndLandscape } from './mobile-device.utils'

export interface RotateDevicePromptProps {
  forceShow?: boolean
}

const props = withDefaults(defineProps<RotateDevicePromptProps>(), {
  forceShow: false,
})

const isMobile = ref(false)
const isPortrait = ref(false)

const shouldDisplay = computed(() => {
  if (props.forceShow) return true
  return isMobile.value && isPortrait.value
})

const updateOrientation = () => {
  if (typeof window === 'undefined') return
  isMobile.value = checkIsMobileTouchDevice()
  isPortrait.value = window.innerHeight > window.innerWidth
}

const handleDismissOrRotate = () => {
  requestFullscreenAndLandscape()
}

onMounted(() => {
  updateOrientation()
  window.addEventListener('resize', updateOrientation)
  window.addEventListener('orientationchange', updateOrientation)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateOrientation)
  window.removeEventListener('orientationchange', updateOrientation)
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
        <div class="relative flex items-center justify-center text-5xl animate-bounce">
          🔄
        </div>
      </div>

      <div class="font-heading font-black text-2xl uppercase tracking-wider text-white">
        Miringkan Layar Anda
      </div>

      <p class="font-sans text-sm text-neutral-300 font-medium max-w-xs mt-2 leading-relaxed">
        Bentengan dioptimalkan untuk tampilan mendatar (<span class="text-amber-400 font-bold">Landscape</span>). Silakan putar ponsel Anda untuk mulai bermain.
      </p>

      <div class="mt-6 flex items-center gap-2 text-xs font-mono font-bold text-neutral-500 bg-neutral-900 px-4 py-2 rounded-xl border border-neutral-800">
        <span>💡 Pastikan Kunci Rotasi (Auto-Rotate) aktif</span>
      </div>
    </div>
  </transition>
</template>

