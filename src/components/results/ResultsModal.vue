<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '../../stores/game-store'
import { useRoomStore } from '../../stores/room-store'
import TactileButton from '../ui/TactileButton.vue'

const router = useRouter()
const gameStore = useGameStore()
const roomStore = useRoomStore()

const result = computed(() => gameStore.matchResult)

const isPlayerWinner = computed(() => {
  if (!result.value || !result.value.winner) return false
  return result.value.winner === roomStore.myTeam
})

const isHostDisconnect = computed(() => result.value?.reason === 'host_disconnect')

const reasonText = computed(() => {
  if (!result.value) return ''
  if (result.value.reason === 'host_disconnect') {
    return 'Tuan rumah (Host) telah keluar atau koneksi terputus. Pertandingan selesai.'
  }
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

const handleLeaveToHome = () => {
  roomStore.leaveRoom()
  router.push('/')
}
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
      <!-- Winner / Disconnect Banner -->
      <div class="flex flex-col items-center gap-2">
        <div class="text-4xl sm:text-5xl">
          {{ isHostDisconnect ? '🔌' : (isPlayerWinner ? '🏆' : '⚔️') }}
        </div>
        <h2
          data-testid="results-winner-title"
          :class="[
            'font-heading font-black text-3xl sm:text-4xl tracking-wide uppercase',
            isHostDisconnect
              ? 'text-rose-500'
              : (isPlayerWinner ? 'text-amber-500' : 'text-neutral-700'),
          ]"
        >
          {{ isHostDisconnect ? 'KONEKSI TERPUTUS' : (isPlayerWinner ? 'KEMENANGAN!' : 'KEKALAHAN') }}
        </h2>
        <div
          v-if="result?.winner"
          data-testid="results-team-label"
          :class="[
            'px-4 py-1.5 rounded-full font-heading font-bold text-xs uppercase tracking-wider text-white shadow-sm',
            result?.winner === 'blue' ? 'bg-blue-600' : 'bg-red-600',
          ]"
        >
          {{ result?.winner === 'blue' ? 'Tim Benteng Biru' : 'Tim Benteng Merah' }} Menang
        </div>
        <div
          v-else
          data-testid="results-cancelled-label"
          class="px-4 py-1.5 rounded-full font-heading font-bold text-xs uppercase tracking-wider text-white bg-neutral-600 shadow-sm"
        >
          Pertandingan Dibatalkan
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
          v-if="!isHostDisconnect"
          variant="amber"
          data-testid="results-restart-btn"
          class="w-full text-base sm:text-lg"
          @click="$emit('restart')"
        >
          {{ roomStore.roomCode === 'LOKAL' ? '🔄 Main Lagi (Latihan)' : '🔄 Kembali ke Ruang Tunggu (Main Lagi)' }}
        </TactileButton>

        <TactileButton
          v-if="isHostDisconnect"
          variant="amber"
          data-testid="results-leave-home-primary-btn"
          class="w-full text-base sm:text-lg"
          @click="handleLeaveToHome"
        >
          ← Keluar ke Beranda
        </TactileButton>

        <button
          v-if="!isHostDisconnect"
          type="button"
          data-testid="results-leave-home-btn"
          class="text-xs font-heading font-bold uppercase tracking-wider text-neutral-400 hover:text-neutral-600 transition-colors py-1 cursor-pointer self-center"
          @click="handleLeaveToHome"
        >
          ← Keluar ke Beranda
        </button>
      </div>
    </div>
  </div>
</template>

