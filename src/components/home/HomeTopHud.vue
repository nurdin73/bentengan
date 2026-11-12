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

const navBtnClass =
  'px-3.5 py-2 rounded-2xl bg-sky-950/35 hover:bg-sky-950/50 backdrop-blur-md text-white border border-white/45 border-b-[4px] border-b-white/80 shadow-md transition-all cursor-pointer active:translate-y-[2px] active:border-b-[2px] flex items-center gap-1.5'
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
        :class="navBtnClass"
        @click="emit('open-rules')"
      >
        <ScrollText class="w-3.5 h-3.5 text-amber-200" />
        <span>Aturan</span>
      </button>

      <button
        type="button"
        data-testid="navbar-controls-btn"
        :class="navBtnClass"
        @click="emit('open-controls')"
      >
        <Gamepad2 class="w-3.5 h-3.5 text-emerald-200" />
        <span>Kontrol</span>
      </button>

      <button
        type="button"
        data-testid="navbar-character-btn"
        :class="navBtnClass"
        @click="emit('open-character')"
      >
        <Shirt class="w-3.5 h-3.5 text-purple-200" />
        <span>Karakter</span>
      </button>

      <button
        type="button"
        data-testid="navbar-settings-btn"
        :class="navBtnClass"
        @click="emit('open-settings')"
      >
        <Settings class="w-3.5 h-3.5 text-amber-200" />
        <span>Pengaturan</span>
      </button>
    </nav>

    <!-- Mobile Hamburger Button (< sm) -->
    <button
      type="button"
      data-testid="navbar-mobile-menu-btn"
      class="sm:hidden w-10 h-10 rounded-2xl bg-sky-950/35 hover:bg-sky-950/50 backdrop-blur-md active:translate-y-[2px] active:border-b-[2px] border border-white/45 border-b-[4px] border-b-white/80 text-white flex items-center justify-center shadow-md transition-all cursor-pointer"
      aria-label="Menu Navigasi"
      @click="emit('toggle-mobile-menu')"
    >
      <X v-if="isMobileMenuOpen" class="w-5 h-5 text-white" />
      <Menu v-else class="w-5 h-5 text-white" />
    </button>
  </header>
</template>

