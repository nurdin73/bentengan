<script setup lang="ts">
interface Props {
  variant?: 'amber' | 'blue' | 'red' | 'emerald' | 'neutral'
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  dataTestid?: string
}

withDefaults(defineProps<Props>(), {
  variant: 'amber',
  disabled: false,
  type: 'button',
  dataTestid: 'tactile-btn',
})

defineEmits<{
  (e: 'click', event: MouseEvent): void
}>()
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
    @click="$emit('click', $event)"
  >
    <slot />
  </button>
</template>
