<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useRoomStore } from '../stores/room-store'
import LobbyModeSelector from '../components/lobby/LobbyModeSelector.vue'
import GameRulesModal from '../components/guide/GameRulesModal.vue'
import GameControlsModal from '../components/guide/GameControlsModal.vue'
import TactileButton from '../components/ui/TactileButton.vue'
import type { TeamId } from '../types/game.types'

const router = useRouter()
const roomStore = useRoomStore()

const showRulesModal = ref(false)
const showControlsModal = ref(false)
const showPracticePicker = ref(false)

const handleCreateHost = async (payload: { username: string; team: TeamId; roomCode: string }) => {
  roomStore.myUsername = payload.username
  await roomStore.createHostRoom(payload.roomCode, payload.team)
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
</script>

<template>
  <div data-testid="home-view" class="h-screen w-full bg-[#f8f6f0] text-neutral-900 flex flex-col justify-between font-sans selection:bg-amber-200 overflow-hidden relative">
    <!-- Navbar -->
    <header class="w-full border-b border-neutral-300/80 bg-white/80 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between z-30">
      <div class="flex items-center gap-3">
        <span class="text-2xl">🏰</span>
        <div class="flex flex-col">
          <span class="font-heading font-black text-xl text-neutral-900 tracking-wider uppercase leading-none">
            Bentengan <span class="text-amber-500">3D</span>
          </span>
          <span class="font-sans text-[10px] text-neutral-500 font-bold uppercase tracking-wider">
            Game Tradisional Online
          </span>
        </div>
      </div>

      <nav class="flex items-center gap-2 sm:gap-3 text-xs font-heading font-bold uppercase tracking-wider text-neutral-600">
        <button
          type="button"
          data-testid="navbar-rules-btn"
          class="px-3 py-1.5 rounded-xl hover:bg-neutral-100 text-neutral-700 transition-colors cursor-pointer"
          @click="showRulesModal = true"
        >
          📜 Aturan
        </button>
        <button
          type="button"
          data-testid="navbar-controls-btn"
          class="px-3 py-1.5 rounded-xl hover:bg-neutral-100 text-neutral-700 transition-colors cursor-pointer"
          @click="showControlsModal = true"
        >
          🎮 Kontrol
        </button>
        <!-- Satu-satunya Tombol Latihan Solo di Seluruh Tampilan -->
        <button
          type="button"
          data-testid="navbar-practice-btn"
          class="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-amber-950 font-black transition-all cursor-pointer shadow-xs border border-amber-500"
          @click="showPracticePicker = true"
        >
          🎮 Latihan Sendiri
        </button>
      </nav>
    </header>

    <!-- Hero Section (Center of Viewport) -->
    <main class="flex-1 flex flex-col items-center justify-center px-4 py-4 gap-6 max-w-4xl mx-auto w-full">
      <!-- Title & Headline -->
      <div class="text-center flex flex-col items-center gap-2">
        <div class="inline-flex items-center gap-2 px-3 py-0.5 bg-amber-100 border border-amber-300 rounded-full text-[11px] font-heading font-black text-amber-900 uppercase tracking-widest shadow-2xs">
          <span>🇮🇩</span>
          <span>Permainan Tradisional Indonesia dalam 3D</span>
        </div>

        <h1 class="font-heading font-black text-3xl sm:text-5xl text-neutral-950 tracking-tight uppercase leading-[1.1]">
          Pertahankan Benteng, <span class="text-amber-500">Taklukkan</span> Lawanmu!
        </h1>

        <p class="font-sans text-xs sm:text-sm text-neutral-600 font-medium max-w-md leading-relaxed">
          Main bareng teman langsung dari browser! Nggak perlu download atau login — cukup buat ruangan, bagikan tautan, dan adu strategi!
        </p>
      </div>

      <!-- Action Mode Selector (Standalone Wide Panel matching User Mockup) -->
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
    <footer class="w-full border-t border-neutral-300/80 bg-white/70 py-3 px-4 text-center flex flex-col items-center gap-1 z-10">
      <span class="font-heading font-black text-[11px] uppercase tracking-wider text-neutral-600">
        Bentengan 3D &bull; Pelestarian Budaya Permainan Tradisional Indonesia
      </span>
      <span class="font-sans text-[10px] text-neutral-400 font-medium">
        Ayo lestarikan serunya permainan tradisional Indonesia dalam dunia 3D modern!
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

    <!-- Popover: Pilih Tim Latihan Solo -->
    <div
      v-if="showPracticePicker"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
      @click.self="showPracticePicker = false"
    >
      <div class="timbul-card w-full max-w-sm p-6 flex flex-col items-center gap-4 shadow-2xl relative">
        <button
          type="button"
          class="absolute top-4 right-4 text-neutral-400 hover:text-neutral-700 font-black text-sm cursor-pointer"
          @click="showPracticePicker = false"
        >
          ✕
        </button>

        <div class="text-center">
          <span class="text-2xl">🎮</span>
          <h3 class="font-heading font-black text-lg text-neutral-900 uppercase">
            Pilih Tim Latihan
          </h3>
          <p class="font-sans text-xs text-neutral-500 font-medium">
            Uji kelincahan dan taktikmu melawan bot sebelum mabar!
          </p>
        </div>

        <div class="grid grid-cols-2 gap-3 w-full pt-1">
          <TactileButton
            variant="blue"
            class="w-full text-xs py-2.5"
            @click="handleStartPractice('blue')"
          >
            🔵 Benteng Biru
          </TactileButton>

          <TactileButton
            variant="red"
            class="w-full text-xs py-2.5"
            @click="handleStartPractice('red')"
          >
            🔴 Benteng Merah
          </TactileButton>
        </div>
      </div>
    </div>
  </div>
</template>
