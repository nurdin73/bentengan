import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { useSettingsStore, DEFAULT_SETTINGS } from '../stores/settings-store'
import { SoundManager } from '../game/audio/sound-manager'
import { computeSpatialMix } from '../game/audio/audio-spatial.utils'
import { computeEnemyTerritoryThreat } from '../game/systems/threat-level.utils'
import type { GameplayEntity } from '../types/game.types'
import SettingsModal from '../components/settings/SettingsModal.vue'

describe('Milestone 6 — Audio System & Game Settings', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.clear?.()
        localStorage.removeItem?.('bentengan_game_settings')
      }
    } catch {
      // Ignore storage clear in mock runner
    }
    vi.restoreAllMocks()
  })

  describe('Settings Store (Pinia)', () => {
    it('initializes with default settings', () => {
      const store = useSettingsStore()
      expect(store.mouseSensitivity).toBe(DEFAULT_SETTINGS.mouseSensitivity)
      expect(store.invertY).toBe(DEFAULT_SETTINGS.invertY)
      expect(store.masterVolume).toBe(DEFAULT_SETTINGS.masterVolume)
      expect(store.sfxVolume).toBe(DEFAULT_SETTINGS.sfxVolume)
      expect(store.bgmVolume).toBe(DEFAULT_SETTINGS.bgmVolume)
      expect(store.isMuted).toBe(false)
      expect(store.shadowsEnabled).toBe(true)
      expect(store.particleDensity).toBe('high')
    })

    it('clamps mouse sensitivity between 0.2 and 3.0', () => {
      const store = useSettingsStore()
      store.setMouseSensitivity(0.05)
      expect(store.mouseSensitivity).toBe(0.2)

      store.setMouseSensitivity(5.0)
      expect(store.mouseSensitivity).toBe(3.0)

      store.setMouseSensitivity(1.75)
      expect(store.mouseSensitivity).toBe(1.75)
    })

    it('toggles invert Y setting and persists state', () => {
      const store = useSettingsStore()
      expect(store.invertY).toBe(false)

      store.setInvertY(true)
      expect(store.invertY).toBe(true)
    })

    it('calculates effective SFX volume correctly with master volume and mute', () => {
      const store = useSettingsStore()
      store.setMasterVolume(0.8)
      store.setSfxVolume(0.5)

      // 0.8 * 0.5 = 0.4
      expect(store.effectiveSfxVolume).toBeCloseTo(0.4, 2)

      store.toggleMute()
      expect(store.isMuted).toBe(true)
      expect(store.effectiveSfxVolume).toBe(0)

      store.toggleMute()
      expect(store.isMuted).toBe(false)
      expect(store.effectiveSfxVolume).toBeCloseTo(0.4, 2)
    })

    it('calculates effective BGM volume correctly with master volume and mute', () => {
      const store = useSettingsStore()
      store.setMasterVolume(0.5)
      store.setBgmVolume(0.6)

      // 0.5 * 0.6 = 0.3
      expect(store.effectiveBgmVolume).toBeCloseTo(0.3, 2)

      store.toggleMute()
      expect(store.effectiveBgmVolume).toBe(0)

      store.toggleMute()
      expect(store.effectiveBgmVolume).toBeCloseTo(0.3, 2)
    })

    it('manages graphics settings: shadows and particle density', () => {
      const store = useSettingsStore()
      store.setShadowsEnabled(false)
      expect(store.shadowsEnabled).toBe(false)

      store.setParticleDensity('low')
      expect(store.particleDensity).toBe('low')
    })

    it('resets all settings back to defaults cleanly', () => {
      const store = useSettingsStore()
      store.setMouseSensitivity(2.8)
      store.setInvertY(true)
      store.setMasterVolume(0.2)
      store.setSfxVolume(0.3)
      store.setBgmVolume(0.9)
      store.setShadowsEnabled(false)
      store.setParticleDensity('low')

      store.resetToDefaults()

      expect(store.mouseSensitivity).toBe(DEFAULT_SETTINGS.mouseSensitivity)
      expect(store.invertY).toBe(DEFAULT_SETTINGS.invertY)
      expect(store.masterVolume).toBe(DEFAULT_SETTINGS.masterVolume)
      expect(store.sfxVolume).toBe(DEFAULT_SETTINGS.sfxVolume)
      expect(store.bgmVolume).toBe(DEFAULT_SETTINGS.bgmVolume)
      expect(store.shadowsEnabled).toBe(DEFAULT_SETTINGS.shadowsEnabled)
      expect(store.particleDensity).toBe(DEFAULT_SETTINGS.particleDensity)
    })
  })

  describe('Settings Modal Component', () => {
    it('renders all setting sections and default control values', () => {
      const wrapper = mount(SettingsModal)

      expect(wrapper.find('[data-testid="settings-modal-card"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="settings-section-audio"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="settings-section-camera"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="settings-section-graphics"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="settings-master-vol-label"]').text()).toContain('80%')
      expect(wrapper.find('[data-testid="settings-sensitivity-label"]').text()).toContain('1.00x')
    })

    it('updates sensitivity when slider input is fired', async () => {
      const wrapper = mount(SettingsModal)
      const store = useSettingsStore()
      const slider = wrapper.find('[data-testid="settings-sensitivity-slider"]')

      await slider.setValue(1.8)
      expect(store.mouseSensitivity).toBe(1.8)
      expect(wrapper.find('[data-testid="settings-sensitivity-label"]').text()).toContain('1.80x')
    })

    it('updates volume when master volume slider is adjusted', async () => {
      const wrapper = mount(SettingsModal)
      const store = useSettingsStore()
      const slider = wrapper.find('[data-testid="settings-master-vol-slider"]')

      await slider.setValue(0.5)
      expect(store.masterVolume).toBe(0.5)
      expect(wrapper.find('[data-testid="settings-master-vol-label"]').text()).toContain('50%')
    })

    it('updates BGM volume when BGM volume slider is adjusted', async () => {
      const wrapper = mount(SettingsModal)
      const store = useSettingsStore()
      const slider = wrapper.find('[data-testid="settings-bgm-vol-slider"]')

      await slider.setValue(0.75)
      expect(store.bgmVolume).toBe(0.75)
      expect(wrapper.find('[data-testid="settings-bgm-vol-label"]').text()).toContain('75%')
    })

    it('toggles mute button and reflects label change', async () => {
      const wrapper = mount(SettingsModal)
      const muteBtn = wrapper.find('[data-testid="settings-toggle-mute-btn"]')

      expect(muteBtn.text()).toContain('Suara Nyala')
      await muteBtn.trigger('click')
      expect(muteBtn.text()).toContain('Mute Aktif')
    })

    it('toggles invert Y and updates button label', async () => {
      const wrapper = mount(SettingsModal)
      const store = useSettingsStore()
      const toggleBtn = wrapper.find('[data-testid="settings-invert-y-toggle"]')

      expect(toggleBtn.text()).toBe('Normal')
      await toggleBtn.trigger('click')
      expect(store.invertY).toBe(true)
      expect(toggleBtn.text()).toBe('Aktif')
    })

    it('switches particle density between low and high', async () => {
      const wrapper = mount(SettingsModal)
      const store = useSettingsStore()
      const lowBtn = wrapper.find('[data-testid="settings-particle-low-btn"]')
      const highBtn = wrapper.find('[data-testid="settings-particle-high-btn"]')

      await lowBtn.trigger('click')
      expect(store.particleDensity).toBe('low')

      await highBtn.trigger('click')
      expect(store.particleDensity).toBe('high')
    })

    it('emits close event on close button or save button click', async () => {
      const wrapper = mount(SettingsModal)
      const closeBtn = wrapper.find('[data-testid="settings-modal-close-btn"]')
      const saveBtn = wrapper.find('[data-testid="settings-save-close-btn"]')

      await closeBtn.trigger('click')
      expect(wrapper.emitted('close')).toBeTruthy()

      await saveBtn.trigger('click')
      expect(wrapper.emitted('close')?.length).toBe(2)
    })

    it('toggles screenShakeEnabled via settings modal toggle button', async () => {
      const wrapper = mount(SettingsModal)
      const store = useSettingsStore()
      const toggleBtn = wrapper.find('[data-testid="settings-screenshake-toggle"]')

      expect(store.screenShakeEnabled).toBe(true)
      expect(toggleBtn.text()).toBe('Aktif')

      await toggleBtn.trigger('click')
      expect(store.screenShakeEnabled).toBe(false)
      expect(toggleBtn.text()).toBe('Nonaktif')
    })
  })

  describe('Sound Manager (Web Audio API Synthesizer)', () => {
    it('handles sound methods safely without crash in headless environment', () => {
      const sm = new SoundManager()
      expect(() => {
        sm.init()
        sm.setListener({ x: 0, y: 1, z: 0 }, 0)
        sm.playFootstep(false)
        sm.playFootstep(true)
        sm.playSprintWhoosh()
        sm.playJump({ x: 2, y: 1, z: 0 })
        sm.playLand({ x: -2, y: 1, z: 0 })
        sm.playDash()
        sm.playSmoke({ x: 0, y: 1, z: 5 })
        sm.playAdrenaline()
        sm.playSkillDenied()
        sm.playCaughtSting()
        sm.startStun()
        sm.stopStun()
        sm.playCapture({ x: 3, y: 1, z: -2 })
        sm.playRescue({ x: -3, y: 1, z: 4 })
        sm.playBaseTouch()
        sm.updateTension(0.1, 0.8, true)
        sm.resetTension()
        sm.playVictory()
        sm.playDefeat()
        sm.dispose()
      }).not.toThrow()
    })

    it('computes spatial distance falloff and stereo pan correctly', () => {
      const center = computeSpatialMix({ x: 0, z: 0 }, 0, { x: 0, z: 0 })
      expect(center.gain).toBe(1)
      expect(center.pan).toBe(0)

      const right = computeSpatialMix({ x: 0, z: 0 }, 0, { x: 10, z: 0 })
      expect(right.pan).toBeGreaterThan(0.5)
      expect(right.gain).toBeLessThan(1)
      expect(right.gain).toBeGreaterThan(0)

      const left = computeSpatialMix({ x: 0, z: 0 }, 0, { x: -10, z: 0 })
      expect(left.pan).toBeLessThan(-0.5)

      const far = computeSpatialMix({ x: 0, z: 0 }, 0, { x: 40, z: 0 })
      expect(far.gain).toBe(0)
    })

    it('computes enemy territory threat strictly when local entity is inside enemy territory', () => {
      const makeEntity = (
        id: string,
        teamId: 'blue' | 'red',
        z: number,
        status: 'normal' | 'jailed' | 'stunned' = 'normal',
      ): GameplayEntity => ({
        id,
        name: id,
        teamId,
        status,
        immunityUntil: 0,
        getPosition: () => ({ x: 0, y: 1, z }),
        teleportTo: () => {},
      })

      // Blue player safely in home territory (z = -5): zero threat even if red is close
      const safeLocal = makeEntity('local', 'blue', -5)
      const nearbyEnemy = makeEntity('enemy', 'red', 1)
      expect(computeEnemyTerritoryThreat(safeLocal, [safeLocal, nearbyEnemy])).toBe(0)

      // Blue player inside enemy territory (z = +5) near active red enemy (z = +8, dist = 3m)
      const invadingLocal = makeEntity('local', 'blue', 5)
      const chasingEnemy = makeEntity('enemy', 'red', 8)
      const threat = computeEnemyTerritoryThreat(invadingLocal, [invadingLocal, chasingEnemy])
      expect(threat).toBeGreaterThan(0.7)

      // Jailed enemy nearby inside enemy territory produces no threat
      const jailedEnemy = makeEntity('enemy-jailed', 'red', 7, 'jailed')
      expect(computeEnemyTerritoryThreat(invadingLocal, [invadingLocal, jailedEnemy])).toBe(0)
    })
  })
})
