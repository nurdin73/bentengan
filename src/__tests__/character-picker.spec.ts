import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import CharacterPickerModal from '../components/wardrobe/CharacterPickerModal.vue'
import { useRoomStore } from '../stores/room-store'
import { OUTFIT_PRESETS } from '../game/entities/character-avatar'
import {
  NetworkMessageSchema,
  RoomPlayerSchema,
  type SetOutfitMessage,
} from '../game/network/network-protocol'

describe('CharacterPickerModal Component', () => {
  const storageMap = new Map<string, string>()

  beforeEach(() => {
    setActivePinia(createPinia())
    storageMap.clear()
    vi.stubGlobal('localStorage', {
      getItem: vi.fn<(key: string) => string | null>((key: string) => storageMap.get(key) ?? null),
      setItem: vi.fn<(key: string, value: string) => void>((key: string, value: string) =>
        storageMap.set(key, value),
      ),
      removeItem: vi.fn<(key: string) => boolean>((key: string) => storageMap.delete(key)),
      clear: vi.fn<() => void>(() => storageMap.clear()),
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders modal with all 6 outfit preset cards and active status', () => {
    const roomStore = useRoomStore()
    roomStore.myOutfitId = 2

    const wrapper = mount(CharacterPickerModal, {
      props: {
        team: 'blue',
      },
    })

    expect(wrapper.find('[data-testid="character-picker-modal"]').exists()).toBe(true)

    // Verify all 6 cards exist
    for (const preset of OUTFIT_PRESETS) {
      const card = wrapper.find(`[data-testid="outfit-card-${preset.id}"]`)
      expect(card.exists()).toBe(true)
      expect(card.text()).toContain(preset.name)
    }

    // Outfit #2 is initially selected from store
    const card2 = wrapper.find('[data-testid="outfit-card-2"]')
    expect(card2.classes()).toContain('ring-2')
  })

  it('switches preview team and adapts color palettes', async () => {
    const wrapper = mount(CharacterPickerModal, {
      props: {
        team: 'blue',
      },
    })

    const redBtn = wrapper.find('[data-testid="team-preview-red-btn"]')
    expect(redBtn.exists()).toBe(true)

    await redBtn.trigger('click')

    // Expect red button to become active
    expect(redBtn.classes()).toContain('bg-red-600')

    const blueBtn = wrapper.find('[data-testid="team-preview-blue-btn"]')
    await blueBtn.trigger('click')
    expect(blueBtn.classes()).toContain('bg-blue-600')
  })

  it('selects another outfit and applies it on confirm', async () => {
    const roomStore = useRoomStore()
    roomStore.myOutfitId = 1
    const setOutfitSpy = vi.spyOn(roomStore, 'setOutfit')

    const wrapper = mount(CharacterPickerModal, {
      props: {
        team: 'blue',
      },
    })

    // Click outfit #4
    const card4 = wrapper.find('[data-testid="outfit-card-4"]')
    await card4.trigger('click')

    // Save outfit
    const saveBtn = wrapper.find('[data-testid="save-outfit-btn"]')
    await saveBtn.trigger('click')

    expect(setOutfitSpy).toHaveBeenCalledWith(4)
    expect(wrapper.emitted('select')).toBeTruthy()
    expect(wrapper.emitted('select')![0]).toEqual([4])
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('emits close on cancel button and close icon click', async () => {
    const wrapper = mount(CharacterPickerModal)

    const closeBtn = wrapper.find('[data-testid="close-character-picker-btn"]')
    await closeBtn.trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)

    const cancelBtn = wrapper.find('[data-testid="cancel-outfit-btn"]')
    await cancelBtn.trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(2)
  })

  it('renders with mobile landscape responsive class hooks and 2-column structure', () => {
    const wrapper = mount(CharacterPickerModal, {
      props: {
        team: 'blue',
      },
    })

    const backdrop = wrapper.find('[data-testid="character-picker-modal-backdrop"]')
    const card = wrapper.find('[data-testid="character-picker-modal"]')

    expect(backdrop.exists()).toBe(true)
    expect(backdrop.classes()).toContain('character-picker-modal-backdrop')

    expect(card.exists()).toBe(true)
    expect(card.classes()).toContain('character-picker-modal-card')
    expect(card.classes()).toContain('max-h-[94dvh]')
    expect(card.classes()).toContain('overflow-y-auto')
    expect(card.classes()).toContain('overscroll-contain')

    // Semantic landscape layout elements
    expect(wrapper.find('.character-picker-header').exists()).toBe(true)
    expect(wrapper.find('.character-picker-subtitle').exists()).toBe(true)
    expect(wrapper.find('.character-picker-close-btn').exists()).toBe(true)
    expect(wrapper.find('.character-picker-body').exists()).toBe(true)
    expect(wrapper.find('.character-picker-left-col').exists()).toBe(true)
    expect(wrapper.find('.character-picker-viewport-container').exists()).toBe(true)
    expect(wrapper.find('.character-picker-summary-card').exists()).toBe(true)
    expect(wrapper.find('.character-picker-right-col').exists()).toBe(true)
    expect(wrapper.find('.character-picker-team-bar').exists()).toBe(true)
    expect(wrapper.find('.character-picker-outfits-grid').exists()).toBe(true)
    expect(wrapper.find('.character-picker-footer').exists()).toBe(true)
  })
})

describe('Room Store Outfit Management & Network Protocol', () => {
  const storageMap = new Map<string, string>()

  beforeEach(() => {
    setActivePinia(createPinia())
    storageMap.clear()
    vi.stubGlobal('localStorage', {
      getItem: vi.fn<(key: string) => string | null>((key: string) => storageMap.get(key) ?? null),
      setItem: vi.fn<(key: string, value: string) => void>((key: string, value: string) =>
        storageMap.set(key, value),
      ),
      removeItem: vi.fn<(key: string) => boolean>((key: string) => storageMap.delete(key)),
      clear: vi.fn<() => void>(() => storageMap.clear()),
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sets outfit, saves to localStorage, and updates player in room roster', () => {
    const roomStore = useRoomStore()
    roomStore.initLocalPractice('red')

    roomStore.setOutfit(3)

    expect(roomStore.myOutfitId).toBe(3)
    expect(localStorage.getItem('bentengan_player_outfit')).toBe('3')

    const me = roomStore.players.find((p) => p.id === roomStore.myPlayerId)
    expect(me?.outfitId).toBe(3)
  })

  it('validates SET_OUTFIT message in NetworkMessageSchema', () => {
    const setOutfitMsg: SetOutfitMessage = {
      type: 'SET_OUTFIT',
      playerId: 'player-123',
      outfitId: 5,
    }

    const parseResult = NetworkMessageSchema.safeParse(setOutfitMsg)
    expect(parseResult.success).toBe(true)

    const invalidMsg = {
      type: 'SET_OUTFIT',
      playerId: 'player-123',
      outfitId: 99, // Out of bounds
    }
    const invalidResult = NetworkMessageSchema.safeParse(invalidMsg)
    expect(invalidResult.success).toBe(false)
  })

  it('validates RoomPlayerSchema with optional outfitId', () => {
    const validPlayer = {
      id: 'p1',
      peerId: 'peer1',
      username: 'Budi',
      teamId: 'blue',
      isReady: true,
      isHost: false,
      outfitId: 2,
    }
    expect(RoomPlayerSchema.safeParse(validPlayer).success).toBe(true)

    const validPlayerWithoutOutfit = {
      id: 'p2',
      peerId: 'peer2',
      username: 'Siti',
      teamId: 'red',
      isReady: false,
      isHost: true,
    }
    expect(RoomPlayerSchema.safeParse(validPlayerWithoutOutfit).success).toBe(true)
  })
})
