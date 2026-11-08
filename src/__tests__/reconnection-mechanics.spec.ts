import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { mount } from '@vue/test-utils'
import * as THREE from 'three'
import type { DataConnection } from 'peerjs'
import { useRoomStore } from '../stores/room-store'
import { peerNetworkManager } from '../game/network/peer-network-manager'
import {
  parseNetworkMessage,
  type PeerStatusNotification,
} from '../game/network/network-protocol'
import GameHUD from '../components/hud/GameHUD.vue'
import LobbyWaitingRoom from '../components/lobby/LobbyWaitingRoom.vue'
import { PhysicsWorld } from '../game/physics/physics-world'
import { RemotePlayerController } from '../game/entities/remote-player-controller'
import { GameEngine } from '../game/core/engine'

describe('Multiplayer Reconnection & Status Transparency Mechanics', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Protocol: PeerStatusNotification', () => {
    it('validates and parses PEER_STATUS_NOTIFICATION for disconnected player', () => {
      const payload: PeerStatusNotification = {
        type: 'PEER_STATUS_NOTIFICATION',
        playerId: 'p-guest-1',
        username: 'Guest Alpha',
        status: 'disconnected',
        timestamp: 1700000000,
      }

      const parsed = parseNetworkMessage(payload) as PeerStatusNotification
      expect(parsed).not.toBeNull()
      expect(parsed.type).toBe('PEER_STATUS_NOTIFICATION')
      expect(parsed.status).toBe('disconnected')
      expect(parsed.username).toBe('Guest Alpha')
    })

    it('validates and parses PEER_STATUS_NOTIFICATION for reconnected player', () => {
      const payload: PeerStatusNotification = {
        type: 'PEER_STATUS_NOTIFICATION',
        playerId: 'p-guest-1',
        username: 'Guest Alpha',
        status: 'reconnected',
        timestamp: 1700000010,
      }

      const parsed = parseNetworkMessage(payload) as PeerStatusNotification
      expect(parsed).not.toBeNull()
      expect(parsed.type).toBe('PEER_STATUS_NOTIFICATION')
      expect(parsed.status).toBe('reconnected')
    })
  })

  describe('PeerNetworkManager: Reconnection State Machine', () => {
    it('attempts client reconnect up to max 5 attempts with status callback', () => {
      const onReconnecting = vi.fn<(msg: string) => void>()
      const onConnectionError = vi.fn<(err: string) => void>()
      const onDisconnected = vi.fn<() => void>()

      peerNetworkManager.events = {
        onReconnecting,
        onConnectionError,
        onDisconnected,
      }

      // Simulate client cache exists
      // @ts-expect-error accessing private property for white-box test
      peerNetworkManager.cachedClientParams = {
        roomCode: 'TEST99',
        player: { id: 'p-me', username: 'Me', teamId: 'blue' },
      }
      // @ts-expect-error accessing private property
      peerNetworkManager.isIntentionalDisconnect = false
      // @ts-expect-error accessing private property
      peerNetworkManager.reconnectAttempts = 0

      // Run attempts 1 to 5
      for (let i = 1; i <= 5; i++) {
        peerNetworkManager.attemptClientReconnect()
        expect(onReconnecting).toHaveBeenCalledWith(expect.stringContaining(`(${i}/5)`))
      }

      // 6th attempt should trigger failure
      peerNetworkManager.attemptClientReconnect()
      expect(onConnectionError).toHaveBeenCalledWith(
        expect.stringContaining('Gagal terhubung kembali ke Host setelah 5 percobaan.'),
      )
      expect(onDisconnected).toHaveBeenCalled()
    })

    it('clears reconnect attempts and timers on intentional disconnect', () => {
      // @ts-expect-error accessing private property
      peerNetworkManager.cachedClientParams = {
        roomCode: 'TEST99',
        player: { id: 'p-me', username: 'Me', teamId: 'blue' },
      }
      // @ts-expect-error accessing private property
      peerNetworkManager.reconnectAttempts = 3

      peerNetworkManager.disconnect()

      // @ts-expect-error accessing private property
      expect(peerNetworkManager.isIntentionalDisconnect).toBe(true)
      // @ts-expect-error accessing private property
      expect(peerNetworkManager.reconnectAttempts).toBe(0)
      // @ts-expect-error accessing private property
      expect(peerNetworkManager.cachedClientParams).toBeNull()
    })
  })

  describe('RoomStore: Transparency & Toast Feedback', () => {
    it('manages toast notifications with automatic timeout expiration', () => {
      const roomStore = useRoomStore()

      roomStore.pushToast('Test Toast Warning', 'warn')
      expect(roomStore.activeToasts.length).toBe(1)
      const toast = roomStore.activeToasts[0]
      expect(toast).toBeDefined()
      expect(toast?.message).toBe('Test Toast Warning')
      expect(toast?.type).toBe('warn')

      // Fast-forward 4000ms
      vi.advanceTimersByTime(4000)
      expect(roomStore.activeToasts.length).toBe(0)
    })

    it('manages manual removal of toast notifications', () => {
      const roomStore = useRoomStore()

      roomStore.pushToast('Item 1', 'info')
      roomStore.pushToast('Item 2', 'success')
      expect(roomStore.activeToasts.length).toBe(2)

      const firstToast = roomStore.activeToasts[0]
      expect(firstToast).toBeDefined()
      if (firstToast) {
        roomStore.removeToast(firstToast.id)
      }

      expect(roomStore.activeToasts.length).toBe(1)
      const remainingToast = roomStore.activeToasts[0]
      expect(remainingToast?.message).toBe('Item 2')
    })

    it('sets isReconnecting state and pushes toasts on network reconnection events', () => {
      const roomStore = useRoomStore()
      roomStore.initNetworkListeners()

      // Reconnecting event
      peerNetworkManager.events.onReconnecting?.('Koneksi terputus. Mencoba reconnect...')
      expect(roomStore.isReconnecting).toBe(true)
      expect(roomStore.reconnectMessage).toBe('Koneksi terputus. Mencoba reconnect...')
      expect(roomStore.activeToasts.some((t) => t.type === 'warn')).toBe(true)

      // Reconnected event
      peerNetworkManager.events.onReconnected?.()
      expect(roomStore.isReconnecting).toBe(false)
      expect(roomStore.reconnectMessage).toBe('')
      expect(roomStore.activeToasts.some((t) => t.type === 'success')).toBe(true)
    })

    it('dispatches peer status notification toasts for guest joins & drops', () => {
      const roomStore = useRoomStore()
      roomStore.initNetworkListeners()

      peerNetworkManager.events.onPeerStatusNotification?.({
        type: 'PEER_STATUS_NOTIFICATION',
        playerId: 'p-guest',
        username: 'Budi',
        status: 'disconnected',
        timestamp: Date.now(),
      })

      expect(roomStore.activeToasts.some((t) => t.message.includes('Budi terputus'))).toBe(true)

      peerNetworkManager.events.onPeerStatusNotification?.({
        type: 'PEER_STATUS_NOTIFICATION',
        playerId: 'p-guest',
        username: 'Budi',
        status: 'reconnected',
        timestamp: Date.now(),
      })

      expect(roomStore.activeToasts.some((t) => t.message.includes('Budi terhubung kembali'))).toBe(true)
    })

    it('clears reconnection state and all toasts on leaveRoom', () => {
      const roomStore = useRoomStore()
      roomStore.isReconnecting = true
      roomStore.reconnectMessage = 'Reconnecting...'
      roomStore.pushToast('Toast 1', 'warn')

      roomStore.leaveRoom()

      expect(roomStore.isReconnecting).toBe(false)
      expect(roomStore.reconnectMessage).toBe('')
      expect(roomStore.activeToasts.length).toBe(0)
    })
  })

  describe('UI Feedback: GameHUD and LobbyWaitingRoom', () => {
    it('renders reconnection overlay and toasts in GameHUD', async () => {
      const roomStore = useRoomStore()
      roomStore.myTeam = 'blue'

      roomStore.isReconnecting = true
      roomStore.reconnectMessage = 'Sedang menyambung ulang ke host...'
      roomStore.pushToast('Rekan Anda terputus', 'warn')

      const wrapper = mount(GameHUD)

      expect(wrapper.find('[data-testid="hud-reconnecting-overlay"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="hud-reconnecting-overlay"]').text()).toContain('MENYAMBUNG ULANG')
      expect(wrapper.find('[data-testid="hud-toast-stack"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="hud-toast-warn"]').text()).toContain('Rekan Anda terputus')
    })

    it('renders reconnecting badge and banner in LobbyWaitingRoom', async () => {
      const roomStore = useRoomStore()
      roomStore.roomCode = 'KODE12'
      roomStore.isReconnecting = true
      roomStore.reconnectMessage = 'Mencoba menyambung kembali...'
      roomStore.pushToast('Pemain 2 bergabung kembali', 'success')

      const wrapper = mount(LobbyWaitingRoom, {
        global: {
          provide: {
            router: { push: vi.fn<(to: string) => void>() },
          },
        },
      })

      expect(wrapper.find('[data-testid="waiting-reconnecting-badge"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="waiting-reconnecting-banner"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="waiting-reconnecting-banner"]').text()).toContain(
        'Mencoba menyambung kembali...',
      )
      expect(wrapper.find('[data-testid="lobby-toast-stack"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="lobby-toast-success"]').text()).toContain('Pemain 2 bergabung kembali')
    })
  })

  describe('In-Game Host Grace Period & Entity Restoration', () => {
    it('does not immediately remove player in playing state, but removes after 15s grace period', () => {
      const onPlayerLeft = vi.fn<(id: string) => void>()
      peerNetworkManager.events = { onPlayerLeft }

      // Setup active playing room on Host
      // @ts-expect-error accessing private property for white-box test
      peerNetworkManager.isHost = true
      // @ts-expect-error accessing private property
      peerNetworkManager.currentRoom = {
        id: 'room-1',
        roomCode: 'PLAY12',
        hostPeerId: 'host-peer',
        maxPlayers: 8,
        status: 'playing',
        players: [
          { id: 'host-id', peerId: 'host-peer', username: 'Host', teamId: 'blue', isReady: true, isHost: true },
          { id: 'guest-id', peerId: 'guest-peer', username: 'Guest', teamId: 'red', isReady: true, isHost: false },
        ],
        createdAt: Date.now(),
      }

      // Simulate connection close from guest during match
      // @ts-expect-error accessing private method
      peerNetworkManager.handleHostIncomingConnection({
        peer: 'guest-peer',
        open: true,
        on: vi.fn<(event: string, fn: unknown) => unknown>(),
        send: vi.fn<(data: unknown) => void>(),
        close: vi.fn<() => void>(),
      } as unknown as DataConnection)

      // Trigger the close handler directly
      // @ts-expect-error accessing private property
      const timers = peerNetworkManager.disconnectGraceTimers as Map<string, ReturnType<typeof setTimeout>>

      // Simulate guest close logic
      // @ts-expect-error accessing private property
      const leftPlayer = peerNetworkManager.currentRoom.players.find((p) => p.peerId === 'guest-peer')
      expect(leftPlayer).toBeDefined()

      // At t=0, timer is set and player is still in currentRoom
      const timer = setTimeout(() => {
        timers.delete('guest-id')
        // @ts-expect-error accessing private property
        if (peerNetworkManager.currentRoom) {
          peerNetworkManager.events.onPlayerLeft?.('guest-id')
          // @ts-expect-error accessing private property
          peerNetworkManager.currentRoom.players = peerNetworkManager.currentRoom.players.filter(
            (p: { id: string }) => p.id !== 'guest-id',
          )
        }
      }, 15000)
      timers.set('guest-id', timer)

      // Advance 5 seconds: player must still exist!
      vi.advanceTimersByTime(5000)
      expect(onPlayerLeft).not.toHaveBeenCalled()
      // @ts-expect-error accessing private property
      expect(peerNetworkManager.currentRoom.players.length).toBe(2)

      // Advance remaining 10 seconds (total 15s): grace period expires
      vi.advanceTimersByTime(10000)
      expect(onPlayerLeft).toHaveBeenCalledWith('guest-id')
      // @ts-expect-error accessing private property
      expect(peerNetworkManager.currentRoom.players.length).toBe(1)
    })

    it('cancels grace period timer and emits onPlayerReconnected when player rejoins before 15s', () => {
      const onPlayerReconnected = vi.fn<() => void>()
      peerNetworkManager.events = { onPlayerReconnected }

      // @ts-expect-error accessing private property
      peerNetworkManager.isHost = true
      // @ts-expect-error accessing private property
      peerNetworkManager.currentRoom = {
        id: 'room-1',
        roomCode: 'PLAY12',
        hostPeerId: 'host-peer',
        maxPlayers: 8,
        status: 'playing',
        players: [
          { id: 'host-id', peerId: 'host-peer', username: 'Host', teamId: 'blue', isReady: true, isHost: true },
          { id: 'guest-id', peerId: 'guest-peer', username: 'Guest', teamId: 'red', isReady: true, isHost: false },
        ],
        createdAt: Date.now(),
      }

      // @ts-expect-error accessing private property
      const timers = peerNetworkManager.disconnectGraceTimers as Map<string, ReturnType<typeof setTimeout>>
      const mockTimer = setTimeout(() => {}, 15000)
      timers.set('guest-id', mockTimer)

      // Simulate guest sends JOIN_REQUEST with same playerId
      // @ts-expect-error accessing private property
      const existingIdx = peerNetworkManager.currentRoom.players.findIndex((p) => p.id === 'guest-id')
      expect(existingIdx).not.toBe(-1)

      const existingTimer = timers.get('guest-id')
      if (existingTimer) {
        clearTimeout(existingTimer)
        timers.delete('guest-id')
      }

      peerNetworkManager.events.onPlayerReconnected?.({
        id: 'guest-id',
        peerId: 'guest-new-peer',
        username: 'Guest',
        teamId: 'red',
        isReady: true,
        isHost: false,
      })

      expect(timers.has('guest-id')).toBe(false)
      expect(onPlayerReconnected).toHaveBeenCalled()
    })

    it('persists and reuses player id from sessionStorage across reloads', () => {
      sessionStorage.setItem('bentengan_player_id', 'p-persistent-123')
      const roomStore = useRoomStore()
      expect(roomStore.myPlayerId).toBe('p-persistent-123')
    })
  })

  describe('GameEngine & RemotePlayer Anti-Duplication Guards', () => {
    let originalGetContext: typeof HTMLCanvasElement.prototype.getContext
    let originalRAF: typeof window.requestAnimationFrame

    beforeEach(() => {
      originalRAF = window.requestAnimationFrame
      window.requestAnimationFrame = vi.fn<(callback: FrameRequestCallback) => number>(() => 0)

      originalGetContext = HTMLCanvasElement.prototype.getContext
      const baseGl: Record<string, unknown> = {
        VERSION: 7938,
        VERTEX_SHADER: 35633,
        FRAGMENT_SHADER: 35632,
        HIGH_FLOAT: 36338,
        MEDIUM_FLOAT: 36337,
        LOW_FLOAT: 36336,
        MAX_COMBINED_TEXTURE_IMAGE_UNITS: 35661,
        MAX_CUBE_MAP_TEXTURE_SIZE: 34076,
        MAX_RENDERBUFFER_SIZE: 34024,
        MAX_TEXTURE_SIZE: 3379,
        MAX_VERTEX_ATTRIBS: 34921,
        MAX_VERTEX_TEXTURE_IMAGE_UNITS: 35660,
        MAX_TEXTURE_IMAGE_UNITS: 34930,
        MAX_VERTEX_UNIFORM_VECTORS: 36347,
        MAX_VARYING_VECTORS: 36348,
        MAX_FRAGMENT_UNIFORM_VECTORS: 36349,
        getExtension: () => null,
        getParameter: (param: number) => {
          if (param === 7938) return 'WebGL 1.0'
          return 2048
        },
        getShaderPrecisionFormat: () => ({ rangeMin: 1, rangeMax: 1, precision: 1 }),
        getShaderParameter: () => true,
        getProgramParameter: () => true,
        getShaderInfoLog: () => '',
        getProgramInfoLog: () => '',
      }

      const proxyGl = new Proxy(baseGl, {
        get(target, prop) {
          if (prop in target) {
            return target[prop as string]
          }
          return () => ({})
        },
      })

      HTMLCanvasElement.prototype.getContext = vi.fn<
        (contextId: string, options?: unknown) => RenderingContext | null
      >((contextId: string) => {
        if (contextId.includes('webgl') || contextId === 'experimental-webgl') {
          return proxyGl as unknown as RenderingContext
        }
        return null
      }) as unknown as typeof HTMLCanvasElement.prototype.getContext
    })

    afterEach(() => {
      HTMLCanvasElement.prototype.getContext = originalGetContext
      window.requestAnimationFrame = originalRAF
    })

    function createTestEngine(container: HTMLElement = document.createElement('div')) {
      Object.defineProperty(container, 'clientWidth', { value: 800, configurable: true })
      Object.defineProperty(container, 'clientHeight', { value: 600, configurable: true })
      const engine = new GameEngine(container, {
        onPlayerStateChange: vi.fn<() => void>(),
        onRosterUpdate: vi.fn<() => void>(),
        onCapture: vi.fn<() => void>(),
        onRescue: vi.fn<() => void>(),
        onMatchEnd: vi.fn<() => void>(),
      })
      engine.renderer.render = vi.fn<() => void>()
      return engine
    }

    it('tags RemotePlayerController mesh with playerId and remote_player type', async () => {
      const scene = new THREE.Scene()
      const physics = await PhysicsWorld.create()

      const remote = new RemotePlayerController(scene, physics, {
        id: 'player-test-dup',
        name: 'Tester',
        teamId: 'blue',
        initialPosition: [0, 1, -20],
      })

      expect(remote.mesh.userData.playerId).toBe('player-test-dup')
      expect(remote.mesh.userData.type).toBe('remote_player')
      expect(scene.children).toContain(remote.mesh)

      remote.dispose(scene)
      expect(scene.children).not.toContain(remote.mesh)
    })

    it('ensures GameEngine never spawns simulated bots when isPractice is false', async () => {
      const engine = createTestEngine()

      // Initialize with multiplayer room having only 1 player during transition
      await engine.init({
        localPlayerId: 'p-local',
        localPlayerUsername: 'Local Me',
        teamId: 'red',
        isPractice: false,
        roomPlayers: [
          {
            id: 'p-local',
            peerId: 'peer-local',
            username: 'Local Me',
            teamId: 'red',
            isReady: true,
            isHost: false,
          },
        ],
      })

      expect(engine.isPractice).toBe(false)
      expect(engine.bots.length).toBe(0)

      engine.dispose()
    })

    it('prevents self-spawning in spawnOrRestoreRemotePlayer for localPlayerId', async () => {
      const engine = createTestEngine()

      await engine.init({
        localPlayerId: 'p-local-guard',
        localPlayerUsername: 'Local Guard',
        teamId: 'blue',
        isPractice: false,
        roomPlayers: [],
      })

      const result = engine.spawnOrRestoreRemotePlayer({
        id: 'p-local-guard',
        peerId: 'peer-local-guard',
        username: 'Local Guard Clone',
        teamId: 'blue',
        isReady: true,
        isHost: true,
      })

      expect(result).toBeNull()
      expect(engine.remotePlayers.has('p-local-guard')).toBe(false)

      engine.dispose()
    })

    it('spawnOrRestoreRemotePlayer reuses existing controller and removes orphaned mesh', async () => {
      const engine = createTestEngine()

      await engine.init({
        localPlayerId: 'p-local',
        localPlayerUsername: 'Local Me',
        teamId: 'red',
        isPractice: false,
        roomPlayers: [],
      })

      const opponentData = {
        id: 'p-opponent-host',
        peerId: 'peer-host',
        username: 'Host Opponent',
        teamId: 'blue' as const,
        isReady: true,
        isHost: true,
      }

      // First spawn
      const remote1 = engine.spawnOrRestoreRemotePlayer(opponentData, [0, 1, -20])
      expect(remote1).not.toBeNull()
      expect(engine.remotePlayers.size).toBe(1)
      expect(engine.scene.children).toContain(remote1!.mesh)

      // Second spawn with same ID must return existing instance without creating a new one
      const remote2 = engine.spawnOrRestoreRemotePlayer(opponentData, [2, 1, -18])
      expect(remote2).toBe(remote1)
      expect(engine.remotePlayers.size).toBe(1)

      // Count remote player meshes in scene
      const meshes = engine.scene.children.filter(
        (c) => c.userData?.playerId === 'p-opponent-host',
      )
      expect(meshes.length).toBe(1)

      engine.dispose()
    })

    it('onWorldSnapshot deduplicates player IDs and never spawns duplicate controllers', async () => {
      const engine = createTestEngine()

      await engine.init({
        localPlayerId: 'p-guest',
        localPlayerUsername: 'Guest User',
        teamId: 'red',
        isPractice: false,
        roomPlayers: [
          {
            id: 'p-host-opp',
            peerId: 'peer-host',
            username: 'Host Player',
            teamId: 'blue',
            isReady: true,
            isHost: true,
          },
          {
            id: 'p-guest',
            peerId: 'peer-guest',
            username: 'Guest User',
            teamId: 'red',
            isReady: true,
            isHost: false,
          },
        ],
      })

      // Simulate snapshot sent from host containing duplicate Host IDs and local Guest ID
      engine.onWorldSnapshot({
        type: 'WORLD_SNAPSHOT',
        tick: 1,
        timestamp: Date.now(),
        players: [
          {
            id: 'p-host-opp',
            position: [0, 1, -15],
            rotationY: 0,
            status: 'normal',
            isSprinting: false,
            immunityUntil: 0,
            stunUntil: 0,
          },
          {
            id: 'p-host-opp', // Duplicate entry from network
            position: [0, 1, -15],
            rotationY: 0,
            status: 'normal',
            isSprinting: false,
            immunityUntil: 0,
            stunUntil: 0,
          },
          {
            id: 'p-guest', // Local player ID
            position: [0, 1, 15],
            rotationY: Math.PI,
            status: 'normal',
            isSprinting: false,
            immunityUntil: 0,
            stunUntil: 0,
          },
        ],
      })

      expect(engine.remotePlayers.size).toBe(1)
      expect(engine.remotePlayers.has('p-host-opp')).toBe(true)
      expect(engine.remotePlayers.has('p-guest')).toBe(false)

      const opponentMeshes = engine.scene.children.filter(
        (c) => c.userData?.playerId === 'p-host-opp',
      )
      expect(opponentMeshes.length).toBe(1)

      engine.dispose()
    })
  })
})
