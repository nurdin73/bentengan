<script setup lang="ts">
import { computed } from 'vue'
import { useRoomStore } from '../../stores/room-store'
import RulesBriefingView from './RulesBriefingView.vue'
import LobbyWaitingRoom from './LobbyWaitingRoom.vue'
import LobbyModeSelector from './LobbyModeSelector.vue'
import type { TeamId } from '../../types/game.types'

const roomStore = useRoomStore()

const emit = defineEmits<{
  (e: 'start-practice', team: TeamId): void
}>()

const currentStage = computed<'waiting' | 'briefing' | 'menu'>(() => {
  if (!roomStore.roomCode || roomStore.roomCode === 'LOKAL') {
    return 'menu'
  }
  if (!roomStore.isHost && !roomStore.hasAcknowledgedRules) {
    return 'briefing'
  }
  return 'waiting'
})

const cardMaxWidthClass = computed(() => {
  if (currentStage.value === 'waiting') return 'max-w-3xl lg:max-w-4xl'
  if (currentStage.value === 'briefing') return 'max-w-xl'
  return 'max-w-md'
})

const handleStartPractice = (payload: { username: string; team: TeamId }) => {
  roomStore.myUsername = payload.username
  roomStore.initLocalPractice(payload.team)
  emit('start-practice', payload.team)
}

const handleCreateHost = async (payload: { username: string; team: TeamId; roomCode: string }) => {
  roomStore.myUsername = payload.username
  await roomStore.createHostRoom(payload.roomCode, payload.team)
}

const handleJoinRoom = async (payload: { username: string; team: TeamId; roomCode: string }) => {
  roomStore.myUsername = payload.username
  await roomStore.joinRemoteRoom(payload.roomCode, payload.team)
}
</script>

<template>
  <div
    data-testid="lobby-modal-backdrop"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
  >
    <div
      data-testid="lobby-modal-card"
      :class="[
        'timbul-card w-full p-5 sm:p-7 flex flex-col gap-5 max-h-[95vh] overflow-y-auto transition-all duration-200',
        cardMaxWidthClass,
      ]"
    >
      <!-- Stage 1: Active Waiting Room (Host or Acknowledged Guest) -->
      <LobbyWaitingRoom
        v-if="currentStage === 'waiting'"
      />

      <!-- Stage 2: Mandatory Rules Briefing Gate for Non-Host Players -->
      <RulesBriefingView
        v-else-if="currentStage === 'briefing'"
        :room-code="roomStore.roomCode"
        @acknowledge="roomStore.acknowledgeRules"
      />

      <!-- Stage 3: Mode Selection Menu (Practice, Host Room, Join Room) -->
      <LobbyModeSelector
        v-else
        :initial-username="roomStore.myUsername"
        :initial-team="roomStore.myTeam"
        :is-connecting="roomStore.isConnecting"
        :connection-error="roomStore.connectionError"
        @start-practice="handleStartPractice"
        @create-host="handleCreateHost"
        @join-room="handleJoinRoom"
      />
    </div>
  </div>
</template>
