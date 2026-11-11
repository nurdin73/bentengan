<script setup lang="ts">
import { ref, computed } from 'vue'
import { getActivePinia } from 'pinia'
import { ChevronsUp } from 'lucide-vue-next'
import { useGameStore } from '../../stores/game-store'
import type { SkillId, SkillsStateMap, SkillState } from '../../game/skills/skill-types'

const props = withDefaults(
  defineProps<{
    isMobile?: boolean
    skills?: Partial<SkillsStateMap>
  }>(),
  {
    isMobile: true,
  },
)

const emit = defineEmits<{
  (e: 'trigger-skill', skillId: SkillId): void
  (e: 'virtual-jump', jump: boolean): void
}>()

const createDefaultSkill = (id: SkillId, name: string, hotkey: string): SkillState => ({
  id,
  name,
  hotkey,
  ready: true,
  cooldownUntil: 0,
  cooldownRemainingSec: 0,
  cooldownProgress: 0,
  activeUntil: 0,
  isActive: false,
})

let gameStore: ReturnType<typeof useGameStore> | null = null
try {
  const activePinia = getActivePinia()
  if (activePinia) {
    gameStore = useGameStore(activePinia)
  }
} catch {
  // Isolated test without pinia injection context
}

const dashSkill = computed(
  () => props.skills?.dash ?? gameStore?.skills.dash ?? createDefaultSkill('dash', 'Kilat', 'Q'),
)
const smokeSkill = computed(
  () => props.skills?.smoke ?? gameStore?.skills.smoke ?? createDefaultSkill('smoke', 'Asap', 'F'),
)
const adrenalineSkill = computed(
  () =>
    props.skills?.adrenaline ??
    gameStore?.skills.adrenaline ??
    createDefaultSkill('adrenaline', 'Adrenalin', 'C'),
)

const isJumpActive = ref(false)
let jumpTouchId: number | null = null

const CIRCUMFERENCE = 135.09 // 2 * PI * 21.5

const getStrokeDashoffset = (progress: number): number => {
  const clamped = Math.max(0, Math.min(1, progress))
  return CIRCUMFERENCE * (1 - clamped)
}

const handleSkillTrigger = (id: SkillId) => {
  const skill =
    id === 'dash' ? dashSkill.value : id === 'smoke' ? smokeSkill.value : adrenalineSkill.value
  if (!skill.ready) return
  emit('trigger-skill', id)
}

const handleSkillTouchStart = (e: TouchEvent, id: SkillId) => {
  e.preventDefault()
  handleSkillTrigger(id)
}

const handleJumpStart = (e: TouchEvent) => {
  e.preventDefault()
  if (jumpTouchId !== null) return
  const touch = e.changedTouches[0]
  if (!touch) return

  jumpTouchId = touch.identifier
  isJumpActive.value = true
  emit('virtual-jump', true)
}

const handleJumpEnd = (e: TouchEvent) => {
  if (jumpTouchId === null) return

  for (let i = 0; i < e.changedTouches.length; i++) {
    const touch = e.changedTouches[i]
    if (touch && touch.identifier === jumpTouchId) {
      jumpTouchId = null
      isJumpActive.value = false
      emit('virtual-jump', false)
      break
    }
  }
}

const handleJumpClick = () => {
  emit('virtual-jump', true)
  setTimeout(() => emit('virtual-jump', false), 150)
}
</script>

