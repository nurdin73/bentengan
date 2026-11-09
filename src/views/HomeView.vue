<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  ScrollText,
  Gamepad2,
  Play,
  Shield,
  Swords,
  X,
  Menu,
  Heart,
} from 'lucide-vue-next'
import { useRoomStore } from '../stores/room-store'
import LobbyModeSelector from '../components/lobby/LobbyModeSelector.vue'
import GameRulesModal from '../components/guide/GameRulesModal.vue'
import GameControlsModal from '../components/guide/GameControlsModal.vue'
import ConfirmDialog from '../components/ui/ConfirmDialog.vue'
import TactileButton from '../components/ui/TactileButton.vue'
import IndonesiaFlag from '../components/ui/IndonesiaFlag.vue'
import type { TeamId } from '../types/game.types'

const router = useRouter()
const roomStore = useRoomStore()

const showRulesModal = ref(false)
const showControlsModal = ref(false)
const showPracticePicker = ref(false)
const isMobileMenuOpen = ref(false)

const handleCreateHost = async (payload: {
  username: string
  team: TeamId
  roomCode: string
  maxPlayers?: 8 | 12
}) => {
  roomStore.myUsername = payload.username
  await roomStore.createHostRoom(payload.roomCode, payload.team, payload.maxPlayers ?? 8)
  if (!roomStore.connectionError) {
    router.push(`/rooms/${payload.roomCode}`)
  }
}

const handleJoinRoom = (payload: { username: string; team: TeamId; roomCode: string }) => {
  roomStore.myUsername = payload.username
  router.push(`/rooms/${payload.roomCode}`)
}

const handleStartPractice = (team: TeamId) => {
  showPracticePicker.value = false
  router.push(`/practice?team=${team}`)
}

const openRulesFromDrawer = () => {
  isMobileMenuOpen.value = false
  showRulesModal.value = true
}

const openControlsFromDrawer = () => {
  isMobileMenuOpen.value = false
  showControlsModal.value = true
}

const openPracticeFromDrawer = () => {
  isMobileMenuOpen.value = false
  showPracticePicker.value = true
}
</script>

