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
  outfitId: z.number().int().min(1).max(6).optional(),
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
  outfitId: z.number().int().min(1).max(6).optional(),
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

// Client -> Host (or Host -> All): Player selected outfit
export const SetOutfitMessageSchema = z.object({
  type: z.literal('SET_OUTFIT'),
  playerId: z.string(),
  outfitId: z.number().int().min(1).max(6),
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

// In-Game Real-Time Synchronization Schemas (20 Hz per PRD Section 11.4)
export const PlayerStatusSchema = z.enum(['normal', 'stunned', 'jailed'])

export const PlayerNetworkStateSchema = z.object({
  id: z.string(),
  position: z.tuple([z.number(), z.number(), z.number()]),
  rotationY: z.number(),
  velocity: z.tuple([z.number(), z.number(), z.number()]).optional(),
  status: PlayerStatusSchema,
  isSprinting: z.boolean(),
  immunityUntil: z.number(),
  stunUntil: z.number(),
})

export const PlayerUpdateMessageSchema = z.object({
  type: z.literal('PLAYER_UPDATE'),
  playerId: z.string(),
  state: PlayerNetworkStateSchema,
})

export const WorldSnapshotMessageSchema = z.object({
  type: z.literal('WORLD_SNAPSHOT'),
  tick: z.number(),
  timestamp: z.number(),
  players: z.array(PlayerNetworkStateSchema),
})

export const GameEventMessageSchema = z.object({
  type: z.literal('GAME_EVENT'),
  event: z.enum(['capture', 'rescue', 'base_capture', 'match_end', 'smoke']),
  winner: TeamIdSchema.optional(),
  reason: z.enum(['base_capture', 'team_elimination', 'host_disconnect']).optional(),
  sourceId: z.string().optional(),
  targetId: z.string().optional(),
  position: z.tuple([z.number(), z.number(), z.number()]).optional(),
  radius: z.number().optional(),
  durationMs: z.number().optional(),
  timestamp: z.number(),
})

export const PeerStatusNotificationSchema = z.object({
  type: z.literal('PEER_STATUS_NOTIFICATION'),
  playerId: z.string(),
  username: z.string(),
  status: z.enum(['disconnected', 'reconnected', 'left']),
  timestamp: z.number(),
})

export const NetworkMessageSchema = z.discriminatedUnion('type', [
  JoinRequestMessageSchema,
  JoinResponseMessageSchema,
  RoomStateSyncMessageSchema,
  SetTeamMessageSchema,
  SetReadyMessageSchema,
  SetOutfitMessageSchema,
  MatchStartMessageSchema,
  PingMessageSchema,
  PongMessageSchema,
  PlayerUpdateMessageSchema,
  WorldSnapshotMessageSchema,
  GameEventMessageSchema,
  PeerStatusNotificationSchema,
])

export type NetworkMessage = z.infer<typeof NetworkMessageSchema>
export type JoinRequestMessage = z.infer<typeof JoinRequestMessageSchema>
export type JoinResponseMessage = z.infer<typeof JoinResponseMessageSchema>
export type RoomStateSyncMessage = z.infer<typeof RoomStateSyncMessageSchema>
export type SetTeamMessage = z.infer<typeof SetTeamMessageSchema>
export type SetReadyMessage = z.infer<typeof SetReadyMessageSchema>
export type SetOutfitMessage = z.infer<typeof SetOutfitMessageSchema>
export type MatchStartMessage = z.infer<typeof MatchStartMessageSchema>
export type PingMessage = z.infer<typeof PingMessageSchema>
export type PongMessage = z.infer<typeof PongMessageSchema>
export type PlayerNetworkState = z.infer<typeof PlayerNetworkStateSchema>
export type PlayerUpdateMessage = z.infer<typeof PlayerUpdateMessageSchema>
export type WorldSnapshotMessage = z.infer<typeof WorldSnapshotMessageSchema>
export type GameEventMessage = z.infer<typeof GameEventMessageSchema>
export type PeerStatusNotification = z.infer<typeof PeerStatusNotificationSchema>

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
    return { startable: false, reason: 'Belum ada pemain di dalam ruangan.' }
  }

  const blueCount = players.filter((p) => p.teamId === 'blue').length
  const redCount = players.filter((p) => p.teamId === 'red').length

  if (blueCount === 0 || redCount === 0) {
    return {
      startable: false,
      reason: 'Setiap benteng (Biru & Merah) harus ada penjaganya dulu ya!',
    }
  }

  if (blueCount !== redCount) {
    return {
      startable: false,
      reason: `Jumlah anggota tim harus seimbang (Biru: ${blueCount}, Merah: ${redCount}) biar adil!`,
    }
  }

  const unreadyPlayers = players.filter((p) => !p.isReady)
  if (unreadyPlayers.length > 0) {
    return {
      startable: false,
      reason: `Masih ada ${unreadyPlayers.length} teman yang belum menekan tombol Siap!`,
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
