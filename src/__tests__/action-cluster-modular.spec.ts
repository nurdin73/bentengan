import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import SprintAnchorButton from '../components/hud/SprintAnchorButton.vue'
import ActionUtilityCluster from '../components/hud/ActionUtilityCluster.vue'
import ActionSkillArc from '../components/hud/ActionSkillArc.vue'

describe('Modular Action Cluster Components Decomposition', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('SprintAnchorButton Component', () => {
    it('renders primary anchor button and circular stamina gauge', () => {
      const wrapper = mount(SprintAnchorButton, {
        props: { staminaPercentage: 80 },
      })

      expect(wrapper.find('[data-testid="hud-sprint-anchor"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="hud-touch-sprint-btn"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="hud-sprint-circular-bar"]').exists()).toBe(true)

      const progress = wrapper.find('[data-testid="hud-sprint-circular-progress"]')
      expect(progress.classes()).toContain('stroke-amber-400')
    })

    it('emits virtual-sprint event on mousedown and mouseup', async () => {
      const wrapper = mount(SprintAnchorButton, {
        props: { staminaPercentage: 100 },
      })

      const btn = wrapper.find('[data-testid="hud-touch-sprint-btn"]')
      await btn.trigger('mousedown')
      expect(wrapper.emitted('virtual-sprint')?.[0]).toEqual([true])

      window.dispatchEvent(new MouseEvent('mouseup'))
      expect(wrapper.emitted('virtual-sprint')?.[1]).toEqual([false])
    })
  })

  describe('ActionUtilityCluster Component', () => {
    it('renders compact rescue button and hides restore button by default', () => {
      const wrapper = mount(ActionUtilityCluster, {
        props: { canRescue: true, rescueCooldownSeconds: 0, showRestore: false },
      })

      expect(wrapper.find('[data-testid="hud-utility-cluster"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="hud-touch-rescue-btn"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="hud-utility-restore-btn"]').exists()).toBe(false)
    })

    it('renders restore button when showRestore prop is true and emits trigger-restore', async () => {
      const wrapper = mount(ActionUtilityCluster, {
        props: { canRescue: false, rescueCooldownSeconds: 0, showRestore: true },
      })

      const restoreBtn = wrapper.find('[data-testid="hud-utility-restore-btn"]')
      expect(restoreBtn.exists()).toBe(true)

      await restoreBtn.trigger('click')
      expect(wrapper.emitted('trigger-restore')).toBeTruthy()
    })

    it('emits virtual-interact when rescue button is clicked and not on cooldown', async () => {
      const wrapper = mount(ActionUtilityCluster, {
        props: { canRescue: true, rescueCooldownSeconds: 0 },
      })

      await wrapper.find('[data-testid="hud-touch-rescue-btn"]').trigger('click')
      expect(wrapper.emitted('virtual-interact')).toBeTruthy()
    })
  })

  describe('ActionSkillArc Component', () => {
    it('renders skill 1 (dash), skill 2 (smoke), skill 3 (adrenaline), and lompat (jump)', () => {
      const wrapper = mount(ActionSkillArc, {
        props: { isMobile: true },
      })

      expect(wrapper.find('[data-testid="hud-action-skill-arc"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="hud-skill-btn-dash"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="hud-skill-btn-smoke"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="hud-skill-btn-adrenaline"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="hud-touch-jump-btn"]').exists()).toBe(true)
    })

    it('emits trigger-skill event when skill buttons are clicked', async () => {
      const wrapper = mount(ActionSkillArc, {
        props: { isMobile: true },
      })

      await wrapper.find('[data-testid="hud-skill-btn-dash"]').trigger('click')
      expect(wrapper.emitted('trigger-skill')?.[0]).toEqual(['dash'])

      await wrapper.find('[data-testid="hud-skill-btn-smoke"]').trigger('click')
      expect(wrapper.emitted('trigger-skill')?.[1]).toEqual(['smoke'])

      await wrapper.find('[data-testid="hud-skill-btn-adrenaline"]').trigger('click')
      expect(wrapper.emitted('trigger-skill')?.[2]).toEqual(['adrenaline'])
    })

    it('emits trigger-skill event on immediate touchstart for multi-touch concurrency', async () => {
      const wrapper = mount(ActionSkillArc, {
        props: { isMobile: true },
      })

      await wrapper.find('[data-testid="hud-skill-btn-dash"]').trigger('touchstart')
      expect(wrapper.emitted('trigger-skill')?.[0]).toEqual(['dash'])

      await wrapper.find('[data-testid="hud-skill-btn-smoke"]').trigger('touchstart')
      expect(wrapper.emitted('trigger-skill')?.[1]).toEqual(['smoke'])

      await wrapper.find('[data-testid="hud-skill-btn-adrenaline"]').trigger('touchstart')
      expect(wrapper.emitted('trigger-skill')?.[2]).toEqual(['adrenaline'])
    })

    it('emits virtual-jump event when lompat button is clicked', async () => {
      const wrapper = mount(ActionSkillArc, {
        props: { isMobile: true },
      })

      await wrapper.find('[data-testid="hud-touch-jump-btn"]').trigger('click')
      expect(wrapper.emitted('virtual-jump')).toBeTruthy()
    })
  })
})
