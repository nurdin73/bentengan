<script setup lang="ts">
const emit = defineEmits<{
  (e: 'close'): void
}>()
</script>

<template>
  <div
    data-testid="game-controls-modal-backdrop"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
    @click.self="emit('close')"
  >
    <div
      data-testid="game-controls-modal-card"
      class="timbul-card w-full max-w-xl p-6 sm:p-7 flex flex-col gap-5 max-h-[90vh] overflow-y-auto relative shadow-2xl"
    >
      <!-- Close Button -->
      <button
        type="button"
        data-testid="controls-modal-close-btn"
        class="absolute top-5 right-5 w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 active:scale-95 text-neutral-600 font-black flex items-center justify-center transition-all cursor-pointer border border-neutral-300"
        @click="emit('close')"
      >
        ✕
      </button>

      <!-- Header -->
      <div class="flex items-center gap-2 pr-8 border-b border-neutral-200 pb-3">
        <span class="text-2xl">🎮</span>
        <div>
          <h2 class="font-heading font-black text-xl sm:text-2xl text-neutral-900 uppercase tracking-wide">
            Panduan Kontrol 3D
          </h2>
          <p class="font-sans text-xs text-neutral-500 font-bold">
            Navigasi Karakter di Arena Bentengan
          </p>
        </div>
      </div>

      <!-- 4 Tactile Control Cards -->
      <div class="grid grid-cols-2 gap-3.5">
        <div class="p-4 rounded-2xl bg-neutral-50 border-2 border-neutral-200 flex flex-col items-center text-center gap-1.5 shadow-2xs">
          <span class="px-3.5 py-1.5 rounded-xl bg-white border border-neutral-300 font-mono font-black text-sm text-neutral-800 shadow-2xs">
            W / A / S / D
          </span>
          <span class="font-sans text-xs font-black text-neutral-800 uppercase tracking-wider">Jalan & Menghindar</span>
          <span class="font-sans text-[11px] text-neutral-500 font-medium">Maju, Kiri, Mundur, Kanan</span>
        </div>

        <div class="p-4 rounded-2xl bg-neutral-50 border-2 border-neutral-200 flex flex-col items-center text-center gap-1.5 shadow-2xs">
          <span class="px-3.5 py-1.5 rounded-xl bg-white border border-neutral-300 font-mono font-black text-sm text-neutral-800 shadow-2xs">
            SHIFT (Tahan)
          </span>
          <span class="font-sans text-xs font-black text-neutral-800 uppercase tracking-wider">Lari Cepat / Sprint</span>
          <span class="font-sans text-[11px] text-neutral-500 font-medium">Memakai tenaga stamina</span>
        </div>

        <div class="p-4 rounded-2xl bg-neutral-50 border-2 border-neutral-200 flex flex-col items-center text-center gap-1.5 shadow-2xs">
          <span class="px-3.5 py-1.5 rounded-xl bg-white border border-neutral-300 font-mono font-black text-sm text-neutral-800 shadow-2xs">
            SPACE
          </span>
          <span class="font-sans text-xs font-black text-neutral-800 uppercase tracking-wider">Lompat</span>
          <span class="font-sans text-[11px] text-neutral-500 font-medium">Melewati pagar & rintangan</span>
        </div>

        <div class="p-4 rounded-2xl bg-neutral-50 border-2 border-neutral-200 flex flex-col items-center text-center gap-1.5 shadow-2xs">
          <span class="px-3.5 py-1.5 rounded-xl bg-white border border-neutral-300 font-mono font-black text-sm text-neutral-800 shadow-2xs">
            MOUSE
          </span>
          <span class="font-sans text-xs font-black text-neutral-800 uppercase tracking-wider">Kamera & Pandangan</span>
          <span class="font-sans text-[11px] text-neutral-500 font-medium">Arahkan sudut mata pandang</span>
        </div>
      </div>
    </div>
  </div>
</template>