<template>
  <div
    data-testid="hud-action-skill-arc"
    class="pointer-events-none absolute inset-0 select-none touch-none"
  >
    <!-- 1. SKILL 1: KILAT / DASH (Position Jam 9:00 - Straight Left) -->
    <div
      class="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2"
      style="left: calc(50% - 110px); top: 50%"
    >
      <button
        data-testid="hud-skill-btn-dash"
        type="button"
        :disabled="!dashSkill.ready"
        :class="[
          'relative flex flex-col items-center justify-center rounded-full transition-all duration-75 select-none outline-none border shadow-xl overflow-hidden',
          props.isMobile ? 'h-[60px] w-[60px]' : 'h-16 w-16',
          dashSkill.isActive
            ? 'border-cyan-300 bg-cyan-500/50 text-cyan-100 ring-4 ring-cyan-300/80 scale-105 animate-pulse'
            : dashSkill.ready
              ? 'border-sky-400/80 bg-neutral-950 text-sky-200 hover:border-sky-300 active:scale-90 shadow-sky-950/50 cursor-pointer'
              : 'border-white/10 bg-neutral-900/85 text-neutral-400 cursor-not-allowed opacity-80',
        ]"
        title="Kilat (Q) - Dash Cepat"
        @touchstart.prevent="handleSkillTouchStart($event, 'dash')"
        @click="handleSkillTrigger('dash')"
      >
        <!-- Full-bleed Skill Icon Image -->
        <img
          :src="'/assets/ui/skills/skill-dash.png'"
          alt="Kilat"
          :class="[
            'absolute inset-0 h-full w-full object-cover rounded-full p-1 select-none pointer-events-none transition-all duration-150',
            dashSkill.ready ? 'opacity-100 drop-shadow-md' : 'opacity-25 grayscale',
          ]"
        />

        <!-- Cooldown Radial SVG -->
        <svg
          v-if="!dashSkill.ready"
          data-testid="hud-skill-dash-cooldown-ring"
          class="absolute inset-0 w-full h-full -rotate-90 pointer-events-none p-0.5 z-10"
          viewBox="0 0 50 50"
        >
          <circle cx="25" cy="25" r="21.5" class="stroke-black/60 fill-transparent stroke-[4px]" />
          <circle
            cx="25"
            cy="25"
            r="21.5"
            class="stroke-sky-400 fill-transparent stroke-[4px] transition-all duration-100"
            :stroke-dasharray="CIRCUMFERENCE"
            :stroke-dashoffset="getStrokeDashoffset(dashSkill.cooldownProgress)"
            stroke-linecap="round"
          />
        </svg>

        <!-- Cooldown Numeric Text Overlay -->
        <span
          v-if="!dashSkill.ready"
          class="relative z-20 font-heading text-sm font-black text-sky-300 leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]"
        >
          {{ dashSkill.cooldownRemainingSec }}s
        </span>
      </button>
    </div>

    <!-- 2. SKILL 2: ASAP / SMOKE (Position Jam 10:30 - Diagonal 45° Top-Left) -->
    <div
      class="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2"
      style="left: calc(50% - 78px); top: calc(50% - 78px)"
    >
      <button
        data-testid="hud-skill-btn-smoke"
        type="button"
        :disabled="!smokeSkill.ready"
        :class="[
          'relative flex flex-col items-center justify-center rounded-full transition-all duration-75 select-none outline-none border shadow-xl overflow-hidden',
          props.isMobile ? 'h-[60px] w-[60px]' : 'h-16 w-16',
          smokeSkill.isActive
            ? 'border-cyan-300 bg-cyan-500/50 text-cyan-100 ring-4 ring-cyan-300/80 scale-105 animate-pulse'
            : smokeSkill.ready
              ? 'border-sky-400/80 bg-neutral-950 text-sky-200 hover:border-sky-300 active:scale-90 shadow-sky-950/50 cursor-pointer'
              : 'border-white/10 bg-neutral-900/85 text-neutral-400 cursor-not-allowed opacity-80',
        ]"
        title="Asap (F) - Tabir Asap Pengabur"
        @touchstart.prevent="handleSkillTouchStart($event, 'smoke')"
        @click="handleSkillTrigger('smoke')"
      >
        <!-- Full-bleed Skill Icon Image -->
        <img
          :src="'/assets/ui/skills/skill-smoke.png'"
          alt="Asap"
          :class="[
            'absolute inset-0 h-full w-full object-cover rounded-full p-1 select-none pointer-events-none transition-all duration-150',
            smokeSkill.ready ? 'opacity-100 drop-shadow-md' : 'opacity-25 grayscale',
          ]"
        />

        <svg
          v-if="!smokeSkill.ready"
          data-testid="hud-skill-smoke-cooldown-ring"
          class="absolute inset-0 w-full h-full -rotate-90 pointer-events-none p-0.5 z-10"
          viewBox="0 0 50 50"
        >
          <circle cx="25" cy="25" r="21.5" class="stroke-black/60 fill-transparent stroke-[4px]" />
          <circle
            cx="25"
            cy="25"
            r="21.5"
            class="stroke-sky-400 fill-transparent stroke-[4px] transition-all duration-100"
            :stroke-dasharray="CIRCUMFERENCE"
            :stroke-dashoffset="getStrokeDashoffset(smokeSkill.cooldownProgress)"
            stroke-linecap="round"
          />
        </svg>

        <span
          v-if="!smokeSkill.ready"
          class="relative z-20 font-heading text-sm font-black text-sky-300 leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]"
        >
          {{ smokeSkill.cooldownRemainingSec }}s
        </span>
      </button>
    </div>

    <!-- 3. SKILL 3: ADRENALIN / SURGE (Position Jam 12:00 - Straight Top) -->
    <div
      class="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2"
      style="left: 50%; top: calc(50% - 110px)"
    >
      <button
        data-testid="hud-skill-btn-adrenaline"
        type="button"
        :disabled="!adrenalineSkill.ready"
        :class="[
          'relative flex flex-col items-center justify-center rounded-full transition-all duration-75 select-none outline-none border shadow-xl overflow-hidden',
          props.isMobile ? 'h-[60px] w-[60px]' : 'h-16 w-16',
          adrenalineSkill.isActive
            ? 'border-cyan-300 bg-cyan-500/50 text-cyan-100 ring-4 ring-cyan-300/80 scale-105 animate-pulse'
            : adrenalineSkill.ready
              ? 'border-sky-400/80 bg-neutral-950 text-sky-200 hover:border-sky-300 active:scale-90 shadow-sky-950/50 cursor-pointer'
              : 'border-white/10 bg-neutral-900/85 text-neutral-400 cursor-not-allowed opacity-80',
        ]"
        title="Adrenalin (C) - Stamina Penuh & Mini-Immunity"
        @touchstart.prevent="handleSkillTouchStart($event, 'adrenaline')"
        @click="handleSkillTrigger('adrenaline')"
      >
        <!-- Full-bleed Skill Icon Image -->
        <img
          :src="'/assets/ui/skills/skill-adrenaline.png'"
          alt="Adrenalin"
          :class="[
            'absolute inset-0 h-full w-full object-cover rounded-full p-1 select-none pointer-events-none transition-all duration-150',
            adrenalineSkill.ready ? 'opacity-100 drop-shadow-md' : 'opacity-25 grayscale',
          ]"
        />

        <svg
          v-if="!adrenalineSkill.ready"
          data-testid="hud-skill-adrenaline-cooldown-ring"
          class="absolute inset-0 w-full h-full -rotate-90 pointer-events-none p-0.5 z-10"
          viewBox="0 0 50 50"
        >
          <circle cx="25" cy="25" r="21.5" class="stroke-black/60 fill-transparent stroke-[4px]" />
          <circle
            cx="25"
            cy="25"
            r="21.5"
            class="stroke-sky-400 fill-transparent stroke-[4px] transition-all duration-100"
            :stroke-dasharray="CIRCUMFERENCE"
            :stroke-dashoffset="getStrokeDashoffset(adrenalineSkill.cooldownProgress)"
            stroke-linecap="round"
          />
        </svg>

        <span
          v-if="!adrenalineSkill.ready"
          class="relative z-20 font-heading text-sm font-black text-sky-300 leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]"
        >
          {{ adrenalineSkill.cooldownRemainingSec }}s
        </span>
      </button>
    </div>

    <!-- 4. LOMPAT / JUMP (Stacked directly above Skill 3 with widened spacing on Jam 12:00 axis) -->
    <div
      class="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2"
      style="left: 50%; top: calc(50% - 188px)"
    >
      <button
        data-testid="hud-touch-jump-btn"
        type="button"
        :class="[
          'flex flex-col items-center justify-center rounded-full border transition-all duration-75 select-none backdrop-blur-md active:scale-90 cursor-pointer shadow-xl',
          props.isMobile ? 'h-[60px] w-[60px]' : 'h-16 w-16',
          isJumpActive
            ? 'border-sky-300 bg-sky-500/50 text-sky-200 ring-4 ring-sky-300/70 scale-90'
            : 'border-white/25 bg-neutral-950/85 text-neutral-200 hover:text-white',
        ]"
        title="Lompat (Space)"
        @touchstart="handleJumpStart"
        @touchend="handleJumpEnd"
        @touchcancel="handleJumpEnd"
        @click="handleJumpClick"
      >
        <ChevronsUp class="h-6.5 w-6.5 stroke-[2.5] drop-shadow-sm" />
        <span
          class="font-heading text-[8px] font-black tracking-wider uppercase mt-0.5 leading-none"
        >
          LOMPAT
        </span>
      </button>
    </div>
  </div>
</template>
