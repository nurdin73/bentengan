<script setup lang="ts">
import { ref } from 'vue'
import { useRoomStore } from './stores/room-store'
import { useGameStore } from './stores/game-store'
import GameCanvas from './components/game/GameCanvas.vue'
import GameHUD from './components/hud/GameHUD.vue'
import LobbyModal from './components/lobby/LobbyModal.vue'
import ResultsModal from './components/results/ResultsModal.vue'
import type { TeamId } from './types/game.types'

const roomStore = useRoomStore()
const gameStore = useGameStore()
const gameCanvasRef = ref<InstanceType<typeof GameCanvas> | null>(null)

const handleStartPractice = (_team: TeamId) => {
  gameStore.resetStats()
  roomStore.setMatchStatus('playing')
}

const handleRequestPointerLock = () => {
  gameCanvasRef.value?.requestPointerLock()
}

const handleRestart = () => {
  gameStore.resetStats()
  roomStore.setMatchStatus('waiting')
}
</script>

<template>
  <main
    data-testid="app-root"
    class="relative w-screen h-screen overflow-hidden bg-neutral-950 font-sans"
  >
    <!-- 3D Game Canvas Viewport (stays active during match and results) -->
    <GameCanvas
      v-if="roomStore.status === 'playing' || roomStore.status === 'finished'"
      ref="gameCanvasRef"
    />

    <!-- Tactile Game HUD (during active play) -->
    <GameHUD
      v-if="roomStore.status === 'playing'"
      @request-pointer-lock="handleRequestPointerLock"
    />

    <!-- Lobby / Practice Start Modal -->
    <LobbyModal
      v-if="roomStore.status === 'waiting'"
      @start-practice="handleStartPractice"
    />

    <!-- Results Modal (when match ends) -->
    <ResultsModal
      v-if="roomStore.status === 'finished'"
      @restart="handleRestart"
    />
  </main>
</template>
