<script setup lang="ts">
import { ref } from 'vue'
import TactileButton from '../ui/TactileButton.vue'
import type { TeamId } from '../../types/game.types'

const props = defineProps<{
  initialUsername: string
  initialTeam: TeamId
  isConnecting: boolean
  connectionError: string | null
}>()

const emit = defineEmits<{
  (e: 'start-practice', payload: { username: string; team: TeamId }): void
  (e: 'create-host', payload: { username: string; team: TeamId; roomCode: string }): void
  (e: 'join-room', payload: { username: string; team: TeamId; roomCode: string }): void
}>()

const username = ref(props.initialUsername)
const targetRoomCode = ref('')
const showPracticeModal = ref(false)
const hostRoomCode = ref(
  Math.random().toString(36).substring(2, 6).toUpperCase() +
  Math.floor(10 + Math.random() * 90),
)

const onCreateHost = () => {
  const code = hostRoomCode.value.trim().toUpperCase() || 'BENTENG'
  emit('create-host', {
    username: username.value.trim() || 'Host',
    team: 'blue',
    roomCode: code,
  })
}

const onJoinRoom = () => {
  if (!targetRoomCode.value.trim()) return
  const code = targetRoomCode.value.trim().toUpperCase()
  emit('join-room', {
    username: username.value.trim() || 'Pemain',
    team: 'red',
    roomCode: code,
  })
}

const onSelectPracticeTeam = (team: TeamId) => {
  showPracticeModal.value = false
  emit('start-practice', {
    username: username.value.trim() || 'Pemain',
    team,
  })
}
</script>

<template>
  <div data-testid="lobby-mode-selector" class="flex flex-col gap-4 relative">
    <!-- Input: Nama Panggilanmu -->
    <div class="flex flex-col gap-1.5">
      <label
        for="username"
        class="font-heading font-black text-xs uppercase tracking-wider text-neutral-800"
      >
        Nama panggilanmu
      </label>
      <input
        id="username"
        v-model="username"
        data-testid="lobby-username-input"
        type="text"
        maxlength="16"
        placeholder="Masukkan nama..."
        class="w-full bg-neutral-100/90 border border-neutral-300 focus:border-amber-400 focus:bg-white rounded-2xl px-4 py-3 font-sans font-bold text-neutral-800 text-sm outline-none transition-all"
      />
    </div>

    <!-- 2-Column Action Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
      <!-- Kolom 1 (Kiri): Tombol Besar Buat Ruangan -->
      <button
        type="button"
        data-testid="lobby-create-room-btn"
        :disabled="isConnecting"
        class="timbul-btn w-full min-h-[105px] h-full bg-[#ff5e42] hover:bg-[#ff6e54] text-white border-[#d83c20] border-b-[#b52a12] border-b-[5px] text-base font-black rounded-2xl flex items-center justify-center gap-2 p-4 cursor-pointer active:translate-y-[2px] active:border-b-[2px] transition-all disabled:opacity-50"
        @click="onCreateHost"
      >
        <span class="text-lg">✨</span>
        <span>{{ isConnecting ? 'Menghubungkan...' : 'Buat Ruangan' }}</span>
      </button>

      <!-- Kolom 2 (Kanan): Input Kode + Gabung Ruangan + Latihan -->
      <div class="flex flex-col gap-2.5 h-full justify-between">
        <!-- Input Kode Room -->
        <input
          id="targetRoomCode"
          v-model="targetRoomCode"
          data-testid="join-room-code-input"
          type="text"
          maxlength="8"
          placeholder="K O D E"
          class="w-full bg-neutral-100/90 border border-neutral-300 focus:border-indigo-400 focus:bg-white rounded-2xl py-2.5 px-3 text-center font-mono font-black text-neutral-800 text-sm tracking-[0.25em] uppercase outline-none transition-all placeholder:text-neutral-400 placeholder:tracking-[0.25em]"
        />

        <!-- Action Row: Gabung Room & Icon Latihan -->
        <div class="flex items-center gap-2">
          <button
            type="button"
            data-testid="lobby-join-room-btn"
            :disabled="isConnecting || !targetRoomCode.trim()"
            class="timbul-btn flex-1 py-3 px-3 bg-[#b29efb] hover:bg-[#bfaeff] text-[#2c1d68] border-[#8e75eb] border-b-[#755bd9] border-b-[4px] text-xs font-black rounded-2xl flex items-center justify-center gap-1.5 cursor-pointer active:translate-y-[2px] active:border-b-[2px] transition-all disabled:opacity-40"
            @click="onJoinRoom"
          >
            <span class="text-sm">🚪</span>
            <span>Gabung Ruangan</span>
          </button>

          <!-- Compact Icon Button Latihan Offline -->
          <button
            type="button"
            data-testid="lobby-start-practice-btn"
            title="Latihan Offline Solo (Bot AI)"
            class="timbul-btn py-3 px-3.5 bg-neutral-200 hover:bg-neutral-300 text-neutral-700 border-neutral-300 border-b-neutral-400 border-b-[4px] text-base rounded-2xl flex items-center justify-center cursor-pointer active:translate-y-[2px] active:border-b-[2px] transition-all"
            @click="showPracticeModal = true"
          >
            🎮
          </button>
        </div>
      </div>
    </div>

    <!-- Error notice -->
    <div
      v-if="connectionError"
      data-testid="lobby-connection-error"
      class="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold text-center"
    >
      ⚠️ {{ connectionError }}
    </div>

    <!-- Modal Popover Pilih Tim Latihan Solo -->
    <div
      v-if="showPracticeModal"
      class="absolute inset-0 bg-white/95 backdrop-blur-xs rounded-2xl p-4 flex flex-col justify-center items-center gap-4 z-20 border border-neutral-200 shadow-lg"
    >
      <div class="text-center">
        <h3 class="font-heading font-black text-base text-neutral-800 uppercase">
          Pilih Tim untuk Latihan
        </h3>
        <p class="font-sans text-xs text-neutral-500">
          Uji arena 3D dan kemampuan melawan Bot AI
        </p>
      </div>

      <div class="grid grid-cols-2 gap-3 w-full">
        <TactileButton
          variant="blue"
          class="w-full text-xs py-2.5"
          @click="onSelectPracticeTeam('blue')"
        >
          🔵 Benteng Biru
        </TactileButton>

        <TactileButton
          variant="red"
          class="w-full text-xs py-2.5"
          @click="onSelectPracticeTeam('red')"
        >
          🔴 Benteng Merah
        </TactileButton>
      </div>

      <button
        type="button"
        class="text-xs font-heading font-bold text-neutral-400 hover:text-neutral-600 uppercase cursor-pointer"
        @click="showPracticeModal = false"
      >
        Batal
      </button>
    </div>
  </div>
</template>
