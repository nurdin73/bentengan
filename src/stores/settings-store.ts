import { defineStore } from 'pinia'

export interface GameSettingsState {
  // Camera controls
  mouseSensitivity: number
  invertY: boolean

  // Audio levels
  masterVolume: number
  sfxVolume: number
  isMuted: boolean

  // Graphics options
  shadowsEnabled: boolean
  particleDensity: 'low' | 'high'
  screenShakeEnabled: boolean
}

const STORAGE_KEY = 'bentengan_game_settings'

export const DEFAULT_SETTINGS: GameSettingsState = {
  mouseSensitivity: 1.0,
  invertY: false,
  masterVolume: 0.8,
  sfxVolume: 0.8,
  isMuted: false,
  shadowsEnabled: true,
  particleDensity: 'high',
  screenShakeEnabled: true,
}

function loadFromStorage(): Partial<GameSettingsState> {
  try {
    if (typeof localStorage === 'undefined') return {}
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Partial<GameSettingsState>
    return parsed
  } catch {
    return {}
  }
}

function persistToStorage(state: GameSettingsState): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    }
  } catch {
    // Ignore storage quota or restricted environment errors
  }
}

export const useSettingsStore = defineStore('settings', {
  state: (): GameSettingsState => {
    const saved = loadFromStorage()
    return {
      mouseSensitivity:
        typeof saved.mouseSensitivity === 'number'
          ? saved.mouseSensitivity
          : DEFAULT_SETTINGS.mouseSensitivity,
      invertY: typeof saved.invertY === 'boolean' ? saved.invertY : DEFAULT_SETTINGS.invertY,
      masterVolume:
        typeof saved.masterVolume === 'number' ? saved.masterVolume : DEFAULT_SETTINGS.masterVolume,
      sfxVolume: typeof saved.sfxVolume === 'number' ? saved.sfxVolume : DEFAULT_SETTINGS.sfxVolume,
      isMuted: typeof saved.isMuted === 'boolean' ? saved.isMuted : DEFAULT_SETTINGS.isMuted,
      shadowsEnabled:
        typeof saved.shadowsEnabled === 'boolean'
          ? saved.shadowsEnabled
          : DEFAULT_SETTINGS.shadowsEnabled,
      particleDensity:
        saved.particleDensity === 'low' || saved.particleDensity === 'high'
          ? saved.particleDensity
          : DEFAULT_SETTINGS.particleDensity,
      screenShakeEnabled:
        typeof saved.screenShakeEnabled === 'boolean'
          ? saved.screenShakeEnabled
          : DEFAULT_SETTINGS.screenShakeEnabled,
    }
  },

  getters: {
    effectiveSfxVolume: (state): number => {
      if (state.isMuted) return 0
      return Math.max(0, Math.min(1, state.masterVolume * state.sfxVolume))
    },
  },

  actions: {
    setMouseSensitivity(val: number): void {
      this.mouseSensitivity = Math.max(0.2, Math.min(3.0, Number(val.toFixed(2))))
      persistToStorage(this.$state)
    },

    setInvertY(val: boolean): void {
      this.invertY = val
      persistToStorage(this.$state)
    },

    setMasterVolume(val: number): void {
      this.masterVolume = Math.max(0, Math.min(1, Number(val.toFixed(2))))
      persistToStorage(this.$state)
    },

    setSfxVolume(val: number): void {
      this.sfxVolume = Math.max(0, Math.min(1, Number(val.toFixed(2))))
      persistToStorage(this.$state)
    },

    toggleMute(): void {
      this.isMuted = !this.isMuted
      persistToStorage(this.$state)
    },

    setShadowsEnabled(val: boolean): void {
      this.shadowsEnabled = val
      persistToStorage(this.$state)
    },

    setParticleDensity(val: 'low' | 'high'): void {
      this.particleDensity = val
      persistToStorage(this.$state)
    },

    setScreenShakeEnabled(val: boolean): void {
      this.screenShakeEnabled = val
      persistToStorage(this.$state)
    },

    resetToDefaults(): void {
      this.mouseSensitivity = DEFAULT_SETTINGS.mouseSensitivity
      this.invertY = DEFAULT_SETTINGS.invertY
      this.masterVolume = DEFAULT_SETTINGS.masterVolume
      this.sfxVolume = DEFAULT_SETTINGS.sfxVolume
      this.isMuted = DEFAULT_SETTINGS.isMuted
      this.shadowsEnabled = DEFAULT_SETTINGS.shadowsEnabled
      this.particleDensity = DEFAULT_SETTINGS.particleDensity
      this.screenShakeEnabled = DEFAULT_SETTINGS.screenShakeEnabled
      persistToStorage(this.$state)
    },
  },
})
