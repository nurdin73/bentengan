<script setup lang="ts">
import { ref } from 'vue'
import {
  Swords,
  Shield,
  Sparkles,
  LogIn,
  AlertCircle,
  Users,
  Check,
  Clock,
  Globe,
  Lock,
} from 'lucide-vue-next'
import type { TeamId } from '../../types/game.types'

const props = defineProps<{
  initialUsername: string
  initialTeam: TeamId
  isConnecting: boolean
  connectionError: string | null
}>()

const emit = defineEmits<{
  (e: 'create-host', payload: {
    username: string
    team: TeamId
    roomCode: string
    maxPlayers: 8 | 12
    matchDurationSec: number
    privacy: 'public' | 'private'
    pin?: string
  }): void
  (e: 'join-room', payload: {
    username: string
    team: TeamId
    roomCode: string
    pin?: string
  }): void
}>()

const username = ref(props.initialUsername)
const selectedCapacity = ref<8 | 12>(8)
const selectedDuration = ref<number>(300)
const selectedPrivacy = ref<'public' | 'private'>('public')
const hostPin = ref('')
const targetRoomCode = ref('')
const joinPin = ref('')
const hostRoomCode = ref(
  Math.random().toString(36).substring(2, 6).toUpperCase() +
  Math.floor(10 + Math.random() * 90),
)

const durationOptions = [
  { value: 180, label: '3 Menit', sub: 'Kilat' },
  { value: 300, label: '5 Menit', sub: 'Standar' },
  { value: 600, label: '10 Menit', sub: 'Panjang' },
  { value: 0, label: 'Bebas', sub: 'Tanpa Batas' },
] as const

const onSelectPrivacy = (privacy: 'public' | 'private') => {
  selectedPrivacy.value = privacy
  if (privacy === 'private' && !hostPin.value.trim()) {
    hostPin.value = Math.floor(1000 + Math.random() * 9000).toString()
  }
}

const onCreateHost = () => {
  const code = hostRoomCode.value.trim().toUpperCase() || 'BENTENG'
  emit('create-host', {
    username: username.value.trim() || 'Host',
    team: 'blue',
    roomCode: code,
    maxPlayers: selectedCapacity.value,
    matchDurationSec: selectedDuration.value,
    privacy: selectedPrivacy.value,
    pin: selectedPrivacy.value === 'private' ? hostPin.value.trim() : undefined,
  })
}

const onJoinRoom = () => {
  if (!targetRoomCode.value.trim()) return
  const code = targetRoomCode.value.trim().toUpperCase()
  emit('join-room', {
    username: username.value.trim() || 'Pemain',
    team: 'red',
    roomCode: code,
    pin: joinPin.value.trim() || undefined,
  })
}
</script>

