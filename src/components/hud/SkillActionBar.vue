<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '../../stores/game-store'
import type { SkillId } from '../../game/skills/skill-types'

const props = withDefaults(
  defineProps<{
    isMobile?: boolean
  }>(),
  {
    isMobile: false,
  },
)

const emit = defineEmits<{
  (e: 'trigger-skill', skillId: SkillId): void
}>()

const gameStore = useGameStore()

const dashSkill = computed(() => gameStore.skills.dash)
const smokeSkill = computed(() => gameStore.skills.smoke)
const adrenalineSkill = computed(() => gameStore.skills.adrenaline)

const handleSkillClick = (id: SkillId) => {
  emit('trigger-skill', id)
}

// 120 is circumference for r=19 (2 * PI * 19 ≈ 119.38)
const CIRCUMFERENCE = 120

const getStrokeDashoffset = (progress: number): number => {
  const clamped = Math.max(0, Math.min(1, progress))
  return CIRCUMFERENCE * (1 - clamped)
}
</script>

<template>
  <div
    data-testid="skill-action-bar"
    :class="[
      'pointer-events-auto flex items-center justify-center gap-3 select-none transition-all',
      props.isMobile ? 'scale-90 sm:scale-100' : '',
    ]"
  >
    <!-- 1. DASH SKILL (Q) -->
    <button
      type="button"
      data-testid="skill-btn-dash"
      :disabled="!dashSkill.ready"
      :class="[
        'relative group flex flex-col items-center justify-center rounded-2xl transition-all cursor-pointer shadow-lg outline-none border border-sky-400/70 overflow-hidden',
        props.isMobile ? 'w-13 h-13' : 'w-15 h-15',
        dashSkill.isActive
          ? 'bg-cyan-500/50 border-cyan-300 ring-4 ring-cyan-300/80 scale-105 animate-pulse'
          : dashSkill.ready
            ? 'bg-neutral-950 hover:border-sky-300 border-b-[4px] border-b-sky-700 active:border-b-[2px] active:translate-y-[2px] shadow-sky-950/40 text-sky-200'
            : 'bg-neutral-900/90 border-white/10 border-b-[3px] border-b-neutral-950 cursor-not-allowed opacity-80 text-neutral-400',
      ]"
      title="Kilat (Q) - Dash Cepat"
      @click="handleSkillClick('dash')"
    >
      <!-- Full-bleed Skill Icon Image -->
      <img
        :src="'/assets/ui/skills/skill-dash.png'"
        alt="Kilat"
        :class="[
          'absolute inset-0 h-full w-full object-cover p-1.5 select-none pointer-events-none transition-all duration-150 group-hover:scale-105',
          dashSkill.ready ? 'opacity-100 drop-shadow-sm' : 'opacity-25 grayscale',
        ]"
      />

      <!-- Cooldown Radial SVG Overlay -->
      <svg
        v-if="!dashSkill.ready"
        data-testid="skill-dash-cooldown-ring"
        class="absolute inset-0 w-full h-full -rotate-90 pointer-events-none p-1 z-10"
        viewBox="0 0 44 44"
      >
        <circle cx="22" cy="22" r="19" class="stroke-black/60 fill-transparent stroke-[4px]" />
        <circle
          cx="22"
          cy="22"
          r="19"
          class="stroke-sky-400 fill-transparent stroke-[4px] transition-all duration-100"
          :stroke-dasharray="CIRCUMFERENCE"
          :stroke-dashoffset="getStrokeDashoffset(dashSkill.cooldownProgress)"
          stroke-linecap="round"
        />
      </svg>

      <!-- Center Cooldown Count -->
      <span
        v-if="!dashSkill.ready"
        data-testid="skill-dash-cooldown-text"
        class="relative z-20 font-heading font-black text-sky-300 text-sm leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]"
      >
        {{ dashSkill.cooldownRemainingSec }}s
      </span>

      <!-- Hotkey Badge (Desktop) -->
      <span
        v-if="!props.isMobile"
        data-testid="skill-dash-hotkey"
        class="absolute -top-2 -right-2 px-1.5 py-0.5 rounded-md bg-neutral-900 text-sky-300 border border-sky-500/50 font-mono font-bold text-[10px] shadow-sm z-30"
      >
        Q
      </span>
    </button>

    <!-- 2. SMOKE SKILL (F) -->
    <button
      type="button"
      data-testid="skill-btn-smoke"
      :disabled="!smokeSkill.ready"
      :class="[
        'relative group flex flex-col items-center justify-center rounded-2xl transition-all cursor-pointer shadow-lg outline-none border border-sky-400/70 overflow-hidden',
        props.isMobile ? 'w-13 h-13' : 'w-15 h-15',
        smokeSkill.isActive
          ? 'bg-cyan-500/50 border-cyan-300 ring-4 ring-cyan-300/80 scale-105 animate-pulse'
          : smokeSkill.ready
            ? 'bg-neutral-950 hover:border-sky-300 border-b-[4px] border-b-sky-700 active:border-b-[2px] active:translate-y-[2px] shadow-sky-950/40 text-sky-200'
            : 'bg-neutral-900/90 border-white/10 border-b-[3px] border-b-neutral-950 cursor-not-allowed opacity-80 text-neutral-400',
      ]"
      title="Asap (F) - Pengabur Pandangan Lawan"
      @click="handleSkillClick('smoke')"
    >
      <!-- Full-bleed Skill Icon Image -->
      <img
        :src="'/assets/ui/skills/skill-smoke.png'"
        alt="Asap"
        :class="[
          'absolute inset-0 h-full w-full object-cover p-1.5 select-none pointer-events-none transition-all duration-150 group-hover:scale-105',
          smokeSkill.ready ? 'opacity-100 drop-shadow-sm' : 'opacity-25 grayscale',
        ]"
      />

      <!-- Cooldown Radial SVG Overlay -->
      <svg
        v-if="!smokeSkill.ready"
        data-testid="skill-smoke-cooldown-ring"
        class="absolute inset-0 w-full h-full -rotate-90 pointer-events-none p-1 z-10"
        viewBox="0 0 44 44"
      >
        <circle cx="22" cy="22" r="19" class="stroke-black/60 fill-transparent stroke-[4px]" />
        <circle
          cx="22"
          cy="22"
          r="19"
          class="stroke-sky-400 fill-transparent stroke-[4px] transition-all duration-100"
          :stroke-dasharray="CIRCUMFERENCE"
          :stroke-dashoffset="getStrokeDashoffset(smokeSkill.cooldownProgress)"
          stroke-linecap="round"
        />
      </svg>

      <!-- Center Cooldown Count -->
      <span
        v-if="!smokeSkill.ready"
        data-testid="skill-smoke-cooldown-text"
        class="relative z-20 font-heading font-black text-sky-300 text-sm leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]"
      >
        {{ smokeSkill.cooldownRemainingSec }}s
      </span>

      <!-- Hotkey Badge (Desktop) -->
      <span
        v-if="!props.isMobile"
        data-testid="skill-smoke-hotkey"
        class="absolute -top-2 -right-2 px-1.5 py-0.5 rounded-md bg-neutral-900 text-sky-300 border border-sky-500/50 font-mono font-bold text-[10px] shadow-sm z-30"
      >
        F
      </span>
    </button>

    <!-- 3. ADRENALINE SKILL (C) -->
    <button
      type="button"
      data-testid="skill-btn-adrenaline"
      :disabled="!adrenalineSkill.ready"
      :class="[
        'relative group flex flex-col items-center justify-center rounded-2xl transition-all cursor-pointer shadow-lg outline-none border border-sky-400/70 overflow-hidden',
        props.isMobile ? 'w-13 h-13' : 'w-15 h-15',
        adrenalineSkill.isActive
          ? 'bg-cyan-500/50 border-cyan-300 ring-4 ring-cyan-300/80 scale-105 animate-pulse'
          : adrenalineSkill.ready
            ? 'bg-neutral-950 hover:border-sky-300 border-b-[4px] border-b-sky-700 active:border-b-[2px] active:translate-y-[2px] shadow-sky-950/40 text-sky-200'
            : 'bg-neutral-900/90 border-white/10 border-b-[3px] border-b-neutral-950 cursor-not-allowed opacity-80 text-neutral-400',
      ]"
      title="Adrenalin (C) - Stamina Penuh & Mini-Immunity"
      @click="handleSkillClick('adrenaline')"
    >
      <!-- Full-bleed Skill Icon Image -->
      <img
        :src="'/assets/ui/skills/skill-adrenaline.png'"
        alt="Adrenalin"
        :class="[
          'absolute inset-0 h-full w-full object-cover p-1.5 select-none pointer-events-none transition-all duration-150 group-hover:scale-105',
          adrenalineSkill.ready ? 'opacity-100 drop-shadow-sm' : 'opacity-25 grayscale',
        ]"
      />

      <!-- Cooldown Radial SVG Overlay -->
      <svg
        v-if="!adrenalineSkill.ready"
        data-testid="skill-adrenaline-cooldown-ring"
        class="absolute inset-0 w-full h-full -rotate-90 pointer-events-none p-1 z-10"
        viewBox="0 0 44 44"
      >
        <circle cx="22" cy="22" r="19" class="stroke-black/60 fill-transparent stroke-[4px]" />
        <circle
          cx="22"
          cy="22"
          r="19"
          class="stroke-sky-400 fill-transparent stroke-[4px] transition-all duration-100"
          :stroke-dasharray="CIRCUMFERENCE"
          :stroke-dashoffset="getStrokeDashoffset(adrenalineSkill.cooldownProgress)"
          stroke-linecap="round"
        />
      </svg>

      <!-- Center Cooldown Count -->
      <span
        v-if="!adrenalineSkill.ready"
        data-testid="skill-adrenaline-cooldown-text"
        class="relative z-20 font-heading font-black text-sky-300 text-sm leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]"
      >
        {{ adrenalineSkill.cooldownRemainingSec }}s
      </span>

      <!-- Hotkey Badge (Desktop) -->
      <span
        v-if="!props.isMobile"
        data-testid="skill-adrenaline-hotkey"
        class="absolute -top-2 -right-2 px-1.5 py-0.5 rounded-md bg-neutral-900 text-sky-300 border border-sky-500/50 font-mono font-bold text-[10px] shadow-sm z-30"
      >
        C
      </span>
    </button>
  </div>
</template>
