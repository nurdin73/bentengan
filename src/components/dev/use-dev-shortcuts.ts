import { onMounted, onUnmounted } from 'vue'
import { useDevStore } from '../../stores/dev-store'

declare global {
  interface Window {
    __BENTENGAN_DEV__?: {
      store: ReturnType<typeof useDevStore>
      toggle: () => void
      enable: () => void
      disable: () => void
    }
    bentengan?: {
      godMode: (enable?: boolean) => void
      freezeBots: (enable?: boolean) => void
      speed: (mult: number) => void
      teleport: (target: 'enemy_base' | 'own_base' | 'enemy_jail' | 'own_jail') => void
      win: () => void
      openDev: () => void
      help: () => void
    }
  }
}

export function useDevShortcuts() {
  const devStore = useDevStore()

  const checkAutoUnlock = () => {
    try {
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search)
        const hasDevQuery =
          urlParams.get('dev') === '1' ||
          urlParams.get('god') === '1' ||
          urlParams.get('debug') === '1' ||
          urlParams.get('dev') === 'true'

        const isPersisted = sessionStorage.getItem('bentengan_dev_mode') === 'true'

        if (hasDevQuery || isPersisted) {
          devStore.unlockDevMode()
        }
      }
    } catch {
      // Ignore URL or storage errors
    }
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    // Avoid triggering when user is typing inside an input or textarea
    const target = e.target as HTMLElement | null
    if (
      target &&
      (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
    ) {
      return
    }

    // Toggle on Backquote / Tilde (`) or F2 or Ctrl+Shift+D
    if (
      e.code === 'Backquote' ||
      e.code === 'F2' ||
      (e.ctrlKey && e.shiftKey && e.code === 'KeyD')
    ) {
      e.preventDefault()
      devStore.unlockDevMode()
      devStore.togglePanel()
    }
  }

  const registerConsoleApi = () => {
    if (typeof window === 'undefined') return

    window.__BENTENGAN_DEV__ = {
      store: devStore,
      toggle: () => devStore.togglePanel(),
      enable: () => devStore.unlockDevMode(),
      disable: () => devStore.lockDevMode(),
    }

    window.bentengan = {
      godMode: (enable = true) => {
        devStore.unlockDevMode()
        devStore.setGodMode(enable)
        console.info(
          `[BENTENGAN DEV] God Mode: ${enable ? 'ACTIVE (Invulnerable + Infinite Stamina)' : 'OFF'}`,
        )
      },
      freezeBots: (enable = true) => {
        devStore.unlockDevMode()
        devStore.setFreezeEnemyBots(enable)
        console.info(
          `[BENTENGAN DEV] Freeze Enemy Bots: ${enable ? 'ACTIVE (Bots will not move)' : 'OFF'}`,
        )
      },
      speed: (mult = 2.0) => {
        devStore.unlockDevMode()
        devStore.setSpeedMultiplier(mult)
        console.info(`[BENTENGAN DEV] Speed Multiplier set to ${mult}x`)
      },
      teleport: (target) => {
        devStore.unlockDevMode()
        devStore.requestTeleport(target)
        console.info(`[BENTENGAN DEV] Teleport requested: ${target}`)
      },
      win: () => {
        devStore.unlockDevMode()
        devStore.requestInstantWin()
        console.info('[BENTENGAN DEV] Instant Win requested')
      },
      openDev: () => {
        devStore.unlockDevMode()
        devStore.isOpen = true
      },
      help: () => {
        console.info(`
[BENTENGAN DEV COMMANDS]
- bentengan.godMode(true/false)       : Kebal tangkapan + stamina tak terbatas
- bentengan.freezeBots(true/false)    : Bot lawan mematung diam di tempat
- bentengan.speed(1.0 / 2.0 / 3.0)    : Ubah kecepatan pemain
- bentengan.teleport('enemy_base' | 'own_base' | 'enemy_jail' | 'own_jail') : Teleport cepat
- bentengan.win()                     : Menangkan pertandingan instan
- bentengan.openDev()                 : Buka panel GUI dev di layar
        `)
      },
    }
  }

  onMounted(() => {
    checkAutoUnlock()
    registerConsoleApi()
    window.addEventListener('keydown', handleKeyDown)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown)
  })

  return {
    devStore,
  }
}
