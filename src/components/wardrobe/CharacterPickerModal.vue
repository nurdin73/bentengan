<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { X, Check, Shield, Shirt } from 'lucide-vue-next'
import { useRoomStore } from '../../stores/room-store'
import {
  OUTFIT_PRESETS,
  type CharacterGender,
  type OutfitPresetMeta,
} from '../../game/entities/character-avatar'
import type { TeamId } from '../../types/game.types'
import CharacterPreviewViewport from './CharacterPreviewViewport.vue'
import OutfitPresetCard from './OutfitPresetCard.vue'

type GenderFilter = 'all' | CharacterGender

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
const genderFilter = ref<GenderFilter>('all')

const maleCount = computed(() => OUTFIT_PRESETS.filter((o) => o.gender === 'male').length)
const femaleCount = computed(() => OUTFIT_PRESETS.filter((o) => o.gender === 'female').length)

const filteredOutfits = computed(() => {
  if (genderFilter.value === 'all') return OUTFIT_PRESETS
  return OUTFIT_PRESETS.filter((o) => o.gender === genderFilter.value)
})

const isEquipped = computed(() => {
  return roomStore.myOutfitId === selectedOutfitId.value
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

const handleSelectOutfit = (outfit: OutfitPresetMeta) => {
  selectedOutfitId.value = outfit.id
}

const handleConfirm = () => {
  roomStore.setOutfit(selectedOutfitId.value)
  emit('select', selectedOutfitId.value)
}
</script>

<template>
  <div
    data-testid="character-picker-modal-backdrop"
    class="character-picker-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 md:p-6 bg-black/80 backdrop-blur-md pointer-events-auto select-none overflow-hidden touch-none"
    @click.self="emit('close')"
  >
    <!-- Modal Window: Fullscreen on mobile, rounded floating game window on desktop/tablet -->
    <div
      data-testid="character-picker-modal"
      class="character-picker-modal-card relative w-full h-full sm:h-auto sm:max-w-4xl md:max-w-5xl sm:max-h-[92vh] sm:aspect-16/10 flex flex-col bg-gradient-to-b from-[#38bdf8] via-[#0284c7] to-[#0369a1] text-white overflow-hidden sm:rounded-3xl sm:border-4 sm:border-white/20 sm:shadow-2xl"
    >
      <!-- Background Decor Accents -->
      <div
        class="absolute -top-16 -left-16 w-64 h-64 rounded-full bg-white/10 blur-2xl pointer-events-none"
      ></div>
      <div
        class="absolute -bottom-20 -right-20 w-80 h-80 rounded-full bg-cyan-300/15 blur-3xl pointer-events-none"
      ></div>

      <!-- Header: Quick Team Toggle Pills (Top-Left) -->
      <div
        class="absolute top-2.5 left-3 sm:top-3 sm:left-4 z-20 flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/20 shadow-md"
      >
        <Shield class="w-3.5 h-3.5 text-amber-300" />
        <span
          class="text-[10px] font-heading font-black uppercase tracking-wider text-white/90 mr-1 hidden xs:inline"
        >
          Tim:
        </span>
        <button
          type="button"
          data-testid="team-preview-blue-btn"
          class="px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-heading font-black uppercase transition-all cursor-pointer border"
          :class="
            previewTeam === 'blue'
              ? 'bg-blue-600 text-white border-white/60 shadow-xs'
              : 'bg-black/30 text-white/70 border-transparent hover:bg-black/50'
          "
          @click="previewTeam = 'blue'"
        >
          Biru
        </button>
        <button
          type="button"
          data-testid="team-preview-red-btn"
          class="px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-heading font-black uppercase transition-all cursor-pointer border"
          :class="
            previewTeam === 'red'
              ? 'bg-red-600 text-white border-white/60 shadow-xs'
              : 'bg-black/30 text-white/70 border-transparent hover:bg-black/50'
          "
          @click="previewTeam = 'red'"
        >
          Merah
        </button>
      </div>

      <!-- Close Button (Top-Right) -->
      <button
        type="button"
        data-testid="close-character-picker-btn"
        class="absolute top-2.5 right-3 sm:top-3 sm:right-4 z-20 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-red-600 hover:bg-red-500 active:scale-95 text-white flex items-center justify-center shadow-lg border-2 border-white/80 transition-all cursor-pointer"
        title="Tutup Lemari"
        @click="emit('close')"
      >
        <X class="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
      </button>

      <!-- Main Layout: 2 Columns (Preview Column + Costumes Grid Column) -->
      <div
        class="w-full h-full flex flex-row items-stretch p-2.5 sm:p-4 md:p-5 gap-2.5 sm:gap-4 md:gap-5 overflow-hidden"
      >
        <!-- KOLOM 1: 3D Preview dengan Tombol Gunakan / Digunakan Menyatu di Bawah -->
        <div class="w-[45%] lg:w-[42%] relative h-full min-h-0 pt-8 pb-1 flex flex-col">
          <!-- 3D Viewport Container with Docked Full-Width Bottom Action Bar -->
          <div
            class="w-full flex-1 min-h-0 relative overflow-hidden rounded-2xl shadow-inner border border-white/10 flex flex-col justify-between bg-black/20"
          >
            <!-- 3D Viewport (pointer-events-none to prevent touch drag / spin conflicts) -->
            <div class="w-full flex-1 min-h-0 pointer-events-none select-none relative">
              <CharacterPreviewViewport
                :outfit-id="selectedOutfitId"
                :team-id="previewTeam"
                :hide-hint="true"
                class="w-full h-full"
              />
            </div>

            <!-- Docked Full-Width Action Bar (100% width of 3D container) -->
            <div class="w-full shrink-0 z-20 pointer-events-auto">
              <button
                v-if="!isEquipped"
                type="button"
                data-testid="save-outfit-btn"
                class="w-full py-2.5 sm:py-3 bg-emerald-500 hover:bg-emerald-400 active:brightness-95 text-white font-heading font-black text-xs sm:text-sm uppercase tracking-wider shadow-lg border-t border-emerald-400/50 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                title="Gunakan Busana Ini"
                @click="handleConfirm"
              >
                <Check class="w-4 h-4 stroke-[3]" />
                <span>Gunakan Busana</span>
              </button>
              <div
                v-else
                data-testid="outfit-active-indicator"
                class="w-full py-2 sm:py-2.5 bg-black/60 backdrop-blur-md text-emerald-300 font-heading font-black text-xs sm:text-sm uppercase tracking-wider border-t border-emerald-400/30 text-center flex items-center justify-center gap-1.5 select-none"
              >
                <Check class="w-4 h-4 stroke-[3] text-emerald-400" />
                <span>Sedang Digunakan</span>
              </div>
            </div>
          </div>
        </div>

        <!-- KOLOM 2: Grid 2 Kolom Kostum + Filter Gender -->
        <div
          class="w-[55%] lg:w-[58%] flex flex-col h-full min-h-0 bg-neutral-900/40 backdrop-blur-md rounded-2xl sm:rounded-3xl border-2 border-white/20 p-2 sm:p-3.5 shadow-2xl overflow-hidden"
        >
          <!-- Panel Header & Gender Filter Tabs -->
          <div class="flex flex-col gap-2 pb-2 shrink-0 border-b border-white/10">
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-1.5">
                <Shirt class="w-4 h-4 text-amber-300" />
                <span
                  class="text-xs sm:text-sm font-heading font-black uppercase tracking-wider text-white"
                >
                  Koleksi Busana
                </span>
              </div>
              <span
                class="text-[10px] sm:text-xs font-mono font-bold bg-white/10 px-2.5 py-0.5 rounded-full text-white/80"
              >
                {{ filteredOutfits.length }} Kostum
              </span>
            </div>

            <!-- Gender Filter Pills -->
            <div
              data-testid="gender-filter-tabs"
              class="flex items-center gap-1.5 bg-black/30 p-1 rounded-xl border border-white/10"
            >
              <button
                type="button"
                data-testid="gender-filter-all"
                class="flex-1 py-1 px-2 rounded-lg text-[10px] sm:text-xs font-heading font-black uppercase tracking-wider transition-all cursor-pointer"
                :class="
                  genderFilter === 'all'
                    ? 'bg-amber-400 text-neutral-900 shadow-xs'
                    : 'text-white/75 hover:text-white hover:bg-white/10'
                "
                @click="genderFilter = 'all'"
              >
                Semua ({{ OUTFIT_PRESETS.length }})
              </button>
              <button
                type="button"
                data-testid="gender-filter-male"
                class="flex-1 py-1 px-2 rounded-lg text-[10px] sm:text-xs font-heading font-black uppercase tracking-wider transition-all cursor-pointer"
                :class="
                  genderFilter === 'male'
                    ? 'bg-sky-400 text-neutral-950 shadow-xs'
                    : 'text-white/75 hover:text-white hover:bg-white/10'
                "
                @click="genderFilter = 'male'"
              >
                Putra ({{ maleCount }})
              </button>
              <button
                type="button"
                data-testid="gender-filter-female"
                class="flex-1 py-1 px-2 rounded-lg text-[10px] sm:text-xs font-heading font-black uppercase tracking-wider transition-all cursor-pointer"
                :class="
                  genderFilter === 'female'
                    ? 'bg-pink-400 text-neutral-950 shadow-xs'
                    : 'text-white/75 hover:text-white hover:bg-white/10'
                "
                @click="genderFilter = 'female'"
              >
                Putri ({{ femaleCount }})
              </button>
            </div>
          </div>

          <!-- Grid 2 Columns of Costumes -->
          <div
            data-testid="outfits-grid"
            class="grid grid-cols-2 gap-2 sm:gap-2.5 overflow-y-auto flex-1 min-h-0 pr-1 py-2"
          >
            <OutfitPresetCard
              v-for="outfit in filteredOutfits"
              :key="outfit.id"
              :outfit="outfit"
              :is-selected="selectedOutfitId === outfit.id"
              :is-equipped="roomStore.myOutfitId === outfit.id"
              @select="handleSelectOutfit"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
