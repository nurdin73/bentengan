<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import {
  Shirt,
  X,
  Check,
  Shield,
  Sparkles,
  Crown,
  Flame,
  Zap,
  GraduationCap,
  CloudSnow,
} from 'lucide-vue-next'
import { useRoomStore } from '../../stores/room-store'
import { OUTFIT_PRESETS, type OutfitPresetMeta } from '../../game/entities/character-avatar'
import type { TeamId } from '../../types/game.types'
import TactileButton from '../ui/TactileButton.vue'
import CharacterPreviewViewport from './CharacterPreviewViewport.vue'

const props = defineProps<{
  team?: TeamId
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'select', outfitId: number): void
}>()

const roomStore = useRoomStore()

const selectedOutfitId = ref<number>(roomStore.myOutfitId || 1)
const previewTeam = ref<TeamId>(props.team ?? roomStore.myTeam ?? 'blue')

const currentOutfit = computed(() => {
  return OUTFIT_PRESETS.find((o) => o.id === selectedOutfitId.value)
})

watch(
  () => roomStore.myOutfitId,
  (newId) => {
    selectedOutfitId.value = newId
  },
  { immediate: true },
)

watch(
  () => props.team,
  (newTeam) => {
    if (newTeam) {
      previewTeam.value = newTeam
    }
  },
)

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    emit('close')
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})

const teamPrimaryColor = computed(() => {
  return previewTeam.value === 'blue' ? '#3B82F6' : '#EF4444'
})

const teamSecondaryColor = computed(() => {
  return previewTeam.value === 'blue' ? '#BAE6FD' : '#FECACA'
})

const teamBadgeClass = computed(() => {
  return previewTeam.value === 'blue'
    ? 'bg-blue-50 text-blue-700 border-blue-200'
    : 'bg-red-50 text-red-700 border-red-200'
})

const handleSelectOutfit = (outfit: OutfitPresetMeta) => {
  selectedOutfitId.value = outfit.id
}

const handleConfirm = () => {
  roomStore.setOutfit(selectedOutfitId.value)
  emit('select', selectedOutfitId.value)
  emit('close')
}

// Icon helper per outfit
const getOutfitIcon = (id: number) => {
  switch (id) {
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
    default:
      return Shirt
  }
}
</script>

