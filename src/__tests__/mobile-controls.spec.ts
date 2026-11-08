import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { InputManager } from '../game/input/input-manager'
import MobileTouchControls from '../components/hud/MobileTouchControls.vue'
import { checkIsMobileTouchDevice } from '../components/hud/mobile-device.utils'

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
      input.injectTouchDelta(10, 20)

      input.reset()

      const state = input.getMovementInput(0)
      expect(state.forward).toBe(false)
      expect(state.left).toBe(false)
      expect(state.sprint).toBe(false)

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
  })
})
