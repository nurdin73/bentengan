import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { useDevStore } from '../stores/dev-store'
import DevDebugPanel from '../components/dev/DevDebugPanel.vue'
import { GameplayRules } from '../game/systems/gameplay-rules'
import type { GameplayEntity } from '../types/game.types'

describe('Developer God Mode & Bot Freeze Suite', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    sessionStorage.clear()
  })

  describe('DevStore State & Mutations', () => {
    it('is locked and closed by default for regular players', () => {
      const store = useDevStore()
      expect(store.isUnlocked).toBe(false)
      expect(store.isOpen).toBe(false)
      expect(store.freezeEnemyBots).toBe(false)
      expect(store.freezeAllBots).toBe(false)
      expect(store.godMode).toBe(false)
      expect(store.speedMultiplier).toBe(1.0)
    })

    it('unlocks and toggles open state cleanly', () => {
      const store = useDevStore()
      store.togglePanel()
      expect(store.isUnlocked).toBe(true)
      expect(store.isOpen).toBe(true)

      store.togglePanel()
      expect(store.isOpen).toBe(false)
      expect(store.isUnlocked).toBe(true)
    })

    it('activates god mode and enforces infinite stamina', () => {
      const store = useDevStore()
      store.setGodMode(true)
      expect(store.godMode).toBe(true)
      expect(store.infiniteStamina).toBe(true)

      store.setGodMode(false)
      expect(store.godMode).toBe(false)
    })

    it('queues and consumes teleport and instant win requests', () => {
      const store = useDevStore()
      store.requestTeleport('enemy_base')
      expect(store.consumeTeleportRequest()).toBe('enemy_base')
      expect(store.consumeTeleportRequest()).toBeNull()

      store.requestInstantWin()
      expect(store.consumeInstantWinRequest()).toBe(true)
      expect(store.consumeInstantWinRequest()).toBe(false)
    })

    it('resets all modifiers cleanly', () => {
      const store = useDevStore()
      store.setFreezeEnemyBots(true)
      store.setGodMode(true)
      store.setSpeedMultiplier(2.5)
      store.setZeroCooldowns(true)

      store.resetAllModifiers()
      expect(store.freezeEnemyBots).toBe(false)
      expect(store.godMode).toBe(false)
      expect(store.speedMultiplier).toBe(1.0)
      expect(store.zeroCooldowns).toBe(false)
    })
  })

  describe('GameplayRules God Mode Immunity', () => {
    it('prevents capture when target has isGodMode enabled even inside enemy territory', () => {
      const hunter: GameplayEntity = {
        id: 'hunter-red',
        name: 'Musuh Merah',
        teamId: 'red',
        status: 'normal',
        immunityUntil: 0,
        getPosition: () => ({ x: 0, y: 1, z: 10 }),
        teleportTo: vi.fn<() => void>(),
      }

      const playerTarget: GameplayEntity = {
        id: 'player-blue',
        name: 'Anda',
        teamId: 'blue',
        status: 'normal',
        immunityUntil: 0,
        isGodMode: true, // God Mode active!
        getPosition: () => ({ x: 0, y: 1, z: 10 }), // Inside enemy territory (z > 0)
        teleportTo: vi.fn<() => void>(),
      }

      const now = 1000
      // Normally, distance is 0 and target is in enemy territory, so it would be capturable
      const canCapture = GameplayRules.canCapture(hunter, playerTarget, now)
      expect(canCapture).toBe(false)
    })

    it('allows normal capture when target does not have isGodMode enabled', () => {
      const hunter: GameplayEntity = {
        id: 'hunter-red',
        name: 'Musuh Merah',
        teamId: 'red',
        status: 'normal',
        immunityUntil: 0,
        getPosition: () => ({ x: 0, y: 1, z: 10 }),
        teleportTo: vi.fn<() => void>(),
      }

      const playerTarget: GameplayEntity = {
        id: 'player-blue',
        name: 'Anda',
        teamId: 'blue',
        status: 'normal',
        immunityUntil: 0,
        isGodMode: false,
        getPosition: () => ({ x: 0, y: 1, z: 10 }),
        teleportTo: vi.fn<() => void>(),
      }

      const now = 1000
      const canCapture = GameplayRules.canCapture(hunter, playerTarget, now)
      expect(canCapture).toBe(true)
    })
  })

  describe('DevDebugPanel Component Presentation', () => {
    it('does not render anything when dev mode is locked (default state)', () => {
      const wrapper = mount(DevDebugPanel)
      expect(wrapper.find('[data-testid="dev-debug-root"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="dev-toggle-pill-btn"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="dev-debug-panel"]').exists()).toBe(false)
    })

    it('renders floating pill when dev mode is unlocked', async () => {
      const store = useDevStore()
      store.unlockDevMode()

      const wrapper = mount(DevDebugPanel)
      expect(wrapper.find('[data-testid="dev-debug-root"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="dev-toggle-pill-btn"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="dev-debug-panel"]').exists()).toBe(false)
    })

    it('opens panel and toggles bot freeze and god mode', async () => {
      const store = useDevStore()
      store.unlockDevMode()
      store.isOpen = true

      const wrapper = mount(DevDebugPanel)
      expect(wrapper.find('[data-testid="dev-debug-panel"]').exists()).toBe(true)

      // Toggle Freeze Enemy Bots
      const freezeBtn = wrapper.find('[data-testid="dev-freeze-enemy-bots-btn"]')
      expect(freezeBtn.exists()).toBe(true)
      await freezeBtn.trigger('click')
      expect(store.freezeEnemyBots).toBe(true)

      // Toggle God Mode
      const godBtn = wrapper.find('[data-testid="dev-godmode-btn"]')
      expect(godBtn.exists()).toBe(true)
      await godBtn.trigger('click')
      expect(store.godMode).toBe(true)

      // Change Speed Multiplier to 2x
      const speed2xBtn = wrapper.find('[data-testid="dev-speed-2x-btn"]')
      expect(speed2xBtn.exists()).toBe(true)
      await speed2xBtn.trigger('click')
      expect(store.speedMultiplier).toBe(2.0)

      // Trigger Teleport Enemy Base
      const teleportBaseBtn = wrapper.find('[data-testid="dev-teleport-enemy-base-btn"]')
      expect(teleportBaseBtn.exists()).toBe(true)
      await teleportBaseBtn.trigger('click')
      expect(store.pendingTeleport).toBe('enemy_base')

      // Trigger Instant Win
      const winBtn = wrapper.find('[data-testid="dev-instant-win-btn"]')
      expect(winBtn.exists()).toBe(true)
      await winBtn.trigger('click')
      expect(store.pendingInstantWin).toBe(true)
    })
  })
})
