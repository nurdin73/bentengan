import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { useRoomStore } from '../stores/room-store'
import { peerNetworkManager } from '../game/network/peer-network-manager'
import { isMatchStartable } from '../game/network/network-protocol'
import ResultsModal from '../components/results/ResultsModal.vue'
import type { RoomPlayer } from '../types/game.types'

describe('Rematch Readiness & Multiplayer Sync', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
  })

  it('resets isReady on all players and returns status to waiting upon rematch', () => {
    const roomStore = useRoomStore()
    roomStore.roomCode = 'ABCD12'
    roomStore.isHost = true
    roomStore.status = 'finished'

    const player1: RoomPlayer = {
      id: 'p1',
      peerId: 'peer1',
      username: 'Alice',
      teamId: 'blue',
      isReady: true,
      isHost: true,
    }
    const player2: RoomPlayer = {
      id: 'p2',
      peerId: 'peer2',
      username: 'Bob',
      teamId: 'red',
      isReady: true,
      isHost: false,
    }
    roomStore.players = [player1, player2]

    const returnToLobbySpy = vi.spyOn(peerNetworkManager, 'returnToLobby').mockImplementation(() => {})

    roomStore.returnToLobbyForRematch()

    expect(roomStore.status).toBe('waiting')
    expect(roomStore.players.every((p) => p.isReady === false)).toBe(true)
    expect(returnToLobbySpy).toHaveBeenCalledTimes(1)

    // Verify isMatchStartable reflects not-ready state
    const readiness = isMatchStartable(roomStore.players)
    expect(readiness.startable).toBe(false)
    expect(readiness.reason).toContain('belum menekan tombol Siap')
  })

  it('resets readiness in local practice without broadcasting network message', () => {
    const roomStore = useRoomStore()
    roomStore.roomCode = 'LOKAL'
    roomStore.isHost = true
    roomStore.status = 'finished'
    roomStore.players = [
      {
        id: 'local-p',
        peerId: 'local-peer',
        username: 'Solo',
        teamId: 'blue',
        isReady: true,
        isHost: true,
      },
    ]

    const returnToLobbySpy = vi.spyOn(peerNetworkManager, 'returnToLobby').mockImplementation(() => {})

    roomStore.returnToLobbyForRematch()

    expect(roomStore.status).toBe('waiting')
    expect(roomStore.players[0]!.isReady).toBe(false)
    expect(returnToLobbySpy).not.toHaveBeenCalled()
  })

  it('requires all players to ready up again before match can be started after rematch', () => {
    const players: RoomPlayer[] = [
      { id: '1', peerId: 'p1', username: 'P1', teamId: 'blue', isReady: false, isHost: true },
      { id: '2', peerId: 'p2', username: 'P2', teamId: 'red', isReady: false, isHost: false },
    ]

    expect(isMatchStartable(players).startable).toBe(false)

    // Player 1 readies up
    players[0]!.isReady = true
    expect(isMatchStartable(players).startable).toBe(false)
    expect(isMatchStartable(players).reason).toContain('1 teman yang belum menekan tombol Siap')

    // Player 2 readies up
    players[1]!.isReady = true
    expect(isMatchStartable(players).startable).toBe(true)
    expect(isMatchStartable(players).reason).toBeUndefined()
  })

  it('prevents guest in a multiplayer room from unilaterally triggering returnToLobbyForRematch', () => {
    const roomStore = useRoomStore()
    roomStore.roomCode = 'ABCD12'
    roomStore.isHost = false
    roomStore.status = 'finished'
    roomStore.players = [
      { id: 'host-1', peerId: 'p-host', username: 'HostUser', teamId: 'blue', isReady: true, isHost: true },
      { id: 'guest-1', peerId: 'p-guest', username: 'GuestUser', teamId: 'red', isReady: true, isHost: false },
    ]

    const returnToLobbySpy = vi.spyOn(peerNetworkManager, 'returnToLobby').mockImplementation(() => {})

    roomStore.returnToLobbyForRematch()

    // Must remain 'finished' and not unilaterally jump to 'waiting'
    expect(roomStore.status).toBe('finished')
    expect(returnToLobbySpy).not.toHaveBeenCalled()
  })

  describe('ResultsModal Host vs Guest Action Authorization', () => {
    it('renders active restart button for solo practice mode', () => {
      const roomStore = useRoomStore()
      roomStore.roomCode = 'LOKAL'
      roomStore.isHost = true

      const wrapper = mount(ResultsModal)
      const restartBtn = wrapper.find('[data-testid="results-restart-btn"]')

      expect(restartBtn.exists()).toBe(true)
      expect(restartBtn.text()).toContain('Main Lagi (Latihan)')
      expect(wrapper.find('[data-testid="results-waiting-host-box"]').exists()).toBe(false)
    })

    it('renders active restart button for Host in a multiplayer room', () => {
      const roomStore = useRoomStore()
      roomStore.roomCode = 'ABCD12'
      roomStore.isHost = true

      const wrapper = mount(ResultsModal)
      const restartBtn = wrapper.find('[data-testid="results-restart-btn"]')

      expect(restartBtn.exists()).toBe(true)
      expect(restartBtn.text()).toContain('Kembali ke Ruang Tunggu (Main Lagi)')
      expect(wrapper.find('[data-testid="results-waiting-host-box"]').exists()).toBe(false)
    })

    it('hides restart button and renders waiting status box for Guest in a multiplayer room', () => {
      const roomStore = useRoomStore()
      roomStore.roomCode = 'ABCD12'
      roomStore.isHost = false

      const wrapper = mount(ResultsModal)

      // Restart button must NOT exist for guests
      expect(wrapper.find('[data-testid="results-restart-btn"]').exists()).toBe(false)

      // Informative waiting box must be shown
      const waitingBox = wrapper.find('[data-testid="results-waiting-host-box"]')
      expect(waitingBox.exists()).toBe(true)
      expect(waitingBox.text()).toContain('Menunggu Host Kembali ke Ruang Tunggu...')
    })
  })
})

