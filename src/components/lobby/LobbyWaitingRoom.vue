<script setup lang="ts">
import { ref } from 'vue'
import { useRoomStore } from '../../stores/room-store'
import TactileButton from '../ui/TactileButton.vue'
import type { TeamId } from '../../types/game.types'

const roomStore = useRoomStore()
const copied = ref(false)

const copyRoomCode = async () => {
  try {
    await navigator.clipboard.writeText(roomStore.roomCode)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch {
    // Ignore clipboard errors
  }
}

const onSelectTeam = (team: TeamId) => {
  roomStore.setTeam(team)
}

const onToggleReady = () => {
  roomStore.toggleReady()
}

const onStartMatch = () => {
  roomStore.startMatch()
}

const onLeave = () => {
  roomStore.leaveRoom()
}
</script>

<template>
  <div data-testid="lobby-waiting-room" class="flex flex-col gap-6 w-full">
    <!-- Header: Room Code, Status & Ping -->
    <div class="flex items-center justify-between border-b border-neutral-200 pb-3">
      <div class="flex items-center gap-3">
        <div class="flex flex-col">
          <span class="font-heading font-black text-[11px] uppercase tracking-wider text-neutral-500">
            KODE RUANGAN
          </span>
          <button
            type="button"
            data-testid="copy-room-code-btn"
            class="flex items-center gap-2 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 active:scale-95 transition-all border border-neutral-300 rounded-xl font-mono font-black text-base text-neutral-900 cursor-pointer shadow-2xs"
            @click="copyRoomCode"
          >
            <span>{{ roomStore.roomCode }}</span>
            <span class="text-xs text-neutral-500">{{ copied ? '✓ Disalin' : '📋' }}</span>
          </button>
        </div>
      </div>

      <!-- Latency & Connected Info -->
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-1.5 px-3 py-1 bg-neutral-100 border border-neutral-200 rounded-xl font-mono text-xs font-bold text-neutral-600">
          <span
            class="w-2.5 h-2.5 rounded-full"
            :class="roomStore.latencyMs < 100 ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'"
          />
          <span>{{ roomStore.latencyMs }} ms</span>
        </div>
      </div>
    </div>

    <!-- 2 Separated Fortress Columns: Blue & Red -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
      <!-- Kolom Kiri: Benteng Biru -->
      <div
        data-testid="roster-blue"
        class="flex flex-col justify-between gap-4 p-5 rounded-3xl bg-blue-50/70 border-2 border-blue-300 border-b-[6px] border-b-blue-400 shadow-sm"
      >
        <!-- Header Benteng Biru -->
        <div class="flex items-center justify-between border-b border-blue-200 pb-2.5">
          <div class="flex items-center gap-2">
            <span class="w-4 h-4 rounded-full bg-blue-500 shadow-xs" />
            <span class="font-heading font-black text-sm uppercase text-blue-900 tracking-wider">
              Benteng Biru
            </span>
          </div>
          <span class="px-2.5 py-0.5 rounded-full bg-blue-200/80 text-blue-800 font-heading font-black text-xs">
            {{ roomStore.bluePlayers.length }} Pemain
          </span>
        </div>

        <!-- Daftar Pemain Tim Biru -->
        <div class="flex flex-col gap-2 min-h-[140px] max-h-[220px] overflow-y-auto pr-1">
          <div
            v-for="p in roomStore.bluePlayers"
            :key="p.id"
            :data-testid="`player-item-${p.id}`"
            class="flex items-center justify-between p-2.5 rounded-2xl bg-white border border-blue-100 shadow-2xs"
          >
            <div class="flex items-center gap-2 truncate">
              <span class="text-sm">{{ p.isHost ? '👑' : '👤' }}</span>
              <span class="font-sans font-bold text-xs text-neutral-800 truncate">
                {{ p.username }} {{ p.id === roomStore.myPlayerId ? '(Anda)' : '' }}
              </span>
            </div>
            <span
              :class="[
                'text-[10px] font-heading font-black uppercase px-2.5 py-1 rounded-lg tracking-wider',
                p.isReady ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-neutral-100 text-neutral-500 border border-neutral-200',
              ]"
            >
              {{ p.isReady ? '✓ Ready' : 'Belum' }}
            </span>
          </div>

          <div
            v-if="roomStore.bluePlayers.length === 0"
            class="text-center py-8 font-sans text-xs text-neutral-400 italic"
          >
            Belum ada pemain di Benteng Biru
          </div>
        </div>

        <!-- Tombol Aksi: Masuk Tim Biru -->
        <div class="pt-2">
          <button
            v-if="roomStore.myTeam !== 'blue'"
            type="button"
            data-testid="waiting-select-blue-btn"
            class="timbul-btn timbul-btn-blue w-full py-3 text-xs font-black rounded-2xl cursor-pointer"
            @click="onSelectTeam('blue')"
          >
            🛡️ Masuk Tim Biru
          </button>
          <div
            v-else
            class="w-full py-2.5 px-3 rounded-2xl bg-blue-600 text-white font-heading font-black text-xs text-center uppercase tracking-wider shadow-inner"
          >
            ✓ Anda Bergabung di Tim Biru
          </div>
        </div>
      </div>

      <!-- Kolom Kanan: Benteng Merah -->
      <div
        data-testid="roster-red"
        class="flex flex-col justify-between gap-4 p-5 rounded-3xl bg-red-50/70 border-2 border-red-300 border-b-[6px] border-b-red-400 shadow-sm"
      >
        <!-- Header Benteng Merah -->
        <div class="flex items-center justify-between border-b border-red-200 pb-2.5">
          <div class="flex items-center gap-2">
            <span class="w-4 h-4 rounded-full bg-red-500 shadow-xs" />
            <span class="font-heading font-black text-sm uppercase text-red-900 tracking-wider">
              Benteng Merah
            </span>
          </div>
          <span class="px-2.5 py-0.5 rounded-full bg-red-200/80 text-red-800 font-heading font-black text-xs">
            {{ roomStore.redPlayers.length }} Pemain
          </span>
        </div>

        <!-- Daftar Pemain Tim Merah -->
        <div class="flex flex-col gap-2 min-h-[140px] max-h-[220px] overflow-y-auto pr-1">
          <div
            v-for="p in roomStore.redPlayers"
            :key="p.id"
            :data-testid="`player-item-${p.id}`"
            class="flex items-center justify-between p-2.5 rounded-2xl bg-white border border-red-100 shadow-2xs"
          >
            <div class="flex items-center gap-2 truncate">
              <span class="text-sm">{{ p.isHost ? '👑' : '👤' }}</span>
              <span class="font-sans font-bold text-xs text-neutral-800 truncate">
                {{ p.username }} {{ p.id === roomStore.myPlayerId ? '(Anda)' : '' }}
              </span>
            </div>
            <span
              :class="[
                'text-[10px] font-heading font-black uppercase px-2.5 py-1 rounded-lg tracking-wider',
                p.isReady ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-neutral-100 text-neutral-500 border border-neutral-200',
              ]"
            >
              {{ p.isReady ? '✓ Ready' : 'Belum' }}
            </span>
          </div>

          <div
            v-if="roomStore.redPlayers.length === 0"
            class="text-center py-8 font-sans text-xs text-neutral-400 italic"
          >
            Belum ada pemain di Benteng Merah
          </div>
        </div>

        <!-- Tombol Aksi: Masuk Tim Merah -->
        <div class="pt-2">
          <button
            v-if="roomStore.myTeam !== 'red'"
            type="button"
            data-testid="waiting-select-red-btn"
            class="timbul-btn timbul-btn-red w-full py-3 text-xs font-black rounded-2xl cursor-pointer"
            @click="onSelectTeam('red')"
          >
            ⚔️ Masuk Tim Merah
          </button>
          <div
            v-else
            class="w-full py-2.5 px-3 rounded-2xl bg-red-600 text-white font-heading font-black text-xs text-center uppercase tracking-wider shadow-inner"
          >
            ✓ Anda Bergabung di Tim Merah
          </div>
        </div>
      </div>
    </div>

    <!-- Error notice if any -->
    <div
      v-if="roomStore.connectionError"
      data-testid="waiting-room-error"
      class="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold text-center"
    >
      ⚠️ {{ roomStore.connectionError }}
    </div>

    <!-- Bottom Actions Section -->
    <div class="flex flex-col gap-3 pt-2">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <!-- Ready Toggle Button for Everyone -->
        <TactileButton
          :variant="roomStore.isReady ? 'emerald' : 'blue'"
          data-testid="waiting-toggle-ready-btn"
          class="w-full text-sm py-3"
          @click="onToggleReady"
        >
          {{ roomStore.isReady ? '✅ Sudah Siap (Ready)' : '⏳ Klik untuk Siap (Ready)' }}
        </TactileButton>

        <!-- Host-only Start Match Button -->
        <div v-if="roomStore.isHost" class="flex flex-col gap-1">
          <TactileButton
            variant="amber"
            data-testid="waiting-start-match-btn"
            :disabled="!roomStore.canStartMatch"
            class="w-full text-sm py-3"
            @click="onStartMatch"
          >
            🚀 Mulai Pertandingan (Host)
          </TactileButton>
        </div>
      </div>

      <!-- Warning hint if cannot start -->
      <p
        v-if="roomStore.isHost && !roomStore.startableStatus.startable"
        data-testid="startable-reason-hint"
        class="text-center font-sans text-xs text-amber-600 font-bold"
      >
        ℹ️ {{ roomStore.startableStatus.reason }}
      </p>

      <!-- Leave Room -->
      <button
        type="button"
        data-testid="waiting-leave-btn"
        class="text-xs font-heading font-bold uppercase tracking-wider text-neutral-400 hover:text-neutral-600 transition-colors py-1 cursor-pointer self-center"
        @click="onLeave"
      >
        ← Keluar dari Room
      </button>
    </div>
  </div>
</template>
