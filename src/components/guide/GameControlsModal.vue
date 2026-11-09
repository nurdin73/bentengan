<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import {
  Gamepad2,
  X,
  Monitor,
  Smartphone,
  Move,
  Zap,
  ArrowUp,
  Eye,
  Maximize2,
  Navigation,
  HeartHandshake,
} from 'lucide-vue-next'

const emit = defineEmits<{
  (e: 'close'): void
}>()

const activeTab = ref<'desktop' | 'touch'>('desktop')

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    emit('close')
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<template>
  <div
    data-testid="game-controls-modal-backdrop"
    class="game-controls-modal-backdrop pointer-events-auto fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-sm"
    @click.self="emit('close')"
  >
    <div
      data-testid="game-controls-modal-card"
      class="game-controls-modal-card timbul-card w-full max-w-xl p-4 sm:p-7 flex flex-col gap-4 sm:gap-5 max-h-[92dvh] overflow-y-auto overscroll-contain relative shadow-2xl"
    >
      <!-- Close Button -->
      <button
        type="button"
        data-testid="controls-modal-close-btn"
        class="absolute top-4 right-4 sm:top-5 sm:right-5 w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 active:scale-95 text-neutral-600 font-black flex items-center justify-center transition-all cursor-pointer border border-neutral-300"
        @click="emit('close')"
      >
        <X class="w-4 h-4" />
      </button>

      <!-- Header -->
      <div class="flex items-center gap-2.5 pr-8 border-b border-neutral-200 pb-3">
        <div class="w-9 h-9 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700 shrink-0">
          <Gamepad2 class="w-5 h-5" />
        </div>
        <div>
          <h2 class="font-heading font-black text-lg sm:text-2xl text-neutral-900 uppercase tracking-wide leading-tight">
            Panduan Kontrol 3D
          </h2>
          <p class="font-sans text-xs text-neutral-500 font-bold">
            Navigasi Karakter di Arena Bentengan
          </p>
        </div>
      </div>

      <!-- Device Tab Switcher -->
      <div
        data-testid="controls-device-tabs"
        class="grid grid-cols-2 gap-1.5 p-1 bg-neutral-100 rounded-2xl border border-neutral-200"
      >
        <button
          type="button"
          data-testid="controls-tab-desktop"
          :class="[
            'py-2 px-3 rounded-xl font-heading font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer',
            activeTab === 'desktop'
              ? 'bg-white text-neutral-900 shadow-xs border border-neutral-200'
              : 'text-neutral-500 hover:text-neutral-700',
          ]"
          @click="activeTab = 'desktop'"
        >
          <Monitor class="w-3.5 h-3.5" />
          <span>Keyboard & Mouse</span>
        </button>

        <button
          type="button"
          data-testid="controls-tab-touch"
          :class="[
            'py-2 px-3 rounded-xl font-heading font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer',
            activeTab === 'touch'
              ? 'bg-white text-neutral-900 shadow-xs border border-neutral-200'
              : 'text-neutral-500 hover:text-neutral-700',
          ]"
          @click="activeTab = 'touch'"
        >
          <Smartphone class="w-3.5 h-3.5" />
          <span>Layar Sentuh (HP)</span>
        </button>
      </div>

      <!-- Desktop Controls Grid -->
      <div
        v-if="activeTab === 'desktop'"
        data-testid="controls-grid-desktop"
        class="grid grid-cols-1 sm:grid-cols-2 gap-3"
      >
        <div class="p-3.5 sm:p-4 rounded-2xl bg-neutral-50 border-2 border-neutral-200 flex flex-col items-center text-center gap-1.5 shadow-2xs">
          <span class="px-3 py-1 rounded-xl bg-white border border-neutral-300 font-mono font-black text-xs sm:text-sm text-neutral-800 shadow-2xs">
            W / A / S / D
          </span>
          <div class="flex items-center gap-1 text-neutral-800 font-sans text-xs font-black uppercase tracking-wider">
            <Move class="w-3.5 h-3.5 text-blue-600" />
            <span>Jalan & Menghindar</span>
          </div>
          <span class="font-sans text-[11px] text-neutral-500 font-medium">Maju, Kiri, Mundur, Kanan</span>
        </div>

        <div class="p-3.5 sm:p-4 rounded-2xl bg-neutral-50 border-2 border-neutral-200 flex flex-col items-center text-center gap-1.5 shadow-2xs">
          <span class="px-3 py-1 rounded-xl bg-white border border-neutral-300 font-mono font-black text-xs sm:text-sm text-neutral-800 shadow-2xs">
            SHIFT (Tahan)
          </span>
          <div class="flex items-center gap-1 text-neutral-800 font-sans text-xs font-black uppercase tracking-wider">
            <Zap class="w-3.5 h-3.5 text-amber-500" />
            <span>Lari Cepat / Sprint</span>
          </div>
          <span class="font-sans text-[11px] text-neutral-500 font-medium">Memakai tenaga stamina</span>
        </div>

        <div class="p-3.5 sm:p-4 rounded-2xl bg-neutral-50 border-2 border-neutral-200 flex flex-col items-center text-center gap-1.5 shadow-2xs">
          <span class="px-3 py-1 rounded-xl bg-white border border-neutral-300 font-mono font-black text-xs sm:text-sm text-neutral-800 shadow-2xs">
            SPACE
          </span>
          <div class="flex items-center gap-1 text-neutral-800 font-sans text-xs font-black uppercase tracking-wider">
            <ArrowUp class="w-3.5 h-3.5 text-emerald-600" />
            <span>Lompat</span>
          </div>
          <span class="font-sans text-[11px] text-neutral-500 font-medium">Melewati pagar & rintangan</span>
        </div>

        <div class="p-3.5 sm:p-4 rounded-2xl bg-neutral-50 border-2 border-neutral-200 flex flex-col items-center text-center gap-1.5 shadow-2xs">
          <span class="px-3 py-1 rounded-xl bg-white border border-neutral-300 font-mono font-black text-xs sm:text-sm text-neutral-800 shadow-2xs">
            MOUSE
          </span>
          <div class="flex items-center gap-1 text-neutral-800 font-sans text-xs font-black uppercase tracking-wider">
            <Eye class="w-3.5 h-3.5 text-indigo-600" />
            <span>Kamera & Pandangan</span>
          </div>
          <span class="font-sans text-[11px] text-neutral-500 font-medium">Arahkan sudut mata pandang</span>
        </div>

        <div class="col-span-1 sm:col-span-2 p-3.5 sm:p-4 rounded-2xl bg-neutral-50 border-2 border-neutral-200 flex flex-col items-center text-center gap-1.5 shadow-2xs">
          <span class="px-3 py-1 rounded-xl bg-white border border-neutral-300 font-mono font-black text-xs sm:text-sm text-neutral-800 shadow-2xs flex items-center gap-1.5">
            <HeartHandshake class="w-3.5 h-3.5 text-blue-600" />
            <span>E / Tempel Langsung</span>
          </span>
          <div class="flex items-center gap-1 text-neutral-800 font-sans text-xs font-black uppercase tracking-wider">
            <HeartHandshake class="w-3.5 h-3.5 text-blue-600" />
            <span>Bebaskan Rekan / Penyelamatan</span>
          </div>
          <span class="font-sans text-[11px] text-neutral-500 font-medium">Tekan tombol E atau tempel/dekati langsung rekan yang disandera di penjara</span>
        </div>
      </div>

      <!-- Touch / Mobile Controls Grid -->
      <div
        v-else
        data-testid="controls-grid-touch"
        class="grid grid-cols-1 sm:grid-cols-2 gap-3"
      >
        <div class="p-3.5 sm:p-4 rounded-2xl bg-neutral-50 border-2 border-neutral-200 flex flex-col items-center text-center gap-1.5 shadow-2xs">
          <span class="px-3 py-1 rounded-xl bg-white border border-neutral-300 font-mono font-black text-xs sm:text-sm text-neutral-800 shadow-2xs flex items-center gap-1.5">
            <Navigation class="w-3.5 h-3.5 text-blue-600" />
            <span>Analog Kiri</span>
          </span>
          <div class="flex items-center gap-1 text-neutral-800 font-sans text-xs font-black uppercase tracking-wider">
            <Move class="w-3.5 h-3.5 text-blue-600" />
            <span>Virtual Joystick</span>
          </div>
          <span class="font-sans text-[11px] text-neutral-500 font-medium">Sentuh & seret untuk berjalan 360°</span>
        </div>

        <div class="p-3.5 sm:p-4 rounded-2xl bg-neutral-50 border-2 border-neutral-200 flex flex-col items-center text-center gap-1.5 shadow-2xs">
          <span class="px-3 py-1 rounded-xl bg-white border border-neutral-300 font-mono font-black text-xs sm:text-sm text-neutral-800 shadow-2xs flex items-center gap-1.5">
            <Zap class="w-3.5 h-3.5 text-amber-500" />
            <span>Tombol Kilat</span>
          </span>
          <div class="flex items-center gap-1 text-neutral-800 font-sans text-xs font-black uppercase tracking-wider">
            <Zap class="w-3.5 h-3.5 text-amber-500" />
            <span>Sprint Sentuh</span>
          </div>
          <span class="font-sans text-[11px] text-neutral-500 font-medium">Tahan tombol untuk lari cepat</span>
        </div>

        <div class="p-3.5 sm:p-4 rounded-2xl bg-neutral-50 border-2 border-neutral-200 flex flex-col items-center text-center gap-1.5 shadow-2xs">
          <span class="px-3 py-1 rounded-xl bg-white border border-neutral-300 font-mono font-black text-xs sm:text-sm text-neutral-800 shadow-2xs flex items-center gap-1.5">
            <ArrowUp class="w-3.5 h-3.5 text-emerald-600" />
            <span>Tombol Panah Atas</span>
          </span>
          <div class="flex items-center gap-1 text-neutral-800 font-sans text-xs font-black uppercase tracking-wider">
            <ArrowUp class="w-3.5 h-3.5 text-emerald-600" />
            <span>Lompat Sentuh</span>
          </div>
          <span class="font-sans text-[11px] text-neutral-500 font-medium">Sentuh untuk melompati rintangan</span>
        </div>

        <div class="p-3.5 sm:p-4 rounded-2xl bg-neutral-50 border-2 border-neutral-200 flex flex-col items-center text-center gap-1.5 shadow-2xs">
          <span class="px-3 py-1 rounded-xl bg-white border border-neutral-300 font-mono font-black text-xs sm:text-sm text-neutral-800 shadow-2xs flex items-center gap-1.5">
            <Eye class="w-3.5 h-3.5 text-indigo-600" />
            <span>Area Layar Kanan</span>
          </span>
          <div class="flex items-center gap-1 text-neutral-800 font-sans text-xs font-black uppercase tracking-wider">
            <Eye class="w-3.5 h-3.5 text-indigo-600" />
            <span>Geser Sudut Pandang</span>
          </div>
          <span class="font-sans text-[11px] text-neutral-500 font-medium">Swipe layar kanan untuk rotasi kamera</span>
        </div>

        <div class="col-span-1 sm:col-span-2 p-3.5 sm:p-4 rounded-2xl bg-neutral-50 border-2 border-neutral-200 flex flex-col items-center text-center gap-1.5 shadow-2xs">
          <span class="px-3 py-1 rounded-xl bg-white border border-neutral-300 font-mono font-black text-xs sm:text-sm text-neutral-800 shadow-2xs flex items-center gap-1.5">
            <HeartHandshake class="w-3.5 h-3.5 text-blue-600" />
            <span>Tombol Bebaskan & Tempel</span>
          </span>
          <div class="flex items-center gap-1 text-neutral-800 font-sans text-xs font-black uppercase tracking-wider">
            <HeartHandshake class="w-3.5 h-3.5 text-blue-600" />
            <span>Penyelamatan Rekan</span>
          </div>
          <span class="font-sans text-[11px] text-neutral-500 font-medium">Sentuh tombol Bebaskan (🤝) atau tempelkan badan langsung ke rekan yang disandera</span>
        </div>

        <div class="col-span-1 sm:col-span-2 p-3 rounded-2xl bg-amber-50/80 border border-amber-200 flex items-center gap-2.5">
          <div class="w-7 h-7 rounded-lg bg-amber-200/80 flex items-center justify-center text-amber-800 shrink-0">
            <Maximize2 class="w-4 h-4" />
          </div>
          <p class="font-sans text-xs text-amber-900 font-medium">
            <span class="font-bold">Tips Mobile:</span> Putar perangkat ke posisi mendatar (Landscape) dan sentuh tombol Layar Penuh untuk visual permainan yang optimal.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@media (orientation: landscape) and (max-height: 520px) {
  .game-controls-modal-backdrop {
    padding: 0 !important;
  }

  .game-controls-modal-card {
    width: 100vw !important;
    height: 100vh !important;
    max-width: 100vw !important;
    max-height: 100vh !important;
    border-radius: 0 !important;
    border: none !important;
    box-shadow: none !important;
    padding: 1rem 1.5rem !important;
  }
}
</style>
