<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  Wifi,
  Smartphone,
  RefreshCw,
  HeartHandshake,
  ZapOff,
  Crosshair,
  HelpCircle,
  Timer,
  Clock,
  Settings,
} from 'lucide-vue-next'
import { useGameStore } from '../../stores/game-store'
import { useRoomStore } from '../../stores/room-store'
import MobileTouchControls from './MobileTouchControls.vue'
import RotateDevicePrompt from './RotateDevicePrompt.vue'
import SkillActionBar from './SkillActionBar.vue'
import GameControlsModal from '../guide/GameControlsModal.vue'
import SettingsModal from '../settings/SettingsModal.vue'
import DevDebugPanel from '../dev/DevDebugPanel.vue'
import { checkIsMobileTouchDevice } from './mobile-device.utils'
import type { VirtualMovementInput } from '../../game/input/input-manager'
import type { SkillId } from '../../game/skills/skill-types'

const gameStore = useGameStore()
const roomStore = useRoomStore()

const isMobile = ref(false)
const forceShowMobileHUD = ref(false)

const isEffectiveMobile = computed(() => isMobile.value || forceShowMobileHUD.value)

const updateDeviceDetection = () => {
  isMobile.value = checkIsMobileTouchDevice()
}

updateDeviceDetection()

onMounted(() => {
  updateDeviceDetection()
  window.addEventListener('resize', updateDeviceDetection)
  window.addEventListener('orientationchange', updateDeviceDetection)
  try {
    forceShowMobileHUD.value = sessionStorage.getItem('bentengan_force_mobile_hud') === 'true'
  } catch {
    // Ignore storage errors in restricted contexts
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', updateDeviceDetection)
  window.removeEventListener('orientationchange', updateDeviceDetection)
})

const toggleMobileHUD = () => {
  forceShowMobileHUD.value = !forceShowMobileHUD.value
  try {
    sessionStorage.setItem('bentengan_force_mobile_hud', String(forceShowMobileHUD.value))
  } catch {
    // Ignore storage errors
  }
}

const showControlsModal = ref(false)
const showSettingsModal = ref(false)

const openControlsModal = () => {
  document.exitPointerLock?.()
  showControlsModal.value = true
}

const closeControlsModal = () => {
  showControlsModal.value = false
}

const openSettingsModal = () => {
  document.exitPointerLock?.()
  showSettingsModal.value = true
}

const closeSettingsModal = () => {
  showSettingsModal.value = false
}

defineEmits<{
  (e: 'request-pointer-lock'): void
  (e: 'virtual-move', movement: VirtualMovementInput): void
  (e: 'virtual-sprint', sprint: boolean): void
  (e: 'virtual-jump', jump: boolean): void
  (e: 'virtual-look', delta: { deltaX: number; deltaY: number }): void
  (e: 'virtual-interact'): void
  (e: 'trigger-skill', skillId: SkillId): void
}>()
</script>

<template>
  <div data-testid="game-hud" class="pointer-events-none absolute inset-0 flex flex-col justify-between p-3 sm:p-5">
    <!-- Top Bar: Network Signal on Left -->
    <div class="flex items-center justify-between w-full z-30">
      <div
        data-testid="hud-network-signal"
        class="pointer-events-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-900/80 backdrop-blur-md border border-neutral-700/80 shadow-md text-xs font-mono font-bold text-neutral-200 select-none"
      >
        <Wifi
          data-testid="hud-signal-icon"
          :class="[
            'w-3.5 h-3.5 shrink-0 transition-colors',
            roomStore.isReconnecting
              ? 'text-amber-400 animate-pulse'
              : roomStore.latencyMs < 80
                ? 'text-emerald-400'
                : roomStore.latencyMs < 150
                  ? 'text-amber-400'
                  : 'text-rose-500 animate-pulse',
          ]"
        />
        <span>{{ roomStore.isReconnecting ? 'Menyambung...' : `${roomStore.latencyMs} ms` }}</span>
        <span v-if="roomStore.roomCode && roomStore.roomCode !== 'LOKAL'" class="text-neutral-500 text-[10px] hidden xs:inline">
          &bull; {{ roomStore.roomCode }}
        </span>
      </div>

      <!-- Top Center: Match Countdown Timer & Jailed Scoreboard -->
      <div
        data-testid="hud-match-timer-scoreboard"
        class="pointer-events-auto flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-neutral-900/85 backdrop-blur-md border border-neutral-700/80 shadow-md text-xs font-mono font-bold select-none"
      >
        <!-- Blue Team Captured Score (Red jailed by Blue) -->
        <div class="flex items-center gap-1 text-blue-400" title="Pemain Merah yang Ditawan Biru">
          <span class="w-2 h-2 rounded-full bg-blue-500 shrink-0"></span>
          <span data-testid="hud-blue-score" class="font-mono text-xs font-black">{{ gameStore.redJailedCount }}</span>
        </div>

        <span class="text-neutral-500 font-sans text-[10px]">&bull;</span>

        <!-- Match Timer Display -->
        <div
          data-testid="hud-timer-display"
          :class="[
            'flex items-center gap-1 font-mono font-black text-xs sm:text-sm px-1',
            gameStore.remainingTimeSec <= 30 && gameStore.matchDurationLimitSec > 0
              ? 'text-rose-400 animate-pulse'
              : 'text-neutral-100',
          ]"
        >
          <Clock class="w-3.5 h-3.5 text-neutral-400 shrink-0" />
          <span>{{ gameStore.formattedRemainingTime }}</span>
        </div>

        <span class="text-neutral-500 font-sans text-[10px]">&bull;</span>

        <!-- Red Team Captured Score (Blue jailed by Red) -->
        <div class="flex items-center gap-1 text-rose-400" title="Pemain Biru yang Ditawan Merah">
          <span data-testid="hud-red-score" class="font-mono text-xs font-black">{{ gameStore.blueJailedCount }}</span>
          <span class="w-2 h-2 rounded-full bg-rose-500 shrink-0"></span>
        </div>
      </div>

      <!-- Top Right: Desktop Controls, Settings & HUD HP Toggle (Desktop Only) -->
      <div v-if="!isMobile" class="flex items-center gap-2 pointer-events-auto">
        <!-- Settings Modal Button (Gear) -->
        <button
          data-testid="hud-settings-btn"
          type="button"
          class="flex items-center justify-center w-8 h-8 rounded-full bg-neutral-900/80 hover:bg-neutral-800 active:scale-95 border border-neutral-700/80 backdrop-blur-md shadow-md text-neutral-300 hover:text-white transition-all cursor-pointer"
          title="Pengaturan Game (Kamera, Audio & Grafis)"
          @click="openSettingsModal"
        >
          <Settings class="w-4 h-4" />
        </button>

        <!-- Controls Guide Help Button (?) -->
        <button
          data-testid="hud-controls-help-btn"
          type="button"
          class="flex items-center justify-center w-8 h-8 rounded-full bg-neutral-900/80 hover:bg-neutral-800 active:scale-95 border border-neutral-700/80 backdrop-blur-md shadow-md text-neutral-300 hover:text-white transition-all cursor-pointer"
          title="Panduan Kontrol (Keyboard & Mouse)"
          @click="openControlsModal"
        >
          <HelpCircle class="w-4 h-4" />
        </button>

        <!-- Compact Mobile HUD Testing Toggle -->
        <button
          data-testid="hud-toggle-mobile-controls-btn"
          type="button"
          :class="[
            'flex items-center justify-center gap-1.5 h-8 px-2.5 rounded-full border backdrop-blur-md shadow-md text-xs font-heading font-bold select-none cursor-pointer transition-all active:scale-95',
            forceShowMobileHUD
              ? 'bg-amber-500/25 border-amber-400/80 text-amber-300 ring-2 ring-amber-400/30'
              : 'bg-neutral-900/80 border-neutral-700/80 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/90',
          ]"
          title="Toggle Mobile HUD (Testing Mode)"
          @click="toggleMobileHUD"
        >
          <Smartphone class="w-3.5 h-3.5 shrink-0" />
          <span class="text-[11px] uppercase tracking-wider">HUD HP</span>
        </button>

        <!-- Developer Mode Toggle Button (Aligned side-by-side with Help and HUD HP) -->
        <DevDebugPanel />
      </div>
      <div v-else class="flex items-center gap-2 pointer-events-auto">
        <!-- Settings Modal Button Mobile -->
        <button
          data-testid="hud-settings-btn-mobile"
          type="button"
          class="flex items-center justify-center w-8 h-8 rounded-full bg-neutral-900/80 hover:bg-neutral-800 active:scale-95 border border-neutral-700/80 backdrop-blur-md shadow-md text-neutral-300 hover:text-white transition-all cursor-pointer"
          title="Pengaturan Game"
          @click="openSettingsModal"
        >
          <Settings class="w-4 h-4" />
        </button>
        <DevDebugPanel />
      </div>
    </div>

    <!-- Top Alerts Area (Pointer Lock Hint / Rescue Prompt / Immunity / Stun / Reconnecting) -->
    <div
      data-testid="hud-top-alerts-container"
      class="fixed top-14 sm:top-16 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2 max-w-lg w-full px-4 pointer-events-none"
    >
      <!-- Pointer Lock Instruction Hint (Desktop only - at top) -->
      <transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="scale-90 opacity-0"
        enter-to-class="scale-100 opacity-100"
        leave-active-class="transition duration-100 ease-in"
        leave-from-class="scale-100 opacity-100"
        leave-to-class="scale-90 opacity-0"
      >
        <div
          v-if="!gameStore.isPointerLocked && !isEffectiveMobile"
          data-testid="hud-pointer-lock-prompt"
          class="pointer-events-auto cursor-pointer timbul-card-dark bg-neutral-900/90 hover:bg-neutral-800 px-5 py-2 rounded-2xl border-b-[4px] border-neutral-950 flex items-center gap-3 transition-all shadow-xl select-none"
          @click="$emit('request-pointer-lock')"
        >
          <Crosshair class="w-5 h-5 shrink-0 text-amber-400 animate-pulse" />
          <div class="text-xs sm:text-sm font-sans font-bold text-neutral-200">
            Klik layar untuk mengunci kursor mouse & mengarahkan kamera
          </div>
        </div>
      </transition>
      <!-- Reconnecting Overlay Banner -->
      <transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="scale-95 opacity-0"
        enter-to-class="scale-100 opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="scale-100 opacity-100"
        leave-to-class="scale-95 opacity-0"
      >
        <div
          v-if="roomStore.isReconnecting"
          data-testid="hud-reconnecting-overlay"
          class="pointer-events-auto bg-amber-500/95 text-amber-950 border-b-[5px] border-amber-700 px-6 py-4 rounded-2xl shadow-2xl flex flex-col sm:flex-row items-center gap-4 max-w-lg mx-auto text-center sm:text-left animate-pulse"
        >
          <RefreshCw class="w-8 h-8 animate-spin shrink-0 text-amber-950" />
          <div class="flex-1">
            <div class="font-heading font-black text-base uppercase tracking-wider">
              MENYAMBUNG ULANG KONEKSI...
            </div>
            <div class="text-xs font-sans font-bold text-amber-900 mt-0.5">
              {{ roomStore.reconnectMessage || 'Koneksi terputus. Sistem sedang mencoba menghubungkan kembali secara otomatis...' }}
            </div>
          </div>
          <button
            v-if="!roomStore.isHost"
            data-testid="hud-reconnect-retry-btn"
            class="timbul-btn bg-amber-800 hover:bg-amber-900 text-white font-heading font-bold text-xs px-3 py-2 rounded-xl whitespace-nowrap cursor-pointer"
            @click="roomStore.manualRetryReconnect()"
          >
            Coba Sekarang
          </button>
        </div>
      </transition>

      <!-- Rescue Prompt (When near jailed ally) -->
      <transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="scale-90 opacity-0"
        enter-to-class="scale-100 opacity-100"
        leave-active-class="transition duration-100 ease-in"
        leave-from-class="scale-100 opacity-100"
        leave-to-class="scale-90 opacity-0"
      >
        <div
          v-if="gameStore.canRescueNearby"
          data-testid="hud-rescue-prompt"
          class="pointer-events-auto cursor-pointer bg-blue-600/95 border-b-[5px] border-blue-900 text-white font-heading font-black px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce active:translate-y-1"
          @click="$emit('virtual-interact')"
          @touchstart.prevent="$emit('virtual-interact')"
        >
          <HeartHandshake class="w-8 h-8 shrink-0 text-white drop-shadow-sm" />
          <div>
            <div class="text-lg uppercase tracking-wider text-stroke-black">BEBASKAN REKAN!</div>
            <div class="text-xs font-sans text-blue-100 font-bold">
              {{ isEffectiveMobile ? 'Ketuk di sini untuk bebaskan rekan!' : 'Tekan E untuk menyelamatkan rekan satu tim!' }}
            </div>
          </div>
        </div>
      </transition>

      <!-- Rescue Cooldown Prompt (When near jailed ally but on cooldown) -->
      <transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="scale-90 opacity-0"
        enter-to-class="scale-100 opacity-100"
        leave-active-class="transition duration-100 ease-in"
        leave-from-class="scale-100 opacity-100"
        leave-to-class="scale-90 opacity-0"
      >
        <div
          v-if="!gameStore.canRescueNearby && gameStore.isNearJailedAlly && gameStore.rescueCooldownRemainingSeconds > 0"
          data-testid="hud-rescue-cooldown-prompt"
          class="pointer-events-auto bg-amber-950/90 border-b-[5px] border-amber-600 text-amber-200 font-heading font-black px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-pulse"
        >
          <Timer class="w-8 h-8 shrink-0 text-amber-400 drop-shadow-sm" />
          <div>
            <div class="text-lg uppercase tracking-wider text-amber-300">COOLDOWN RESCUE ({{ gameStore.rescueCooldownRemainingSeconds }}s)</div>
            <div class="text-xs font-sans text-amber-200/90 font-bold">
              Tunggu hingga cooldown selesai untuk menyelamatkan kawan!
            </div>
          </div>
        </div>
      </transition>


      <!-- Stunned Alert -->
      <transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="scale-90 opacity-0"
        enter-to-class="scale-100 opacity-100"
        leave-active-class="transition duration-100 ease-in"
        leave-from-class="scale-100 opacity-100"
        leave-to-class="scale-90 opacity-0"
      >
        <div
          v-if="gameStore.isStunned"
          data-testid="hud-stun-alert"
          class="pointer-events-auto bg-red-600/95 border-b-[5px] border-red-800 text-white font-heading font-black px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-pulse"
        >
          <ZapOff class="w-8 h-8 shrink-0 text-white drop-shadow-sm animate-pulse" />
          <div>
            <div class="text-lg uppercase tracking-wider text-stroke-black">STUNNED!</div>
            <div class="text-xs font-sans text-red-100 font-bold">Stamina habis! Tidak bisa bergerak selama 2 detik.</div>
          </div>
        </div>
      </transition>
    </div>

    <!-- Toast Notification Stack -->
    <div
      data-testid="hud-toast-stack"
      class="fixed top-20 right-4 sm:right-6 flex flex-col gap-2 z-50 pointer-events-auto max-w-sm"
    >
      <transition-group
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="translate-x-8 opacity-0"
        enter-to-class="translate-x-0 opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="translate-x-0 opacity-100"
        leave-to-class="translate-x-8 opacity-0"
      >
        <div
          v-for="toast in roomStore.activeToasts"
          :key="toast.id"
          :data-testid="`hud-toast-${toast.type}`"
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
            class="text-xs opacity-75 hover:opacity-100 ml-2 cursor-pointer"
            @click="roomStore.removeToast(toast.id)"
          >
            ✕
          </button>
        </div>
      </transition-group>
    </div>

    <!-- Rotate Device Prompt (Mobile Portrait Warning) -->
    <RotateDevicePrompt :force-mobile="forceShowMobileHUD" />

    <!-- Tactical Skills Action Bar (Desktop only, mobile uses ActionSkillArc in MobileTouchControls) -->
    <div
      v-if="!isEffectiveMobile"
      data-testid="hud-skills-container"
      class="fixed bottom-3 sm:bottom-6 left-1/2 -translate-x-1/2 z-30"
    >
      <SkillActionBar
        :is-mobile="false"
        @trigger-skill="$emit('trigger-skill', $event)"
      />
    </div>

    <!-- Mobile Virtual Joystick & Touch Controls -->
    <MobileTouchControls
      :force-show="forceShowMobileHUD"
      :can-rescue="gameStore.canRescueNearby"
      :is-stunned="gameStore.isStunned"
      :stamina-percentage="gameStore.staminaPercentage"
      :rescue-cooldown-seconds="gameStore.rescueCooldownRemainingSeconds"
      @virtual-move="$emit('virtual-move', $event)"
      @virtual-sprint="$emit('virtual-sprint', $event)"
      @virtual-jump="$emit('virtual-jump', $event)"
      @virtual-look="$emit('virtual-look', $event)"
      @virtual-interact="$emit('virtual-interact')"
      @trigger-skill="$emit('trigger-skill', $event)"
    />

    <!-- Modals (Teleported to body to escape HUD pointer-events-none) -->
    <Teleport to="body">
      <GameControlsModal
        v-if="showControlsModal"
        @close="closeControlsModal"
      />
      <SettingsModal
        v-if="showSettingsModal"
        @close="closeSettingsModal"
      />
    </Teleport>
  </div>
</template>
