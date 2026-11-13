<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Play, Shield, Swords } from 'lucide-vue-next'
import { useRoomStore } from '../stores/room-store'
import { useSettingsStore } from '../stores/settings-store'
import { useHomeBgm } from '../components/home/use-home-bgm'
import HomeTopHud from '../components/home/HomeTopHud.vue'
import HomeMobileDrawer from '../components/home/HomeMobileDrawer.vue'
import HomeCharacterStage from '../components/home/HomeCharacterStage.vue'
import LobbyModeSelector from '../components/lobby/LobbyModeSelector.vue'
import GameRulesModal from '../components/guide/GameRulesModal.vue'
import GameControlsModal from '../components/guide/GameControlsModal.vue'
import SettingsModal from '../components/settings/SettingsModal.vue'
import CharacterPickerModal from '../components/wardrobe/CharacterPickerModal.vue'
import ConfirmDialog from '../components/ui/ConfirmDialog.vue'
import TactileButton from '../components/ui/TactileButton.vue'
import type { TeamId } from '../types/game.types'

const router = useRouter()
const roomStore = useRoomStore()
const settingsStore = useSettingsStore()

useHomeBgm()

const showRulesModal = ref(false)
const showControlsModal = ref(false)
const showSettingsModal = ref(false)
const showCharacterModal = ref(false)
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

const openModalFromDrawer = (target: 'rules' | 'controls' | 'character' | 'settings' | 'practice') => {
  isMobileMenuOpen.value = false
  if (target === 'rules') showRulesModal.value = true
  else if (target === 'controls') showControlsModal.value = true
  else if (target === 'character') showCharacterModal.value = true
  else if (target === 'settings') showSettingsModal.value = true
  else showPracticePicker.value = true
}
</script>

<template>
  <div
    data-testid="home-view"
    class="min-h-screen min-h-dvh w-full bg-gradient-to-b from-[#38bdf8] via-[#0ea5e9] to-[#0284c7] text-neutral-900 flex flex-col justify-between font-sans selection:bg-amber-200 overflow-y-auto relative"
  >
    <!-- Atmospheric Arena Backdrop Accents -->
    <div class="pointer-events-none fixed inset-0 overflow-hidden z-0">
      <div
        class="absolute -top-24 left-1/4 w-[520px] h-[520px] rounded-full bg-white/20 blur-3xl"
      />
      <div
        class="absolute top-1/3 -right-24 w-96 h-96 rounded-full bg-cyan-200/20 blur-3xl"
      />
      <!-- Subtle Bentengan Turf Horizon -->
      <div
        class="absolute bottom-0 inset-x-0 h-24 sm:h-28 bg-gradient-to-t from-emerald-700/35 via-emerald-500/15 to-transparent"
      />
    </div>

    <!-- Top Game HUD -->
    <HomeTopHud
      :is-mobile-menu-open="isMobileMenuOpen"
      :is-muted="settingsStore.isMuted"
      @open-rules="showRulesModal = true"
      @open-controls="showControlsModal = true"
      @open-character="showCharacterModal = true"
      @open-settings="showSettingsModal = true"
      @toggle-mobile-menu="isMobileMenuOpen = !isMobileMenuOpen"
      @toggle-mute="settingsStore.toggleMute()"
    />

    <!-- Mobile Navigation Drawer -->
    <HomeMobileDrawer
      :is-open="isMobileMenuOpen"
      @close="isMobileMenuOpen = false"
      @open-rules="openModalFromDrawer('rules')"
      @open-controls="openModalFromDrawer('controls')"
      @open-character="openModalFromDrawer('character')"
      @open-settings="openModalFromDrawer('settings')"
      @open-practice="openModalFromDrawer('practice')"
    />

    <!-- Main 2-Column Game Lobby Stage -->
    <main
      class="relative z-10 flex-1 flex items-center justify-center px-4 sm:px-8 lg:px-12 py-2 sm:py-4 max-w-7xl mx-auto w-full"
    >
      <div class="w-full grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8 items-center">
        <!-- Left: Live 3D Character Stage -->
        <div class="lg:col-span-6 flex flex-col items-center justify-center">
          <HomeCharacterStage
            :outfit-id="roomStore.myOutfitId"
            :team-id="roomStore.myTeam"
            :paused="showCharacterModal"
            @open-wardrobe="showCharacterModal = true"
          />
        </div>

        <!-- Right: Play Hub Card -->
        <div class="lg:col-span-6 flex flex-col items-center lg:items-end justify-center w-full">
          <LobbyModeSelector
            class="w-full max-w-xl"
            :initial-username="roomStore.myUsername"
            :initial-team="roomStore.myTeam"
            :is-connecting="roomStore.isConnecting"
            :connection-error="roomStore.connectionError"
            @create-host="handleCreateHost"
            @join-room="handleJoinRoom"
          >
            <template #footer-action>
              <button
                type="button"
                data-testid="home-practice-btn"
                class="timbul-btn w-full py-3 px-4 bg-amber-400 hover:bg-amber-300 text-amber-950 border-amber-500 border-b-[5px] border-b-amber-600 text-xs sm:text-sm font-black rounded-2xl flex items-center justify-center gap-2 cursor-pointer"
                @click="showPracticePicker = true"
              >
                <Play class="w-4 h-4 fill-amber-950 shrink-0" />
                <span>Latihan Solo (VS Bot)</span>
              </button>
            </template>
          </LobbyModeSelector>
        </div>
      </div>
    </main>

    <!-- Minimal Game Footer -->
    <footer
      class="relative z-10 w-full py-2 px-4 text-center text-[10px] sm:text-[11px] font-heading font-bold uppercase tracking-wider text-white/80 shrink-0"
    >
      &copy; 2026 Bentengan 3D &bull; Main Gratis Langsung di Browser
    </footer>

    <!-- Modals -->
    <GameRulesModal v-if="showRulesModal" @close="showRulesModal = false" />
    <GameControlsModal v-if="showControlsModal" @close="showControlsModal = false" />
    <SettingsModal v-if="showSettingsModal" @close="showSettingsModal = false" />
    <CharacterPickerModal
      v-if="showCharacterModal"
      :team="roomStore.myTeam"
      @close="showCharacterModal = false"
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
        <div
          class="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700 shadow-2xs"
        >
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
