<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import {
  Settings,
  X,
  Volume2,
  VolumeX,
  Sliders,
  Sparkles,
  RotateCcw,
  Check,
  Music,
} from 'lucide-vue-next'
import { useSettingsStore } from '../../stores/settings-store'
import { soundManager } from '../../game/audio/sound-manager'
import TactileButton from '../ui/TactileButton.vue'

const emit = defineEmits<{
  (e: 'close'): void
}>()

const settings = useSettingsStore()

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    emit('close')
  }
}

const handleTestAudio = () => {
  soundManager.playRescue()
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<template>
  <div
    data-testid="settings-modal-backdrop"
    class="settings-modal-backdrop pointer-events-auto fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-sm"
    @click.self="emit('close')"
  >
    <div
      data-testid="settings-modal-card"
      class="settings-modal-card timbul-card w-full max-w-lg p-4 sm:p-6 flex flex-col gap-4 sm:gap-5 max-h-[92dvh] overflow-y-auto overscroll-contain relative shadow-2xl"
    >
      <!-- Close Button -->
      <button
        type="button"
        data-testid="settings-modal-close-btn"
        class="absolute top-4 right-4 sm:top-5 sm:right-5 w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 active:scale-95 text-neutral-600 font-black flex items-center justify-center transition-all cursor-pointer border border-neutral-300"
        title="Tutup Pengaturan"
        @click="emit('close')"
      >
        <X class="w-4 h-4" />
      </button>

      <!-- Header -->
      <div class="flex items-center gap-2.5 pr-8 border-b border-neutral-200 pb-3">
        <div
          class="w-9 h-9 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700 shrink-0"
        >
          <Settings class="w-5 h-5" />
        </div>
        <div>
          <h2
            class="font-heading font-black text-lg sm:text-2xl text-neutral-900 uppercase tracking-wide leading-tight"
          >
            Pengaturan Game
          </h2>
          <p class="font-sans text-xs text-neutral-500 font-bold">
            Sensitivitas, Efek Suara & Grafis
          </p>
        </div>
      </div>

      <!-- Settings Form Groups -->
      <div class="flex flex-col gap-4">
        <!-- 1. Audio Section -->
        <div
          data-testid="settings-section-audio"
          class="flex flex-col gap-3 p-3.5 bg-neutral-50 rounded-2xl border border-neutral-200"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Volume2 v-if="!settings.isMuted" class="w-4 h-4 text-amber-600" />
              <VolumeX v-else class="w-4 h-4 text-rose-500" />
              <span class="font-heading font-bold text-sm text-neutral-800 uppercase tracking-wide"
                >Audio & Suara</span
              >
            </div>
            <button
              type="button"
              data-testid="settings-toggle-mute-btn"
              :class="[
                'px-2.5 py-1 rounded-lg text-xs font-heading font-bold border transition-colors cursor-pointer flex items-center gap-1.5',
                settings.isMuted
                  ? 'bg-rose-100 border-rose-300 text-rose-700'
                  : 'bg-emerald-100 border-emerald-300 text-emerald-800',
              ]"
              @click="settings.toggleMute()"
            >
              <span>{{ settings.isMuted ? 'Mute Aktif' : 'Suara Nyala' }}</span>
            </button>
          </div>

          <!-- Master Volume Slider -->
          <div class="flex flex-col gap-1">
            <div class="flex justify-between text-xs font-bold text-neutral-600">
              <span>Volume Utama</span>
              <span data-testid="settings-master-vol-label" class="font-mono text-neutral-800">
                {{ Math.round(settings.masterVolume * 100) }}%
              </span>
            </div>
            <input
              data-testid="settings-master-vol-slider"
              type="range"
              min="0"
              max="1"
              step="0.05"
              :value="settings.masterVolume"
              class="w-full accent-amber-500 cursor-pointer"
              @input="settings.setMasterVolume(Number(($event.target as HTMLInputElement).value))"
            />
          </div>

          <!-- SFX Volume Slider -->
          <div class="flex flex-col gap-1">
            <div class="flex justify-between text-xs font-bold text-neutral-600">
              <span>Volume Efek (SFX)</span>
              <span data-testid="settings-sfx-vol-label" class="font-mono text-neutral-800">
                {{ Math.round(settings.sfxVolume * 100) }}%
              </span>
            </div>
            <input
              data-testid="settings-sfx-vol-slider"
              type="range"
              min="0"
              max="1"
              step="0.05"
              :value="settings.sfxVolume"
              class="w-full accent-amber-500 cursor-pointer"
              @input="settings.setSfxVolume(Number(($event.target as HTMLInputElement).value))"
            />
          </div>

          <!-- BGM Volume Slider -->
          <div class="flex flex-col gap-1">
            <div class="flex justify-between text-xs font-bold text-neutral-600">
              <span>Volume Musik (BGM)</span>
              <span data-testid="settings-bgm-vol-label" class="font-mono text-neutral-800">
                {{ Math.round(settings.bgmVolume * 100) }}%
              </span>
            </div>
            <input
              data-testid="settings-bgm-vol-slider"
              type="range"
              min="0"
              max="1"
              step="0.05"
              :value="settings.bgmVolume"
              class="w-full accent-amber-500 cursor-pointer"
              @input="settings.setBgmVolume(Number(($event.target as HTMLInputElement).value))"
            />
          </div>

          <!-- Test Sound Button -->
          <div class="flex justify-end pt-1">
            <button
              type="button"
              data-testid="settings-test-sound-btn"
              class="px-2.5 py-1 text-xs font-heading font-bold rounded-lg bg-neutral-200 hover:bg-neutral-300 active:scale-95 text-neutral-700 flex items-center gap-1.5 transition-all cursor-pointer border border-neutral-300"
              @click="handleTestAudio"
            >
              <Music class="w-3.5 h-3.5" />
              <span>Tes Efek Suara (Preview)</span>
            </button>
          </div>
        </div>

        <!-- 2. Camera Controls Section -->
        <div
          data-testid="settings-section-camera"
          class="flex flex-col gap-3 p-3.5 bg-neutral-50 rounded-2xl border border-neutral-200"
        >
          <div class="flex items-center gap-2">
            <Sliders class="w-4 h-4 text-amber-600" />
            <span class="font-heading font-bold text-sm text-neutral-800 uppercase tracking-wide"
              >Kamera & Sensitivitas</span
            >
          </div>

          <!-- Sensitivity Slider -->
          <div class="flex flex-col gap-1">
            <div class="flex justify-between text-xs font-bold text-neutral-600">
              <span>Sensitivitas Putaran Mouse</span>
              <span data-testid="settings-sensitivity-label" class="font-mono text-neutral-800">
                {{ settings.mouseSensitivity.toFixed(2) }}x
              </span>
            </div>
            <input
              data-testid="settings-sensitivity-slider"
              type="range"
              min="0.2"
              max="3.0"
              step="0.1"
              :value="settings.mouseSensitivity"
              class="w-full accent-amber-500 cursor-pointer"
              @input="
                settings.setMouseSensitivity(Number(($event.target as HTMLInputElement).value))
              "
            />
          </div>

          <!-- Invert Y Toggle -->
          <div class="flex items-center justify-between pt-1">
            <span class="text-xs font-bold text-neutral-700">Balik Sumbu Y (Invert Look)</span>
            <button
              type="button"
              data-testid="settings-invert-y-toggle"
              :class="[
                'px-3 py-1 rounded-lg text-xs font-heading font-bold border transition-colors cursor-pointer',
                settings.invertY
                  ? 'bg-amber-100 border-amber-400 text-amber-900'
                  : 'bg-neutral-200 border-neutral-300 text-neutral-600',
              ]"
              @click="settings.setInvertY(!settings.invertY)"
            >
              {{ settings.invertY ? 'Aktif' : 'Normal' }}
            </button>
          </div>
        </div>

        <!-- 3. Graphics & VFX Section -->
        <div
          data-testid="settings-section-graphics"
          class="flex flex-col gap-3 p-3.5 bg-neutral-50 rounded-2xl border border-neutral-200"
        >
          <div class="flex items-center gap-2">
            <Sparkles class="w-4 h-4 text-amber-600" />
            <span class="font-heading font-bold text-sm text-neutral-800 uppercase tracking-wide"
              >Grafis & Efek Partikel</span
            >
          </div>

          <!-- Shadows Toggle -->
          <div class="flex items-center justify-between">
            <div class="flex flex-col">
              <span class="text-xs font-bold text-neutral-700">Bayangan 3D (Shadows)</span>
              <span class="text-[10px] text-neutral-500"
                >Matikan untuk meningkatkan performa di HP lama</span
              >
            </div>
            <button
              type="button"
              data-testid="settings-shadows-toggle"
              :class="[
                'px-3 py-1 rounded-lg text-xs font-heading font-bold border transition-colors cursor-pointer',
                settings.shadowsEnabled
                  ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                  : 'bg-neutral-200 border-neutral-300 text-neutral-600',
              ]"
              @click="settings.setShadowsEnabled(!settings.shadowsEnabled)"
            >
              {{ settings.shadowsEnabled ? 'Aktif' : 'Nonaktif' }}
            </button>
          </div>

          <!-- Particle Density Switcher -->
          <div class="flex items-center justify-between">
            <div class="flex flex-col">
              <span class="text-xs font-bold text-neutral-700">Kepadatan Partikel (VFX)</span>
              <span class="text-[10px] text-neutral-500">Jejak debu lari & kilau penyelamatan</span>
            </div>
            <div class="flex gap-1 bg-neutral-200 p-1 rounded-lg border border-neutral-300">
              <button
                type="button"
                data-testid="settings-particle-low-btn"
                :class="[
                  'px-2.5 py-0.5 rounded text-[11px] font-heading font-bold transition-all cursor-pointer',
                  settings.particleDensity === 'low'
                    ? 'bg-white text-neutral-900 shadow-2xs'
                    : 'text-neutral-500 hover:text-neutral-700',
                ]"
                @click="settings.setParticleDensity('low')"
              >
                Rendah
              </button>
              <button
                type="button"
                data-testid="settings-particle-high-btn"
                :class="[
                  'px-2.5 py-0.5 rounded text-[11px] font-heading font-bold transition-all cursor-pointer',
                  settings.particleDensity === 'high'
                    ? 'bg-white text-neutral-900 shadow-2xs'
                    : 'text-neutral-500 hover:text-neutral-700',
                ]"
                @click="settings.setParticleDensity('high')"
              >
                Tinggi
              </button>
            </div>
          </div>

          <!-- Screen Shake Toggle -->
          <div class="flex items-center justify-between">
            <div class="flex flex-col">
              <span class="text-xs font-bold text-neutral-700">Getaran Kamera (Screen Shake)</span>
              <span class="text-[10px] text-neutral-500"
                >Guncangan saat benturan, dash, atau penangkapan</span
              >
            </div>
            <button
              type="button"
              data-testid="settings-screenshake-toggle"
              :class="[
                'px-3 py-1 rounded-lg text-xs font-heading font-bold border transition-colors cursor-pointer',
                settings.screenShakeEnabled
                  ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                  : 'bg-neutral-200 border-neutral-300 text-neutral-600',
              ]"
              @click="settings.setScreenShakeEnabled(!settings.screenShakeEnabled)"
            >
              {{ settings.screenShakeEnabled ? 'Aktif' : 'Nonaktif' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Action Footer -->
      <div class="flex items-center justify-between pt-2 border-t border-neutral-200">
        <button
          type="button"
          data-testid="settings-reset-btn"
          class="text-xs font-heading font-bold text-neutral-500 hover:text-neutral-800 flex items-center gap-1.5 transition-colors cursor-pointer py-1"
          @click="settings.resetToDefaults()"
        >
          <RotateCcw class="w-3.5 h-3.5" />
          <span>Reset Default</span>
        </button>

        <TactileButton
          variant="amber"
          data-testid="settings-save-close-btn"
          class="text-xs sm:text-sm px-4 py-2"
          @click="emit('close')"
        >
          <Check class="w-4 h-4 mr-1.5" />
          <span>Simpan & Tutup</span>
        </TactileButton>
      </div>
    </div>
  </div>
</template>