<template>
  <div
    data-testid="lobby-mode-selector"
    class="bg-white border-2 border-neutral-200/90 rounded-[24px] sm:rounded-[28px] p-4 sm:p-8 shadow-xs flex flex-col gap-3.5 sm:gap-4 relative"
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
        class="w-full bg-neutral-100/90 border border-neutral-300 focus:border-amber-400 focus:bg-white rounded-2xl px-4 py-2.5 sm:py-3 font-sans font-bold text-neutral-800 text-base sm:text-sm outline-none transition-all placeholder:text-neutral-400"
      />
    </div>

    <!-- Pilihan Format Pertandingan (4v4 vs 6v6) sebagai Tombol Timbul -->
    <div class="flex flex-col gap-1.5">
      <label class="font-heading font-black text-xs uppercase tracking-wider text-neutral-800 flex items-center gap-1.5">
        <Users class="w-3.5 h-3.5 text-neutral-600" />
        <span>Format Pertandingan</span>
      </label>

      <div class="grid grid-cols-2 gap-2.5 sm:gap-3">
        <!-- Tombol 4 vs 4 -->
        <button
          type="button"
          data-testid="capacity-4v4-btn"
          :class="[
            'timbul-btn flex flex-col items-center justify-center py-2 sm:py-2.5 px-3 rounded-2xl border-2 transition-all cursor-pointer relative',
            selectedCapacity === 8
              ? 'bg-amber-50/90 border-amber-400 border-b-[5px] border-b-amber-600 shadow-xs'
              : 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 border-b-[4px] border-b-neutral-400 text-neutral-600 opacity-80 hover:opacity-100',
          ]"
          @click="selectedCapacity = 8"
        >
          <div class="flex items-center gap-1.5">
            <Swords
              :class="['w-4 h-4', selectedCapacity === 8 ? 'text-amber-700' : 'text-neutral-500']"
            />
            <span
              :class="[
                'font-heading font-black text-xs sm:text-sm tracking-wider uppercase',
                selectedCapacity === 8 ? 'text-neutral-950' : 'text-neutral-700',
              ]"
            >
              4 vs 4
            </span>
            <Check
              v-if="selectedCapacity === 8"
              class="w-3.5 h-3.5 text-amber-700 stroke-[3]"
            />
          </div>
          <span
            :class="[
              'font-sans text-[10px] sm:text-[11px] font-bold mt-0.5',
              selectedCapacity === 8 ? 'text-amber-800' : 'text-neutral-400',
            ]"
          >
            Maks. 8 Pemain
          </span>
        </button>

        <!-- Tombol 6 vs 6 -->
        <button
          type="button"
          data-testid="capacity-6v6-btn"
          :class="[
            'timbul-btn flex flex-col items-center justify-center py-2 sm:py-2.5 px-3 rounded-2xl border-2 transition-all cursor-pointer relative',
            selectedCapacity === 12
              ? 'bg-blue-50/90 border-blue-400 border-b-[5px] border-b-blue-600 shadow-xs'
              : 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 border-b-[4px] border-b-neutral-400 text-neutral-600 opacity-80 hover:opacity-100',
          ]"
          @click="selectedCapacity = 12"
        >
          <div class="flex items-center gap-1.5">
            <Shield
              :class="['w-4 h-4', selectedCapacity === 12 ? 'text-blue-700' : 'text-neutral-500']"
            />
            <span
              :class="[
                'font-heading font-black text-xs sm:text-sm tracking-wider uppercase',
                selectedCapacity === 12 ? 'text-neutral-950' : 'text-neutral-700',
              ]"
            >
              6 vs 6
            </span>
            <Check
              v-if="selectedCapacity === 12"
              class="w-3.5 h-3.5 text-blue-700 stroke-[3]"
            />
          </div>
          <span
            :class="[
              'font-sans text-[10px] sm:text-[11px] font-bold mt-0.5',
              selectedCapacity === 12 ? 'text-blue-800' : 'text-neutral-400',
            ]"
          >
            Maks. 12 Pemain
          </span>
        </button>
      </div>
    </div>

    <!-- Durasi Pertandingan -->
    <div class="flex flex-col gap-1.5">
      <label class="font-heading font-black text-xs uppercase tracking-wider text-neutral-800 flex items-center gap-1.5">
        <Clock class="w-3.5 h-3.5 text-neutral-600" />
        <span>Durasi Pertandingan</span>
      </label>

      <div class="grid grid-cols-4 gap-1.5 sm:gap-2">
        <button
          v-for="opt in durationOptions"
          :key="opt.value"
          type="button"
          :data-testid="`duration-${opt.value}-btn`"
          :class="[
            'timbul-btn flex flex-col items-center justify-center py-1.5 sm:py-2 px-1 rounded-xl border-2 transition-all cursor-pointer text-center',
            selectedDuration === opt.value
              ? 'bg-amber-50/90 border-amber-400 border-b-[4px] border-b-amber-600 shadow-2xs'
              : 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 border-b-[3px] border-b-neutral-400 text-neutral-600 opacity-80 hover:opacity-100',
          ]"
          @click="selectedDuration = opt.value"
        >
          <span
            :class="[
              'font-heading font-black text-[11px] sm:text-xs tracking-wider uppercase',
              selectedDuration === opt.value ? 'text-neutral-950' : 'text-neutral-700',
            ]"
          >
            {{ opt.label }}
          </span>
          <span
            :class="[
              'font-sans text-[9px] sm:text-[10px] font-bold',
              selectedDuration === opt.value ? 'text-amber-800' : 'text-neutral-400',
            ]"
          >
            {{ opt.sub }}
          </span>
        </button>
      </div>
    </div>

    <!-- Tipe Akses Ruangan (Publik vs Privat) -->
    <div class="flex flex-col gap-1.5">
      <label class="font-heading font-black text-xs uppercase tracking-wider text-neutral-800 flex items-center gap-1.5">
        <Lock class="w-3.5 h-3.5 text-neutral-600" />
        <span>Akses Ruangan</span>
      </label>

      <div class="grid grid-cols-2 gap-2.5 sm:gap-3">
        <!-- Tombol Publik -->
        <button
          type="button"
          data-testid="privacy-public-btn"
          :class="[
            'timbul-btn flex flex-col items-center justify-center py-2 sm:py-2.5 px-3 rounded-2xl border-2 transition-all cursor-pointer relative',
            selectedPrivacy === 'public'
              ? 'bg-emerald-50/90 border-emerald-400 border-b-[5px] border-b-emerald-600 shadow-xs'
              : 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 border-b-[4px] border-b-neutral-400 text-neutral-600 opacity-80 hover:opacity-100',
          ]"
          @click="onSelectPrivacy('public')"
        >
          <div class="flex items-center gap-1.5">
            <Globe
              :class="['w-4 h-4', selectedPrivacy === 'public' ? 'text-emerald-700' : 'text-neutral-500']"
            />
            <span
              :class="[
                'font-heading font-black text-xs sm:text-sm tracking-wider uppercase',
                selectedPrivacy === 'public' ? 'text-neutral-950' : 'text-neutral-700',
              ]"
            >
              Publik
            </span>
            <Check
              v-if="selectedPrivacy === 'public'"
              class="w-3.5 h-3.5 text-emerald-700 stroke-[3]"
            />
          </div>
          <span
            :class="[
              'font-sans text-[10px] sm:text-[11px] font-bold mt-0.5',
              selectedPrivacy === 'public' ? 'text-emerald-800' : 'text-neutral-400',
            ]"
          >
            Siapapun bisa masuk
          </span>
        </button>

        <!-- Tombol Privat -->
        <button
          type="button"
          data-testid="privacy-private-btn"
          :class="[
            'timbul-btn flex flex-col items-center justify-center py-2 sm:py-2.5 px-3 rounded-2xl border-2 transition-all cursor-pointer relative',
            selectedPrivacy === 'private'
              ? 'bg-rose-50/90 border-rose-400 border-b-[5px] border-b-rose-600 shadow-xs'
              : 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 border-b-[4px] border-b-neutral-400 text-neutral-600 opacity-80 hover:opacity-100',
          ]"
          @click="onSelectPrivacy('private')"
        >
          <div class="flex items-center gap-1.5">
            <Lock
              :class="['w-4 h-4', selectedPrivacy === 'private' ? 'text-rose-700' : 'text-neutral-500']"
            />
            <span
              :class="[
                'font-heading font-black text-xs sm:text-sm tracking-wider uppercase',
                selectedPrivacy === 'private' ? 'text-neutral-950' : 'text-neutral-700',
              ]"
            >
              Privat
            </span>
            <Check
              v-if="selectedPrivacy === 'private'"
              class="w-3.5 h-3.5 text-rose-700 stroke-[3]"
            />
          </div>
          <span
            :class="[
              'font-sans text-[10px] sm:text-[11px] font-bold mt-0.5',
              selectedPrivacy === 'private' ? 'text-rose-800' : 'text-neutral-400',
            ]"
          >
            Kunci dengan PIN
          </span>
        </button>
      </div>

      <!-- Input PIN Host jika Privat dipilih -->
      <div v-if="selectedPrivacy === 'private'" class="flex flex-col gap-1 mt-1">
        <input
          id="hostPin"
          v-model="hostPin"
          data-testid="host-pin-input"
          type="password"
          maxlength="6"
          placeholder="Ketik PIN (cth: 1234)..."
          class="w-full bg-neutral-100/90 border-2 border-rose-300 focus:border-rose-500 focus:bg-white rounded-2xl px-4 py-2 font-mono font-bold text-center tracking-[0.25em] text-neutral-800 text-sm outline-none transition-all placeholder:font-sans placeholder:tracking-normal placeholder:text-neutral-400 placeholder:text-xs"
        />
        <span class="text-[10px] text-rose-700 font-bold px-1">
          *Pemain harus memasukkan PIN ini untuk bisa bergabung ke ruanganmu.
        </span>
      </div>
    </div>

    <!-- 2-Column Action Grid on Desktop, Stacked with Divider on Mobile -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
      <!-- Kolom 1 (Kiri): Tombol Besar Buat Ruangan -->
      <button
        type="button"
        data-testid="lobby-create-room-btn"
        :disabled="isConnecting || (selectedPrivacy === 'private' && !hostPin.trim())"
        class="timbul-btn w-full py-3.5 sm:min-h-[105px] h-full bg-[#ff5e42] hover:bg-[#ff6e54] text-white border-[#d83c20] border-b-[#b52a12] border-b-[5px] text-sm sm:text-base font-black rounded-2xl flex items-center justify-center gap-2 p-3 sm:p-4 cursor-pointer active:translate-y-[2px] active:border-b-[2px] transition-all disabled:opacity-50"
        @click="onCreateHost"
      >
        <Sparkles class="w-5 h-5 text-amber-200 shrink-0" />
        <span>{{ isConnecting ? 'Menyiapkan Ruangan...' : 'Buat Ruangan' }}</span>
      </button>

      <!-- Mobile-only subtle visual divider -->
      <div class="flex items-center gap-2.5 sm:hidden py-0.5">
        <div class="flex-1 h-px bg-neutral-200"></div>
        <span class="text-[10px] font-heading font-black uppercase tracking-widest text-neutral-400">Atau Masukkan Kode</span>
        <div class="flex-1 h-px bg-neutral-200"></div>
      </div>

      <!-- Kolom 2 (Kanan): Input Kode + PIN (Opsional) + Gabung Ruangan -->
      <div class="flex flex-col gap-2 sm:gap-2.5 h-full justify-between">
        <div class="flex flex-col gap-1.5">
          <!-- Input Kode Room -->
          <input
            id="targetRoomCode"
            v-model="targetRoomCode"
            data-testid="join-room-code-input"
            type="text"
            maxlength="8"
            placeholder="K O D E"
            autocapitalize="characters"
            autocomplete="off"
            spellcheck="false"
            class="w-full bg-neutral-100/90 border border-neutral-300 focus:border-indigo-400 focus:bg-white rounded-2xl py-2 px-3 text-center font-mono font-black text-neutral-800 text-base sm:text-sm tracking-[0.25em] uppercase outline-none transition-all placeholder:text-neutral-400 placeholder:tracking-[0.25em]"
          />

          <!-- Input PIN (bila ruangan privat) -->
          <input
            id="joinPin"
            v-model="joinPin"
            data-testid="join-room-pin-input"
            type="password"
            maxlength="6"
            placeholder="PIN (Bila Privat)"
            class="w-full bg-neutral-100/90 border border-neutral-300 focus:border-indigo-400 focus:bg-white rounded-2xl py-2 px-3 text-center font-mono font-bold text-neutral-800 text-xs tracking-[0.2em] outline-none transition-all placeholder:font-sans placeholder:tracking-normal placeholder:text-neutral-400 placeholder:text-xs"
          />
        </div>

        <!-- Tombol Gabung Ruangan (Full Width) -->
        <button
          type="button"
          data-testid="lobby-join-room-btn"
          :disabled="isConnecting || !targetRoomCode.trim()"
          class="timbul-btn w-full py-2.5 px-3 bg-[#b29efb] hover:bg-[#bfaeff] text-[#2c1d68] border-[#8e75eb] border-b-[#755bd9] border-b-[4px] text-xs font-black rounded-2xl flex items-center justify-center gap-1.5 cursor-pointer active:translate-y-[2px] active:border-b-[2px] transition-all disabled:opacity-40"
          @click="onJoinRoom"
        >
          <LogIn class="w-4 h-4 shrink-0" />
          <span>Gabung Ruangan</span>
        </button>
      </div>
    </div>

    <!-- Error notice -->
    <div
      v-if="connectionError"
      data-testid="lobby-connection-error"
      class="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold text-center flex items-center justify-center gap-2"
    >
      <AlertCircle class="w-4 h-4 text-rose-600 shrink-0" />
      <span>{{ connectionError }}</span>
    </div>
  </div>
</template>
