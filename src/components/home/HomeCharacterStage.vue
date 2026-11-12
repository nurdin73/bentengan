<script setup lang="ts">
import { computed } from 'vue'
import { Shirt } from 'lucide-vue-next'
import CharacterPreviewViewport from '../wardrobe/CharacterPreviewViewport.vue'
import { OUTFIT_PRESETS } from '../../game/entities/character-avatar'
import type { TeamId } from '../../types/game.types'

const props = defineProps<{
  outfitId: number
  teamId: TeamId
  paused?: boolean
}>()

const emit = defineEmits<{
  (e: 'open-wardrobe'): void
}>()

const activeOutfitName = computed(() => {
  return OUTFIT_PRESETS.find((o) => o.id === props.outfitId)?.name ?? 'Setelan Standar'
})
</script>

<template>
  <section
    data-testid="home-character-stage"
    class="relative flex flex-col items-center justify-center w-full"
  >
    <!-- Floating Outfit Tag -->
    <div
      data-testid="home-outfit-badge"
      class="mb-2 inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/20 backdrop-blur-md border border-white/40 text-white shadow-sm"
    >
      <span class="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
      <span class="font-heading font-black text-[11px] uppercase tracking-widest">
        {{ activeOutfitName }}
      </span>
    </div>

    <!-- 3D Showcase Area -->
    <div class="relative w-full max-w-[350px] sm:max-w-[400px] aspect-[4/4.3] flex items-center justify-center">
      <!-- Radial Ground Glow -->
      <div
        class="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 w-56 h-16 rounded-full blur-xl opacity-60 transition-colors duration-300"
        :class="teamId === 'blue' ? 'bg-cyan-300' : 'bg-rose-400'"
      />

      <!-- Live 3D Viewport (unmounted while Wardrobe modal is open to save WebGL contexts) -->
      <CharacterPreviewViewport
        v-if="!paused"
        :outfit-id="outfitId"
        :team-id="teamId"
        variant="stage"
        hide-hint
        class="w-full h-full"
      />
      <div
        v-else
        data-testid="home-character-stage-paused"
        class="w-full h-full rounded-3xl bg-white/10 border border-white/20 flex items-center justify-center text-white/70 font-heading text-xs uppercase tracking-widest"
      >
        Membuka Lemari...
      </div>
    </div>

    <!-- Tactile Wardrobe CTA -->
    <button
      type="button"
      data-testid="home-wardrobe-btn"
      class="timbul-btn mt-1 px-6 py-2.5 bg-white hover:bg-amber-50 text-neutral-900 border-neutral-200 border-b-[4px] border-b-neutral-300 text-xs sm:text-sm font-black rounded-2xl shadow-xl flex items-center gap-2"
      @click="emit('open-wardrobe')"
    >
      <Shirt class="w-4 h-4 text-sky-600 shrink-0" />
      <span>Ganti Karakter</span>
    </button>
  </section>
</template>

