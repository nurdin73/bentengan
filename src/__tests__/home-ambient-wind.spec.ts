import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import HomeAmbientWind from '../components/home/HomeAmbientWind.vue'
import {
  LEAF_PARTICLES,
  LOW_DENSITY_LEAF_LIMIT,
  LOW_DENSITY_STREAK_LIMIT,
  WIND_STREAKS,
} from '../components/home/home-ambient-wind.config'
import HomeView from '../views/HomeView.vue'
import { useSettingsStore } from '../stores/settings-store'

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: vi.fn<(to: string) => void>(),
    replace: vi.fn<(to: string) => void>(),
  }),
}))

describe('HomeAmbientWind', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    window.matchMedia = vi.fn<() => MediaQueryList>().mockImplementation(() => ({
      matches: false,
      media: '',
      onchange: null,
      addListener: vi.fn<() => void>(),
      removeListener: vi.fn<() => void>(),
      addEventListener: vi.fn<() => void>(),
      removeEventListener: vi.fn<() => void>(),
      dispatchEvent: vi.fn<() => boolean>(),
    }))
  })

  it('renders decorative non-interactive wind and falling leaves backdrop', () => {
    const wrapper = mount(HomeAmbientWind)
    const root = wrapper.find('[data-testid="home-ambient-wind"]')

    expect(root.exists()).toBe(true)
    expect(root.attributes('aria-hidden')).toBe('true')
    expect(root.classes()).toContain('pointer-events-none')
    expect(root.classes()).toContain('z-0')
  })

  it('renders full leaf and wind streak counts on high particle density', () => {
    const wrapper = mount(HomeAmbientWind, {
      props: { density: 'high' },
    })

    expect(wrapper.findAll('[data-testid="home-ambient-leaf"]')).toHaveLength(
      LEAF_PARTICLES.length,
    )
    expect(wrapper.findAll('[data-testid="home-ambient-streak"]')).toHaveLength(
      WIND_STREAKS.length,
    )
  })

  it('reduces leaf and wind streak counts on low particle density', () => {
    const wrapper = mount(HomeAmbientWind, {
      props: { density: 'low' },
    })

    expect(wrapper.findAll('[data-testid="home-ambient-leaf"]')).toHaveLength(
      LOW_DENSITY_LEAF_LIMIT,
    )
    expect(wrapper.findAll('[data-testid="home-ambient-streak"]')).toHaveLength(
      LOW_DENSITY_STREAK_LIMIT,
    )
  })

  it('integrates inside HomeView and reacts to settingsStore.particleDensity', async () => {
    const settings = useSettingsStore()
    settings.setParticleDensity('high')

    const wrapper = mount(HomeView)
    expect(wrapper.find('[data-testid="home-ambient-wind"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="home-ambient-leaf"]')).toHaveLength(
      LEAF_PARTICLES.length,
    )

    settings.setParticleDensity('low')
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('[data-testid="home-ambient-leaf"]')).toHaveLength(
      LOW_DENSITY_LEAF_LIMIT,
    )
    expect(wrapper.findAll('[data-testid="home-ambient-streak"]')).toHaveLength(
      LOW_DENSITY_STREAK_LIMIT,
    )

    wrapper.unmount()
  })
})

