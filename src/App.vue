<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <div
    data-testid="app-root"
    class="min-h-screen w-full bg-neutral-950 font-sans selection:bg-amber-300 selection:text-neutral-950"
  >
    <RouterView />
  </div>
</template>
