import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useRoomStore } from '../stores/room-store'
import { useGameStore } from '../stores/game-store'
import { isMatchStartable } from '../game/network/network-protocol'
import { peerNetworkManager } from '../game/network/peer-network-manager'
import * as THREE from 'three'
import { PhysicsWorld } from '../game/physics/physics-world'
import { RemotePlayerController } from '../game/entities/remote-player-controller'
import type { RoomPlayer } from '../types/game.types'

function createRoster(blueCount: number, redCount: number, allReady = true): RoomPlayer[] {
  const players: RoomPlayer[] = []
  for (let i = 0; i < blueCount; i++) {
    players.push({
      id: `b-${i}`,
      peerId: `peer-b-${i}`,
      username: `Blue ${i + 1}`,
      teamId: 'blue',
      isReady: allReady,
      isHost: i === 0,
    })
  }
  for (let i = 0; i < redCount; i++) {
    players.push({
      id: `r-${i}`,
      peerId: `peer-r-${i}`,
      username: `Red ${i + 1}`,
      teamId: 'red',
      isReady: allReady,
      isHost: false,
    })
  }
  return players
}

describe('Milestone 5 — Scale, Edge Cases & Stabilization', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
  })

  describe('Roster Scaling (4v4 & 6v6)', () => {
    it('validates 4 vs 4 full roster (8 players) as startable', () => {
      const roster4v4 = createRoster(4, 4, true)
      expect(roster4v4.length).toBe(8)

      const check = isMatchStartable(roster4v4)
      expect(check.startable).toBe(true)
      expect(check.reason).toBeUndefined()
    })

    it('validates 6 vs 6 full roster (12 players) as startable', () => {
      const roster6v6 = createRoster(6, 6, true)
      expect(roster6v6.length).toBe(12)

      const check = isMatchStartable(roster6v6)
      expect(check.startable).toBe(true)
      expect(check.reason).toBeUndefined()
    })

    it('rejects unbalanced rosters (e.g. 5 vs 4) with friendly Indonesian reason', () => {
      const unbalanced = createRoster(5, 4, true)
      const check = isMatchStartable(unbalanced)

      expect(check.startable).toBe(false)
      expect(check.reason).toContain('harus seimbang')
      expect(check.reason).toContain('Biru: 5, Merah: 4')
    })

    it('rejects rosters where players are not ready', () => {
      const roster = createRoster(4, 4, false)
      const check = isMatchStartable(roster)

      expect(check.startable).toBe(false)
      expect(check.reason).toContain('belum menekan tombol Siap')
    })
  })

  describe('Host Disconnection Handling', () => {
    it('sets matchResult with host_disconnect and finishes game when host disconnects mid-match', () => {
      const roomStore = useRoomStore()
      const gameStore = useGameStore()

      roomStore.initNetworkListeners()
      roomStore.status = 'playing'
      roomStore.isHost = false
      roomStore.roomCode = 'TEST12'

      expect(roomStore.status).toBe('playing')

      // Trigger network onDisconnected callback while playing
      peerNetworkManager.events.onDisconnected?.()

      expect(roomStore.status).toBe('finished')
      expect(gameStore.matchResult?.reason).toBe('host_disconnect')
      expect(gameStore.matchResult?.winner).toBeNull()
      expect(roomStore.connectionError).toContain('Tuan rumah (Host) telah keluar')
    })
  })

  describe('Mid-Game Remote Player Removal', () => {
    it('cleanly disposes and removes remote player from scene and map when leaving', async () => {
      const scene = new THREE.Scene()
      const physics = await PhysicsWorld.create()

      const remotePlayers = new Map<string, RemotePlayerController>()
      const remote = new RemotePlayerController(scene, physics, {
        id: 'enemy-1',
        name: 'Enemy 1',
        teamId: 'red',
        initialPosition: [0, 1, 20],
      })
      remotePlayers.set('enemy-1', remote)

      expect(remotePlayers.size).toBe(1)
      expect(scene.children).toContain(remote.mesh)

      // Simulate removeRemotePlayer
      const playerToRemove = remotePlayers.get('enemy-1')
      if (playerToRemove) {
        playerToRemove.dispose(scene)
        remotePlayers.delete('enemy-1')
      }

      expect(remotePlayers.size).toBe(0)
      expect(scene.children).not.toContain(remote.mesh)
    })
  })
})
