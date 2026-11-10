<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import {
  X,
  Check,
  Shield,
  Zap,
  Crown,
  Flame,
  Sparkles,
  GraduationCap,
  CloudSnow,
  Shirt,
} from 'lucide-vue-next'
import { useRoomStore } from '../../stores/room-store'
import {
  OUTFIT_PRESETS,
  type OutfitPresetMeta,
} from '../../game/entities/character-avatar'
import type { TeamId } from '../../types/game.types'
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

      <!-- Main Layout: 2 Columns (Preview Column + Grid 2x2 Costumes Column) -->
      <div
        class="w-full h-full flex flex-row items-stretch p-2.5 sm:p-4 md:p-5 gap-2.5 sm:gap-4 md:gap-5 overflow-hidden"
      >
        <!-- KOLOM 1: 3D Preview dengan Tombol Gunakan / Digunakan Menyatu di Bawah -->
        <div
          class="w-[45%] lg:w-[42%] relative h-full min-h-0 pt-8 pb-1 flex flex-col"
        >
          <!-- 3D Viewport Container -->
          <div class="w-full flex-1 min-h-0 relative overflow-hidden rounded-2xl shadow-inner border border-white/10">
            <!-- 3D Viewport (pointer-events-none to prevent touch drag / spin conflicts) -->
            <div class="w-full h-full pointer-events-none select-none">
              <CharacterPreviewViewport
                :outfit-id="selectedOutfitId"
                :team-id="previewTeam"
                :hide-hint="true"
                class="w-full h-full"
              />
            </div>

            <!-- Floating Action: Gunakan / Digunakan (Menyatu di bagian bawah 3D Viewport) -->
            <div class="absolute bottom-3 inset-x-0 mx-auto w-fit z-20 pointer-events-auto">
              <button
                v-if="!isEquipped"
                type="button"
                data-testid="save-outfit-btn"
                class="px-5 py-2 rounded-full bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-white font-heading font-black text-xs sm:text-sm uppercase tracking-wider shadow-xl border-2 border-white/80 flex items-center gap-1.5 transition-all cursor-pointer"
                title="Gunakan Busana Ini"
                @click="handleConfirm"
              >
                <Check class="w-4 h-4 stroke-[3]" />
                <span>Gunakan</span>
              </button>
              <div
                v-else
                data-testid="outfit-active-indicator"
                class="px-4 py-1.5 rounded-full bg-black/60 backdrop-blur-md text-emerald-300 font-heading font-black text-xs sm:text-sm uppercase tracking-wider border border-emerald-400/50 shadow-xl flex items-center gap-1.5 select-none"
              >
                <Check class="w-4 h-4 stroke-[3] text-emerald-400" />
                <span>Digunakan</span>
              </div>
            </div>
          </div>
        </div>

        <!-- KOLOM 2: Grid 2 Kolom Kostum -->
        <div
          class="w-[55%] lg:w-[58%] flex flex-col h-full min-h-0 bg-neutral-900/40 backdrop-blur-md rounded-2xl sm:rounded-3xl border-2 border-white/20 p-2 sm:p-3.5 shadow-2xl overflow-hidden"
        >
          <!-- Panel Header -->
          <div class="flex items-center justify-between pb-2 shrink-0 border-b border-white/10">
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
              {{ OUTFIT_PRESETS.length }} Kostum
            </span>
          </div>

          <!-- Grid 2x2 (2 Columns of Costumes) -->
          <div
            data-testid="outfits-grid"
            class="grid grid-cols-2 gap-2 sm:gap-2.5 overflow-y-auto flex-1 min-h-0 pr-1 py-2"
          >
            <div
              v-for="outfit in OUTFIT_PRESETS"
              :key="outfit.id"
              :data-testid="`outfit-card-${outfit.id}`"
              class="relative rounded-xl sm:rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between items-center text-center select-none overflow-hidden min-h-[110px] sm:min-h-[130px] bg-gradient-to-b from-white to-slate-100 group shadow-md"
              :class="[
                selectedOutfitId === outfit.id
                  ? 'border-amber-400 ring-2 ring-amber-400/80 shadow-amber-500/20 shadow-lg'
                  : 'border-slate-300/80 hover:border-white/80 opacity-90 hover:opacity-100',
              ]"
              @click="handleSelectOutfit(outfit)"
            >
              <!-- Card Number Tag & Active Dot -->
              <div class="w-full flex items-center justify-between px-2 pt-1.5">
                <span
                  class="text-[8px] sm:text-[9px] font-mono font-black text-neutral-400 uppercase"
                >
                  #{{ outfit.id }}
                </span>
                <span
                  class="w-2 h-2 rounded-full"
                  :class="
                    roomStore.myOutfitId === outfit.id ? 'bg-emerald-500' : 'bg-transparent'
                  "
                  title="Aktif"
                ></span>
              </div>

              <!-- Stylized Avatar / Outfit Icon -->
              <div class="flex-1 flex flex-col items-center justify-center p-1 w-full min-h-0">
                <div
                  class="w-9 h-9 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center transition-all shadow-inner"
                  :class="
                    selectedOutfitId === outfit.id
                      ? 'bg-neutral-900 text-amber-300 scale-105'
                      : 'bg-slate-200 text-neutral-700'
                  "
                >
                  <component :is="getOutfitIcon(outfit.id)" class="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <span
                  class="mt-1 text-[10px] sm:text-xs font-heading font-black text-neutral-900 truncate max-w-full px-1"
                >
                  {{ outfit.name }}
                </span>
                <span
                  class="text-[8.5px] sm:text-[9.5px] font-sans text-neutral-500 truncate max-w-full px-1"
                >
                  {{ outfit.subtitle }}
                </span>
              </div>

              <!-- Bottom Selected Banner (Stumble Guys Style) -->
              <div
                v-if="selectedOutfitId === outfit.id"
                class="w-full bg-white text-neutral-900 font-heading font-black text-[9px] sm:text-[10px] uppercase tracking-wider py-0.5 sm:py-1 border-t-2 border-amber-400 shrink-0 shadow-xs"
              >
                SELECTED
              </div>
              <div
                v-else-if="roomStore.myOutfitId === outfit.id"
                class="w-full bg-emerald-600 text-white font-heading font-black text-[8px] sm:text-[9px] uppercase tracking-wider py-0.5 sm:py-1 shrink-0"
              >
                DIPAKAI
              </div>
              <div
                v-else
                class="w-full bg-slate-200 text-neutral-500 font-sans font-semibold text-[8px] sm:text-[9px] py-0.5 sm:py-1 truncate shrink-0 px-1"
              >
                🧢 {{ outfit.hatName }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
