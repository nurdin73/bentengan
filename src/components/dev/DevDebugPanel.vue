<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import {
  Wrench,
  Shield,
  Zap,
  FastForward,
  MapPin,
  Trophy,
  X,
  RotateCcw,
  PauseCircle,
} from 'lucide-vue-next'
import { useDevStore, type TeleportTarget } from '../../stores/dev-store'
import { useDevShortcuts } from './use-dev-shortcuts'

useDevShortcuts()
const devStore = useDevStore()

const persistInSession = ref(false)

onMounted(() => {
  try {
    persistInSession.value = sessionStorage.getItem('bentengan_dev_mode') === 'true'
  } catch {
    // Ignore storage errors
  }
})

watch(persistInSession, (val) => {
  try {
    if (val) {
      sessionStorage.setItem('bentengan_dev_mode', 'true')
    } else {
      sessionStorage.removeItem('bentengan_dev_mode')
    }
  } catch {
    // Ignore storage errors
  }
})

const handleTeleport = (target: TeleportTarget) => {
  devStore.requestTeleport(target)
}

const handleInstantWin = () => {
  devStore.requestInstantWin()
}

const handleSpeedChange = (mult: number) => {
  devStore.setSpeedMultiplier(mult)
}

const handleClose = () => {
  devStore.isOpen = false
}
</script>

