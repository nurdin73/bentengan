<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { GameEngine } from '../../game/core/engine'
import { useGameStore } from '../../stores/game-store'
import { useRoomStore } from '../../stores/room-store'
import { peerNetworkManager } from '../../game/network/peer-network-manager'

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

  // Hook real-time multiplayer network listeners to engine
  peerNetworkManager.events.onPlayerUpdate = (update) => {
    engine?.onPlayerUpdate(update)
  }
  peerNetworkManager.events.onWorldSnapshot = (snapshot) => {
    engine?.onWorldSnapshot(snapshot)
  }
  peerNetworkManager.events.onGameEvent = (event) => {
    engine?.onGameEvent(event)
  }

  await engine.init({
    localPlayerId: roomStore.myPlayerId,
    localPlayerUsername: roomStore.myUsername,
    teamId: roomStore.myTeam,
    roomPlayers: roomStore.players,
    isPractice: roomStore.roomCode === 'LOKAL',
    isHost: roomStore.isHost,
  })

  document.addEventListener('pointerlockchange', onPointerLockChange)
})

onUnmounted(() => {
  document.removeEventListener('pointerlockchange', onPointerLockChange)
  peerNetworkManager.events.onPlayerUpdate = undefined
  peerNetworkManager.events.onWorldSnapshot = undefined
  peerNetworkManager.events.onGameEvent = undefined

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
