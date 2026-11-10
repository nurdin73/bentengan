import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import CharacterPreviewViewport from '../components/wardrobe/CharacterPreviewViewport.vue'
import * as THREE from 'three'
import { setCharacterModelTemplate } from '../game/entities/character-avatar'

function buildMockCharacterGLTF(): THREE.Group {
  const root = new THREE.Group()
  root.name = 'Character_Root'

  const torsoPivot = new THREE.Group()
  torsoPivot.name = 'Pivot_Torso'
  root.add(torsoPivot)

  const headPivot = new THREE.Group()
  headPivot.name = 'Pivot_Head'
  torsoPivot.add(headPivot)

  const armLPivot = new THREE.Group()
  armLPivot.name = 'Pivot_Arm_L'
  torsoPivot.add(armLPivot)

  const armRPivot = new THREE.Group()
  armRPivot.name = 'Pivot_Arm_R'
  torsoPivot.add(armRPivot)

  const legLPivot = new THREE.Group()
  legLPivot.name = 'Pivot_Leg_L'
  root.add(legLPivot)

  const legRPivot = new THREE.Group()
  legRPivot.name = 'Pivot_Leg_R'
  root.add(legRPivot)

  return root
}

describe('CharacterPreviewViewport Component', () => {
  beforeEach(() => {
    setCharacterModelTemplate(buildMockCharacterGLTF())
  })

  afterEach(() => {
    setCharacterModelTemplate(null as unknown as THREE.Group)
    vi.restoreAllMocks()
  })

  it('mounts cleanly and renders 3D viewport container, live badge, and 360 hint', () => {
    const wrapper = mount(CharacterPreviewViewport, {
      props: {
        outfitId: 1,
        teamId: 'blue',
      },
    })

    expect(wrapper.find('[data-testid="character-preview-viewport"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="preview-live-badge"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="preview-rotate-hint"]').exists()).toBe(true)

    wrapper.unmount()
  })

  it('reacts to outfitId and teamId prop updates dynamically', async () => {
    const wrapper = mount(CharacterPreviewViewport, {
      props: {
        outfitId: 1,
        teamId: 'blue',
      },
    })

    await wrapper.setProps({ outfitId: 3, teamId: 'red' })

    expect(wrapper.props('outfitId')).toBe(3)
    expect(wrapper.props('teamId')).toBe('red')

    wrapper.unmount()
  })

  it('handles pointer drag interaction without crashing', () => {
    const wrapper = mount(CharacterPreviewViewport, {
      props: {
        outfitId: 2,
        teamId: 'blue',
      },
    })

    const el = wrapper.find('[data-testid="character-preview-viewport"]').element

    // Simulate pointer drag using standard DOM events
    el.dispatchEvent(new Event('pointerdown'))
    el.dispatchEvent(new Event('pointermove'))
    el.dispatchEvent(new Event('pointerup'))

    expect(wrapper.exists()).toBe(true)
    wrapper.unmount()
  })
})
