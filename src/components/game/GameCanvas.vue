<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { GameEngine } from '../../game/core/engine'
import { GAME_CONFIG } from '../../game/core/constants'
import type { VirtualMovementInput } from '../../game/input/input-manager'
import type { SkillId } from '../../game/skills/skill-types'
import { useGameStore } from '../../stores/game-store'
import { useRoomStore } from '../../stores/room-store'
import { peerNetworkManager } from '../../game/network/peer-network-manager'

const containerRef = ref<HTMLDivElement | null>(null)
const gameStore = useGameStore()
const roomStore = useRoomStore()

let engine: GameEngine | null = null
let prevRoomStateUpdated: typeof peerNetworkManager.events.onRoomStateUpdated | undefined

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
    onSkillStateChange: (skills) => {
      gameStore.updateSkillsState(skills)
    },
    onRosterUpdate: (roster) => {
      gameStore.updateRosterCounts(roster)
    },
    onTimerUpdate: (remainingSec, limitSec) => {
      gameStore.updateMatchTimer(remainingSec, limitSec)
    },
    onCapture: (hunterName: string, targetName: string) => {
      if (hunterName === 'Anda' || hunterName === roomStore.myUsername) {
        gameStore.recordCapture()
      }
      if (targetName === 'Anda' || targetName === roomStore.myUsername) {
        gameStore.recordTimesCaptured()
      }
    },
    onRescue: (rescuerName: string) => {
      if (rescuerName === 'Anda' || rescuerName === roomStore.myUsername) {
        gameStore.recordRescue()
      }
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
  prevRoomStateUpdated = peerNetworkManager.events.onRoomStateUpdated
  peerNetworkManager.events.onRoomStateUpdated = (room) => {
    prevRoomStateUpdated?.(room)
    engine?.updateRoomPlayers(room.players)
  }
  peerNetworkManager.events.onPlayerUpdate = (update) => {
    engine?.onPlayerUpdate(update)
  }
  peerNetworkManager.events.onWorldSnapshot = (snapshot) => {
    engine?.onWorldSnapshot(snapshot)
  }
  peerNetworkManager.events.onGameEvent = (event) => {
    engine?.onGameEvent(event)
  }
  peerNetworkManager.events.onPlayerLeft = (playerId) => {
    engine?.removeRemotePlayer(playerId)
  }
  peerNetworkManager.events.onPlayerReconnected = (player) => {
    engine?.spawnOrRestoreRemotePlayer(player)
  }

  await engine.init({
    localPlayerId: roomStore.myPlayerId,
    localPlayerUsername: roomStore.myUsername,
    teamId: roomStore.myTeam,
    roomPlayers: roomStore.players,
    isPractice: roomStore.roomCode === 'LOKAL',
    isHost: roomStore.isHost,
    matchDurationLimitSec:
      roomStore.currentRoom?.matchDurationSec ??
      GAME_CONFIG.gameplay.defaultMatchDurationSec,
  })

  if (gameStore.isPaused) {
    engine.setPaused(true)
  }

  document.addEventListener('pointerlockchange', onPointerLockChange)
})

watch(
  () => gameStore.isPaused,
  (paused) => {
    engine?.setPaused(paused)
  },
)

onUnmounted(() => {
  document.removeEventListener('pointerlockchange', onPointerLockChange)
  peerNetworkManager.events.onRoomStateUpdated = prevRoomStateUpdated
  peerNetworkManager.events.onPlayerUpdate = undefined
  peerNetworkManager.events.onWorldSnapshot = undefined
  peerNetworkManager.events.onGameEvent = undefined
  peerNetworkManager.events.onPlayerLeft = undefined
  peerNetworkManager.events.onPlayerReconnected = undefined

  if (engine) {
    engine.dispose()
    engine = null
  }
})

const requestPointerLock = () => {
  engine?.input.requestPointerLock()
}

const setVirtualMovement = (movement: Partial<VirtualMovementInput>) => {
  engine?.input.setVirtualMovement(movement)
}

const setVirtualSprint = (sprint: boolean) => {
  engine?.input.setVirtualSprint(sprint)
}

const setVirtualJump = (jump: boolean) => {
  engine?.input.setVirtualJump(jump)
}

const injectTouchDelta = (deltaX: number, deltaY: number) => {
  engine?.input.injectTouchDelta(deltaX, deltaY)
}

const triggerVirtualInteract = () => {
  engine?.input.triggerVirtualInteract()
}

const triggerSkill = (skillId: SkillId) => {
  engine?.input.triggerVirtualSkill(skillId)
}

defineExpose({
  requestPointerLock,
  setVirtualMovement,
  setVirtualSprint,
  setVirtualJump,
  injectTouchDelta,
  triggerVirtualInteract,
  triggerSkill,
  setPaused: (paused: boolean) => engine?.setPaused(paused),
})
</script>

<template>
  <div
    ref="containerRef"
    data-testid="game-canvas-container"
    class="w-full h-full relative overflow-hidden bg-neutral-950 cursor-crosshair"
  />
</template>
