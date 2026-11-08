<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import { useRoomStore } from '../stores/room-store'
import { useGameStore } from '../stores/game-store'
import LobbyWaitingRoom from '../components/lobby/LobbyWaitingRoom.vue'
import RulesBriefingView from '../components/lobby/RulesBriefingView.vue'
import GameCanvas from '../components/game/GameCanvas.vue'
import GameHUD from '../components/hud/GameHUD.vue'
import ResultsModal from '../components/results/ResultsModal.vue'
import type { VirtualMovementInput } from '../game/input/input-manager'

const route = useRoute()
const router = useRouter()
const roomStore = useRoomStore()
const gameStore = useGameStore()

onBeforeRouteLeave(() => {
  roomStore.leaveRoom()
})

const roomCode = computed(() => {
  const c = route.params.code
  const str = Array.isArray(c) ? c[0] ?? '' : c ?? ''
  return str.toUpperCase()
})

const gameCanvasRef = ref<InstanceType<typeof GameCanvas> | null>(null)
const tempUsername = ref(roomStore.myUsername)
const isSubmittingJoin = ref(false)

onMounted(async () => {
  try {
    const hostedRoom = sessionStorage.getItem('bentengan_hosted_room')
    // If this browser tab was the Host of this room who reloaded: redirect back to Home
    if (hostedRoom && hostedRoom === roomCode.value && !roomStore.isHost) {
      sessionStorage.removeItem('bentengan_hosted_room')
      roomStore.leaveRoom()
      router.replace('/')
      return
    }
  } catch {
    // Ignore storage access errors in restricted contexts
  }

  // If host already initialized room on this code, we're ready
  if (roomStore.isHost && roomStore.roomCode === roomCode.value) {
    return
  }

  // If user navigated directly via URL or reloaded as guest, allow them to join/rejoin
  roomStore.roomCode = roomCode.value
})

const handleJoinAcknowledge = async () => {
  isSubmittingJoin.value = true
  roomStore.myUsername = tempUsername.value.trim() || 'Pemain'
  await roomStore.joinRemoteRoom(roomCode.value, 'red')
  if (!roomStore.connectionError) {
    roomStore.acknowledgeRules()
  }
  isSubmittingJoin.value = false
}

const handleRequestPointerLock = () => {
  gameCanvasRef.value?.requestPointerLock()
}

const handleVirtualMove = (move: VirtualMovementInput) => {
  gameCanvasRef.value?.setVirtualMovement(move)
}

const handleVirtualSprint = (sprint: boolean) => {
  gameCanvasRef.value?.setVirtualSprint(sprint)
}

const handleVirtualJump = (jump: boolean) => {
  gameCanvasRef.value?.setVirtualJump(jump)
}

const handleVirtualLook = (delta: { deltaX: number; deltaY: number }) => {
  gameCanvasRef.value?.injectTouchDelta(delta.deltaX, delta.deltaY)
}

const handleVirtualInteract = () => {
  gameCanvasRef.value?.triggerVirtualInteract()
}

const handleRestart = () => {
  gameStore.resetStats()
  roomStore.returnToLobbyForRematch()
}

const handleLeaveToHome = () => {
  roomStore.leaveRoom()
  router.push('/')
}
</script>

<template>
  <div data-testid="room-view" class="relative w-screen h-screen overflow-hidden bg-neutral-950 font-sans">
    <!-- Active 3D Gameplay Viewport -->
    <GameCanvas
      v-if="roomStore.status === 'playing' || roomStore.status === 'finished'"
      ref="gameCanvasRef"
    />

    <!-- Active In-Game HUD -->
    <GameHUD
      v-if="roomStore.status === 'playing'"
      @request-pointer-lock="handleRequestPointerLock"
      @virtual-move="handleVirtualMove"
      @virtual-sprint="handleVirtualSprint"
      @virtual-jump="handleVirtualJump"
      @virtual-look="handleVirtualLook"
      @virtual-interact="handleVirtualInteract"
    />

    <!-- Results Modal on Finish -->
    <ResultsModal
      v-if="roomStore.status === 'finished'"
      @restart="handleRestart"
    />

    <!-- Waiting Stage (Lobby or Onboarding Rules Gate) -->
    <div
      v-if="roomStore.status === 'waiting'"
      data-testid="room-waiting-stage"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    >
      <!-- Onboarding Gate for Direct URL Visitors (Enter Name & Acknowledge Rules) -->
      <div
        v-if="!roomStore.isHost && !roomStore.hasAcknowledgedRules"
        data-testid="guest-onboarding-modal"
        class="timbul-card w-full max-w-xl p-6 sm:p-8 flex flex-col gap-5 max-h-[92vh] overflow-y-auto"
      >
        <!-- Error Notice if Join Failed -->
        <div
          v-if="roomStore.connectionError"
          data-testid="join-connection-error"
          class="p-3 rounded-2xl bg-rose-50 border-2 border-rose-300 text-rose-700 text-xs font-bold text-center"
        >
          ⚠️ {{ roomStore.connectionError }}
        </div>

        <div class="flex flex-col gap-1.5 pb-2 border-b border-neutral-200">
          <label for="directUsername" class="font-heading font-black text-xs uppercase tracking-wider text-neutral-800">
            Nama Panggilanmu
          </label>
          <input
            id="directUsername"
            v-model="tempUsername"
            type="text"
            maxlength="16"
            placeholder="Masukkan nama Anda..."
            class="w-full bg-neutral-100 border-2 border-neutral-300 focus:border-amber-400 rounded-2xl px-4 py-2.5 font-sans font-bold text-neutral-800 text-sm outline-none"
          />
        </div>

        <!-- Rules Briefing View -->
        <RulesBriefingView
          :room-code="roomCode"
          @acknowledge="handleJoinAcknowledge"
        />

        <button
          type="button"
          class="text-xs font-heading font-bold text-neutral-400 hover:text-neutral-600 text-center uppercase cursor-pointer"
          @click="handleLeaveToHome"
        >
          ← Batalkan & Kembali ke Beranda
        </button>
      </div>

      <!-- Active Enlarged 2-Column Waiting Room -->
      <div
        v-else
        data-testid="room-waiting-modal"
        class="timbul-card w-full max-w-4xl p-6 sm:p-8 flex flex-col gap-6 max-h-[92vh] overflow-y-auto shadow-2xl"
      >
        <LobbyWaitingRoom @leave="handleLeaveToHome" />
      </div>
    </div>
  </div>
</template>
