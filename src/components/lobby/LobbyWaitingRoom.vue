<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  Copy,
  Check,
  Swords,
  Shield,
  Crown,
  User,
  CheckCircle2,
  Clock,
  Wifi,
  RefreshCw,
  Play,
  ArrowLeft,
  AlertCircle,
  X,
  Castle,
  Shirt,
} from 'lucide-vue-next'
import { computed } from 'vue'
import { useRoomStore } from '../../stores/room-store'
import TactileButton from '../ui/TactileButton.vue'
import ConfirmDialog from '../ui/ConfirmDialog.vue'
import CharacterPickerModal from '../wardrobe/CharacterPickerModal.vue'
import { OUTFIT_PRESETS } from '../../game/entities/character-avatar'
import type { TeamId } from '../../types/game.types'

const router = useRouter()
const roomStore = useRoomStore()
const copied = ref(false)
const activeMobileTab = ref<TeamId>(roomStore.myTeam || 'blue')
const showLeaveDialog = ref(false)
const showStartDialog = ref(false)
const showWardrobeModal = ref(false)

const currentOutfitName = computed(() => {
  const outfitId = roomStore.myPlayer?.outfitId ?? roomStore.myOutfitId ?? 1
  return OUTFIT_PRESETS.find((o) => o.id === outfitId)?.name ?? 'Casual Striker'
})

const emit = defineEmits<{
  (e: 'leave'): void
}>()

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
  activeMobileTab.value = team
}

const onToggleReady = () => {
  roomStore.toggleReady()
}

const handleStartClick = () => {
  showStartDialog.value = true
}

const confirmStart = () => {
  showStartDialog.value = false
  roomStore.startMatch()
}

const handleLeaveClick = () => {
  showLeaveDialog.value = true
}

const confirmLeave = () => {
  showLeaveDialog.value = false
  roomStore.leaveRoom()
  emit('leave')
  router.push('/')
}
</script>

