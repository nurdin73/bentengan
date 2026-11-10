import { describe, it, expect, beforeEach } from 'vitest'
import * as THREE from 'three'
import { PhysicsWorld } from '../game/physics/physics-world'
import { RemotePlayerController } from '../game/entities/remote-player-controller'
import { GameplayRules } from '../game/systems/gameplay-rules'
import {
  parseNetworkMessage,
  type PlayerNetworkState,
  type PlayerUpdateMessage,
  type WorldSnapshotMessage,
  type GameEventMessage,
} from '../game/network/network-protocol'

describe('Multiplayer Gameplay Real-Time Synchronization', () => {
  let scene: THREE.Scene
  let physics: PhysicsWorld

  beforeEach(async () => {
    scene = new THREE.Scene()
    physics = await PhysicsWorld.create()
  })

  it('validates PlayerUpdateMessage schema correctly', () => {
    const rawUpdate: PlayerUpdateMessage = {
      type: 'PLAYER_UPDATE',
      playerId: 'player-1',
      state: {
        id: 'player-1',
        position: [5, 1, -10],
        rotationY: Math.PI / 2,
        status: 'normal',
        isSprinting: true,
        immunityUntil: 0,
        stunUntil: 0,
      },
    }

    const parsed = parseNetworkMessage(rawUpdate)
    expect(parsed).not.toBeNull()
    expect(parsed?.type).toBe('PLAYER_UPDATE')
    const update = parsed as PlayerUpdateMessage
    expect(update.state.position).toEqual([5, 1, -10])
    expect(update.state.isSprinting).toBe(true)
  })

  it('validates WorldSnapshotMessage schema correctly', () => {
    const p1State: PlayerNetworkState = {
      id: 'p1',
      position: [0, 1, -20],
      rotationY: 0,
      status: 'normal',
      isSprinting: false,
      immunityUntil: 0,
      stunUntil: 0,
    }
    const p2State: PlayerNetworkState = {
      id: 'p2',
      position: [0, 1, 20],
      rotationY: Math.PI,
      status: 'jailed',
      isSprinting: false,
      immunityUntil: 5000,
      stunUntil: 0,
    }

    const rawSnapshot: WorldSnapshotMessage = {
      type: 'WORLD_SNAPSHOT',
      tick: 42,
      timestamp: Date.now(),
      players: [p1State, p2State],
    }

    const parsed = parseNetworkMessage(rawSnapshot)
    expect(parsed).not.toBeNull()
    expect(parsed?.type).toBe('WORLD_SNAPSHOT')
    const snapshot = parsed as WorldSnapshotMessage
    expect(snapshot.players.length).toBe(2)
    expect(snapshot.players[1]!.status).toBe('jailed')
  })

  it('validates GameEventMessage schema correctly', () => {
    const rawEvent: GameEventMessage = {
      type: 'GAME_EVENT',
      event: 'capture',
      sourceId: 'Alice',
      targetId: 'Bob',
      timestamp: Date.now(),
    }

    const parsed = parseNetworkMessage(rawEvent)
    expect(parsed).not.toBeNull()
    expect(parsed?.type).toBe('GAME_EVENT')
    const event = parsed as GameEventMessage
    expect(event.event).toBe('capture')
    expect(event.targetId).toBe('Bob')
  })

  it('spawns RemotePlayerController with 3D mesh, kinematic collider, and overhead billboard', () => {
    const remote = new RemotePlayerController(scene, physics, {
      id: 'remote-1',
      name: 'Bob',
      teamId: 'red',
      initialPosition: [0, 1, 20],
    })

    expect(remote.id).toBe('remote-1')
    expect(remote.name).toBe('Bob')
    expect(remote.teamId).toBe('red')
    expect(remote.status).toBe('normal')

    const pos = remote.getPosition()
    expect(pos.x).toBe(0)
    expect(pos.z).toBe(20)

    // Verify Three.js scene hierarchy has mesh and billboard
    expect(scene.children).toContain(remote.mesh)

    // Verify kinematic body is tracked in Rapier
    expect(remote.body.isKinematic()).toBe(true)

    remote.dispose(scene)
    expect(scene.children).not.toContain(remote.mesh)
  })

  it('smoothly interpolates remote player position and updates kinematic collider', () => {
    const remote = new RemotePlayerController(scene, physics, {
      id: 'remote-1',
      name: 'Bob',
      teamId: 'red',
      initialPosition: [0, 1, 20],
    })

    // Remote receives new target transform from network snapshot
    remote.setTargetTransform([5, 1, 15], Math.PI / 4, 'normal', true)
    remote.updateInterpolation(0.05, 1000)

    const pos = remote.getPosition()
    // Position should have moved towards target (0 -> 5, 20 -> 15)
    expect(pos.x).toBeGreaterThan(0)
    expect(pos.z).toBeLessThan(20)

    remote.dispose(scene)
  })

  it('allows GameplayRules to interact with RemotePlayerController as GameplayEntity', () => {
    const remoteBlue = new RemotePlayerController(scene, physics, {
      id: 'blue-1',
      name: 'Alice',
      teamId: 'blue',
      initialPosition: [0, 1, -15],
    })

    const remoteRed = new RemotePlayerController(scene, physics, {
      id: 'red-1',
      name: 'Bob',
      teamId: 'red',
      initialPosition: [0, 1, -15], // Bob in blue territory!
    })

    const now = 1000

    // Bob is in Blue territory (Z < 0) and in close proximity to Alice (hunter)
    expect(GameplayRules.isInEnemyTerritory(remoteRed)).toBe(true)
    const canCatch = GameplayRules.canCapture(remoteBlue, remoteRed, now)
    expect(canCatch).toBe(true)

    // Capture Bob and teleport to blue territory jail
    remoteRed.status = 'jailed'
    remoteRed.teleportTo(12, 1, -12)

    expect(remoteRed.status).toBe('jailed')
    expect(remoteRed.getPosition().x).toBe(12)
    expect(remoteRed.getPosition().z).toBe(-12)

    remoteBlue.dispose(scene)
    remoteRed.dispose(scene)
  })

  it('displays orbiting stun stars when remote player is stunned', () => {
    const remote = new RemotePlayerController(scene, physics, {
      id: 'remote-stun-test',
      name: 'Bob',
      teamId: 'red',
      initialPosition: [0, 1, 20],
    })

    expect(remote.stunStarsGroup.visible).toBe(false)

    // Receive stunned state
    remote.setTargetTransform([0, 1, 20], 0, 'stunned', false, 0, 5000)
    remote.updateInterpolation(0.05, 1000)

    expect(remote.stunStarsGroup.visible).toBe(true)

    // Return to normal
    remote.setTargetTransform([0, 1, 20], 0, 'normal', false, 0, 0)
    remote.updateInterpolation(0.05, 6000)

    expect(remote.stunStarsGroup.visible).toBe(false)

    remote.dispose(scene)
  })

  it('correctly parses and serializes network smoke game events with coordinates', () => {
    const rawSmokeEvent: GameEventMessage = {
      type: 'GAME_EVENT',
      event: 'smoke',
      sourceId: 'remote-player-123',
      position: [8.5, 0.5, -12.0],
      radius: 7.0,
      durationMs: 3000,
      timestamp: Date.now(),
    }

    const parsed = parseNetworkMessage(rawSmokeEvent)
    expect(parsed).not.toBeNull()
    expect(parsed?.type).toBe('GAME_EVENT')
    const event = parsed as GameEventMessage
    expect(event.event).toBe('smoke')
    expect(event.sourceId).toBe('remote-player-123')
    expect(event.position).toEqual([8.5, 0.5, -12.0])
    expect(event.radius).toBe(7.0)
    expect(event.durationMs).toBe(3000)
  })

  it('synchronizes immunity duration across peers with different epoch timestamps', () => {
    const remote = new RemotePlayerController(scene, physics, {
      id: 'remote-immune-test',
      name: 'Charlie',
      teamId: 'blue',
      initialPosition: [0, 1, 0],
    })

    // Peer A had 3000ms remaining immunity and sent it over the network
    const remainingImmunityMs = 3000
    // Peer B has an arbitrary local performance.now() of 150000ms
    const peerBLocalNow = 150000

    // Receiver reconstructs local immunity timestamp: localNow + remaining
    const reconstructedImmunityUntil = peerBLocalNow + remainingImmunityMs
    remote.setTargetTransform([0, 1, 0], 0, 'normal', false, reconstructedImmunityUntil)

    // At peerBLocalNow + 1000 (2000ms left), player is immune
    remote.updateInterpolation(0.016, peerBLocalNow + 1000)
    expect(peerBLocalNow + 1000 < remote.immunityUntil).toBe(true)

    // At peerBLocalNow + 3500, immunity has expired
    remote.updateInterpolation(0.016, peerBLocalNow + 3500)
    expect(peerBLocalNow + 3500 < remote.immunityUntil).toBe(false)

    remote.dispose(scene)
  })

  it('applies procedural forward tilt when remote player is sprinting and moving', () => {
    const remote = new RemotePlayerController(scene, physics, {
      id: 'remote-sprint-tilt',
      name: 'Diana',
      teamId: 'red',
      initialPosition: [0, 1, 0],
    })

    // Target is moving forward and sprinting
    remote.setTargetTransform([0, 1, 10], 0, 'normal', true)
    remote.updateInterpolation(0.1, 1000)

    // Find body mesh child to verify tilt
    const bodyMesh = remote.mesh.children.find(
      (c) => c instanceof THREE.Mesh && c.geometry.type === 'CapsuleGeometry',
    ) as THREE.Mesh | undefined

    expect(bodyMesh).toBeDefined()
    expect(bodyMesh?.rotation.x).toBeGreaterThan(0.05)

    remote.dispose(scene)
  })

  it('validates MATCH_START message with custom durationLimitSec', () => {
    const rawMsg = {
      type: 'MATCH_START',
      startTime: 1700000000000,
      durationLimitSec: 300,
    }
    const parsed = parseNetworkMessage(rawMsg)
    expect(parsed).not.toBeNull()
    expect(parsed?.type).toBe('MATCH_START')
    expect((parsed as unknown as { durationLimitSec: number }).durationLimitSec).toBe(300)
  })

  it('validates GAME_EVENT timeout match_end with draw (null winner)', () => {
    const drawEvent: GameEventMessage = {
      type: 'GAME_EVENT',
      event: 'match_end',
      winner: null,
      reason: 'timeout',
      timestamp: Date.now(),
    }
    const parsed = parseNetworkMessage(drawEvent)
    expect(parsed).not.toBeNull()
    expect(parsed?.type).toBe('GAME_EVENT')
    const event = parsed as GameEventMessage
    expect(event.event).toBe('match_end')
    expect(event.winner).toBeNull()
    expect(event.reason).toBe('timeout')
  })
})
