import { describe, it, expect } from 'vitest'
import {
  parseNetworkMessage,
  isMatchStartable,
  getHostPeerId,
  getClientPeerId,
  type NetworkMessage,
} from '../game/network/network-protocol'
import type { RoomPlayer } from '../types/game.types'

describe('Network Protocol & Schemas', () => {
  it('parses valid JOIN_REQUEST message', () => {
    const raw = {
      type: 'JOIN_REQUEST',
      playerId: 'p-123',
      username: 'Garuda',
      teamId: 'blue',
    }

    const parsed = parseNetworkMessage(raw)
    expect(parsed).toEqual(raw)
  })

  it('parses valid SET_TEAM message', () => {
    const raw = {
      type: 'SET_TEAM',
      playerId: 'p-123',
      teamId: 'red',
    }

    const parsed = parseNetworkMessage(raw)
    expect(parsed).not.toBeNull()
    expect(parsed?.type).toBe('SET_TEAM')
  })

  it('parses valid SET_READY message', () => {
    const raw = {
      type: 'SET_READY',
      playerId: 'p-123',
      isReady: true,
    }

    const parsed = parseNetworkMessage(raw)
    expect(parsed).not.toBeNull()
    expect(parsed?.type).toBe('SET_READY')
  })

  it('parses valid MATCH_START message', () => {
    const raw = {
      type: 'MATCH_START',
      startTime: 1700000000000,
    }

    const parsed = parseNetworkMessage(raw)
    expect(parsed).not.toBeNull()
    expect(parsed?.type).toBe('MATCH_START')
  })

  it('parses valid PING and PONG messages', () => {
    const pingRaw: NetworkMessage = { type: 'PING', timestamp: 12345 }
    const pongRaw: NetworkMessage = { type: 'PONG', timestamp: 12345 }

    expect(parseNetworkMessage(pingRaw)).toEqual(pingRaw)
    expect(parseNetworkMessage(pongRaw)).toEqual(pongRaw)
  })

  it('rejects invalid message formats and unknown types', () => {
    expect(parseNetworkMessage(null)).toBeNull()
    expect(parseNetworkMessage({})).toBeNull()
    expect(parseNetworkMessage({ type: 'UNKNOWN_TYPE' })).toBeNull()
    expect(
      parseNetworkMessage({
        type: 'SET_TEAM',
        playerId: 'p-1',
        teamId: 'invalid-team',
      }),
    ).toBeNull()
  })

  it('generates consistent normalized peer IDs', () => {
    expect(getHostPeerId('kera7')).toBe('bentengan-KERA7-host')
    expect(getClientPeerId('kera7', 'player-99')).toBe('bentengan-KERA7-player-99')
  })
})

describe('Team Balance & Match Start Validation', () => {
  const createPlayer = (
    id: string,
    teamId: 'blue' | 'red',
    isReady: boolean,
    isHost = false,
  ): RoomPlayer => ({
    id,
    peerId: `peer-${id}`,
    username: `User-${id}`,
    teamId,
    isReady,
    isHost,
  })

  it('disallows starting when room has zero players', () => {
    const res = isMatchStartable([])
    expect(res.startable).toBe(false)
    expect(res.reason).toContain('Belum ada pemain')
  })

  it('disallows starting when one team has zero players', () => {
    const players: RoomPlayer[] = [
      createPlayer('p1', 'blue', true, true),
      createPlayer('p2', 'blue', true, false),
    ]

    const res = isMatchStartable(players)
    expect(res.startable).toBe(false)
    expect(res.reason).toContain('Setiap benteng (Biru & Merah) harus ada penjaganya')
  })

  it('disallows starting when player counts are uneven (e.g. 2v1)', () => {
    const players: RoomPlayer[] = [
      createPlayer('p1', 'blue', true, true),
      createPlayer('p2', 'blue', true, false),
      createPlayer('p3', 'red', true, false),
    ]

    const res = isMatchStartable(players)
    expect(res.startable).toBe(false)
    expect(res.reason).toContain('harus seimbang')
  })

  it('disallows starting when any player is not ready', () => {
    const players: RoomPlayer[] = [
      createPlayer('p1', 'blue', true, true),
      createPlayer('p2', 'red', false, false),
    ]

    const res = isMatchStartable(players)
    expect(res.startable).toBe(false)
    expect(res.reason).toContain('belum menekan tombol Siap')
  })

  it('allows starting when teams are balanced (1v1) and all are ready', () => {
    const players: RoomPlayer[] = [
      createPlayer('p1', 'blue', true, true),
      createPlayer('p2', 'red', true, false),
    ]

    const res = isMatchStartable(players)
    expect(res.startable).toBe(true)
    expect(res.reason).toBeUndefined()
  })

  it('allows starting for 2v2 balanced and all ready', () => {
    const players: RoomPlayer[] = [
      createPlayer('p1', 'blue', true, true),
      createPlayer('p2', 'blue', true, false),
      createPlayer('p3', 'red', true, false),
      createPlayer('p4', 'red', true, false),
    ]

    const res = isMatchStartable(players)
    expect(res.startable).toBe(true)
  })
})
