<script setup lang="ts">
import { computed } from 'vue'
import {
  AlertTriangle,
  AlertCircle,
  HelpCircle,
  Info,
  X,
} from 'lucide-vue-next'
import TactileButton from './TactileButton.vue'

export type DialogType = 'confirm' | 'alert' | 'danger' | 'info'

interface Props {
  type?: DialogType
  title: string
  message?: string
  confirmText?: string
  cancelText?: string
  confirmVariant?: 'amber' | 'emerald' | 'red' | 'blue'
  cancelVariant?: 'neutral'
  showCloseButton?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  type: 'confirm',
  message: '',
  confirmText: '',
  cancelText: 'Batal',
  confirmVariant: undefined,
  cancelVariant: 'neutral',
  showCloseButton: true,
})

const emit = defineEmits<{
  (e: 'confirm'): void
  (e: 'cancel'): void
  (e: 'close'): void
}>()

const computedConfirmText = computed(() => {
  if (props.confirmText) return props.confirmText
  if (props.type === 'alert') return 'Mengerti'
  if (props.type === 'danger') return 'Ya, Lanjutkan'
  return 'Konfirmasi'
})

const resolvedConfirmVariant = computed(() => {
  if (props.confirmVariant) return props.confirmVariant
  if (props.type === 'danger') return 'red'
  if (props.type === 'alert') return 'amber'
  if (props.type === 'info') return 'blue'
  return 'emerald'
})

const onBackdropClick = () => {
  emit('close')
}

const onCancel = () => {
  emit('cancel')
  emit('close')
}

const onConfirm = () => {
  emit('confirm')
}
</script>

<template>
  <div
    data-testid="confirm-dialog-backdrop"
    class="confirm-dialog-backdrop fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs overflow-y-auto"
    @click.self="onBackdropClick"
  >
    <div
      data-testid="confirm-dialog-card"
      class="confirm-dialog-card timbul-card w-full max-w-md p-5 sm:p-7 flex flex-col items-center text-center gap-3.5 sm:gap-5 shadow-2xl relative max-h-[92dvh] overflow-y-auto overscroll-contain animate-in fade-in zoom-in-95 duration-150"
      role="dialog"
      aria-modal="true"
    >
      <!-- Close Button -->
      <button
        v-if="showCloseButton"
        type="button"
        data-testid="dialog-close-btn"
        class="absolute top-3.5 right-3.5 sm:top-5 sm:right-5 text-neutral-400 hover:text-neutral-700 font-black text-sm cursor-pointer p-1"
        @click="onCancel"
      >
        <X class="w-4 h-4" />
      </button>

      <!-- Contextual Icon Badge -->
      <div
        :class="[
          'w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-2xs',
          type === 'danger' && 'bg-rose-100 text-rose-600 border border-rose-200',
          type === 'confirm' && 'bg-amber-100 text-amber-700 border border-amber-200',
          type === 'alert' && 'bg-amber-100 text-amber-600 border border-amber-200',
          type === 'info' && 'bg-blue-100 text-blue-600 border border-blue-200',
        ]"
      >
        <AlertTriangle v-if="type === 'danger'" class="w-6 h-6 sm:w-7 sm:h-7" />
        <AlertCircle v-else-if="type === 'alert'" class="w-6 h-6 sm:w-7 sm:h-7" />
        <Info v-else-if="type === 'info'" class="w-6 h-6 sm:w-7 sm:h-7" />
        <HelpCircle v-else class="w-6 h-6 sm:w-7 sm:h-7" />
      </div>

      <!-- Title & Message -->
      <div class="flex flex-col gap-1 w-full">
        <h3
          data-testid="dialog-title"
          class="font-heading font-black text-lg sm:text-2xl text-neutral-900 uppercase tracking-tight leading-tight"
        >
          {{ title }}
        </h3>
        <p
          v-if="message"
          data-testid="dialog-message"
          class="font-sans text-xs sm:text-sm text-neutral-600 font-medium leading-relaxed"
        >
          {{ message }}
        </p>
      </div>

      <!-- Optional Custom Content Slot -->
      <slot />

      <!-- Action Buttons -->
      <slot name="actions">
        <!-- 1-Button Layout for Alert -->
        <div v-if="type === 'alert'" class="w-full pt-1">
          <TactileButton
            :variant="resolvedConfirmVariant"
            data-testid="dialog-confirm-btn"
            class="w-full text-xs sm:text-sm py-2.5 sm:py-3"
            @click="onConfirm"
          >
            {{ computedConfirmText }}
          </TactileButton>
        </div>

        <!-- 2-Button Layout for Confirm / Danger / Info -->
        <div v-else class="grid grid-cols-2 gap-2 sm:gap-2.5 w-full pt-1">
          <TactileButton
            :variant="cancelVariant"
            data-testid="dialog-cancel-btn"
            class="w-full text-xs sm:text-sm py-2.5 sm:py-3"
            @click="onCancel"
          >
            {{ cancelText }}
          </TactileButton>

          <TactileButton
            :variant="resolvedConfirmVariant"
            data-testid="dialog-confirm-btn"
            class="w-full text-xs sm:text-sm py-2.5 sm:py-3"
            @click="onConfirm"
          >
            {{ computedConfirmText }}
          </TactileButton>
        </div>
      </slot>
    </div>
  </div>
</template>

<style scoped>
@media (orientation: landscape) and (max-height: 520px) {
  .confirm-dialog-backdrop {
    padding: 0.5rem !important;
  }

  .confirm-dialog-card {
    padding: 1rem 1.5rem !important;
    gap: 0.75rem !important;
    max-height: 94dvh !important;
  }
}
</style>

