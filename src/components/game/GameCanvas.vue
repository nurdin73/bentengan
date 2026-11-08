<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { GameEngine } from '../../game/core/engine'
import { useGameStore } from '../../stores/game-store'
import { useRoomStore } from '../../stores/room-store'

const containerRef = ref<HTMLDivElement | null>(null)
const gameStore = useGameStore()
const roomStore = useRoomStore()

let engine: GameEngine | null = null

const onPointerLockChange = () => {
  if (engine) {
    gameStore.setPointerLocked(engine.input.getPointerLocked())
  }
}

onMounted(async () => {
  if (!containerRef.value) return

  engine = new GameEngine(containerRef.value, {
    onPlayerStateChange: (state) => {
      gameStore.updateLocalPlayerState(state)
    },
    onRosterUpdate: (roster) => {
      gameStore.updateRosterCounts(roster)
    },
    onCapture: () => {
      gameStore.recordCapture()
    },
    onRescue: () => {
      gameStore.recordRescue()
    },
    onMatchEnd: (result) => {
      result.players[0]!.captures = gameStore.capturesCount
      result.players[0]!.rescues = gameStore.rescuesCount
      result.players[0]!.timesCaptured = gameStore.timesCapturedCount
      gameStore.finishMatch(result)
      roomStore.setMatchStatus('finished')
      document.exitPointerLock?.()
    },
  })

  await engine.init(roomStore.myTeam)
  document.addEventListener('pointerlockchange', onPointerLockChange)
})

onUnmounted(() => {
  document.removeEventListener('pointerlockchange', onPointerLockChange)
  if (engine) {
    engine.dispose()
    engine = null
  }
})

const requestPointerLock = () => {
  engine?.input.requestPointerLock()
}

defineExpose({
  requestPointerLock,
})
</script>

<template>
  <div
    ref="containerRef"
    data-testid="game-canvas-container"
    class="w-full h-full relative overflow-hidden bg-neutral-950 cursor-crosshair"
  />
</template>
