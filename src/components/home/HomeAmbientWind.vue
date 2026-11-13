<script setup lang="ts">
import { computed } from 'vue'
import {
  LEAF_PARTICLES,
  LEAF_TONE_COLORS,
  LOW_DENSITY_LEAF_LIMIT,
  LOW_DENSITY_STREAK_LIMIT,
  WIND_STREAKS,
  type LeafParticleConfig,
  type WindStreakConfig,
} from './home-ambient-wind.config'

const props = withDefaults(
  defineProps<{
    density?: 'low' | 'high'
  }>(),
  {
    density: 'high',
  },
)

const visibleLeaves = computed(() =>
  props.density === 'low' ? LEAF_PARTICLES.slice(0, LOW_DENSITY_LEAF_LIMIT) : LEAF_PARTICLES,
)

const visibleStreaks = computed(() =>
  props.density === 'low' ? WIND_STREAKS.slice(0, LOW_DENSITY_STREAK_LIMIT) : WIND_STREAKS,
)

function getLeafStyle(leaf: LeafParticleConfig): Record<string, string> {
  return {
    left: `${leaf.startXPercent}%`,
    width: `${leaf.sizePx}px`,
    height: `${leaf.sizePx}px`,
    animationDuration: `${leaf.durationSec}s`,
    animationDelay: `${leaf.delaySec}s`,
    '--leaf-drift-x': `${leaf.driftXRem}rem`,
    '--leaf-sway-x': `${leaf.swayXRem}rem`,
    '--leaf-rot-start': `${leaf.rotateStartDeg}deg`,
    '--leaf-rot-end': `${leaf.rotateEndDeg}deg`,
    '--leaf-opacity': String(leaf.opacity),
  }
}

function getStreakStyle(streak: WindStreakConfig): Record<string, string> {
  return {
    top: `${streak.topPercent}%`,
    width: `${streak.widthPx}px`,
    animationDuration: `${streak.durationSec}s`,
    animationDelay: `${streak.delaySec}s`,
    '--streak-opacity': String(streak.opacity),
  }
}
</script>

<template>
  <div
    data-testid="home-ambient-wind"
    aria-hidden="true"
    class="pointer-events-none fixed inset-0 overflow-hidden z-0 select-none"
  >
    <!-- Subtle Wind Gust Ribbons -->
    <svg
      v-for="streak in visibleStreaks"
      :key="`streak-${streak.id}`"
      data-testid="home-ambient-streak"
      viewBox="0 0 220 36"
      fill="none"
      class="ambient-wind-streak absolute left-0 h-8"
      :style="getStreakStyle(streak)"
    >
      <path
        d="M4 22 C58 14, 118 28, 174 16 C194 12, 208 6, 200 4 C192 2, 185 11, 194 15"
        stroke="white"
        stroke-width="2.2"
        stroke-linecap="round"
        stroke-opacity="0.85"
      />
      <path
        d="M34 30 C84 24, 128 33, 168 26"
        stroke="#e0f2fe"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-opacity="0.65"
      />
    </svg>

    <!-- Wind-Blown Falling Leaves -->
    <svg
      v-for="leaf in visibleLeaves"
      :key="`leaf-${leaf.id}`"
      data-testid="home-ambient-leaf"
      viewBox="0 0 24 24"
      fill="none"
      class="ambient-leaf absolute -top-10 drop-shadow-xs"
      :style="getLeafStyle(leaf)"
    >
      <template v-if="leaf.shape === 'oval'">
        <path
          d="M20 4C12 4 6.5 8.5 5 15.5C4.5 17.8 5.2 19.3 6.5 20C13.5 19 19.5 13 20 4Z"
          :fill="LEAF_TONE_COLORS[leaf.tone].fill"
        />
        <path
          d="M4 20.5C8.5 16.5 13 11.5 18 6"
          :stroke="LEAF_TONE_COLORS[leaf.tone].vein"
          stroke-width="1.5"
          stroke-linecap="round"
        />
      </template>
      <template v-else>
        <path
          d="M21 3C13.5 4.2 8.2 7.8 5.5 14C4.4 16.5 4.6 18.6 6 19.8C12.8 18.2 18.2 12.2 21 3Z"
          :fill="LEAF_TONE_COLORS[leaf.tone].fill"
        />
        <path
          d="M4.5 20.5C9.5 15.8 14 10.8 18.8 5.4"
          :stroke="LEAF_TONE_COLORS[leaf.tone].vein"
          stroke-width="1.4"
          stroke-linecap="round"
        />
      </template>
    </svg>
  </div>
</template>

<style scoped>
.ambient-leaf {
  will-change: transform, opacity;
  animation-name: leaf-fall-wind;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}

.ambient-wind-streak {
  will-change: transform, opacity;
  animation-name: wind-gust-sweep;
  animation-timing-function: cubic-bezier(0.37, 0, 0.63, 1);
  animation-iteration-count: infinite;
}

@keyframes leaf-fall-wind {
  0% {
    opacity: 0;
    transform: translate3d(0, -8vh, 0) rotate(var(--leaf-rot-start, 0deg)) scale(0.88);
  }
  10% {
    opacity: var(--leaf-opacity, 0.65);
  }
  28% {
    transform: translate3d(
        calc(var(--leaf-drift-x, 18rem) * 0.25 + var(--leaf-sway-x, 2rem)),
        26vh,
        0
      )
      rotate(calc(var(--leaf-rot-start, 0deg) + 85deg)) scale(1);
  }
  55% {
    transform: translate3d(
        calc(var(--leaf-drift-x, 18rem) * 0.55 - var(--leaf-sway-x, 2rem) * 0.6),
        56vh,
        0
      )
      rotate(calc(var(--leaf-rot-start, 0deg) + 185deg)) scale(0.92);
  }
  80% {
    opacity: var(--leaf-opacity, 0.65);
    transform: translate3d(
        calc(var(--leaf-drift-x, 18rem) * 0.82 + var(--leaf-sway-x, 2rem) * 0.7),
        84vh,
        0
      )
      rotate(calc(var(--leaf-rot-end, 280deg) * 0.8)) scale(0.98);
  }
  100% {
    opacity: 0;
    transform: translate3d(var(--leaf-drift-x, 18rem), 110vh, 0)
      rotate(var(--leaf-rot-end, 280deg)) scale(0.86);
  }
}

@keyframes wind-gust-sweep {
  0% {
    opacity: 0;
    transform: translate3d(-25vw, 0, 0) scaleX(0.75);
  }
  20% {
    opacity: var(--streak-opacity, 0.2);
  }
  55% {
    opacity: var(--streak-opacity, 0.2);
    transform: translate3d(42vw, 10px, 0) scaleX(1.08);
  }
  82% {
    opacity: calc(var(--streak-opacity, 0.2) * 0.45);
  }
  100% {
    opacity: 0;
    transform: translate3d(112vw, 22px, 0) scaleX(0.85);
  }
}

@media (prefers-reduced-motion: reduce) {
  .ambient-leaf,
  .ambient-wind-streak {
    animation: none;
    opacity: 0;
  }
}
</style>

