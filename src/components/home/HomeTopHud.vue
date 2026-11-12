<script setup lang="ts">
import { ScrollText, Gamepad2, Settings, Shirt, Menu, X } from 'lucide-vue-next'

defineProps<{
  isMobileMenuOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'open-rules'): void
  (e: 'open-controls'): void
  (e: 'open-character'): void
  (e: 'open-settings'): void
  (e: 'toggle-mobile-menu'): void
}>()
</script>

<template>
  <header
    data-testid="home-top-hud"
    class="sticky top-0 w-full px-3.5 sm:px-8 py-3 sm:py-4 flex items-center justify-between z-30 shrink-0"
  >
    <!-- Left: Game Emblem -->
    <div class="flex items-center">
      <img
        :src="'/icons/bentengan-wordmark.png'"
        alt="Bentengan 3D"
        data-testid="home-wordmark-logo"
        class="h-10 sm:h-12 md:h-14 w-auto object-contain drop-shadow-md select-none"
      />
    </div>

    <!-- Desktop Nav Pills (sm and up) -->
    <nav
      class="hidden sm:flex items-center gap-2 text-xs font-heading font-black uppercase tracking-wider"
    >
      <button
        type="button"
        data-testid="navbar-rules-btn"
        class="px-3.5 py-2 rounded-2xl bg-white/90 hover:bg-white text-neutral-800 border border-white border-b-[3px] border-b-sky-200/90 shadow-md transition-all cursor-pointer active:translate-y-[1px] active:border-b-[2px] flex items-center gap-1.5"
        @click="emit('open-rules')"
      >
        <ScrollText class="w-3.5 h-3.5 text-sky-600" />
        <span>Aturan</span>
      </button>

      <button
        type="button"
        data-testid="navbar-controls-btn"
        class="px-3.5 py-2 rounded-2xl bg-white/90 hover:bg-white text-neutral-800 border border-white border-b-[3px] border-b-sky-200/90 shadow-md transition-all cursor-pointer active:translate-y-[1px] active:border-b-[2px] flex items-center gap-1.5"
        @click="emit('open-controls')"
      >
        <Gamepad2 class="w-3.5 h-3.5 text-emerald-600" />
        <span>Kontrol</span>
      </button>

      <button
        type="button"
        data-testid="navbar-character-btn"
        class="px-3.5 py-2 rounded-2xl bg-white/90 hover:bg-white text-neutral-800 border border-white border-b-[3px] border-b-sky-200/90 shadow-md transition-all cursor-pointer active:translate-y-[1px] active:border-b-[2px] flex items-center gap-1.5"
        @click="emit('open-character')"
      >
        <Shirt class="w-3.5 h-3.5 text-purple-600" />
        <span>Karakter</span>
      </button>

      <button
        type="button"
        data-testid="navbar-settings-btn"
        class="px-3.5 py-2 rounded-2xl bg-white/90 hover:bg-white text-neutral-800 border border-white border-b-[3px] border-b-sky-200/90 shadow-md transition-all cursor-pointer active:translate-y-[1px] active:border-b-[2px] flex items-center gap-1.5"
        @click="emit('open-settings')"
      >
        <Settings class="w-3.5 h-3.5 text-amber-600" />
        <span>Pengaturan</span>
      </button>
    </nav>

    <!-- Mobile Hamburger Button (< sm) -->
    <button
      type="button"
      data-testid="navbar-mobile-menu-btn"
      class="sm:hidden w-10 h-10 rounded-2xl bg-white/90 hover:bg-white active:scale-95 border border-white border-b-[3px] border-b-sky-200 text-neutral-800 flex items-center justify-center shadow-md transition-all cursor-pointer"
      aria-label="Menu Navigasi"
      @click="emit('toggle-mobile-menu')"
    >
      <X v-if="isMobileMenuOpen" class="w-5 h-5 text-neutral-800" />
      <Menu v-else class="w-5 h-5 text-neutral-800" />
    </button>
  </header>
</template>

