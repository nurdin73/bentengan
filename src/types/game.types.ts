export type TeamId = 'blue' | 'red'

export type PlayerStatus = 'normal' | 'stunned' | 'jailed'

export interface MovementInput {
  forward: boolean
  backward: boolean
  left: boolean
  right: boolean
  sprint: boolean
  jump: boolean
  interact: boolean
  cameraYaw: number
}

export interface GameplayEntity {
  id: string
  name: string
  teamId: TeamId
  status: PlayerStatus
  immunityUntil: number
  rescueCooldownUntil?: number
  isGodMode?: boolean
  isFrozen?: boolean
  getPosition(): { x: number; y: number; z: number }
  teleportTo(x: number, y: number, z: number): void
}

export interface PlayerTransform {
  position: [number, number, number]
  velocity: [number, number, number]
  rotation: number
}

export interface PlayerState {
  id: string
  peerId: string
  username: string
  teamId: TeamId

  position: [number, number, number]
  velocity: [number, number, number]
  rotation: number

  status: PlayerStatus

  stamina: number
  isSprinting: boolean
  isGrounded: boolean

  immunityUntil: number
  stunUntil: number
  rescueCooldownUntil?: number

  capturedBy: string | null
}

export type RoomStatus = 'waiting' | 'starting' | 'playing' | 'finished'
export type RoomPrivacy = 'public' | 'private'

export interface RoomPlayer {
  id: string
  peerId: string
  username: string
  teamId: TeamId
  isReady: boolean
  isHost: boolean
}

export interface Room {
  id: string
  roomCode: string
  hostPeerId: string
  maxPlayers: 8 | 12
  status: RoomStatus
  players: RoomPlayer[]
  createdAt: number
  matchDurationSec?: number
  privacy?: RoomPrivacy
}

export type MatchEndReason = 'base_capture' | 'team_elimination' | 'host_disconnect' | 'timeout'

export interface MatchPlayerStats {
  playerId: string
  teamId: TeamId
  captures: number
  rescues: number
  timesCaptured: number
}

export interface MatchResult {
  matchId: string
  winner: TeamId | null
  reason: MatchEndReason
  duration: number
  players: MatchPlayerStats[]
}
