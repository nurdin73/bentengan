<script setup lang="ts">
import { ScrollText, Gamepad2, Play, Settings, Shirt, X } from 'lucide-vue-next'

defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'open-rules'): void
  (e: 'open-controls'): void
  (e: 'open-character'): void
  (e: 'open-settings'): void
  (e: 'open-practice'): void
}>()
</script>

<template>
  <transition
    enter-active-class="transition-opacity duration-200 ease-out"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition-opacity duration-150 ease-in"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      v-if="isOpen"
      data-testid="navbar-mobile-drawer-backdrop"
      class="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs sm:hidden"
      @click="emit('close')"
    />
  </transition>

  <transition
    enter-active-class="transition duration-250 ease-out transform"
    enter-from-class="-translate-y-full opacity-0"
    enter-to-class="translate-y-0 opacity-100"
    leave-active-class="transition duration-200 ease-in transform"
    leave-from-class="translate-y-0 opacity-100"
    leave-to-class="-translate-y-full opacity-0"
  >
    <div
      v-if="isOpen"
      data-testid="navbar-mobile-drawer"
      class="fixed top-0 left-0 right-0 z-50 bg-[#fdfbf7] border-b-4 border-neutral-300 shadow-2xl p-4 sm:hidden flex flex-col gap-4 rounded-b-3xl"
    >
      <div class="flex items-center justify-between border-b border-neutral-200 pb-3">
        <div class="flex items-center gap-2.5">
          <div
            class="w-9 h-9 rounded-2xl bg-neutral-900 border border-amber-500/40 p-0.5 flex items-center justify-center shrink-0 shadow-xs overflow-hidden"
          >
            <img
              :src="'/icons/icon-192x192.png'"
              alt="Bentengan 3D Logo"
              class="w-full h-full object-cover rounded-xl"
            />
          </div>
          <div class="flex flex-col">
            <span class="font-heading font-black text-lg text-neutral-900 uppercase leading-none">
              Bentengan <span class="text-amber-500">3D</span>
            </span>
            <span class="font-sans text-[10px] text-neutral-500 font-bold uppercase tracking-wider">
              Menu Utama
            </span>
          </div>
        </div>
        <button
          type="button"
          data-testid="mobile-drawer-close-btn"
          class="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 active:scale-95 text-neutral-600 flex items-center justify-center border border-neutral-300 cursor-pointer"
          @click="emit('close')"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <div class="flex flex-col gap-2.5">
        <button
          type="button"
          data-testid="mobile-drawer-rules-btn"
          class="w-full p-3 rounded-2xl bg-white border border-neutral-200 hover:bg-neutral-50 flex items-center gap-3 text-left transition-all shadow-2xs active:scale-[0.99] cursor-pointer"
          @click="emit('open-rules')"
        >
          <div
            class="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0"
          >
            <ScrollText class="w-5 h-5" />
          </div>
          <div class="flex flex-col flex-1">
            <span class="font-heading font-black text-sm text-neutral-900 uppercase"
              >Aturan Permainan</span
            >
            <span class="font-sans text-[11px] text-neutral-500 font-medium"
              >Pelajari aturan benteng &amp; tangkap musuh</span
            >
          </div>
        </button>

        <button
          type="button"
          data-testid="mobile-drawer-controls-btn"
          class="w-full p-3 rounded-2xl bg-white border border-neutral-200 hover:bg-neutral-50 flex items-center gap-3 text-left transition-all shadow-2xs active:scale-[0.99] cursor-pointer"
          @click="emit('open-controls')"
        >
          <div
            class="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0"
          >
            <Gamepad2 class="w-5 h-5" />
          </div>
          <div class="flex flex-col flex-1">
            <span class="font-heading font-black text-sm text-neutral-900 uppercase"
              >Panduan Kontrol 3D</span
            >
            <span class="font-sans text-[11px] text-neutral-500 font-medium"
              >Kontrol sentuh HP &amp; keyboard</span
            >
          </div>
        </button>

        <button
          type="button"
          data-testid="mobile-drawer-character-btn"
          class="w-full p-3 rounded-2xl bg-white border border-neutral-200 hover:bg-neutral-50 flex items-center gap-3 text-left transition-all shadow-2xs active:scale-[0.99] cursor-pointer"
          @click="emit('open-character')"
        >
          <div
            class="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0"
          >
            <Shirt class="w-5 h-5" />
          </div>
          <div class="flex flex-col flex-1">
            <span class="font-heading font-black text-sm text-neutral-900 uppercase"
              >Lemari Karakter</span
            >
            <span class="font-sans text-[11px] text-neutral-500 font-medium"
              >Ganti busana &amp; setelan 3D</span
            >
          </div>
        </button>

        <button
          type="button"
          data-testid="mobile-drawer-settings-btn"
          class="w-full p-3 rounded-2xl bg-white border border-neutral-200 hover:bg-neutral-50 flex items-center gap-3 text-left transition-all shadow-2xs active:scale-[0.99] cursor-pointer"
          @click="emit('open-settings')"
        >
          <div
            class="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0"
          >
            <Settings class="w-5 h-5" />
          </div>
          <div class="flex flex-col flex-1">
            <span class="font-heading font-black text-sm text-neutral-900 uppercase"
              >Pengaturan Game</span
            >
            <span class="font-sans text-[11px] text-neutral-500 font-medium"
              >Sensitivitas kamera, suara &amp; grafis</span
            >
          </div>
        </button>

        <button
          type="button"
          data-testid="mobile-drawer-practice-btn"
          class="w-full p-3.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-amber-950 border border-amber-500 border-b-[4px] border-b-amber-600 flex items-center gap-3 text-left transition-all shadow-xs active:translate-y-[2px] active:border-b-[2px] cursor-pointer"
          @click="emit('open-practice')"
        >
          <div
            class="w-9 h-9 rounded-xl bg-amber-500/30 text-amber-950 flex items-center justify-center shrink-0"
          >
            <Play class="w-5 h-5 fill-amber-950" />
          </div>
          <div class="flex flex-col flex-1">
            <span class="font-heading font-black text-sm uppercase">Latihan Sendiri (Solo)</span>
            <span class="font-sans text-[11px] text-amber-900 font-bold"
              >Uji taktik melawan bot sebelum mabar!</span
            >
          </div>
        </button>
      </div>
    </div>
  </transition>
</template>

