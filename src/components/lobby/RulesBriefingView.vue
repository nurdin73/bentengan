<script setup lang="ts">
import TactileButton from '../ui/TactileButton.vue'

defineProps<{
  roomCode: string
}>()

const emit = defineEmits<{
  (e: 'acknowledge'): void
}>()
</script>

<template>
  <div
    data-testid="rules-briefing-view"
    class="flex flex-col gap-5 max-h-[80vh] overflow-y-auto pr-1"
  >
    <!-- Header -->
    <div class="text-center flex flex-col items-center gap-1 border-b border-neutral-200 pb-3">
      <div
        class="inline-flex items-center gap-2 px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-bold uppercase tracking-wider"
      >
        <span>📜 Briefing Aturan Permainan</span>
      </div>
      <h2 class="font-heading font-black text-2xl text-neutral-900 tracking-wide uppercase pt-1">
        Aturan Main Bentengan 3D
      </h2>
      <p class="font-sans text-xs text-neutral-500 font-semibold">
        Room: <span class="font-mono font-bold text-neutral-800">{{ roomCode }}</span> &bull; Baca
        dengan cermat sebelum masuk ruang tunggu
      </p>
    </div>

    <!-- Rule Cards Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
      <!-- Rule 1: Pembagian Wilayah -->
      <div
        data-testid="rule-card-territory"
        class="p-3.5 rounded-2xl bg-neutral-50 border-2 border-neutral-200 flex flex-col gap-1.5"
      >
        <div class="flex items-center gap-2 text-blue-600 font-heading font-bold text-sm uppercase">
          <span class="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center text-xs">🌐</span>
          <span>1. Garis Tengah Pembatas</span>
        </div>
        <p class="font-sans text-xs text-neutral-600 leading-relaxed">
          Arena terbagi dua oleh garis tengah. Di area benteng sendiri kamu aman! Tapi begitu nyebrang ke wilayah lawan, kamu jadi buronan dan <span class="font-bold text-rose-600">bisa ditangkap</span>!
        </p>
      </div>

      <!-- Rule 2: Mekanisme Menangkap -->
      <div
        data-testid="rule-card-capture"
        class="p-3.5 rounded-2xl bg-neutral-50 border-2 border-neutral-200 flex flex-col gap-1.5"
      >
        <div class="flex items-center gap-2 text-rose-600 font-heading font-bold text-sm uppercase">
          <span class="w-6 h-6 rounded-lg bg-rose-100 flex items-center justify-center text-xs">🎯</span>
          <span>2. Siapa Terakhir Keluar, Dia Menang!</span>
        </div>
        <p class="font-sans text-xs text-neutral-600 leading-relaxed">
          Pemain yang <span class="font-bold">keluar benteng belakangan</span> berhak mengejar dan menepuk lawan yang keluar lebih dulu. Pantau terus pergerakan musuh!
        </p>
      </div>

      <!-- Rule 3: Penjara & Penyelamatan -->
      <div
        data-testid="rule-card-rescue"
        class="p-3.5 rounded-2xl bg-neutral-50 border-2 border-neutral-200 flex flex-col gap-1.5"
      >
        <div
          class="flex items-center gap-2 text-amber-600 font-heading font-bold text-sm uppercase"
        >
          <span class="w-6 h-6 rounded-lg bg-amber-100 flex items-center justify-center text-xs">⛓️</span>
          <span>3. Selamatkan Teman Satu Tim!</span>
        </div>
        <p class="font-sans text-xs text-neutral-600 leading-relaxed">
          Teman yang tertangkap akan disandera di tiang lawan. Susup ke sana dan <span class="font-bold text-emerald-600">tepuk mereka</span> untuk membebaskan (+2 detik kebal buat kabur bareng)!
        </p>
      </div>

      <!-- Rule 4: Syarat Kemenangan -->
      <div
        data-testid="rule-card-victory"
        class="p-3.5 rounded-2xl bg-neutral-50 border-2 border-neutral-200 flex flex-col gap-1.5"
      >
        <div
          class="flex items-center gap-2 text-emerald-600 font-heading font-bold text-sm uppercase"
        >
          <span class="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center text-xs">🏆</span>
          <span>4. Rebut Tiang Benteng Lawan!</span>
        </div>
        <p class="font-sans text-xs text-neutral-600 leading-relaxed">
          Cukup susup dan <span class="font-bold text-emerald-700">tepuk tiang benteng lawan</span> untuk menang seketika, atau tangkap semua pemain lawan sampai habis!
        </p>
      </div>
    </div>

    <!-- Confirmation Action -->
    <div class="pt-2 flex flex-col gap-2">
      <TactileButton
        variant="amber"
        data-testid="rules-acknowledge-btn"
        class="w-full text-base py-3"
        @click="emit('acknowledge')"
      >
        ✅ Saya Paham & Masuk Ruang Tunggu
      </TactileButton>
      <p class="text-center font-sans text-[11px] text-neutral-400">
        Dengan menekan tombol di atas, Anda menyatakan telah memahami aturan main Bentengan 3D.
      </p>
    </div>
  </div>
</template>
