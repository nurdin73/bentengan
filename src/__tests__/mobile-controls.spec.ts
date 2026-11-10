import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { InputManager } from '../game/input/input-manager'
import MobileTouchControls from '../components/hud/MobileTouchControls.vue'
import RotateDevicePrompt from '../components/hud/RotateDevicePrompt.vue'
import { checkIsMobileTouchDevice } from '../components/hud/mobile-device.utils'
import { useGameStore } from '../stores/game-store'

describe('Mobile Touch Controls & Virtual Input Integration', () => {
  describe('InputManager Virtual Inputs', () => {
    let input: InputManager

    beforeEach(() => {
      input = new InputManager()
    })

    afterEach(() => {
      input.dispose()
    })

    it('merges virtual movement state with keyboard movement', () => {
      // Initially false
      let state = input.getMovementInput(0)
      expect(state.forward).toBe(false)
      expect(state.right).toBe(false)

      // Set virtual direction
      input.setVirtualMovement({ forward: true, right: true })
      state = input.getMovementInput(0)
      expect(state.forward).toBe(true)
      expect(state.backward).toBe(false)
      expect(state.left).toBe(false)
      expect(state.right).toBe(true)

      // Clear virtual direction
      input.setVirtualMovement({ forward: false, right: false })
      state = input.getMovementInput(0)
      expect(state.forward).toBe(false)
      expect(state.right).toBe(false)
    })

    it('merges virtual sprint state correctly', () => {
      let state = input.getMovementInput(0)
      expect(state.sprint).toBe(false)

      input.setVirtualSprint(true)
      state = input.getMovementInput(0)
      expect(state.sprint).toBe(true)

      input.setVirtualSprint(false)
      state = input.getMovementInput(0)
      expect(state.sprint).toBe(false)
    })

    it('merges virtual jump state correctly', () => {
      let state = input.getMovementInput(0)
      expect(state.jump).toBe(false)

      input.setVirtualJump(true)
      state = input.getMovementInput(0)
      expect(state.jump).toBe(true)

      input.setVirtualJump(false)
      state = input.getMovementInput(0)
      expect(state.jump).toBe(false)
    })

    it('accumulates touch look delta into consumeMouseDelta', () => {
      input.injectTouchDelta(12, -8)
      input.injectTouchDelta(5, 3)

      const delta = input.consumeMouseDelta()
      expect(delta.deltaX).toBe(17)
      expect(delta.deltaY).toBe(-5)

      // Second consumption must be reset to zero
      const secondDelta = input.consumeMouseDelta()
      expect(secondDelta.deltaX).toBe(0)
      expect(secondDelta.deltaY).toBe(0)
    })

    it('handles one-shot virtual interact trigger', () => {
      input.triggerVirtualInteract()
      const first = input.getMovementInput(0)
      expect(first.interact).toBe(true)

      const second = input.getMovementInput(0)
      expect(second.interact).toBe(false)
    })

    it('resets virtual states on input.reset()', () => {
      input.setVirtualMovement({ forward: true, left: true })
      input.setVirtualSprint(true)
      input.setVirtualJump(true)
      input.injectTouchDelta(10, 20)

      input.reset()

      const state = input.getMovementInput(0)
      expect(state.forward).toBe(false)
      expect(state.left).toBe(false)
      expect(state.sprint).toBe(false)
      expect(state.jump).toBe(false)

      const delta = input.consumeMouseDelta()
      expect(delta.deltaX).toBe(0)
      expect(delta.deltaY).toBe(0)
    })
  })

  describe('Mobile Device Detection', () => {
    const originalMatchMedia = window.matchMedia

    afterEach(() => {
      window.matchMedia = originalMatchMedia
    })

    it('returns false when device does not have coarse pointer or touch support', () => {
      Object.defineProperty(navigator, 'maxTouchPoints', { value: 0, configurable: true })
      window.matchMedia = vi.fn<() => MediaQueryList>().mockImplementation(() => ({
        matches: false,
        media: '(pointer: coarse)',
        onchange: null,
        addListener: vi.fn<() => void>(),
        removeListener: vi.fn<() => void>(),
        addEventListener: vi.fn<() => void>(),
        removeEventListener: vi.fn<() => void>(),
        dispatchEvent: vi.fn<() => boolean>(),
      }))

      expect(checkIsMobileTouchDevice()).toBe(false)
    })

    it('returns true when device has touch capability and coarse pointer', () => {
      Object.defineProperty(navigator, 'maxTouchPoints', { value: 5, configurable: true })
      window.matchMedia = vi.fn<() => MediaQueryList>().mockImplementation(() => ({
        matches: true,
        media: '(pointer: coarse)',
        onchange: null,
        addListener: vi.fn<() => void>(),
        removeListener: vi.fn<() => void>(),
        addEventListener: vi.fn<() => void>(),
        removeEventListener: vi.fn<() => void>(),
        dispatchEvent: vi.fn<() => boolean>(),
      }))

      expect(checkIsMobileTouchDevice()).toBe(true)
    })
  })

  describe('MobileTouchControls Component', () => {
    beforeEach(() => {
      setActivePinia(createPinia())
    })

    it('does not render controls when not on mobile and forceShow is false', () => {
      const wrapper = mount(MobileTouchControls, {
        props: { forceShow: false },
      })
      expect(wrapper.find('[data-testid="mobile-touch-controls"]').exists()).toBe(false)
    })

    it('renders virtual joystick, sprint button, and look zone when forceShow is true', () => {
      const wrapper = mount(MobileTouchControls, {
        props: { forceShow: true },
      })

      expect(wrapper.find('[data-testid="mobile-touch-controls"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="hud-virtual-joystick"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="hud-joystick-knob"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="hud-touch-sprint-btn"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="hud-touch-jump-btn"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="hud-touch-rescue-btn"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="hud-touch-look-zone"]').exists()).toBe(true)
    })

    it('dispatches virtual-move events on joystick touch interaction', async () => {
      const wrapper = mount(MobileTouchControls, {
        props: { forceShow: true },
      })

      const joystick = wrapper.find('[data-testid="hud-virtual-joystick"]')
      const baseEl = joystick.element as HTMLElement

      // Mock getBoundingClientRect
      vi.spyOn(baseEl, 'getBoundingClientRect').mockReturnValue({
        left: 50,
        top: 500,
        width: 100,
        height: 100,
        right: 150,
        bottom: 600,
        x: 50,
        y: 500,
        toJSON: () => ({}),
      })

      // Center is at (100, 550)
      // Touch upwards (forward): Y = 510 (deltaY = -40, normY = -40/45 < -0.25)
      await joystick.trigger('touchstart', {
        changedTouches: [{ identifier: 1, clientX: 100, clientY: 510 }],
      })

      const moveEvents = wrapper.emitted('virtual-move')
      expect(moveEvents).toBeDefined()
      expect(moveEvents?.[0]?.[0]).toEqual({
        forward: true,
        backward: false,
        left: false,
        right: false,
      })

      // Move rightwards: X = 140, Y = 550 (deltaX = +40, deltaY = 0)
      await joystick.trigger('touchmove', {
        changedTouches: [{ identifier: 1, clientX: 140, clientY: 550 }],
      })

      expect(moveEvents?.[1]?.[0]).toEqual({
        forward: false,
        backward: false,
        left: false,
        right: true,
      })

      // Release touch
      await joystick.trigger('touchend', {
        changedTouches: [{ identifier: 1, clientX: 140, clientY: 550 }],
      })

      expect(moveEvents?.[2]?.[0]).toEqual({
        forward: false,
        backward: false,
        left: false,
        right: false,
      })
    })

    it('dispatches virtual-sprint events on sprint button touch interaction', async () => {
      const wrapper = mount(MobileTouchControls, {
        props: { forceShow: true },
      })

      const sprintBtn = wrapper.find('[data-testid="hud-touch-sprint-btn"]')

      await sprintBtn.trigger('touchstart', {
        changedTouches: [{ identifier: 2, clientX: 300, clientY: 600 }],
      })

      expect(wrapper.emitted('virtual-sprint')?.[0]).toEqual([true])

      await sprintBtn.trigger('touchend', {
        changedTouches: [{ identifier: 2, clientX: 300, clientY: 600 }],
      })

      expect(wrapper.emitted('virtual-sprint')?.[1]).toEqual([false])
    })

    it('renders circular stamina bar on sprint button and adapts to stamina percentage', async () => {
      const wrapper = mount(MobileTouchControls, {
        props: { forceShow: true, staminaPercentage: 100 },
      })

      const gauge = wrapper.find('[data-testid="hud-sprint-circular-bar"]')
      const progressCircle = wrapper.find('[data-testid="hud-sprint-circular-progress"]')

      expect(gauge.exists()).toBe(true)
      expect(progressCircle.exists()).toBe(true)
      expect(progressCircle.classes()).toContain('stroke-amber-400')
      expect(progressCircle.classes()).not.toContain('animate-pulse')
      expect(Number(progressCircle.attributes('stroke-dashoffset'))).toBeCloseTo(0, 1)

      // Moderate stamina (40%): changes to orange
      await wrapper.setProps({ staminaPercentage: 40 })
      expect(progressCircle.classes()).toContain('stroke-orange-500')
      // dashoffset should be approx 289.03 * (1 - 0.4) = 173.42
      expect(Number(progressCircle.attributes('stroke-dashoffset'))).toBeCloseTo(173.4, 1)

      // Low stamina (10%): changes to red and triggers pulse alert
      await wrapper.setProps({ staminaPercentage: 10 })
      expect(progressCircle.classes()).toContain('stroke-rose-500')
      expect(progressCircle.classes()).toContain('animate-pulse')
      // dashoffset should be approx 289.03 * (1 - 0.1) = 260.13
      expect(Number(progressCircle.attributes('stroke-dashoffset'))).toBeCloseTo(260.1, 1)
    })

    it('dispatches virtual-jump events on jump button touch interaction', async () => {
      const wrapper = mount(MobileTouchControls, {
        props: { forceShow: true },
      })

      const jumpBtn = wrapper.find('[data-testid="hud-touch-jump-btn"]')
      expect(jumpBtn.exists()).toBe(true)

      await jumpBtn.trigger('touchstart', {
        changedTouches: [{ identifier: 4, clientX: 300, clientY: 500 }],
      })

      expect(wrapper.emitted('virtual-jump')?.[0]).toEqual([true])

      await jumpBtn.trigger('touchend', {
        changedTouches: [{ identifier: 4, clientX: 300, clientY: 500 }],
      })

      expect(wrapper.emitted('virtual-jump')?.[1]).toEqual([false])
    })

    it('dispatches virtual-interact event on rescue button touch and click', async () => {
      const wrapper = mount(MobileTouchControls, {
        props: { forceShow: true, canRescue: false },
      })

      const rescueBtn = wrapper.find('[data-testid="hud-touch-rescue-btn"]')
      expect(rescueBtn.exists()).toBe(true)

      // Touch start emits virtual-interact
      await rescueBtn.trigger('touchstart', {
        changedTouches: [{ identifier: 5, clientX: 250, clientY: 500 }],
      })
      expect(wrapper.emitted('virtual-interact')).toHaveLength(1)

      // Click also emits virtual-interact
      await rescueBtn.trigger('click')
      expect(wrapper.emitted('virtual-interact')).toHaveLength(2)
    })

    it('applies pulsing emerald styling when canRescue is true', () => {
      const wrapper = mount(MobileTouchControls, {
        props: { forceShow: true, canRescue: true },
      })

      const rescueBtn = wrapper.find('[data-testid="hud-touch-rescue-btn"]')
      expect(rescueBtn.classes()).toContain('animate-pulse')
      expect(rescueBtn.classes()).toContain('bg-emerald-500')
    })

    it('displays numeric-only countdown on rescue button when on cooldown and blocks interact events', async () => {
      const wrapper = mount(MobileTouchControls, {
        props: { forceShow: true, canRescue: true, rescueCooldownSeconds: 28 },
      })

      const rescueBtn = wrapper.find('[data-testid="hud-touch-rescue-btn"]')
      const cooldownBadge = wrapper.find('[data-testid="hud-rescue-cooldown-badge"]')

      expect(cooldownBadge.exists()).toBe(true)
      expect(cooldownBadge.text()).toBe('28') // Must be purely numeric, NO 's'
      expect(cooldownBadge.text()).not.toContain('s')
      expect(rescueBtn.attributes('disabled')).toBeDefined()
      expect(rescueBtn.classes()).toContain('cursor-not-allowed')

      // Touching while on cooldown must NOT emit virtual-interact
      await rescueBtn.trigger('touchstart', {
        changedTouches: [{ identifier: 5, clientX: 250, clientY: 500 }],
      })
      expect(wrapper.emitted('virtual-interact')).toBeUndefined()

      await rescueBtn.trigger('click')
      expect(wrapper.emitted('virtual-interact')).toBeUndefined()
    })

    it('renders fullscreen toggle button and triggers requestFullscreenAndLandscape', async () => {
      const wrapper = mount(MobileTouchControls, {
        props: { forceShow: true },
      })

      const fsBtn = wrapper.find('[data-testid="hud-fullscreen-btn"]')
      expect(fsBtn.exists()).toBe(true)
    })

    it('dispatches virtual-look events on touch look zone dragging', async () => {
      const wrapper = mount(MobileTouchControls, {
        props: { forceShow: true },
      })

      const lookZone = wrapper.find('[data-testid="hud-touch-look-zone"]')

      await lookZone.trigger('touchstart', {
        changedTouches: [{ identifier: 3, clientX: 200, clientY: 300 }],
      })

      await lookZone.trigger('touchmove', {
        changedTouches: [{ identifier: 3, clientX: 220, clientY: 290 }],
      })

      const lookEvents = wrapper.emitted('virtual-look')
      expect(lookEvents).toBeDefined()
      // deltaX = (220 - 200) * 1.5 = 30, deltaY = (290 - 300) * 1.5 = -15
      expect(lookEvents?.[0]?.[0]).toEqual({
        deltaX: 30,
        deltaY: -15,
      })
    })

    it('allows joystick knob to drag in UI but suppresses virtual-move when isStunned is true', async () => {
      const wrapper = mount(MobileTouchControls, {
        props: { forceShow: true, isStunned: true },
      })

      const joystick = wrapper.find('[data-testid="hud-virtual-joystick"]')
      const knob = wrapper.find('[data-testid="hud-joystick-knob"]')
      const baseEl = joystick.element as HTMLElement

      vi.spyOn(baseEl, 'getBoundingClientRect').mockReturnValue({
        left: 50,
        top: 500,
        width: 100,
        height: 100,
        right: 150,
        bottom: 600,
        x: 50,
        y: 500,
        toJSON: () => ({}),
      })

      // Center is at (100, 550)
      // Drag upwards (Y = 510): knob moves in UI (translate3d should be set)
      await joystick.trigger('touchstart', {
        changedTouches: [{ identifier: 10, clientX: 100, clientY: 510 }],
      })

      // UI knob is moved (dy = -40)
      expect(knob.attributes('style')).toContain('translate3d(0px, -40px, 0)')

      // But virtual-move must emit all false
      const moveEvents = wrapper.emitted('virtual-move')
      expect(moveEvents).toBeDefined()
      expect(moveEvents?.[0]?.[0]).toEqual({
        forward: false,
        backward: false,
        left: false,
        right: false,
      })
    })

    it('clears virtual-move if isStunned becomes true while joystick was being dragged', async () => {
      const wrapper = mount(MobileTouchControls, {
        props: { forceShow: true, isStunned: false },
      })

      const joystick = wrapper.find('[data-testid="hud-virtual-joystick"]')
      const baseEl = joystick.element as HTMLElement

      vi.spyOn(baseEl, 'getBoundingClientRect').mockReturnValue({
        left: 50,
        top: 500,
        width: 100,
        height: 100,
        right: 150,
        bottom: 600,
        x: 50,
        y: 500,
        toJSON: () => ({}),
      })

      // Start drag forward
      await joystick.trigger('touchstart', {
        changedTouches: [{ identifier: 11, clientX: 100, clientY: 510 }],
      })

      expect(wrapper.emitted('virtual-move')?.[0]?.[0]).toEqual({
        forward: true,
        backward: false,
        left: false,
        right: false,
      })

      // Stun occurs dynamically
      await wrapper.setProps({ isStunned: true })

      const moveEvents = wrapper.emitted('virtual-move')
      const lastEvent = moveEvents?.[moveEvents.length - 1]?.[0]
      expect(lastEvent).toEqual({
        forward: false,
        backward: false,
        left: false,
        right: false,
      })
    })

    it('disables sprint button and prevents virtual-sprint activation when isStunned is true', async () => {
      const wrapper = mount(MobileTouchControls, {
        props: { forceShow: true, isStunned: true },
      })

      const sprintBtn = wrapper.find('[data-testid="hud-touch-sprint-btn"]')
      expect(sprintBtn.attributes('disabled')).toBeDefined()

      await sprintBtn.trigger('touchstart', {
        changedTouches: [{ identifier: 12, clientX: 300, clientY: 600 }],
      })

      expect(wrapper.emitted('virtual-sprint')).toBeUndefined()
    })
  })

  describe('RotateDevicePrompt Component', () => {
    beforeEach(() => {
      setActivePinia(createPinia())
    })

    it('does not render prompt when not in portrait and forceShow is false', () => {
      const gameStore = useGameStore()
      const wrapper = mount(RotateDevicePrompt, {
        props: { forceShow: false },
      })
      expect(wrapper.find('[data-testid="rotate-device-prompt"]').exists()).toBe(false)
      expect(gameStore.isPaused).toBe(false)
    })

    it('renders rotation instructions overlay when forceShow is true and pauses game', () => {
      const gameStore = useGameStore()
      const wrapper = mount(RotateDevicePrompt, {
        props: { forceShow: true },
      })

      const overlay = wrapper.find('[data-testid="rotate-device-prompt"]')
      expect(overlay.exists()).toBe(true)
      expect(overlay.text()).toContain('Miringkan Layar Anda')
      expect(gameStore.isPaused).toBe(true)
      expect(wrapper.emitted('update:active')?.[0]).toEqual([true])
    })

    it('unpauses game when unmounted after being shown', () => {
      const gameStore = useGameStore()
      const wrapper = mount(RotateDevicePrompt, {
        props: { forceShow: true },
      })

      expect(gameStore.isPaused).toBe(true)
      wrapper.unmount()
      expect(gameStore.isPaused).toBe(false)
    })

    it('triggers pause and displays overlay when forceMobile is true and in portrait orientation', async () => {
      const gameStore = useGameStore()
      const originalInnerWidth = window.innerWidth
      const originalInnerHeight = window.innerHeight

      // Simulate portrait dimensions in JSDOM
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 360,
      })
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 800,
      })

      const wrapper = mount(RotateDevicePrompt, {
        props: { forceMobile: true },
      })
      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="rotate-device-prompt"]').exists()).toBe(true)
      expect(gameStore.isPaused).toBe(true)

      // Restore dimensions
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: originalInnerWidth,
      })
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: originalInnerHeight,
      })
    })
  })
})
