<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Trophy, Unplug, Swords, RotateCcw, Clock } from 'lucide-vue-next'
import { useGameStore } from '../../stores/game-store'
import { useRoomStore } from '../../stores/room-store'
import TactileButton from '../ui/TactileButton.vue'

const router = useRouter()
const gameStore = useGameStore()
const roomStore = useRoomStore()

const result = computed(() => gameStore.matchResult)

const canRestart = computed(() => {
  return roomStore.roomCode === 'LOKAL' || roomStore.isHost
})

const isPlayerWinner = computed(() => {
  if (!result.value || !result.value.winner) return false
  return result.value.winner === roomStore.myTeam
})

const isHostDisconnect = computed(() => result.value?.reason === 'host_disconnect')
const isTie = computed(() => result.value?.reason === 'timeout' && result.value?.winner === null)

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
  if (result.value.reason === 'timeout') {
    if (result.value.winner === null) {
      return 'Waktu habis! Jumlah tawanan kedua tim sama (Hasil Imbang).'
    }
    return isPlayerWinner.value
      ? 'Waktu Habis! Tim Anda Menang Berdasarkan Tawanan Terbanyak!'
      : 'Waktu Habis! Tim Lawan Menang Berdasarkan Tawanan Terbanyak!'
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
    class="results-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto"
  >
    <div
      data-testid="results-modal-card"
      class="results-modal-card timbul-card w-full max-w-lg p-5 sm:p-8 flex flex-col gap-5 sm:gap-6 text-center max-h-[92dvh] overflow-y-auto overscroll-contain animate-in fade-in zoom-in-95 duration-200"
    >
      <!-- Winner / Disconnect Banner (Left Column in Mobile Landscape) -->
      <div class="results-landscape-col-left flex flex-col items-center gap-2">
        <div class="flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-neutral-100 shadow-inner">
          <Unplug v-if="isHostDisconnect" class="w-8 h-8 sm:w-9 sm:h-9 text-rose-500" />
          <Trophy v-else-if="isPlayerWinner" class="w-8 h-8 sm:w-9 sm:h-9 text-amber-500" />
          <Swords v-else class="w-8 h-8 sm:w-9 sm:h-9 text-neutral-600" />
        </div>
        <h2
          data-testid="results-winner-title"
          :class="[
            'font-heading font-black text-2xl sm:text-4xl tracking-wide uppercase leading-tight',
            isHostDisconnect
              ? 'text-rose-500'
              : isTie
                ? 'text-amber-500'
                : (isPlayerWinner ? 'text-amber-500' : 'text-neutral-700'),
          ]"
        >
          {{ isHostDisconnect ? 'KONEKSI TERPUTUS' : (isTie ? 'HASIL IMBANG (SERI)' : (isPlayerWinner ? 'KEMENANGAN!' : 'KEKALAHAN')) }}
        </h2>
        <div
          v-if="result?.winner"
          data-testid="results-team-label"
          :class="[
            'px-3.5 py-1 sm:px-4 sm:py-1.5 rounded-full font-heading font-bold text-xs uppercase tracking-wider text-white shadow-sm',
            result?.winner === 'blue' ? 'bg-blue-600' : 'bg-red-600',
          ]"
        >
          {{ result?.winner === 'blue' ? 'Tim Benteng Biru' : 'Tim Benteng Merah' }} Menang
        </div>
        <div
          v-else-if="isTie"
          data-testid="results-tie-label"
          class="px-3.5 py-1 sm:px-4 sm:py-1.5 rounded-full font-heading font-bold text-xs uppercase tracking-wider text-amber-950 bg-amber-400 shadow-sm"
        >
          Pertandingan Seri (Draw)
        </div>
        <div
          v-else
          data-testid="results-cancelled-label"
          class="px-3.5 py-1 sm:px-4 sm:py-1.5 rounded-full font-heading font-bold text-xs uppercase tracking-wider text-white bg-neutral-600 shadow-sm"
        >
          Pertandingan Dibatalkan
        </div>
        <p
          data-testid="results-win-reason"
          class="font-sans text-xs sm:text-sm text-neutral-600 font-bold mt-0.5 sm:mt-1 max-w-xs sm:max-w-md"
        >
          {{ reasonText }}
        </p>
      </div>

      <!-- Right Column in Mobile Landscape: Stats + Action Buttons -->
      <div class="results-landscape-col-right flex flex-col gap-4 sm:gap-5 w-full">
        <!-- Match Statistics Table -->
        <div
          data-testid="results-stats-panel"
          class="bg-neutral-100 border-2 border-neutral-200 rounded-xl sm:rounded-2xl p-3 sm:p-4 grid grid-cols-3 gap-1.5 sm:gap-2 shadow-2xs"
        >
          <div class="flex flex-col items-center">
            <span class="text-[10px] sm:text-[11px] font-heading font-bold uppercase tracking-wider text-neutral-500">Durasi</span>
            <span data-testid="results-stat-duration" class="font-mono font-black text-base sm:text-lg text-neutral-800">
              {{ result?.duration || 0 }}s
            </span>
          </div>

          <div class="flex flex-col items-center border-x-2 border-neutral-200">
            <span class="text-[10px] sm:text-[11px] font-heading font-bold uppercase tracking-wider text-neutral-500">Tangkapan</span>
            <span data-testid="results-stat-captures" class="font-mono font-black text-base sm:text-lg text-emerald-600">
              {{ gameStore.capturesCount }}
            </span>
          </div>

          <div class="flex flex-col items-center">
            <span class="text-[10px] sm:text-[11px] font-heading font-bold uppercase tracking-wider text-neutral-500">Penyelamatan</span>
            <span data-testid="results-stat-rescues" class="font-mono font-black text-base sm:text-lg text-blue-600">
              {{ gameStore.rescuesCount }}
            </span>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex flex-col gap-2.5 sm:gap-3 pt-0.5 sm:pt-2">
          <!-- Host or Solo Practice: Can restart match or return room to lobby -->
          <TactileButton
            v-if="!isHostDisconnect && canRestart"
            variant="amber"
            data-testid="results-restart-btn"
            class="w-full text-sm sm:text-base py-2.5 sm:py-3 flex items-center justify-center gap-2"
            @click="$emit('restart')"
          >
            <RotateCcw class="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
            <span>{{ roomStore.roomCode === 'LOKAL' ? 'Main Lagi (Latihan)' : 'Kembali ke Ruang Tunggu (Main Lagi)' }}</span>
          </TactileButton>

          <!-- Guest in multiplayer room: Waiting for Host -->
          <div
            v-else-if="!isHostDisconnect && !canRestart"
            data-testid="results-waiting-host-box"
            class="w-full text-xs sm:text-sm py-2.5 sm:py-3 px-4 rounded-xl sm:rounded-2xl bg-neutral-100 border-2 border-neutral-300 text-neutral-600 font-heading font-bold flex items-center justify-center gap-2 shadow-2xs"
          >
            <Clock class="w-4 h-4 sm:w-5 sm:h-5 shrink-0 animate-spin text-neutral-400" />
            <span>Menunggu Host Kembali ke Ruang Tunggu...</span>
          </div>

          <TactileButton
            v-if="isHostDisconnect"
            variant="amber"
            data-testid="results-leave-home-primary-btn"
            class="w-full text-sm sm:text-base py-2.5 sm:py-3"
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
  </div>
</template>

<style scoped>
@media (orientation: landscape) and (max-height: 520px) {
  .results-modal-backdrop {
    padding: 0 !important;
  }

  .results-modal-card {
    width: 100vw !important;
    height: 100vh !important;
    max-width: 100vw !important;
    max-height: 100vh !important;
    border-radius: 0 !important;
    border: none !important;
    box-shadow: none !important;
    flex-direction: row !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 2rem !important;
    padding: 1.25rem 2.5rem !important;
  }

  .results-landscape-col-left {
    flex: 1 1 45% !important;
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    justify-content: center !important;
    text-align: center !important;
    gap: 0.5rem !important;
  }

  .results-landscape-col-right {
    flex: 1 1 55% !important;
    display: flex !important;
    flex-direction: column !important;
    justify-content: center !important;
    max-width: 26rem !important;
    width: 100% !important;
    gap: 0.875rem !important;
  }
}
</style>

