import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useGameStore } from '../stores/game-store'
import ActionUtilityCluster from '../components/hud/ActionUtilityCluster.vue'
import GameHUD from '../components/hud/GameHUD.vue'
import { GAME_CONFIG } from '../game/core/constants'

describe('Rescue Cooldown Reactivity & Event Filtering Fix', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('GameStore rescueCooldownRemainingSeconds reactivity', () => {
    it('initializes rescueCooldownRemainingSeconds to 0 and not on cooldown', () => {
      const gameStore = useGameStore()
      expect(gameStore.rescueCooldownRemainingSeconds).toBe(0)
      expect(gameStore.isRescueOnCooldown).toBe(false)
    })

    it('sets rescueCooldownRemainingSeconds to 30 when recordRescue is called', () => {
      const gameStore = useGameStore()
      gameStore.recordRescue()

      expect(gameStore.rescuesCount).toBe(1)
      expect(gameStore.rescueCooldownRemainingSeconds).toBe(
        Math.ceil(GAME_CONFIG.gameplay.rescueCooldownMs / 1000),
      )
      expect(gameStore.isRescueOnCooldown).toBe(true)
    })

    it('reactively updates rescueCooldownRemainingSeconds on each tick via updateLocalPlayerState', () => {
      const gameStore = useGameStore()
      gameStore.recordRescue()
      expect(gameStore.rescueCooldownRemainingSeconds).toBe(30)

      gameStore.updateLocalPlayerState({
        stamina: 100,
        isSprinting: false,
        status: 'normal',
        stunUntil: 0,
        immunityUntil: 0,
        rescueCooldownUntil: performance.now() + 29000,
        rescueCooldownRemainingSeconds: 29,
      })
      expect(gameStore.rescueCooldownRemainingSeconds).toBe(29)
      expect(gameStore.isRescueOnCooldown).toBe(true)

      gameStore.updateLocalPlayerState({
        stamina: 100,
        isSprinting: false,
        status: 'normal',
        stunUntil: 0,
        immunityUntil: 0,
        rescueCooldownUntil: 0,
        rescueCooldownRemainingSeconds: 0,
      })
      expect(gameStore.rescueCooldownRemainingSeconds).toBe(0)
      expect(gameStore.isRescueOnCooldown).toBe(false)
    })

    it('resets rescue cooldown properties cleanly on resetStats', () => {
      const gameStore = useGameStore()
      gameStore.recordRescue()
      gameStore.isNearJailedAlly = true
      expect(gameStore.rescueCooldownRemainingSeconds).toBe(30)

      gameStore.resetStats()
      expect(gameStore.rescueCooldownRemainingSeconds).toBe(0)
      expect(gameStore.rescueCooldownUntil).toBe(0)
      expect(gameStore.isNearJailedAlly).toBe(false)
      expect(gameStore.isRescueOnCooldown).toBe(false)
    })
  })

  describe('ActionUtilityCluster UI countdown integration', () => {
    it('displays numeric countdown badge and blocks clicks while on cooldown', async () => {
      const wrapper = mount(ActionUtilityCluster, {
        props: {
          canRescue: false,
          rescueCooldownSeconds: 25,
        },
      })

      const btn = wrapper.find('[data-testid="hud-touch-rescue-btn"]')
      expect(btn.attributes('disabled')).toBeDefined()

      const badge = wrapper.find('[data-testid="hud-rescue-cooldown-badge"]')
      expect(badge.exists()).toBe(true)
      expect(badge.text()).toBe('25')

      await btn.trigger('click')
      expect(wrapper.emitted('virtual-interact')).toBeUndefined()
    })

    it('enables rescue button and hides badge when rescueCooldownSeconds reaches 0', async () => {
      const wrapper = mount(ActionUtilityCluster, {
        props: {
          canRescue: true,
          rescueCooldownSeconds: 0,
        },
      })

      const btn = wrapper.find('[data-testid="hud-touch-rescue-btn"]')
      expect(btn.attributes('disabled')).toBeUndefined()
      expect(wrapper.find('[data-testid="hud-rescue-cooldown-badge"]').exists()).toBe(false)

      await btn.trigger('click')
      expect(wrapper.emitted('virtual-interact')).toBeTruthy()
    })
  })

  describe('GameHUD Rescue Cooldown Alert Presentation', () => {
    it('displays hud-rescue-cooldown-prompt when near jailed ally but on cooldown', () => {
      const gameStore = useGameStore()
      gameStore.canRescueNearby = false
      gameStore.isNearJailedAlly = true
      gameStore.rescueCooldownRemainingSeconds = 18

      const wrapper = mount(GameHUD)
      const cdPrompt = wrapper.find('[data-testid="hud-rescue-cooldown-prompt"]')
      expect(cdPrompt.exists()).toBe(true)
      expect(cdPrompt.text()).toContain('18s')

      const normalPrompt = wrapper.find('[data-testid="hud-rescue-prompt"]')
      expect(normalPrompt.exists()).toBe(false)
    })

    it('displays hud-rescue-prompt when canRescueNearby is true', () => {
      const gameStore = useGameStore()
      gameStore.canRescueNearby = true
      gameStore.isNearJailedAlly = true
      gameStore.rescueCooldownRemainingSeconds = 0

      const wrapper = mount(GameHUD)
      const normalPrompt = wrapper.find('[data-testid="hud-rescue-prompt"]')
      expect(normalPrompt.exists()).toBe(true)

      const cdPrompt = wrapper.find('[data-testid="hud-rescue-cooldown-prompt"]')
      expect(cdPrompt.exists()).toBe(false)
    })
  })
})
