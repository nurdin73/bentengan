import { onMounted, onUnmounted, watch } from 'vue'
import { useSettingsStore } from '../../stores/settings-store'
import { homeBgmPlayer } from '../../game/audio/home-bgm'

/**
 * Manages the lifecycle of the homepage background music:
 * - Starts automatically when permitted, or unlocks seamlessly on first user gesture
 * - Syncs with settingsStore.effectiveBgmVolume (master * bgm * mute)
 * - Pauses when browser tab is hidden and fades out cleanly on unmount
 */
export function useHomeBgm(): void {
  const settings = useSettingsStore()
  let isDisposed = false
  let unlockListenersAttached = false

  const removeUnlockListeners = () => {
    if (!unlockListenersAttached || typeof window === 'undefined') return
    window.removeEventListener('pointerdown', handleUserGesture)
    window.removeEventListener('keydown', handleUserGesture)
    unlockListenersAttached = false
  }

  const handleUserGesture = () => {
    if (isDisposed || settings.effectiveBgmVolume <= 0) return

    void homeBgmPlayer.unlockAndStart(settings.effectiveBgmVolume).then((started) => {
      if (started) {
        removeUnlockListeners()
      }
    })
  }

  const attachUnlockListeners = () => {
    if (unlockListenersAttached || typeof window === 'undefined') return
    window.addEventListener('pointerdown', handleUserGesture, { passive: true })
    window.addEventListener('keydown', handleUserGesture, { passive: true })
    unlockListenersAttached = true
  }

  const handleVisibilityChange = () => {
    if (isDisposed || typeof document === 'undefined') return

    if (document.visibilityState === 'hidden') {
      homeBgmPlayer.pause()
      return
    }

    if (settings.effectiveBgmVolume > 0) {
      void homeBgmPlayer.resume(settings.effectiveBgmVolume)
    }
  }

  watch(
    () => settings.effectiveBgmVolume,
    (newVolume) => {
      if (isDisposed) return

      if (newVolume <= 0) {
        homeBgmPlayer.pause()
        return
      }

      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return
      }

      if (homeBgmPlayer.playing) {
        homeBgmPlayer.setVolume(newVolume)
      } else {
        void homeBgmPlayer.resume(newVolume).then(() => {
          if (!homeBgmPlayer.playing) {
            attachUnlockListeners()
          } else {
            removeUnlockListeners()
          }
        })
      }
    },
  )

  onMounted(() => {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange)
    }

    if (settings.effectiveBgmVolume > 0) {
      void homeBgmPlayer.start(settings.effectiveBgmVolume).then((started) => {
        if (!started && !isDisposed) {
          attachUnlockListeners()
        }
      })
    } else {
      attachUnlockListeners()
    }
  })

  onUnmounted(() => {
    isDisposed = true
    removeUnlockListeners()
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
    homeBgmPlayer.stop()
  })
}