<template>
  <!-- Only render when unlocked via URL param, hotkey, or console -->
  <div v-if="devStore.isUnlocked" data-testid="dev-debug-root" class="relative pointer-events-auto">
    <!-- Dev Toggle Pill Button (Aligned with Help & HUD HP) -->
    <button
      data-testid="dev-toggle-pill-btn"
      type="button"
      :class="[
        'flex items-center justify-center gap-1.5 h-8 px-2.5 rounded-full border backdrop-blur-md shadow-md text-xs font-heading font-bold select-none cursor-pointer transition-all active:scale-95',
        devStore.godMode || devStore.freezeEnemyBots
          ? 'bg-amber-500/25 border-amber-400/80 text-amber-300 ring-2 ring-amber-400/30 animate-pulse'
          : 'bg-neutral-900/80 border-neutral-700/80 text-neutral-300 hover:text-white hover:bg-neutral-800/90',
      ]"
      title="Toggle Developer & God Mode Panel (~ atau F2)"
      @click="devStore.togglePanel()"
    >
      <Wrench class="w-3.5 h-3.5 text-amber-400 shrink-0" />
      <span class="text-[11px] uppercase tracking-wider">DEV</span>
      <span class="text-[9px] bg-neutral-800 text-neutral-400 px-1 py-0.2 rounded border border-neutral-700 font-mono hidden sm:inline">~</span>
    </button>

    <!-- Dev Panel Modal / Card -->
    <transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="scale-95 opacity-0 translate-y-2"
      enter-to-class="scale-100 opacity-100 translate-y-0"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="scale-100 opacity-100 translate-y-0"
      leave-to-class="scale-95 opacity-0 translate-y-2"
    >
        <div
          v-if="devStore.isOpen"
          data-testid="dev-debug-panel"
          class="fixed top-14 sm:top-16 right-3 sm:right-5 w-[340px] max-h-[85vh] overflow-y-auto bg-neutral-950/95 border border-neutral-800 rounded-2xl shadow-2xl backdrop-blur-xl p-4 text-neutral-200 font-sans flex flex-col gap-4 text-xs select-none z-50 pointer-events-auto"
        >
          <!-- Panel Header -->
        <div class="flex items-center justify-between pb-2 border-b border-neutral-800">
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
            <h3 class="font-heading font-black text-sm tracking-wide text-amber-300 uppercase">
              Developer God Mode
            </h3>
          </div>
          <button
            data-testid="dev-panel-close-btn"
            type="button"
            class="p-1 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
            @click="handleClose"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <!-- Section 1: Bot AI Controls -->
        <div class="flex flex-col gap-2">
          <span class="text-[10px] font-mono font-bold tracking-wider uppercase text-neutral-400 flex items-center gap-1.5">
            <PauseCircle class="w-3.5 h-3.5 text-rose-400" />
            Kontrol Bot Lawan
          </span>

          <!-- Freeze Bot Lawan Toggle -->
          <button
            data-testid="dev-freeze-enemy-bots-btn"
            type="button"
            :class="[
              'w-full flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer font-bold',
              devStore.freezeEnemyBots
                ? 'bg-rose-500/20 border-rose-500/80 text-rose-200 ring-1 ring-rose-500/50'
                : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-850',
            ]"
            @click="devStore.setFreezeEnemyBots(!devStore.freezeEnemyBots)"
          >
            <div class="flex items-center gap-2">
              <PauseCircle class="w-4 h-4 text-rose-400" />
              <span>Bot Lawan Diam (Freeze)</span>
            </div>
            <span
              :class="[
                'text-[10px] px-2 py-0.5 rounded-md font-mono uppercase',
                devStore.freezeEnemyBots ? 'bg-rose-500 text-white' : 'bg-neutral-800 text-neutral-400',
              ]"
            >
              {{ devStore.freezeEnemyBots ? 'AKTIF' : 'OFF' }}
            </span>
          </button>

          <!-- Freeze Semua Bot Toggle -->
          <button
            data-testid="dev-freeze-all-bots-btn"
            type="button"
            :class="[
              'w-full flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer font-medium text-[11px]',
              devStore.freezeAllBots
                ? 'bg-rose-500/20 border-rose-500/80 text-rose-200'
                : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:bg-neutral-850',
            ]"
            @click="devStore.setFreezeAllBots(!devStore.freezeAllBots)"
          >
            <span>Freeze Semua Bot (Kawan & Musuh)</span>
            <span class="font-mono text-[10px]">
              {{ devStore.freezeAllBots ? 'ON' : 'OFF' }}
            </span>
          </button>
        </div>

        <!-- Section 2: Player God Mode Modifiers -->
        <div class="flex flex-col gap-2">
          <span class="text-[10px] font-mono font-bold tracking-wider uppercase text-neutral-400 flex items-center gap-1.5">
            <Shield class="w-3.5 h-3.5 text-emerald-400" />
            God Mode & Karakter
          </span>

          <!-- God Mode Main Toggle (Invulnerable + Infinite Stamina) -->
          <button
            data-testid="dev-godmode-btn"
            type="button"
            :class="[
              'w-full flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer font-bold',
              devStore.godMode
                ? 'bg-emerald-500/20 border-emerald-500/80 text-emerald-200 ring-1 ring-emerald-500/50'
                : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-850',
            ]"
            @click="devStore.setGodMode(!devStore.godMode)"
          >
            <div class="flex items-center gap-2">
              <Shield class="w-4 h-4 text-emerald-400" />
              <span>God Mode (Kebal + Stamina)</span>
            </div>
            <span
              :class="[
                'text-[10px] px-2 py-0.5 rounded-md font-mono uppercase',
                devStore.godMode ? 'bg-emerald-500 text-white font-bold' : 'bg-neutral-800 text-neutral-400',
              ]"
            >
              {{ devStore.godMode ? 'AKTIF' : 'OFF' }}
            </span>
          </button>

          <!-- No Skill Cooldowns -->
          <button
            data-testid="dev-zero-cooldowns-btn"
            type="button"
            :class="[
              'w-full flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer font-medium text-[11px]',
              devStore.zeroCooldowns
                ? 'bg-sky-500/20 border-sky-500/80 text-sky-200'
                : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:bg-neutral-850',
            ]"
            @click="devStore.setZeroCooldowns(!devStore.zeroCooldowns)"
          >
            <div class="flex items-center gap-1.5">
              <Zap class="w-3.5 h-3.5 text-sky-400" />
              <span>Tanpa Cooldown Skill (Spam)</span>
            </div>
            <span class="font-mono text-[10px]">{{ devStore.zeroCooldowns ? 'ON' : 'OFF' }}</span>
          </button>

          <!-- Speed Multipliers -->
          <div class="flex items-center justify-between gap-1 mt-1">
            <span class="text-[11px] text-neutral-400 flex items-center gap-1">
              <FastForward class="w-3.5 h-3.5 text-amber-400" />
              Kecepatan:
            </span>
            <div class="flex items-center gap-1">
              <button
                v-for="s in [1.0, 1.5, 2.0, 3.0]"
                :key="s"
                :data-testid="`dev-speed-${s}x-btn`"
                type="button"
                :class="[
                  'px-2 py-1 rounded-md text-[10px] font-mono font-bold transition-all cursor-pointer',
                  devStore.speedMultiplier === s
                    ? 'bg-amber-400 text-black'
                    : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700',
                ]"
                @click="handleSpeedChange(s)"
              >
                {{ s }}x
              </button>
            </div>
          </div>
        </div>

        <!-- Section 3: Teleport Shortcuts -->
        <div class="flex flex-col gap-2">
          <span class="text-[10px] font-mono font-bold tracking-wider uppercase text-neutral-400 flex items-center gap-1.5">
            <MapPin class="w-3.5 h-3.5 text-indigo-400" />
            Teleportasi Cepat
          </span>
          <div class="grid grid-cols-3 gap-1.5">
            <button
              data-testid="dev-teleport-enemy-base-btn"
              type="button"
              class="flex flex-col items-center justify-center p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 transition-all cursor-pointer active:scale-95 text-center"
              @click="handleTeleport('enemy_base')"
            >
              <span class="font-bold text-[11px] text-rose-300">Base Musuh</span>
              <span class="text-[9px] text-neutral-500">Sentuh Benteng</span>
            </button>
            <button
              data-testid="dev-teleport-jail-btn"
              type="button"
              class="flex flex-col items-center justify-center p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 transition-all cursor-pointer active:scale-95 text-center"
              @click="handleTeleport('enemy_jail')"
            >
              <span class="font-bold text-[11px] text-amber-300">Penjara</span>
              <span class="text-[9px] text-neutral-500">Tes Rescue</span>
            </button>
            <button
              data-testid="dev-teleport-home-base-btn"
              type="button"
              class="flex flex-col items-center justify-center p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 transition-all cursor-pointer active:scale-95 text-center"
              @click="handleTeleport('own_base')"
            >
              <span class="font-bold text-[11px] text-blue-300">Base Sendiri</span>
              <span class="text-[9px] text-neutral-500">Kembali Aman</span>
            </button>
          </div>
        </div>

        <!-- Section 4: Game Actions & Resets -->
        <div class="flex flex-col gap-2 pt-1 border-t border-neutral-800">
          <button
            data-testid="dev-instant-win-btn"
            type="button"
            class="w-full flex items-center justify-center gap-1.5 p-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-bold transition-all cursor-pointer active:scale-95"
            @click="handleInstantWin"
          >
            <Trophy class="w-4 h-4 text-amber-400" />
            <span>Menangkan Match Seketika</span>
          </button>

          <button
            data-testid="dev-reset-all-btn"
            type="button"
            class="w-full flex items-center justify-center gap-1.5 p-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-white text-[11px] transition-all cursor-pointer"
            @click="devStore.resetAllModifiers()"
          >
            <RotateCcw class="w-3.5 h-3.5" />
            <span>Reset Semua Setting Dev ke Normal</span>
          </button>
        </div>

        <!-- Footer / Helpers -->
        <div class="flex items-center justify-between pt-2 border-t border-neutral-800/80 text-[10px] text-neutral-500">
          <label class="flex items-center gap-1.5 cursor-pointer hover:text-neutral-300">
            <input
              v-model="persistInSession"
              type="checkbox"
              class="rounded bg-neutral-900 border-neutral-700 text-amber-500 focus:ring-0 w-3 h-3 cursor-pointer"
            />
            <span>Ingat di browser ini</span>
          </label>
          <span class="font-mono">F2 / ~ untuk toggle</span>
        </div>
      </div>
    </transition>
  </div>
</template>

