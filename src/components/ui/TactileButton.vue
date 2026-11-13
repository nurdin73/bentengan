<script setup lang="ts">
import { uiSound } from '../../game/audio/ui-sound'

interface Props {
  variant?: 'amber' | 'blue' | 'red' | 'emerald' | 'neutral'
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  dataTestid?: string
  silent?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'amber',
  disabled: false,
  type: 'button',
  dataTestid: 'tactile-btn',
  silent: false,
})

const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void
}>()

const handleClick = (e: MouseEvent) => {
  if (!props.disabled && !props.silent) {
    uiSound.playUiClick()
  }
  emit('click', e)
}
</script>

<template>
  <button
    :type="type"
    :disabled="disabled"
    :data-testid="dataTestid"
    :class="[
      'timbul-btn px-6 py-3 text-base sm:text-lg tracking-wide shadow-lg active:scale-[0.99]',
      variant === 'amber' && 'timbul-btn-amber',
      variant === 'blue' && 'timbul-btn-blue',
      variant === 'red' && 'timbul-btn-red',
      variant === 'emerald' && 'timbul-btn-emerald',
      variant === 'neutral' && 'timbul-btn-neutral',
    ]"
    @click="handleClick"
  >
    <slot />
  </button>
</template>
