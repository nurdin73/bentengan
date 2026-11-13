import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import MatchCountdownOverlay from '../components/hud/MatchCountdownOverlay.vue'
import { uiSound } from '../game/audio/ui-sound'

describe('MatchCountdownOverlay Component', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(uiSound, 'playCountdownTick').mockImplementation(() => {})
    vi.spyOn(uiSound, 'playWhistleStart').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('renders countdown starting at 3 and ticks through to MULAI! with sound cues', async () => {
    const wrapper = mount(MatchCountdownOverlay)

    const overlay = wrapper.find('[data-testid="match-countdown-overlay"]')
    expect(overlay.exists()).toBe(true)
    expect(overlay.classes()).toContain('bg-black/40')
    expect(wrapper.find('[data-testid="countdown-number"]').text()).toContain('3')
    expect(uiSound.playCountdownTick).toHaveBeenCalledTimes(1)

    // Advance 850ms -> 2
    await vi.advanceTimersByTimeAsync(850)
    expect(wrapper.find('[data-testid="countdown-number"]').text()).toContain('2')
    expect(overlay.classes()).toContain('bg-black/40')
    expect(uiSound.playCountdownTick).toHaveBeenCalledTimes(2)

    // Advance 850ms -> 1
    await vi.advanceTimersByTimeAsync(850)
    expect(wrapper.find('[data-testid="countdown-number"]').text()).toContain('1')
    expect(overlay.classes()).toContain('bg-black/40')
    expect(uiSound.playCountdownTick).toHaveBeenCalledTimes(3)

    // Advance 850ms -> MULAI!
    await vi.advanceTimersByTimeAsync(850)
    expect(wrapper.find('[data-testid="countdown-number"]').text()).toContain('MULAI!')
    expect(overlay.classes()).toContain('bg-transparent')
    expect(overlay.classes()).not.toContain('bg-black/40')
    expect(uiSound.playWhistleStart).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('started')).toBeTruthy()

    // Advance 350ms -> finished emitted and hidden
    await vi.advanceTimersByTimeAsync(350)
    expect(wrapper.emitted('finished')).toBeTruthy()
  })
})
