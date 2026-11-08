<script setup lang="ts">
import { ref } from 'vue'
import type { TeamId } from '../../types/game.types'

const props = defineProps<{
  initialUsername: string
  initialTeam: TeamId
  isConnecting: boolean
  connectionError: string | null
}>()

const emit = defineEmits<{
  (e: 'create-host', payload: { username: string; team: TeamId; roomCode: string; maxPlayers: 8 | 12 }): void
  (e: 'join-room', payload: { username: string; team: TeamId; roomCode: string }): void
}>()

const username = ref(props.initialUsername)
const selectedCapacity = ref<8 | 12>(8)
const targetRoomCode = ref('')
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
    maxPlayers: selectedCapacity.value,
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
</script>

<template>
  <div
    data-testid="lobby-mode-selector"
    class="bg-white border-2 border-neutral-200/90 rounded-[28px] p-6 sm:p-8 shadow-xs flex flex-col gap-4 relative"
  >
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
        placeholder="Ketik nama panggilanmu..."
        class="w-full bg-neutral-100/90 border border-neutral-300 focus:border-amber-400 focus:bg-white rounded-2xl px-4 py-3 font-sans font-bold text-neutral-800 text-sm outline-none transition-all"
      />
    </div>

    <!-- Pilihan Format Pertandingan (4v4 vs 6v6) -->
    <div class="flex flex-col gap-1.5">
      <div class="flex items-center justify-between">
        <label class="font-heading font-black text-xs uppercase tracking-wider text-neutral-800">
          Format Pertandingan
        </label>
        <span class="text-[11px] font-sans font-bold text-neutral-500">
          {{ selectedCapacity === 8 ? 'Maksimal 8 Pemain' : 'Maksimal 12 Pemain' }}
        </span>
      </div>
      <div class="grid grid-cols-2 gap-2 p-1 bg-neutral-100/90 rounded-2xl border border-neutral-300">
        <button
          type="button"
          data-testid="capacity-4v4-btn"
          :class="[
            'py-2 px-3 rounded-xl font-heading font-black text-xs uppercase tracking-wider transition-all cursor-pointer',
            selectedCapacity === 8
              ? 'bg-white text-neutral-900 shadow-sm border border-neutral-200'
              : 'text-neutral-500 hover:text-neutral-700',
          ]"
          @click="selectedCapacity = 8"
        >
          ⚔️ 4 vs 4
        </button>
        <button
          type="button"
          data-testid="capacity-6v6-btn"
          :class="[
            'py-2 px-3 rounded-xl font-heading font-black text-xs uppercase tracking-wider transition-all cursor-pointer',
            selectedCapacity === 12
              ? 'bg-white text-neutral-900 shadow-sm border border-neutral-200'
              : 'text-neutral-500 hover:text-neutral-700',
          ]"
          @click="selectedCapacity = 12"
        >
          🛡️ 6 vs 6
        </button>
      </div>
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
        <span>{{ isConnecting ? 'Menyiapkan Ruangan...' : 'Buat Ruangan' }}</span>
      </button>

      <!-- Kolom 2 (Kanan): Input Kode + Gabung Ruangan (Full Width) -->
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

        <!-- Tombol Gabung Ruangan (Full Width) -->
        <button
          type="button"
          data-testid="lobby-join-room-btn"
          :disabled="isConnecting || !targetRoomCode.trim()"
          class="timbul-btn w-full py-3 px-3 bg-[#b29efb] hover:bg-[#bfaeff] text-[#2c1d68] border-[#8e75eb] border-b-[#755bd9] border-b-[4px] text-xs font-black rounded-2xl flex items-center justify-center gap-1.5 cursor-pointer active:translate-y-[2px] active:border-b-[2px] transition-all disabled:opacity-40"
          @click="onJoinRoom"
        >
          <span class="text-sm">🚪</span>
          <span>Gabung Ruangan</span>
        </button>
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
  </div>
</template>
