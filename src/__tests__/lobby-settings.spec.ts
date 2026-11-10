import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import LobbyModeSelector from '../components/lobby/LobbyModeSelector.vue'
import LobbyWaitingRoom from '../components/lobby/LobbyWaitingRoom.vue'
import { useRoomStore } from '../stores/room-store'
import { peerNetworkManager } from '../game/network/peer-network-manager'

describe('Match Duration Lobby Settings', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
  })

  describe('LobbyModeSelector Component', () => {
    it('renders all duration options (3m, 5m, 10m, Bebas) with default 5m (300s)', () => {
      const wrapper = mount(LobbyModeSelector, {
        props: {
          initialUsername: 'Garuda',
          initialTeam: 'blue',
          isConnecting: false,
          connectionError: null,
        },
      })

      expect(wrapper.find('[data-testid="duration-180-btn"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="duration-300-btn"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="duration-600-btn"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="duration-0-btn"]').exists()).toBe(true)
    })

    it('emits create-host event with selected duration', async () => {
      const wrapper = mount(LobbyModeSelector, {
        props: {
          initialUsername: 'Garuda',
          initialTeam: 'blue',
          isConnecting: false,
          connectionError: null,
        },
      })

      // Select 10m (600s)
      await wrapper.find('[data-testid="duration-600-btn"]').trigger('click')

      // Click Create Room
      await wrapper.find('[data-testid="lobby-create-room-btn"]').trigger('click')

      const emitted = wrapper.emitted('create-host')
      expect(emitted).toBeDefined()
      expect(emitted?.[0]?.[0]).toMatchObject({
        matchDurationSec: 600,
      })
    })
  })

  describe('LobbyWaitingRoom Component Duration Controls', () => {
    it('renders interactive duration selector for Host and triggers setMatchDuration', async () => {
      const roomStore = useRoomStore()
      roomStore.isHost = true
      roomStore.matchDurationSec = 300
      const setDurationSpy = vi.spyOn(roomStore, 'setMatchDuration')

      const wrapper = mount(LobbyWaitingRoom)

      expect(wrapper.find('[data-testid="waiting-room-duration-selector"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="waiting-room-duration-badge"]').exists()).toBe(false)

      // Click 3m option
      await wrapper.find('[data-testid="waiting-duration-180-btn"]').trigger('click')
      expect(setDurationSpy).toHaveBeenCalledWith(180)
    })

    it('renders read-only duration badge for Guests without interactive buttons', () => {
      const roomStore = useRoomStore()
      roomStore.isHost = false
      roomStore.matchDurationSec = 600

      const wrapper = mount(LobbyWaitingRoom)

      expect(wrapper.find('[data-testid="waiting-room-duration-selector"]').exists()).toBe(false)
      const badge = wrapper.find('[data-testid="waiting-room-duration-badge"]')
      expect(badge.exists()).toBe(true)
      expect(badge.text()).toContain('10 Menit')
    })
  })
})

