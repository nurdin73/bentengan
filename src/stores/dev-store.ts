import { defineStore } from 'pinia'
import { ref } from 'vue'

export type TeleportTarget = 'enemy_base' | 'own_base' | 'enemy_jail' | 'own_jail'

export const useDevStore = defineStore('dev', () => {
  // Activation state (Default: false / hidden)
  const isUnlocked = ref(false)
  const isOpen = ref(false)

  // Bot modifiers
  const freezeEnemyBots = ref(false)
  const freezeAllBots = ref(false)

  // Player modifiers
  const godMode = ref(false)
  const infiniteStamina = ref(false)
  const speedMultiplier = ref(1.0)
  const zeroCooldowns = ref(false)

  // Event dispatch counter / target for engine consumption
  const pendingTeleport = ref<TeleportTarget | null>(null)
  const pendingInstantWin = ref(false)

  const unlockDevMode = () => {
    isUnlocked.value = true
  }

  const lockDevMode = () => {
    isUnlocked.value = false
    isOpen.value = false
    resetAllModifiers()
  }

  const togglePanel = () => {
    if (!isUnlocked.value) {
      isUnlocked.value = true
    }
    isOpen.value = !isOpen.value
  }

  const setFreezeEnemyBots = (val: boolean) => {
    freezeEnemyBots.value = val
  }

  const setFreezeAllBots = (val: boolean) => {
    freezeAllBots.value = val
  }

  const setGodMode = (val: boolean) => {
    godMode.value = val
    if (val) {
      infiniteStamina.value = true
    }
  }

  const setInfiniteStamina = (val: boolean) => {
    infiniteStamina.value = val
  }

  const setSpeedMultiplier = (mult: number) => {
    speedMultiplier.value = mult
  }

  const setZeroCooldowns = (val: boolean) => {
    zeroCooldowns.value = val
  }

  const requestTeleport = (target: TeleportTarget) => {
    pendingTeleport.value = target
  }

  const consumeTeleportRequest = (): TeleportTarget | null => {
    const t = pendingTeleport.value
    pendingTeleport.value = null
    return t
  }

  const requestInstantWin = () => {
    pendingInstantWin.value = true
  }

  const consumeInstantWinRequest = (): boolean => {
    const w = pendingInstantWin.value
    pendingInstantWin.value = false
    return w
  }

  const resetAllModifiers = () => {
    freezeEnemyBots.value = false
    freezeAllBots.value = false
    godMode.value = false
    infiniteStamina.value = false
    speedMultiplier.value = 1.0
    zeroCooldowns.value = false
    pendingTeleport.value = null
    pendingInstantWin.value = false
  }

  return {
    isUnlocked,
    isOpen,
    freezeEnemyBots,
    freezeAllBots,
    godMode,
    infiniteStamina,
    speedMultiplier,
    zeroCooldowns,
    pendingTeleport,
    pendingInstantWin,
    unlockDevMode,
    lockDevMode,
    togglePanel,
    setFreezeEnemyBots,
    setFreezeAllBots,
    setGodMode,
    setInfiniteStamina,
    setSpeedMultiplier,
    setZeroCooldowns,
    requestTeleport,
    consumeTeleportRequest,
    requestInstantWin,
    consumeInstantWinRequest,
    resetAllModifiers,
  }
})