<template>
  <div
    data-testid="character-picker-modal-backdrop"
    class="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-sm pointer-events-auto"
    @click.self="emit('close')"
  >
    <div
      data-testid="character-picker-modal"
      class="timbul-card w-full max-w-4xl p-4 sm:p-6 flex flex-col gap-4 sm:gap-5 max-h-[94dvh] overflow-y-auto overscroll-contain relative shadow-2xl bg-[#f8f6f0]"
    >
      <!-- Close Button -->
      <button
        type="button"
        data-testid="close-character-picker-btn"
        class="absolute top-4 right-4 sm:top-5 sm:right-5 w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 active:scale-95 text-neutral-600 font-black flex items-center justify-center transition-all cursor-pointer border border-neutral-300"
        title="Tutup Lemari"
        @click="emit('close')"
      >
        <X class="w-4 h-4" />
      </button>

      <!-- Header -->
      <div class="flex flex-col gap-1 pr-10">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-xl bg-amber-400 text-amber-950 flex items-center justify-center shadow-xs border border-amber-500/50">
            <Shirt class="w-4 h-4" />
          </div>
          <h2 class="font-heading font-black text-lg sm:text-xl text-neutral-900 uppercase tracking-wider">
            Lemari Busana Karakter
          </h2>
        </div>
        <p class="font-sans text-xs text-neutral-600">
          Pilih setelan busana modular untuk karakter 3D Anda. Putar preview karakter untuk melihat detail aksesori.
        </p>
      </div>

      <!-- Main Content Area: Responsive Split (Desktop 2-columns / Mobile Stack) -->
      <div class="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-5 items-start">
        <!-- Left / Top Column: 3D Pedestal Viewport (md:col-span-5) -->
        <div class="md:col-span-5 flex flex-col gap-2.5">
          <div class="h-44 sm:h-52 md:h-[350px] w-full">
            <CharacterPreviewViewport
              :outfit-id="selectedOutfitId"
              :team-id="previewTeam"
            />
          </div>

          <!-- Active Selected Outfit Summary Card -->
          <div class="p-3 rounded-2xl bg-white/90 border border-neutral-300/80 shadow-2xs flex flex-col gap-1">
            <div class="flex items-center justify-between">
              <span class="text-[10px] font-heading font-black text-neutral-500 uppercase tracking-wider">
                Pratinjau Busana
              </span>
              <span class="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border" :class="teamBadgeClass">
                {{ previewTeam === 'blue' ? 'Tim Biru' : 'Tim Merah' }}
              </span>
            </div>
            <div class="font-heading font-black text-sm text-neutral-900 leading-tight">
              {{ currentOutfit?.name }}
            </div>
            <div class="font-sans text-[11px] text-neutral-500 font-semibold">
              {{ currentOutfit?.subtitle }}
            </div>
          </div>
        </div>

        <!-- Right / Bottom Column: Team Bar & Outfits Grid (md:col-span-7) -->
        <div class="md:col-span-7 flex flex-col gap-3">
          <!-- Preview Team Toggle Bar -->
          <div class="flex items-center justify-between flex-wrap gap-2.5 p-2.5 sm:p-3 rounded-2xl bg-white/80 border border-neutral-300/80 shadow-2xs">
            <div class="flex items-center gap-2">
              <Shield class="w-4 h-4 text-neutral-500" />
              <span class="font-heading font-bold text-xs uppercase text-neutral-700">Preview Warna Tim:</span>
            </div>
            <div class="flex items-center gap-1.5">
              <button
                type="button"
                data-testid="team-preview-blue-btn"
                class="px-3 py-1 rounded-xl text-xs font-heading font-black uppercase transition-all cursor-pointer flex items-center gap-1.5 border"
                :class="
                  previewTeam === 'blue'
                    ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                    : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
                "
                @click="previewTeam = 'blue'"
              >
                <span class="w-2.5 h-2.5 rounded-full bg-blue-400 border border-white/50 inline-block"></span>
                <span>Tim Biru</span>
              </button>
              <button
                type="button"
                data-testid="team-preview-red-btn"
                class="px-3 py-1 rounded-xl text-xs font-heading font-black uppercase transition-all cursor-pointer flex items-center gap-1.5 border"
                :class="
                  previewTeam === 'red'
                    ? 'bg-red-600 text-white border-red-700 shadow-xs'
                    : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
                "
                @click="previewTeam = 'red'"
              >
                <span class="w-2.5 h-2.5 rounded-full bg-red-400 border border-white/50 inline-block"></span>
                <span>Tim Merah</span>
              </button>
            </div>
          </div>

          <!-- Outfits Grid: 2 columns on tablet/desktop, 1 on small mobile -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 max-h-[280px] sm:max-h-[320px] md:max-h-[350px] overflow-y-auto pr-1">
            <div
              v-for="outfit in OUTFIT_PRESETS"
              :key="outfit.id"
              :data-testid="`outfit-card-${outfit.id}`"
              class="relative p-3 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-2 bg-white group text-left select-none"
              :class="[
                selectedOutfitId === outfit.id
                  ? 'border-neutral-900 ring-2 ring-neutral-900 shadow-md bg-amber-50/40'
                  : 'border-neutral-200 hover:border-neutral-400 shadow-2xs hover:shadow-xs',
              ]"
              @click="handleSelectOutfit(outfit)"
            >
              <!-- Top Row: Icon, Number, Selected Mark -->
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <div
                    class="w-7 h-7 rounded-xl flex items-center justify-center transition-colors"
                    :class="
                      selectedOutfitId === outfit.id
                        ? 'bg-neutral-900 text-amber-300'
                        : 'bg-neutral-100 text-neutral-700 group-hover:bg-neutral-200'
                    "
                  >
                    <component :is="getOutfitIcon(outfit.id)" class="w-3.5 h-3.5" />
                  </div>
                  <span class="font-mono text-[10px] font-black uppercase px-1.5 py-0.5 rounded-md bg-neutral-100 text-neutral-600 border border-neutral-200">
                    #{{ outfit.id }}
                  </span>
                </div>

                <!-- Active Indicator -->
                <div
                  v-if="selectedOutfitId === outfit.id"
                  class="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xs"
                  title="Busana Terpilih"
                >
                  <Check class="w-3.5 h-3.5 stroke-[3]" />
                </div>
                <div
                  v-else-if="roomStore.myOutfitId === outfit.id"
                  class="text-[9px] font-heading font-black uppercase tracking-wider text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-full"
                >
                  Aktif
                </div>
              </div>

              <!-- Body Info -->
              <div class="flex flex-col gap-0.5">
                <div class="font-heading font-black text-xs sm:text-sm text-neutral-900 leading-tight">
                  {{ outfit.name }}
                </div>
                <div class="font-sans text-[10.5px] font-semibold text-neutral-500">
                  {{ outfit.subtitle }}
                </div>
                <p class="font-sans text-[10px] text-neutral-600 mt-0.5 line-clamp-2 leading-relaxed">
                  {{ outfit.description }}
                </p>
              </div>

              <!-- Visual Color Palettes & Accessories Pills -->
              <div class="pt-1.5 border-t border-neutral-100 flex flex-col gap-1">
                <!-- Palette chips -->
                <div class="flex items-center justify-between text-[8.5px] text-neutral-500 font-bold uppercase">
                  <span>Warna Tim:</span>
                  <div class="flex items-center gap-1">
                    <span
                      class="w-2.5 h-2.5 rounded-full border border-black/10 inline-block shadow-2xs"
                      :style="{ backgroundColor: teamPrimaryColor }"
                      title="Warna Primer"
                    ></span>
                    <span
                      class="w-2.5 h-2.5 rounded-full border border-black/10 inline-block shadow-2xs"
                      :style="{ backgroundColor: teamSecondaryColor }"
                      title="Warna Sekunder"
                    ></span>
                  </div>
                </div>

                <!-- Accessories Chips -->
                <div class="flex flex-wrap gap-1 text-[8.5px] text-neutral-600 font-sans">
                  <span class="px-1.5 py-0.5 rounded-md bg-neutral-100 border border-neutral-200/80">
                    🧢 {{ outfit.hatName }}
                  </span>
                  <span class="px-1.5 py-0.5 rounded-md bg-neutral-100 border border-neutral-200/80">
                    👕 {{ outfit.topName }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Action Footer -->
      <div class="pt-3 border-t border-neutral-200 flex items-center justify-between gap-3 flex-wrap">
        <div class="text-xs text-neutral-500 font-sans">
          Busana terpilih:
          <strong class="text-neutral-900 font-bold">
            {{ OUTFIT_PRESETS.find((o) => o.id === selectedOutfitId)?.name }}
          </strong>
        </div>

        <div class="flex items-center gap-2 ml-auto">
          <TactileButton
            type="button"
            data-testid="cancel-outfit-btn"
            variant="neutral"
            size="md"
            @click="emit('close')"
          >
            Batal
          </TactileButton>

          <TactileButton
            type="button"
            data-testid="save-outfit-btn"
            variant="amber"
            size="md"
            @click="handleConfirm"
          >
            <Check class="w-4 h-4 mr-1 text-neutral-900" />
            <span>Gunakan Busana</span>
          </TactileButton>
        </div>
      </div>
    </div>
  </div>
</template>
