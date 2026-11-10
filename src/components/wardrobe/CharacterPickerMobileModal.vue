<script setup lang="ts">
import CharacterPickerModal from './CharacterPickerModal.vue'
import type { TeamId } from '../../types/game.types'

defineProps<{
  team?: TeamId
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'select', outfitId: number): void
}>()
</script>

<template>
  <CharacterPickerModal
    :team="team"
    @close="emit('close')"
    @select="(id) => emit('select', id)"
  />
</template>
