<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useRoomStore } from '../stores/room-store'
import { useGameStore } from '../stores/game-store'
import GameCanvas from '../components/game/GameCanvas.vue'
import GameHUD from '../components/hud/GameHUD.vue'
import ResultsModal from '../components/results/ResultsModal.vue'
import type { TeamId } from '../types/game.types'
import type { VirtualMovementInput } from '../game/input/input-manager'

const route = useRoute()
const router = useRouter()
const roomStore = useRoomStore()
const gameStore = useGameStore()
const gameCanvasRef = ref<InstanceType<typeof GameCanvas> | null>(null)

onMounted(() => {
  const chosenTeam: TeamId = route.query.team === 'red' ? 'red' : 'blue'
  gameStore.resetStats()
  roomStore.initLocalPractice(chosenTeam)
  roomStore.setMatchStatus('playing')
})

const handleRequestPointerLock = () => {
  gameCanvasRef.value?.requestPointerLock()
}

const handleVirtualMove = (move: VirtualMovementInput) => {
  gameCanvasRef.value?.setVirtualMovement(move)
}

const handleVirtualSprint = (sprint: boolean) => {
  gameCanvasRef.value?.setVirtualSprint(sprint)
}

const handleVirtualLook = (delta: { deltaX: number; deltaY: number }) => {
  gameCanvasRef.value?.injectTouchDelta(delta.deltaX, delta.deltaY)
}

const handleVirtualInteract = () => {
  gameCanvasRef.value?.triggerVirtualInteract()
}

const handleRestart = () => {
  gameStore.resetStats()
  const chosenTeam: TeamId = route.query.team === 'red' ? 'red' : 'blue'
  roomStore.initLocalPractice(chosenTeam)
  roomStore.setMatchStatus('playing')
}

const handleExitToHome = () => {
  roomStore.leaveRoom()
  router.push('/')
}
</script>

<template>
  <div data-testid="practice-view" class="relative w-screen h-screen overflow-hidden bg-neutral-950 font-sans">
    <!-- 3D Arena Canvas -->
    <GameCanvas
      v-if="roomStore.status === 'playing' || roomStore.status === 'finished'"
      ref="gameCanvasRef"
    />

    <!-- Game HUD -->
    <GameHUD
      v-if="roomStore.status === 'playing'"
      @request-pointer-lock="handleRequestPointerLock"
      @virtual-move="handleVirtualMove"
      @virtual-sprint="handleVirtualSprint"
      @virtual-look="handleVirtualLook"
      @virtual-interact="handleVirtualInteract"
    />

    <!-- Results Modal on Finish -->
    <ResultsModal
      v-if="roomStore.status === 'finished'"
      @restart="handleRestart"
    />

    <!-- Quick Exit Button -->
    <div class="fixed top-4 left-4 z-40">
      <button
        type="button"
        class="px-3 py-1.5 rounded-xl bg-black/60 hover:bg-black/80 text-white font-heading font-black text-xs uppercase tracking-wider transition-all cursor-pointer border border-white/20 backdrop-blur-xs"
        @click="handleExitToHome"
      >
        ← Keluar Latihan
      </button>
    </div>
  </div>
</template>