<template>
  <div data-testid="lobby-waiting-room" class="flex flex-col gap-4 sm:gap-6 w-full">
    <!-- Header: Room Code, Status & Ping -->
    <div class="flex items-center justify-between border-b border-neutral-200 pb-3 gap-2">
      <div class="flex items-center gap-2 sm:gap-3 flex-wrap">
        <div class="flex flex-col">
          <span
            class="font-heading font-black text-[10px] sm:text-[11px] uppercase tracking-wider text-neutral-500"
          >
            KODE RUANGAN
          </span>
          <button
            type="button"
            data-testid="copy-room-code-btn"
            class="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 active:scale-95 transition-all border border-neutral-300 rounded-xl font-mono font-black text-sm sm:text-base text-neutral-900 cursor-pointer shadow-2xs"
            @click="copyRoomCode"
          >
            <span>{{ roomStore.roomCode }}</span>
            <span class="text-neutral-500 flex items-center gap-1 text-xs">
              <Check v-if="copied" class="w-3.5 h-3.5 text-emerald-600" />
              <Copy v-else class="w-3.5 h-3.5" />
              <span class="text-[10px] font-sans font-bold hidden sm:inline">{{
                copied ? 'Disalin' : 'Salin'
              }}</span>
            </span>
          </button>
        </div>

        <!-- Mode & Capacity Badge (Visible on Mobile & Desktop) -->
        <div class="flex flex-col">
          <span
            class="font-heading font-black text-[10px] sm:text-[11px] uppercase tracking-wider text-neutral-500"
          >
            FORMAT GAME
          </span>
          <span
            data-testid="waiting-room-capacity-badge"
            class="px-2.5 sm:px-3 py-1.5 bg-neutral-100 border border-neutral-300 rounded-xl font-heading font-black text-[11px] sm:text-xs text-neutral-800 flex items-center gap-1.5"
          >
            <Shield v-if="roomStore.maxPlayers === 12" class="w-3.5 h-3.5 text-blue-600" />
            <Swords v-else class="w-3.5 h-3.5 text-amber-600" />
            <span>{{
              roomStore.maxPlayers === 12 ? '6 vs 6 (Maks. 12)' : '4 vs 4 (Maks. 8)'
            }}</span>
          </span>
        </div>
      </div>

      <!-- Latency & Connected Info -->
      <div class="flex items-center gap-2">
        <div
          v-if="roomStore.isReconnecting"
          data-testid="waiting-reconnecting-badge"
          class="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-amber-100 border border-amber-300 rounded-xl font-mono text-xs font-bold text-amber-800 animate-pulse"
        >
          <span class="w-2 h-2 rounded-full bg-amber-500" />
          <span class="hidden sm:inline">Menyambung Ulang...</span>
          <span class="sm:hidden">Menyambung...</span>
        </div>
        <div
          v-else
          class="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-neutral-100 border border-neutral-200 rounded-xl font-mono text-xs font-bold text-neutral-600"
        >
          <Wifi
            class="w-3.5 h-3.5"
            :class="roomStore.latencyMs < 100 ? 'text-emerald-500' : 'text-amber-500'"
          />
          <span class="hidden sm:inline"
            >{{ roomStore.latencyMs < 100 ? 'Sinyal Lancar' : 'Sinyal Sedang' }} ({{
              roomStore.latencyMs
            }}
            ms)</span
          >
          <span class="sm:hidden">{{ roomStore.latencyMs }} ms</span>
        </div>
      </div>
    </div>

    <!-- Reconnecting Banner Notice if active -->
    <div
      v-if="roomStore.isReconnecting"
      data-testid="waiting-reconnecting-banner"
      class="p-3 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-900 text-xs font-bold flex items-center justify-between gap-3 shadow-xs"
    >
      <div class="flex items-center gap-2">
        <RefreshCw class="w-4 h-4 animate-spin text-amber-700 shrink-0" />
        <span>{{
          roomStore.reconnectMessage || 'Koneksi terputus. Mencoba menyambung kembali...'
        }}</span>
      </div>
      <button
        v-if="!roomStore.isHost"
        data-testid="waiting-reconnect-retry-btn"
        class="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-heading font-black cursor-pointer shadow-xs whitespace-nowrap"
        @click="roomStore.manualRetryReconnect()"
      >
        Coba Sekarang
      </button>
    </div>

    <!-- Connection Error Notice if present -->
    <div
      v-if="roomStore.connectionError"
      data-testid="waiting-connection-error"
      class="p-3 rounded-2xl bg-rose-50 border-2 border-rose-300 text-rose-700 text-xs font-bold text-center flex items-center justify-center gap-2"
    >
      <AlertCircle class="w-4 h-4 text-rose-600 shrink-0" />
      <span>{{ roomStore.connectionError }}</span>
    </div>

    <!-- Personal Wardrobe Bar -->
    <div
      data-testid="lobby-wardrobe-bar"
      class="flex items-center justify-between p-3 rounded-2xl bg-white border border-neutral-300 shadow-2xs gap-3 flex-wrap"
    >
      <div class="flex items-center gap-2.5">
        <div
          class="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0"
        >
          <Shirt class="w-4 h-4" />
        </div>
        <div class="flex flex-col">
          <span
            class="text-[10px] font-heading font-black text-neutral-500 uppercase tracking-wider"
          >
            Setelan Busana Karakter
          </span>
          <span class="font-sans font-bold text-xs text-neutral-900">
            {{ currentOutfitName }}
          </span>
        </div>
      </div>

      <button
        type="button"
        data-testid="lobby-open-wardrobe-btn"
        class="px-3 py-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 active:scale-95 text-neutral-800 border border-neutral-300 font-heading font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
        @click="showWardrobeModal = true"
      >
        <Shirt class="w-3.5 h-3.5 text-neutral-600" />
        <span>Ganti Busana</span>
      </button>
    </div>

    <!-- Mobile-Only Team Tabs (< md) -->
    <div
      data-testid="mobile-team-tab-selector"
      class="grid grid-cols-2 gap-1.5 p-1 bg-neutral-100 rounded-2xl border border-neutral-200 md:hidden"
    >
      <button
        type="button"
        data-testid="mobile-tab-blue"
        :class="[
          'py-2 px-3 rounded-xl font-heading font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer',
          activeMobileTab === 'blue'
            ? 'bg-blue-600 text-white shadow-xs'
            : 'text-neutral-600 hover:text-neutral-900',
        ]"
        @click="activeMobileTab = 'blue'"
      >
        <Shield class="w-3.5 h-3.5" />
        <span>Benteng Biru ({{ roomStore.bluePlayers.length }})</span>
      </button>

      <button
        type="button"
        data-testid="mobile-tab-red"
        :class="[
          'py-2 px-3 rounded-xl font-heading font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer',
          activeMobileTab === 'red'
            ? 'bg-red-600 text-white shadow-xs'
            : 'text-neutral-600 hover:text-neutral-900',
        ]"
        @click="activeMobileTab = 'red'"
      >
        <Swords class="w-3.5 h-3.5" />
        <span>Benteng Merah ({{ roomStore.redPlayers.length }})</span>
      </button>
    </div>

    <!-- 2 Fortress Columns (Desktop: Side-by-side; Mobile: Tab-filtered) -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
      <!-- Kolom Kiri: Benteng Biru -->
      <div
        data-testid="roster-blue"
        :class="[
          'flex-col justify-between gap-3.5 p-4 sm:p-5 rounded-3xl bg-blue-50/70 border-2 border-blue-300 border-b-[6px] border-b-blue-400 shadow-sm',
          activeMobileTab === 'blue' ? 'flex' : 'hidden md:flex',
        ]"
      >
        <!-- Header Benteng Biru -->
        <div class="flex items-center justify-between border-b border-blue-200 pb-2.5">
          <div class="flex items-center gap-2">
            <Castle class="w-4 h-4 text-blue-600 shrink-0" />
            <span
              class="font-heading font-black text-xs sm:text-sm uppercase text-blue-900 tracking-wider"
            >
              Benteng Biru
            </span>
          </div>
          <span
            class="px-2.5 py-0.5 rounded-full bg-blue-200/80 text-blue-800 font-heading font-black text-xs"
          >
            {{ roomStore.bluePlayers.length }} Pemain
          </span>
        </div>

        <!-- Daftar Pemain Tim Biru -->
        <div
          class="flex flex-col gap-2 min-h-[120px] max-h-[200px] sm:max-h-[220px] overflow-y-auto pr-1"
        >
          <div
            v-for="p in roomStore.bluePlayers"
            :key="p.id"
            :data-testid="`player-item-${p.id}`"
            class="flex items-center justify-between p-2.5 rounded-2xl bg-white border border-blue-100 shadow-2xs"
          >
            <div class="flex items-center gap-2 truncate">
              <Crown v-if="p.isHost" class="w-4 h-4 text-amber-500 shrink-0" />
              <User v-else class="w-4 h-4 text-neutral-400 shrink-0" />
              <span class="font-sans font-bold text-xs text-neutral-800 truncate">
                {{ p.username }} {{ p.id === roomStore.myPlayerId ? '(Anda)' : '' }}
              </span>
              <span
                class="text-[9px] font-mono px-1 py-0.5 rounded bg-blue-100/80 text-blue-800 border border-blue-200/60 shrink-0"
                :title="`Busana: #${p.outfitId ?? 1}`"
              >
                #{{ p.outfitId ?? 1 }}
              </span>
            </div>
            <span
              :class="[
                'text-[10px] font-heading font-black uppercase px-2.5 py-1 rounded-lg tracking-wider flex items-center gap-1 shrink-0',
                p.isReady
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-neutral-100 text-neutral-500 border border-neutral-200',
              ]"
            >
              <CheckCircle2 v-if="p.isReady" class="w-3 h-3 text-emerald-700" />
              <Clock v-else class="w-3 h-3 text-neutral-400" />
              <span>{{ p.isReady ? 'Ready' : 'Belum' }}</span>
            </span>
          </div>

          <div
            v-if="roomStore.bluePlayers.length === 0"
            class="text-center py-6 sm:py-8 font-sans text-xs text-neutral-400 italic"
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
            class="timbul-btn timbul-btn-blue w-full py-3 text-xs font-black rounded-2xl cursor-pointer flex items-center justify-center gap-1.5"
            @click="onSelectTeam('blue')"
          >
            <Shield class="w-3.5 h-3.5" />
            <span>Masuk Tim Biru</span>
          </button>
          <div
            v-else
            class="w-full py-2.5 px-3 rounded-2xl bg-blue-600 text-white font-heading font-black text-xs text-center uppercase tracking-wider shadow-inner flex items-center justify-center gap-1.5"
          >
            <Check class="w-3.5 h-3.5" />
            <span>Anda Bergabung di Tim Biru</span>
          </div>
        </div>
      </div>

      <!-- Kolom Kanan: Benteng Merah -->
      <div
        data-testid="roster-red"
        :class="[
          'flex-col justify-between gap-3.5 p-4 sm:p-5 rounded-3xl bg-red-50/70 border-2 border-red-300 border-b-[6px] border-b-red-400 shadow-sm',
          activeMobileTab === 'red' ? 'flex' : 'hidden md:flex',
        ]"
      >
        <!-- Header Benteng Merah -->
        <div class="flex items-center justify-between border-b border-red-200 pb-2.5">
          <div class="flex items-center gap-2">
            <Castle class="w-4 h-4 text-red-600 shrink-0" />
            <span
              class="font-heading font-black text-xs sm:text-sm uppercase text-red-900 tracking-wider"
            >
              Benteng Merah
            </span>
          </div>
          <span
            class="px-2.5 py-0.5 rounded-full bg-red-200/80 text-red-800 font-heading font-black text-xs"
          >
            {{ roomStore.redPlayers.length }} Pemain
          </span>
        </div>

        <!-- Daftar Pemain Tim Merah -->
        <div
          class="flex flex-col gap-2 min-h-[120px] max-h-[200px] sm:max-h-[220px] overflow-y-auto pr-1"
        >
          <div
            v-for="p in roomStore.redPlayers"
            :key="p.id"
            :data-testid="`player-item-${p.id}`"
            class="flex items-center justify-between p-2.5 rounded-2xl bg-white border border-red-100 shadow-2xs"
          >
            <div class="flex items-center gap-2 truncate">
              <Crown v-if="p.isHost" class="w-4 h-4 text-amber-500 shrink-0" />
              <User v-else class="w-4 h-4 text-neutral-400 shrink-0" />
              <span class="font-sans font-bold text-xs text-neutral-800 truncate">
                {{ p.username }} {{ p.id === roomStore.myPlayerId ? '(Anda)' : '' }}
              </span>
              <span
                class="text-[9px] font-mono px-1 py-0.5 rounded bg-blue-100/80 text-blue-800 border border-blue-200/60 shrink-0"
                :title="`Busana: #${p.outfitId ?? 1}`"
              >
                #{{ p.outfitId ?? 1 }}
              </span>
            </div>
            <span
              :class="[
                'text-[10px] font-heading font-black uppercase px-2.5 py-1 rounded-lg tracking-wider flex items-center gap-1 shrink-0',
                p.isReady
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-neutral-100 text-neutral-500 border border-neutral-200',
              ]"
            >
              <CheckCircle2 v-if="p.isReady" class="w-3 h-3 text-emerald-700" />
              <Clock v-else class="w-3 h-3 text-neutral-400" />
              <span>{{ p.isReady ? 'Ready' : 'Belum' }}</span>
            </span>
          </div>

          <div
            v-if="roomStore.redPlayers.length === 0"
            class="text-center py-6 sm:py-8 font-sans text-xs text-neutral-400 italic"
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
            class="timbul-btn timbul-btn-red w-full py-3 text-xs font-black rounded-2xl cursor-pointer flex items-center justify-center gap-1.5"
            @click="onSelectTeam('red')"
          >
            <Swords class="w-3.5 h-3.5" />
            <span>Masuk Tim Merah</span>
          </button>
          <div
            v-else
            class="w-full py-2.5 px-3 rounded-2xl bg-red-600 text-white font-heading font-black text-xs text-center uppercase tracking-wider shadow-inner flex items-center justify-center gap-1.5"
          >
            <Check class="w-3.5 h-3.5" />
            <span>Anda Bergabung di Tim Merah</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Error notice if any -->
    <div
      v-if="roomStore.connectionError"
      data-testid="waiting-room-error"
      class="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold text-center flex items-center justify-center gap-2"
    >
      <AlertCircle class="w-4 h-4 text-rose-600 shrink-0" />
      <span>{{ roomStore.connectionError }}</span>
    </div>

    <!-- Sticky Bottom Actions Section -->
    <div
      data-testid="waiting-sticky-actions"
      class="sticky bottom-0 bg-white/95 backdrop-blur-md pt-3 pb-1 border-t border-neutral-200/80 flex flex-col gap-2.5 z-20 mt-auto rounded-b-2xl"
    >
      <!-- Non-Host Layout: Keluar and Ready side-by-side horizontally -->
      <div v-if="!roomStore.isHost" class="grid grid-cols-2 gap-2.5">
        <TactileButton
          variant="neutral"
          data-testid="waiting-leave-btn"
          class="w-full text-xs sm:text-sm py-3 flex items-center justify-center gap-1.5"
          @click="handleLeaveClick"
        >
          <ArrowLeft class="w-4 h-4 shrink-0" />
          <span>Keluar</span>
        </TactileButton>

        <TactileButton
          :variant="roomStore.isReady ? 'red' : 'emerald'"
          data-testid="waiting-toggle-ready-btn"
          class="w-full text-xs sm:text-sm py-3 flex items-center justify-center gap-2"
          @click="onToggleReady"
        >
          <X v-if="roomStore.isReady" class="w-4 h-4 shrink-0 stroke-[2.5]" />
          <CheckCircle2 v-else class="w-4 h-4 shrink-0 stroke-[2.5]" />
          <span>{{ roomStore.isReady ? 'Batal' : 'Ready' }}</span>
        </TactileButton>
      </div>

      <!-- Host Layout: Ready and Start Match side-by-side, Leave below -->
      <div v-else class="flex flex-col gap-2.5">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <!-- Ready Toggle Button for Host -->
          <TactileButton
            :variant="roomStore.isReady ? 'red' : 'emerald'"
            data-testid="waiting-toggle-ready-btn"
            class="w-full text-xs sm:text-sm py-3 flex items-center justify-center gap-2"
            @click="onToggleReady"
          >
            <X v-if="roomStore.isReady" class="w-4 h-4 shrink-0 stroke-[2.5]" />
            <CheckCircle2 v-else class="w-4 h-4 shrink-0 stroke-[2.5]" />
            <span>{{ roomStore.isReady ? 'Batal' : 'Ready' }}</span>
          </TactileButton>

          <!-- Host-only Start Match Button -->
          <TactileButton
            variant="amber"
            data-testid="waiting-start-match-btn"
            :disabled="!roomStore.canStartMatch"
            class="w-full text-xs sm:text-sm py-3 flex items-center justify-center gap-2"
            @click="handleStartClick"
          >
            <Play class="w-4 h-4 fill-amber-950 shrink-0" />
            <span>Mulai Permainan!</span>
          </TactileButton>
        </div>

        <!-- Warning hint if cannot start -->
        <p
          v-if="!roomStore.startableStatus.startable"
          data-testid="startable-reason-hint"
          class="text-center font-sans text-xs text-amber-600 font-bold flex items-center justify-center gap-1.5"
        >
          <AlertCircle class="w-3.5 h-3.5 shrink-0" />
          <span>{{ roomStore.startableStatus.reason }}</span>
        </p>

        <!-- Leave Room for Host -->
        <button
          type="button"
          data-testid="waiting-leave-btn"
          class="text-xs font-heading font-bold uppercase tracking-wider text-neutral-400 hover:text-neutral-600 transition-colors py-1 cursor-pointer self-center flex items-center gap-1.5"
          @click="handleLeaveClick"
        >
          <ArrowLeft class="w-3.5 h-3.5" />
          <span>Tutup / Keluar dari Ruangan</span>
        </button>
      </div>
    </div>

    <!-- Dialog Konfirmasi Keluar Ruangan -->
    <ConfirmDialog
      v-if="showLeaveDialog"
      type="danger"
      data-testid="dialog-leave-room"
      title="Keluar dari Ruangan?"
      :message="
        roomStore.isHost
          ? 'Sebagai Tuan Rumah (Host), jika Anda keluar maka ruangan ini akan ditutup dan seluruh pemain akan terputus.'
          : 'Anda akan meninggalkan benteng dan kembali ke beranda.'
      "
      confirm-text="Ya, Keluar"
      cancel-text="Batal"
      confirm-variant="red"
      @confirm="confirmLeave"
      @cancel="showLeaveDialog = false"
      @close="showLeaveDialog = false"
    />

    <!-- Dialog Konfirmasi Mulai Pertandingan (Opsi A) -->
    <ConfirmDialog
      v-if="showStartDialog"
      type="confirm"
      data-testid="dialog-start-match"
      title="Mulai Pertandingan?"
      message="Seluruh pemain yang terhubung di Benteng Biru dan Merah akan langsung masuk ke arena 3D."
      confirm-text="Mulai"
      cancel-text="Batal"
      confirm-variant="amber"
      @confirm="confirmStart"
      @cancel="showStartDialog = false"
      @close="showStartDialog = false"
    >
      <div class="flex items-center justify-center gap-2 py-1 text-xs font-heading font-black">
        <span
          class="px-2.5 py-1 rounded-xl bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1.5"
        >
          <Castle class="w-3.5 h-3.5 text-blue-600" />
          <span>Benteng Biru: {{ roomStore.bluePlayers.length }}</span>
        </span>
        <span class="text-neutral-400">vs</span>
        <span
          class="px-2.5 py-1 rounded-xl bg-red-100 text-red-800 border border-red-200 flex items-center gap-1.5"
        >
          <Castle class="w-3.5 h-3.5 text-red-600" />
          <span>Benteng Merah: {{ roomStore.redPlayers.length }}</span>
        </span>
      </div>
    </ConfirmDialog>

    <!-- Floating Toast Notifications for Lobby -->
    <div
      data-testid="lobby-toast-stack"
      class="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 flex flex-col gap-2 z-50 sm:max-w-sm pointer-events-auto"
    >
      <transition-group
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="translate-y-4 opacity-0"
        enter-to-class="translate-y-0 opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="translate-y-0 opacity-100"
        leave-to-class="translate-y-4 opacity-0"
      >
        <div
          v-for="toast in roomStore.activeToasts"
          :key="toast.id"
          :data-testid="`lobby-toast-${toast.type}`"
          :class="[
            'px-4 py-2.5 rounded-xl text-xs font-heading font-bold shadow-xl border-b-[3px] flex items-center justify-between gap-3',
            toast.type === 'warn'
              ? 'bg-amber-500 text-amber-950 border-amber-700'
              : toast.type === 'success'
                ? 'bg-emerald-600 text-white border-emerald-800'
                : 'bg-neutral-800 text-neutral-100 border-neutral-900',
          ]"
        >
          <span>{{ toast.message }}</span>
          <button
            class="text-xs opacity-75 hover:opacity-100 ml-2 cursor-pointer p-0.5"
            @click="roomStore.removeToast(toast.id)"
          >
            <X class="w-3.5 h-3.5" />
          </button>
        </div>
      </transition-group>
    </div>
    <!-- Modal Lemari Busana Karakter -->
    <CharacterPickerModal
      v-if="showWardrobeModal"
      :team="roomStore.myTeam"
      @close="showWardrobeModal = false"
    />
  </div>
</template>
