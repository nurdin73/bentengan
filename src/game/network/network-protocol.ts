import { z } from 'zod'
import type { RoomPlayer } from '../../types/game.types'

export const TeamIdSchema = z.enum(['blue', 'red'])

export const RoomPlayerSchema = z.object({
  id: z.string(),
  peerId: z.string(),
  username: z.string().min(1).max(20),
  teamId: TeamIdSchema,
  isReady: z.boolean(),
  isHost: z.boolean(),
})

export const RoomStatusSchema = z.enum(['waiting', 'starting', 'playing', 'finished'])

export const RoomSchema = z.object({
  id: z.string(),
  roomCode: z.string(),
  hostPeerId: z.string(),
  maxPlayers: z.union([z.literal(8), z.literal(12)]),
  status: RoomStatusSchema,
  players: z.array(RoomPlayerSchema),
  createdAt: z.number(),
})

// Client -> Host: Request to join room
export const JoinRequestMessageSchema = z.object({
  type: z.literal('JOIN_REQUEST'),
  playerId: z.string(),
  username: z.string().min(1).max(20),
  teamId: TeamIdSchema,
})

// Host -> Client: Acknowledge join
export const JoinResponseMessageSchema = z.object({
  type: z.literal('JOIN_RESPONSE'),
  accepted: z.boolean(),
  room: RoomSchema.optional(),
  reason: z.string().optional(),
})

// Host -> All Clients: Synchronize full room state
export const RoomStateSyncMessageSchema = z.object({
  type: z.literal('ROOM_STATE_SYNC'),
  room: RoomSchema,
})

// Client -> Host (or Host -> All): Player switched team
export const SetTeamMessageSchema = z.object({
  type: z.literal('SET_TEAM'),
  playerId: z.string(),
  teamId: TeamIdSchema,
})

// Client -> Host (or Host -> All): Player ready state toggle
export const SetReadyMessageSchema = z.object({
  type: z.literal('SET_READY'),
  playerId: z.string(),
  isReady: z.boolean(),
})

// Host -> All Clients: Start countdown / enter match
export const MatchStartMessageSchema = z.object({
  type: z.literal('MATCH_START'),
  startTime: z.number(),
})

// Heartbeat & Latency Measurement
export const PingMessageSchema = z.object({
  type: z.literal('PING'),
  timestamp: z.number(),
})

export const PongMessageSchema = z.object({
  type: z.literal('PONG'),
  timestamp: z.number(),
})

export const NetworkMessageSchema = z.discriminatedUnion('type', [
  JoinRequestMessageSchema,
  JoinResponseMessageSchema,
  RoomStateSyncMessageSchema,
  SetTeamMessageSchema,
  SetReadyMessageSchema,
  MatchStartMessageSchema,
  PingMessageSchema,
  PongMessageSchema,
])

export type NetworkMessage = z.infer<typeof NetworkMessageSchema>
export type JoinRequestMessage = z.infer<typeof JoinRequestMessageSchema>
export type JoinResponseMessage = z.infer<typeof JoinResponseMessageSchema>
export type RoomStateSyncMessage = z.infer<typeof RoomStateSyncMessageSchema>
export type SetTeamMessage = z.infer<typeof SetTeamMessageSchema>
export type SetReadyMessage = z.infer<typeof SetReadyMessageSchema>
export type MatchStartMessage = z.infer<typeof MatchStartMessageSchema>
export type PingMessage = z.infer<typeof PingMessageSchema>
export type PongMessage = z.infer<typeof PongMessageSchema>

/**
 * Validates whether the incoming payload matches the network protocol schema.
 */
export function parseNetworkMessage(raw: unknown): NetworkMessage | null {
  const result = NetworkMessageSchema.safeParse(raw)
  if (result.success) {
    return result.data
  }
  return null
}

/**
 * Validates if teams are balanced and ready to start.
 * Rules:
 * 1. At least 1 player per team.
 * 2. Team sizes must be equal (N_blue == N_red).
 * 3. All non-host and host players must be ready.
 */
export function isMatchStartable(players: RoomPlayer[]): {
  startable: boolean
  reason?: string
} {
  if (players.length === 0) {
    return { startable: false, reason: 'Tidak ada pemain di dalam room.' }
  }

  const blueCount = players.filter((p) => p.teamId === 'blue').length
  const redCount = players.filter((p) => p.teamId === 'red').length

  if (blueCount === 0 || redCount === 0) {
    return {
      startable: false,
      reason: 'Kedua tim (Biru & Merah) wajib memiliki minimal 1 pemain.',
    }
  }

  if (blueCount !== redCount) {
    return {
      startable: false,
      reason: `Jumlah pemain belum seimbang (Biru: ${blueCount}, Merah: ${redCount}).`,
    }
  }

  const unreadyPlayers = players.filter((p) => !p.isReady)
  if (unreadyPlayers.length > 0) {
    return {
      startable: false,
      reason: `${unreadyPlayers.length} pemain belum siap (Ready).`,
    }
  }

  return { startable: true }
}

/**
 * Generates a normalized room peer ID for PeerJS.
 */
export function getHostPeerId(roomCode: string): string {
  return `bentengan-${roomCode.trim().toUpperCase()}-host`
}

export function getClientPeerId(roomCode: string, playerId: string): string {
  return `bentengan-${roomCode.trim().toUpperCase()}-${playerId.trim()}`
}
