<script setup lang="ts">
withDefaults(
  defineProps<{
    className?: string
  }>(),
  {
    className: 'w-4 h-3',
  },
)
</script>

<template>
  <svg
    :class="['inline-block overflow-hidden rounded-[2px] shadow-2xs border border-neutral-300/80 shrink-0', className]"
    viewBox="0 0 18 12"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-label="Bendera Indonesia"
    role="img"
  >
    <rect width="18" height="6" fill="#E70011" />
    <rect y="6" width="18" height="6" fill="#FFFFFF" />
  </svg>
</template>

