<script setup lang="ts">
const emit = defineEmits<{
  (e: 'close'): void
}>()
</script>

<template>
  <div
    data-testid="game-rules-modal-backdrop"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
    @click.self="emit('close')"
  >
    <div
      data-testid="game-rules-modal-card"
      class="timbul-card w-full max-w-2xl p-6 sm:p-7 flex flex-col gap-5 max-h-[90vh] overflow-y-auto relative shadow-2xl"
    >
      <!-- Close Button -->
      <button
        type="button"
        data-testid="rules-modal-close-btn"
        class="absolute top-5 right-5 w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 active:scale-95 text-neutral-600 font-black flex items-center justify-center transition-all cursor-pointer border border-neutral-300"
        @click="emit('close')"
      >
        ✕
      </button>

      <!-- Header -->
      <div class="flex items-center gap-2 pr-8 border-b border-neutral-200 pb-3">
        <span class="text-2xl">📜</span>
        <div>
          <h2 class="font-heading font-black text-xl sm:text-2xl text-neutral-900 uppercase tracking-wide">
            Aturan Main Bentengan 3D
          </h2>
          <p class="font-sans text-xs text-neutral-500 font-bold">
            Warisan Permainan Tradisional Indonesia
          </p>
        </div>
      </div>

      <!-- 4 Tactile Rule Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <!-- Card 1 -->
        <div class="p-4 rounded-2xl bg-neutral-50 border-2 border-neutral-200 flex flex-col gap-1.5 shadow-2xs">
          <div class="flex items-center gap-2 text-blue-600 font-heading font-black text-xs uppercase">
            <span class="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center text-xs">🌐</span>
            <span>1. Garis Tengah Pembatas</span>
          </div>
          <p class="font-sans text-xs text-neutral-600 leading-relaxed">
            Arena terbagi dua oleh garis tengah. Di area benteng sendiri kamu aman! Tapi begitu nyebrang ke wilayah lawan, kamu jadi buronan dan <span class="font-bold text-rose-600">bisa ditangkap</span>!
          </p>
        </div>

        <!-- Card 2 -->
        <div class="p-4 rounded-2xl bg-neutral-50 border-2 border-neutral-200 flex flex-col gap-1.5 shadow-2xs">
          <div class="flex items-center gap-2 text-rose-600 font-heading font-black text-xs uppercase">
            <span class="w-6 h-6 rounded-lg bg-rose-100 flex items-center justify-center text-xs">🎯</span>
            <span>2. Siapa Terakhir Keluar, Dia Menang!</span>
          </div>
          <p class="font-sans text-xs text-neutral-600 leading-relaxed">
            Pemain yang <span class="font-bold">keluar benteng belakangan</span> berhak mengejar dan menepuk lawan yang keluar lebih dulu. Pantau terus pergerakan musuh!
          </p>
        </div>

        <!-- Card 3 -->
        <div class="p-4 rounded-2xl bg-neutral-50 border-2 border-neutral-200 flex flex-col gap-1.5 shadow-2xs">
          <div class="flex items-center gap-2 text-amber-600 font-heading font-black text-xs uppercase">
            <span class="w-6 h-6 rounded-lg bg-amber-100 flex items-center justify-center text-xs">⛓️</span>
            <span>3. Selamatkan Teman Satu Tim!</span>
          </div>
          <p class="font-sans text-xs text-neutral-600 leading-relaxed">
            Teman yang tertangkap akan disandera di tiang lawan. Susup ke sana dan <span class="font-bold text-emerald-600">tepuk mereka</span> untuk membebaskan (+2 detik kebal buat kabur bareng)!
          </p>
        </div>

        <!-- Card 4 -->
        <div class="p-4 rounded-2xl bg-neutral-50 border-2 border-neutral-200 flex flex-col gap-1.5 shadow-2xs">
          <div class="flex items-center gap-2 text-emerald-600 font-heading font-black text-xs uppercase">
            <span class="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center text-xs">🏆</span>
            <span>4. Rebut Tiang Benteng Lawan!</span>
          </div>
          <p class="font-sans text-xs text-neutral-600 leading-relaxed">
            Cukup susup dan <span class="font-bold text-emerald-700">tepuk tiang benteng lawan</span> untuk menang seketika, atau tangkap semua pemain lawan sampai habis!
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

