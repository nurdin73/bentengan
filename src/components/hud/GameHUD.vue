<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '../../stores/game-store'
import { useRoomStore } from '../../stores/room-store'

const gameStore = useGameStore()
const roomStore = useRoomStore()

const staminaColor = computed(() => {
  if (gameStore.isStunned) return 'bg-red-500'
  if (gameStore.staminaPercentage > 50) return 'bg-emerald-400'
  if (gameStore.staminaPercentage > 25) return 'bg-amber-400'
  return 'bg-red-400'
})

defineEmits<{
  (e: 'request-pointer-lock'): void
}>()
</script>

<template>
  <div data-testid="game-hud" class="pointer-events-none absolute inset-0 flex flex-col justify-between p-4 sm:p-6">
    <!-- Top Header Bar -->
    <header class="flex items-start justify-between w-full">
      <!-- Team & Player Badge -->
      <div
        data-testid="hud-team-badge"
        class="timbul-card-dark px-4 py-2 flex items-center gap-3 pointer-events-auto"
      >
        <div
          class="w-3.5 h-3.5 rounded-full ring-2 ring-white/50"
          :class="roomStore.myTeam === 'blue' ? 'bg-blue-500' : 'bg-red-500'"
        />
        <div>
          <span class="text-xs uppercase tracking-wider text-neutral-400 font-bold block">Tim Anda</span>
          <span class="font-heading font-black text-sm uppercase text-white tracking-wide">
            {{ roomStore.myTeam === 'blue' ? 'Benteng Biru' : 'Benteng Merah' }}
          </span>
        </div>
      </div>

      <!-- Live Team Roster / Jail Tracker -->
      <div
        data-testid="hud-roster-tracker"
        class="timbul-card-dark px-4 py-2 flex items-center gap-4 text-xs font-heading font-bold"
      >
        <div class="flex items-center gap-2">
          <span class="w-2.5 h-2.5 rounded-full bg-blue-500" />
          <span class="text-neutral-300">Biru:</span>
          <span data-testid="hud-blue-jailed" class="font-mono text-neutral-100">
            {{ gameStore.blueJailedCount }}/{{ gameStore.blueTotalCount }} Jailed
          </span>
        </div>

        <div class="w-px h-4 bg-neutral-700" />

        <div class="flex items-center gap-2">
          <span class="w-2.5 h-2.5 rounded-full bg-red-500" />
          <span class="text-neutral-300">Merah:</span>
          <span data-testid="hud-red-jailed" class="font-mono text-neutral-100">
            {{ gameStore.redJailedCount }}/{{ gameStore.redTotalCount }} Jailed
          </span>
        </div>
      </div>

      <!-- Territory Safety Badge -->
      <div
        data-testid="hud-territory-badge"
        :class="[
          'px-4 py-2 rounded-2xl flex items-center gap-2 border-b-[4px] font-heading font-black text-xs uppercase tracking-wider transition-all duration-200 shadow-lg',
          gameStore.isInEnemyTerritory
            ? 'bg-red-600 text-white border-red-900 animate-pulse'
            : 'bg-emerald-600 text-white border-emerald-900',
        ]"
      >
        <span>{{ gameStore.isInEnemyTerritory ? '⚠️' : '🛡️' }}</span>
        <span>{{ gameStore.isInEnemyTerritory ? 'Wilayah Lawan (Bahaya!)' : 'Wilayah Sendiri (Aman)' }}</span>
      </div>
    </header>

    <!-- Center Alerts (Rescue Prompt / Immunity / Stun) -->
    <div class="flex flex-col items-center justify-center gap-3">
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
          class="bg-blue-600/95 border-b-[5px] border-blue-900 text-white font-heading font-black px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce"
        >
          <span class="text-2xl">🤝</span>
          <div>
            <div class="text-lg uppercase tracking-wider text-stroke-black">BEBASKAN REKAN!</div>
            <div class="text-xs font-sans text-blue-100 font-bold">Tekan <kbd class="bg-blue-800 px-1 rounded">E</kbd> untuk menyelamatkan rekan satu tim!</div>
          </div>
        </div>
      </transition>

      <!-- Immunity Alert -->
      <transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="scale-90 opacity-0"
        enter-to-class="scale-100 opacity-100"
        leave-active-class="transition duration-100 ease-in"
        leave-from-class="scale-100 opacity-100"
        leave-to-class="scale-90 opacity-0"
      >
        <div
          v-if="gameStore.isImmune"
          data-testid="hud-immunity-alert"
          class="bg-amber-500/95 border-b-[5px] border-amber-700 text-amber-950 font-heading font-black px-6 py-2.5 rounded-2xl shadow-2xl flex items-center gap-3"
        >
          <span class="text-2xl">🛡️</span>
          <div>
            <div class="text-base uppercase tracking-wider">KEBAL TANGKAP (IMMUNE)</div>
            <div class="text-xs font-mono font-bold">Durasi: {{ gameStore.immunityRemainingSeconds }} detik</div>
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
          class="bg-red-600/95 border-b-[5px] border-red-800 text-white font-heading font-black px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-pulse"
        >
          <span class="text-2xl">⚡</span>
          <div>
            <div class="text-lg uppercase tracking-wider text-stroke-black">STUNNED!</div>
            <div class="text-xs font-sans text-red-100 font-bold">Stamina habis! Tidak bisa bergerak selama 2 detik.</div>
          </div>
        </div>
      </transition>

      <!-- Pointer Lock Instruction Hint -->
      <div
        v-if="!gameStore.isPointerLocked"
        data-testid="hud-pointer-lock-prompt"
        class="pointer-events-auto cursor-pointer timbul-card-dark bg-neutral-900/90 hover:bg-neutral-800 px-5 py-3 rounded-2xl border-b-[4px] border-neutral-950 flex items-center gap-3 transition-all"
        @click="$emit('request-pointer-lock')"
      >
        <span class="text-xl">🎯</span>
        <div class="text-sm font-sans font-bold text-neutral-200">
          Klik layar untuk mengunci kursor mouse & mengarahkan kamera
        </div>
      </div>
    </div>

    <!-- Bottom Controls & Stamina HUD -->
    <footer class="flex flex-col sm:flex-row items-end sm:items-end justify-between gap-4 w-full">
      <!-- Controls Cheatsheet -->
      <div
        data-testid="hud-controls-helper"
        class="timbul-card-dark px-4 py-3 text-xs font-sans text-neutral-300 hidden md:flex flex-col gap-1.5 opacity-80"
      >
        <div class="font-heading font-bold text-amber-400 uppercase tracking-wider text-[11px]">Kontrol Desktop</div>
        <div class="flex items-center gap-2">
          <kbd class="bg-neutral-800 px-1.5 py-0.5 rounded border border-neutral-700 font-mono font-bold">W A S D</kbd>
          <span>Bergerak</span>
        </div>
        <div class="flex items-center gap-2">
          <kbd class="bg-neutral-800 px-1.5 py-0.5 rounded border border-neutral-700 font-mono font-bold">Shift</kbd>
          <span>Sprint</span>
        </div>
        <div class="flex items-center gap-2">
          <kbd class="bg-neutral-800 px-1.5 py-0.5 rounded border border-neutral-700 font-mono font-bold">Space</kbd>
          <span>Melompat (Jump)</span>
        </div>
        <div class="flex items-center gap-2">
          <kbd class="bg-neutral-800 px-1.5 py-0.5 rounded border border-neutral-700 font-mono font-bold">E</kbd>
          <span>Bebaskan Rekan (Rescue)</span>
        </div>
        <div class="flex items-center gap-2">
          <kbd class="bg-neutral-800 px-1.5 py-0.5 rounded border border-neutral-700 font-mono font-bold">Sentuh Lawan</kbd>
          <span>Tangkap (Capture 1.5m)</span>
        </div>
        <div class="flex items-center gap-2">
          <kbd class="bg-neutral-800 px-1.5 py-0.5 rounded border border-neutral-700 font-mono font-bold">Sentuh Benteng</kbd>
          <span>Menang (Base Capture)</span>
        </div>
      </div>

      <!-- Stamina Bar Panel -->
      <div
        data-testid="hud-stamina-panel"
        class="timbul-card-dark p-4 w-full sm:w-80 flex flex-col gap-2"
      >
        <div class="flex justify-between items-center text-xs font-heading font-bold uppercase tracking-wider">
          <span class="flex items-center gap-1.5 text-neutral-300">
            <span>⚡ Stamina</span>
            <span
              v-if="gameStore.isSprinting"
              data-testid="hud-sprint-badge"
              class="bg-amber-500 text-amber-950 px-1.5 py-0.2 rounded text-[10px] font-black"
            >
              SPRINT
            </span>
          </span>
          <span class="text-neutral-400 font-mono font-bold">{{ Math.round(gameStore.stamina) }} / {{ gameStore.maxStamina }}</span>
        </div>

        <!-- Tactile Progress Bar -->
        <div class="w-full bg-neutral-950 rounded-full h-4 p-0.5 border border-neutral-800 overflow-hidden shadow-inner">
          <div
            data-testid="hud-stamina-fill"
            class="h-full rounded-full transition-all duration-75 border-b-2 border-black/30 shadow-sm"
            :class="staminaColor"
            :style="{ width: `${gameStore.staminaPercentage}%` }"
          />
        </div>
      </div>
    </footer>
  </div>
</template>