<template>
  <div
    data-testid="home-view"
    class="min-h-screen min-h-dvh w-full bg-[#f8f6f0] text-neutral-900 flex flex-col justify-between font-sans selection:bg-amber-200 overflow-y-auto relative"
  >
    <!-- Navbar (Sticky Top) -->
    <header class="sticky top-0 w-full border-b border-neutral-300/80 bg-white/85 backdrop-blur-md px-3.5 sm:px-8 py-2.5 sm:py-3.5 flex items-center justify-between z-30 shrink-0 transition-all">
      <div class="flex items-center gap-2 sm:gap-3">
        <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-neutral-900 border border-amber-500/40 p-0.5 flex items-center justify-center shrink-0 shadow-xs overflow-hidden">
          <img :src="'/icons/icon-192x192.png'" alt="Bentengan 3D Logo" class="w-full h-full object-cover rounded-xl" />
        </div>
        <div class="flex flex-col">
          <span class="font-heading font-black text-lg sm:text-xl text-neutral-900 tracking-wider uppercase leading-none">
            Bentengan <span class="text-amber-500">3D</span>
          </span>
          <span class="font-sans text-[9px] sm:text-[10px] text-neutral-500 font-bold uppercase tracking-wider hidden xs:inline">
            Game Tradisional Online
          </span>
        </div>
      </div>

      <!-- Desktop Nav Buttons (sm and up) -->
      <nav class="hidden sm:flex items-center gap-2 sm:gap-3 text-xs font-heading font-bold uppercase tracking-wider text-neutral-600">
        <button
          type="button"
          data-testid="navbar-rules-btn"
          class="px-3 py-1.5 rounded-xl hover:bg-neutral-100 text-neutral-700 transition-colors cursor-pointer flex items-center gap-1.5"
          @click="showRulesModal = true"
        >
          <ScrollText class="w-3.5 h-3.5 text-neutral-600" />
          <span>Aturan</span>
        </button>
        <button
          type="button"
          data-testid="navbar-controls-btn"
          class="px-3 py-1.5 rounded-xl hover:bg-neutral-100 text-neutral-700 transition-colors cursor-pointer flex items-center gap-1.5"
          @click="showControlsModal = true"
        >
          <Gamepad2 class="w-3.5 h-3.5 text-neutral-600" />
          <span>Kontrol</span>
        </button>
        <!-- Tombol Latihan Solo -->
        <button
          type="button"
          data-testid="navbar-practice-btn"
          class="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-amber-950 font-black transition-all cursor-pointer shadow-xs border border-amber-500 flex items-center gap-1.5"
          @click="showPracticePicker = true"
        >
          <Play class="w-3.5 h-3.5 text-amber-950 fill-amber-950" />
          <span>Latihan Sendiri</span>
        </button>
      </nav>

      <!-- Mobile Hamburger Button (< sm) -->
      <button
        type="button"
        data-testid="navbar-mobile-menu-btn"
        class="sm:hidden w-9 h-9 rounded-xl bg-neutral-100 hover:bg-neutral-200 active:scale-95 border border-neutral-300 text-neutral-800 flex items-center justify-center transition-all cursor-pointer"
        aria-label="Menu Navigasi"
        @click="isMobileMenuOpen = !isMobileMenuOpen"
      >
        <X v-if="isMobileMenuOpen" class="w-5 h-5 text-neutral-800" />
        <Menu v-else class="w-5 h-5 text-neutral-800" />
      </button>
    </header>

    <!-- Mobile Drawer Overlay Sheet -->
    <transition
      enter-active-class="transition-opacity duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isMobileMenuOpen"
        data-testid="navbar-mobile-drawer-backdrop"
        class="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs sm:hidden"
        @click="isMobileMenuOpen = false"
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
        v-if="isMobileMenuOpen"
        data-testid="navbar-mobile-drawer"
        class="fixed top-0 left-0 right-0 z-50 bg-[#fdfbf7] border-b-4 border-neutral-300 shadow-2xl p-4 sm:hidden flex flex-col gap-4 rounded-b-3xl"
      >
        <!-- Drawer Header -->
        <div class="flex items-center justify-between border-b border-neutral-200 pb-3">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-2xl bg-neutral-900 border border-amber-500/40 p-0.5 flex items-center justify-center shrink-0 shadow-xs overflow-hidden">
              <img :src="'/icons/icon-192x192.png'" alt="Bentengan 3D Logo" class="w-full h-full object-cover rounded-xl" />
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
            @click="isMobileMenuOpen = false"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <!-- Drawer Navigation Items -->
        <div class="flex flex-col gap-2.5">
          <!-- Item 1: Aturan Permainan -->
          <button
            type="button"
            data-testid="mobile-drawer-rules-btn"
            class="w-full p-3 rounded-2xl bg-white border border-neutral-200 hover:bg-neutral-50 flex items-center gap-3 text-left transition-all shadow-2xs active:scale-[0.99] cursor-pointer"
            @click="openRulesFromDrawer"
          >
            <div class="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <ScrollText class="w-5 h-5" />
            </div>
            <div class="flex flex-col flex-1">
              <span class="font-heading font-black text-sm text-neutral-900 uppercase">Aturan Permainan</span>
              <span class="font-sans text-[11px] text-neutral-500 font-medium">Pelajari aturan benteng & tangkap musuh</span>
            </div>
          </button>

          <!-- Item 2: Panduan Kontrol -->
          <button
            type="button"
            data-testid="mobile-drawer-controls-btn"
            class="w-full p-3 rounded-2xl bg-white border border-neutral-200 hover:bg-neutral-50 flex items-center gap-3 text-left transition-all shadow-2xs active:scale-[0.99] cursor-pointer"
            @click="openControlsFromDrawer"
          >
            <div class="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <Gamepad2 class="w-5 h-5" />
            </div>
            <div class="flex flex-col flex-1">
              <span class="font-heading font-black text-sm text-neutral-900 uppercase">Panduan Kontrol 3D</span>
              <span class="font-sans text-[11px] text-neutral-500 font-medium">Kontrol sentuh HP & keyboard</span>
            </div>
          </button>

          <!-- Item 3: Latihan Sendiri Solo -->
          <button
            type="button"
            data-testid="mobile-drawer-practice-btn"
            class="w-full p-3.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-amber-950 border border-amber-500 border-b-[4px] border-b-amber-600 flex items-center gap-3 text-left transition-all shadow-xs active:translate-y-[2px] active:border-b-[2px] cursor-pointer"
            @click="openPracticeFromDrawer"
          >
            <div class="w-9 h-9 rounded-xl bg-amber-500/30 text-amber-950 flex items-center justify-center shrink-0">
              <Play class="w-5 h-5 fill-amber-950" />
            </div>
            <div class="flex flex-col flex-1">
              <span class="font-heading font-black text-sm uppercase">Latihan Sendiri (Solo)</span>
              <span class="font-sans text-[11px] text-amber-900 font-bold">Uji taktik melawan bot sebelum mabar!</span>
            </div>
          </button>
        </div>
      </div>
    </transition>

    <!-- Hero Section (Center of Viewport) -->
    <main class="flex-1 flex flex-col items-center justify-center px-3.5 sm:px-4 py-4 sm:py-6 gap-4 sm:gap-6 max-w-4xl mx-auto w-full">
      <!-- Title & Headline -->
      <div class="text-center flex flex-col items-center gap-1.5 sm:gap-2">
        <div class="inline-flex items-center gap-2 px-3 py-0.5 bg-amber-100 border border-amber-300 rounded-full text-[10px] sm:text-[11px] font-heading font-black text-amber-900 uppercase tracking-widest shadow-2xs">
          <IndonesiaFlag class="w-3.5 h-2.5" />
          <span>Permainan Tradisional Indonesia 3D</span>
        </div>

        <h1 class="font-heading font-black text-2xl xs:text-3xl sm:text-5xl text-neutral-950 tracking-tight uppercase leading-[1.15] sm:leading-[1.1]">
          Pertahankan Benteng, <span class="text-amber-500">Taklukkan</span> Lawanmu!
        </h1>

        <p class="font-sans text-xs sm:text-sm text-neutral-600 font-medium max-w-md leading-relaxed px-1">
          Main bareng teman langsung dari browser HP & laptop! Nggak perlu install aplikasi — cukup buat ruangan, bagikan tautan, dan adu strategi!
        </p>
      </div>

      <!-- Action Mode Selector -->
      <LobbyModeSelector
        class="w-full max-w-xl sm:max-w-2xl"
        :initial-username="roomStore.myUsername"
        :initial-team="roomStore.myTeam"
        :is-connecting="roomStore.isConnecting"
        :connection-error="roomStore.connectionError"
        @create-host="handleCreateHost"
        @join-room="handleJoinRoom"
      />
    </main>

    <!-- Footer -->
    <footer class="w-full border-t border-neutral-300/80 bg-white/70 py-2 sm:py-2.5 px-3 sm:px-4 text-center flex flex-col items-center gap-0.5 sm:gap-1 z-10 shrink-0">
      <div class="flex items-center justify-center gap-1.5 font-heading font-black text-[10px] sm:text-[11px] uppercase tracking-wider text-neutral-600">
        <span>Dibuat dengan</span>
        <Heart class="w-3 h-3 text-rose-500 fill-rose-500 shrink-0" />
        <span>untuk Melestarikan Permainan Tradisional Indonesia</span>
      </div>
      <span class="font-sans text-[9px] sm:text-[10px] text-neutral-400 font-medium">
        &copy; 2026 Bentengan 3D &bull; Main Gratis Langsung di Browser
      </span>
    </footer>

    <!-- Dedicated Modal 1: Aturan Permainan -->
    <GameRulesModal
      v-if="showRulesModal"
      @close="showRulesModal = false"
    />

    <!-- Dedicated Modal 2: Panduan Kontrol -->
    <GameControlsModal
      v-if="showControlsModal"
      @close="showControlsModal = false"
    />

    <!-- Dialog: Pilih Tim Latihan Solo -->
    <ConfirmDialog
      v-if="showPracticePicker"
      data-testid="practice-picker-dialog"
      title="Pilih Tim Latihan"
      message="Uji kelincahan dan taktikmu melawan bot sebelum mabar!"
      type="confirm"
      @close="showPracticePicker = false"
    >
      <template #icon>
        <div class="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700 shadow-2xs">
          <Play class="w-6 h-6 fill-amber-700" />
        </div>
      </template>

      <template #actions>
        <div class="grid grid-cols-2 gap-2.5 w-full pt-1">
          <TactileButton
            variant="blue"
            data-testid="practice-pick-blue-btn"
            class="w-full text-xs py-2.5 sm:py-3 flex items-center justify-center gap-1.5"
            @click="handleStartPractice('blue')"
          >
            <Shield class="w-3.5 h-3.5 shrink-0" />
            <span>Benteng Biru</span>
          </TactileButton>

          <TactileButton
            variant="red"
            data-testid="practice-pick-red-btn"
            class="w-full text-xs py-2.5 sm:py-3 flex items-center justify-center gap-1.5"
            @click="handleStartPractice('red')"
          >
            <Swords class="w-3.5 h-3.5 shrink-0" />
            <span>Benteng Merah</span>
          </TactileButton>
        </div>
      </template>
    </ConfirmDialog>
  </div>
</template>
