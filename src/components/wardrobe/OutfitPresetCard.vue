<script setup lang="ts">
import { computed } from 'vue'
import {
  Zap,
  Crown,
  Flame,
  Sparkles,
  GraduationCap,
  CloudSnow,
  Shirt,
  Flower2,
  Wind,
  Ribbon,
  Award,
} from 'lucide-vue-next'
import type { OutfitPresetMeta } from '../../game/entities/character-avatar'

const props = defineProps<{
  outfit: OutfitPresetMeta
  isSelected: boolean
  isEquipped: boolean
}>()

const emit = defineEmits<{
  (e: 'select', outfit: OutfitPresetMeta): void
}>()

const presetIcon = computed(() => {
  switch (props.outfit.id) {
    case 1:
      return Zap
    case 2:
      return Crown
    case 3:
      return Flame
    case 4:
      return Sparkles
    case 5:
      return GraduationCap
    case 6:
      return CloudSnow
    case 7:
      return Flower2
    case 8:
      return Wind
    case 9:
      return Ribbon
    case 10:
      return Award
    default:
      return Shirt
  }
})
</script>

<template>
  <div
    :data-testid="`outfit-card-${outfit.id}`"
    class="relative rounded-xl sm:rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between items-center text-center select-none overflow-hidden min-h-[110px] sm:min-h-[130px] bg-gradient-to-b from-white to-slate-100 group shadow-md"
    :class="[
      isSelected
        ? 'border-amber-400 ring-2 ring-amber-400/80 shadow-amber-500/20 shadow-lg'
        : 'border-slate-300/80 hover:border-white/80 opacity-90 hover:opacity-100',
    ]"
    @click="emit('select', outfit)"
  >
    <!-- Card Number Tag, Gender Badge & Active Dot -->
    <div class="w-full flex items-center justify-between px-2 pt-1.5 gap-1">
      <div class="flex items-center gap-1">
        <span class="text-[8px] sm:text-[9px] font-mono font-black text-neutral-400 uppercase">
          #{{ outfit.id }}
        </span>
        <span
          :data-testid="`outfit-gender-badge-${outfit.id}`"
          class="text-[7.5px] sm:text-[8.5px] font-heading font-black uppercase px-1.5 py-0.2 rounded-full"
          :class="
            outfit.gender === 'female'
              ? 'bg-pink-100 text-pink-700'
              : 'bg-sky-100 text-sky-700'
          "
        >
          {{ outfit.gender === 'female' ? 'Putri' : 'Putra' }}
        </span>
      </div>
      <span
        class="w-2 h-2 rounded-full shrink-0"
        :class="isEquipped ? 'bg-emerald-500' : 'bg-transparent'"
        title="Aktif"
      ></span>
    </div>

    <!-- Stylized Avatar / Outfit Icon -->
    <div class="flex-1 flex flex-col items-center justify-center p-1 w-full min-h-0">
      <div
        class="w-9 h-9 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center transition-all shadow-inner"
        :class="
          isSelected
            ? 'bg-neutral-900 text-amber-300 scale-105'
            : outfit.gender === 'female'
              ? 'bg-pink-100 text-pink-700'
              : 'bg-slate-200 text-neutral-700'
        "
      >
        <component :is="presetIcon" class="w-5 h-5 sm:w-6 sm:h-6" />
      </div>
      <span
        class="mt-1 text-[10px] sm:text-xs font-heading font-black text-neutral-900 truncate max-w-full px-1"
      >
        {{ outfit.name }}
      </span>
      <span class="text-[8.5px] sm:text-[9.5px] font-sans text-neutral-500 truncate max-w-full px-1">
        {{ outfit.subtitle }}
      </span>
    </div>

    <!-- Bottom Selected / Equipped / Feature Banner -->
    <div
      v-if="isSelected"
      class="w-full bg-white text-neutral-900 font-heading font-black text-[9px] sm:text-[10px] uppercase tracking-wider py-0.5 sm:py-1 border-t-2 border-amber-400 shrink-0 shadow-xs"
    >
      SELECTED
    </div>
    <div
      v-else-if="isEquipped"
      class="w-full bg-emerald-600 text-white font-heading font-black text-[8px] sm:text-[9px] uppercase tracking-wider py-0.5 sm:py-1 shrink-0"
    >
      DIPAKAI
    </div>
    <div
      v-else
      class="w-full bg-slate-200 text-neutral-600 font-sans font-semibold text-[8px] sm:text-[9px] py-0.5 sm:py-1 truncate shrink-0 px-1"
    >
      {{ outfit.hatName }}
    </div>
  </div>
</template>

