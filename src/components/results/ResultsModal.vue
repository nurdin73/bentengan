<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '../../stores/game-store'
import { useRoomStore } from '../../stores/room-store'
import TactileButton from '../ui/TactileButton.vue'

const gameStore = useGameStore()
const roomStore = useRoomStore()

const result = computed(() => gameStore.matchResult)

const isPlayerWinner = computed(() => {
  if (!result.value || !result.value.winner) return false
  return result.value.winner === roomStore.myTeam
})

const reasonText = computed(() => {
  if (!result.value) return ''
  if (result.value.reason === 'base_capture') {
    return isPlayerWinner.value
      ? 'Berhasil Merebut Benteng Lawan (Base Capture)!'
      : 'Benteng Anda Telah Direbut Lawan!'
  }
  if (result.value.reason === 'team_elimination') {
    return isPlayerWinner.value
      ? 'Seluruh Tim Lawan Terpenjara (Team Elimination)!'
      : 'Seluruh Anggota Tim Anda Telah Tertangkap!'
  }
  return 'Pertandingan Selesai'
})

defineEmits<{
  (e: 'restart'): void
}>()
</script>

<template>
  <div
    data-testid="results-modal-backdrop"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
  >
    <div
      data-testid="results-modal-card"
      class="timbul-card w-full max-w-lg p-6 sm:p-8 flex flex-col gap-6 text-center animate-in fade-in zoom-in-95 duration-200"
    >
      <!-- Winner Banner -->
      <div class="flex flex-col items-center gap-2">
        <div class="text-4xl sm:text-5xl">
          {{ isPlayerWinner ? '🏆' : '⚔️' }}
        </div>
        <h2
          data-testid="results-winner-title"
          :class="[
            'font-heading font-black text-3xl sm:text-4xl tracking-wide uppercase',
            isPlayerWinner ? 'text-amber-500' : 'text-neutral-700',
          ]"
        >
          {{ isPlayerWinner ? 'KEMENANGAN!' : 'KEKALAHAN' }}
        </h2>
        <div
          data-testid="results-team-label"
          :class="[
            'px-4 py-1.5 rounded-full font-heading font-bold text-xs uppercase tracking-wider text-white shadow-sm',
            result?.winner === 'blue' ? 'bg-blue-600' : 'bg-red-600',
          ]"
        >
          {{ result?.winner === 'blue' ? 'Tim Benteng Biru' : 'Tim Benteng Merah' }} Menang
        </div>
        <p
          data-testid="results-win-reason"
          class="font-sans text-xs sm:text-sm text-neutral-600 font-bold mt-1"
        >
          {{ reasonText }}
        </p>
      </div>

      <!-- Match Statistics Table -->
      <div
        data-testid="results-stats-panel"
        class="bg-neutral-100 border-2 border-neutral-200 rounded-2xl p-4 grid grid-cols-3 gap-2"
      >
        <div class="flex flex-col items-center">
          <span class="text-[11px] font-heading font-bold uppercase tracking-wider text-neutral-500">Durasi</span>
          <span data-testid="results-stat-duration" class="font-mono font-black text-lg text-neutral-800">
            {{ result?.duration || 0 }}s
          </span>
        </div>

        <div class="flex flex-col items-center border-x-2 border-neutral-200">
          <span class="text-[11px] font-heading font-bold uppercase tracking-wider text-neutral-500">Tangkapan</span>
          <span data-testid="results-stat-captures" class="font-mono font-black text-lg text-emerald-600">
            {{ gameStore.capturesCount }}
          </span>
        </div>

        <div class="flex flex-col items-center">
          <span class="text-[11px] font-heading font-bold uppercase tracking-wider text-neutral-500">Penyelamatan</span>
          <span data-testid="results-stat-rescues" class="font-mono font-black text-lg text-blue-600">
            {{ gameStore.rescuesCount }}
          </span>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex flex-col gap-3 pt-2">
        <TactileButton
          variant="amber"
          data-testid="results-restart-btn"
          class="w-full text-lg"
          @click="$emit('restart')"
        >
          🔄 Main Lagi (Latihan)
        </TactileButton>
      </div>
    </div>
  </div>
</template>

