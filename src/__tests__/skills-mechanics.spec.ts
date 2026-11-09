import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as THREE from 'three'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { GAME_CONFIG } from '../game/core/constants'
import { SkillManager } from '../game/skills/skill-manager'
import { useGameStore } from '../stores/game-store'
import SkillActionBar from '../components/hud/SkillActionBar.vue'
import type { PlayerController } from '../game/entities/player-controller'
import type { SmokeEventPayload } from '../game/skills/skill-types'

describe('Tactical Active Skills & Bot Status Simulation', () => {
  let scene: THREE.Scene
  let dummyPlayer: PlayerController

  beforeEach(() => {
    setActivePinia(createPinia())
    scene = new THREE.Scene()
    dummyPlayer = {
      id: 'local-player',
      teamId: 'blue',
      status: 'normal',
      stamina: 50,
      getPosition: () => new THREE.Vector3(5, 1, 10),
      applyDash: vi.fn<(durationMs: number, speedMultiplier: number) => void>(),
      applyAdrenaline: vi.fn<(durationMs: number, immunityDurationMs: number) => void>(),
    } as unknown as PlayerController
  })

  describe('Skill Configurations & Baseline Cooldowns', () => {
    it('should have proper cooldowns and parameters for Dash, Smoke, and Adrenaline', () => {
      expect(GAME_CONFIG.skills.dash.cooldownMs).toBe(8000)
      expect(GAME_CONFIG.skills.dash.durationMs).toBe(350)
      expect(GAME_CONFIG.skills.dash.hotkey).toBe('Q')

      expect(GAME_CONFIG.skills.smoke.cooldownMs).toBe(18000)
      expect(GAME_CONFIG.skills.smoke.durationMs).toBe(3000)
      expect(GAME_CONFIG.skills.smoke.radius).toBe(7.0)
      expect(GAME_CONFIG.skills.smoke.hotkey).toBe('F')

      expect(GAME_CONFIG.skills.adrenaline.cooldownMs).toBe(35000)
      expect(GAME_CONFIG.skills.adrenaline.durationMs).toBe(4000)
      expect(GAME_CONFIG.skills.adrenaline.immunityDurationMs).toBe(4000)
      expect(GAME_CONFIG.skills.adrenaline.hotkey).toBe('C')
    })
  })

  describe('SkillManager Activation & State Flow', () => {
    it('initializes all skills as ready with 0 cooldown', () => {
      const manager = new SkillManager(scene)
      const now = 1000
      const states = manager.getAllSkillsState(now)

      expect(states.dash.ready).toBe(true)
      expect(states.dash.cooldownRemainingSec).toBe(0)
      expect(states.smoke.ready).toBe(true)
      expect(states.adrenaline.ready).toBe(true)
      manager.dispose()
    })

    it('successfully triggers Dash and applies dash to player', () => {
      const manager = new SkillManager(scene)
      const now = 1000

      const result = manager.triggerSkill('dash', dummyPlayer, now)
      expect(result.success).toBe(true)
      expect(dummyPlayer.applyDash).toHaveBeenCalledWith(350, 2.2)

      const stateAfter = manager.getSkillState('dash', now)
      expect(stateAfter.ready).toBe(false)
      expect(stateAfter.cooldownRemainingSec).toBe(8)
      expect(stateAfter.isActive).toBe(true)
      manager.dispose()
    })

    it('rejects skill activation while on cooldown', () => {
      const manager = new SkillManager(scene)
      const now = 1000

      manager.triggerSkill('dash', dummyPlayer, now)
      const secondAttempt = manager.triggerSkill('dash', dummyPlayer, now + 1000)

      expect(secondAttempt.success).toBe(false)
      expect(secondAttempt.reason).toBe('cooldown')
      manager.dispose()
    })

    it('rejects skill activation when player is jailed or stunned', () => {
      const manager = new SkillManager(scene)
      const now = 1000

      dummyPlayer.status = 'jailed'
      const jailedAttempt = manager.triggerSkill('smoke', dummyPlayer, now)
      expect(jailedAttempt.success).toBe(false)
      expect(jailedAttempt.reason).toBe('jailed')

      dummyPlayer.status = 'stunned'
      const stunnedAttempt = manager.triggerSkill('smoke', dummyPlayer, now)
      expect(stunnedAttempt.success).toBe(false)
      expect(stunnedAttempt.reason).toBe('stunned')
      manager.dispose()
    })

    it('triggers Smoke Screen and notifies callback with payload coordinates', () => {
      let receivedSmoke: SmokeEventPayload | null = null
      const manager = new SkillManager(scene, {
        onSmokeTriggered: (payload) => {
          receivedSmoke = payload
        },
      })
      const now = 2000

      const res = manager.triggerSkill('smoke', dummyPlayer, now)
      expect(res.success).toBe(true)
      expect(receivedSmoke).not.toBeNull()
      const smoke = receivedSmoke as unknown as SmokeEventPayload
      expect(smoke.x).toBe(5)
      expect(smoke.z).toBe(10)
      expect(smoke.radius).toBe(7.0)
      expect(smoke.sourceTeamId).toBe('blue')
      manager.dispose()
    })

    it('triggers Adrenaline and invokes applyAdrenaline on player', () => {
      const manager = new SkillManager(scene)
      const now = 5000

      const res = manager.triggerSkill('adrenaline', dummyPlayer, now)
      expect(res.success).toBe(true)
      expect(dummyPlayer.applyAdrenaline).toHaveBeenCalledWith(4000, 4000)

      const state = manager.getSkillState('adrenaline', now)
      expect(state.ready).toBe(false)
      expect(state.cooldownRemainingSec).toBe(35)
      manager.dispose()
    })

    it('resets all cooldowns on resetAllCooldowns', () => {
      const manager = new SkillManager(scene)
      const now = 1000
      manager.triggerSkill('dash', dummyPlayer, now)
      manager.triggerSkill('smoke', dummyPlayer, now)

      expect(manager.getSkillState('dash', now).ready).toBe(false)
      expect(manager.getSkillState('smoke', now).ready).toBe(false)

      manager.resetAllCooldowns()

      expect(manager.getSkillState('dash', now).ready).toBe(true)
      expect(manager.getSkillState('smoke', now).ready).toBe(true)
      manager.dispose()
    })
  })

  describe('SkillActionBar Vue Component Presentation', () => {
    it('renders all 3 tactical arcade buttons with hotkeys', () => {
      const wrapper = mount(SkillActionBar, {
        props: { isMobile: false },
      })

      expect(wrapper.find('[data-testid="skill-action-bar"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="skill-btn-dash"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="skill-btn-smoke"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="skill-btn-adrenaline"]').exists()).toBe(true)

      expect(wrapper.find('[data-testid="skill-dash-hotkey"]').text()).toBe('Q')
      expect(wrapper.find('[data-testid="skill-smoke-hotkey"]').text()).toBe('F')
      expect(wrapper.find('[data-testid="skill-adrenaline-hotkey"]').text()).toBe('C')
    })

    it('emits trigger-skill event on button click', async () => {
      const wrapper = mount(SkillActionBar, {
        props: { isMobile: false },
      })

      await wrapper.find('[data-testid="skill-btn-dash"]').trigger('click')
      expect(wrapper.emitted('trigger-skill')).toBeTruthy()
      expect(wrapper.emitted('trigger-skill')?.[0]).toEqual(['dash'])

      await wrapper.find('[data-testid="skill-btn-smoke"]').trigger('click')
      expect(wrapper.emitted('trigger-skill')?.[1]).toEqual(['smoke'])

      await wrapper.find('[data-testid="skill-btn-adrenaline"]').trigger('click')
      expect(wrapper.emitted('trigger-skill')?.[2]).toEqual(['adrenaline'])
    })

    it('shows cooldown timer and disables button when on cooldown', async () => {
      const gameStore = useGameStore()
      gameStore.skills.dash = {
        id: 'dash',
        name: 'Kilat',
        hotkey: 'Q',
        ready: false,
        cooldownUntil: performance.now() + 6000,
        cooldownRemainingSec: 6,
        cooldownProgress: 0.75,
        activeUntil: 0,
        isActive: false,
      }

      const wrapper = mount(SkillActionBar, {
        props: { isMobile: false },
      })

      const dashBtn = wrapper.find('[data-testid="skill-btn-dash"]')
      expect(dashBtn.attributes('disabled')).toBeDefined()
      expect(wrapper.find('[data-testid="skill-dash-cooldown-text"]').text()).toBe('6s')
      expect(wrapper.find('[data-testid="skill-dash-cooldown-ring"]').exists()).toBe(true)
    })
  })
})
