import { Peer, type DataConnection } from 'peerjs'
import type { Room, RoomPlayer, TeamId } from '../../types/game.types'
import {
  getHostPeerId,
  getClientPeerId,
  parseNetworkMessage,
  type NetworkMessage,
  isMatchStartable,
} from './network-protocol'

export interface PeerNetworkEvents {
  onRoomStateUpdated: (room: Room) => void
  onMatchStarted: (startTime: number) => void
  onConnectionError: (errorMsg: string) => void
  onDisconnected: () => void
  onLatencyUpdated: (latencyMs: number) => void
}

export class PeerNetworkManager {
  private peer: Peer | null = null
  private hostConnection: DataConnection | null = null
  private clientConnections = new Map<string, DataConnection>()
  private pingIntervalId: ReturnType<typeof setInterval> | null = null

  private currentRoom: Room | null = null
  private localPlayerId = ''
  private isHost = false

  public events: Partial<PeerNetworkEvents> = {}

  public get room(): Room | null {
    return this.currentRoom
  }

  public get isConnected(): boolean {
    return this.peer !== null && !this.peer.disconnected
  }

  /**
   * Initializes host room on PeerJS Cloud.
   */
  public async initHost(
    roomCode: string,
    player: Omit<RoomPlayer, 'peerId' | 'isHost'>,
    maxPlayers: 8 | 12 = 8,
  ): Promise<string> {
    this.disconnect()

    const hostPeerId = getHostPeerId(roomCode)
    this.localPlayerId = player.id
    this.isHost = true

    return new Promise((resolve, reject) => {
      try {
        const peerInstance = new Peer(hostPeerId, {
          debug: 1,
        })
        this.peer = peerInstance

        peerInstance.on('open', (id) => {
          this.currentRoom = {
            id: `room-${roomCode}`,
            roomCode: roomCode.toUpperCase(),
            hostPeerId: id,
            maxPlayers,
            status: 'waiting',
            players: [
              {
                id: player.id,
                peerId: id,
                username: player.username,
                teamId: player.teamId,
                isReady: player.isReady,
                isHost: true,
              },
            ],
            createdAt: Date.now(),
          }

          this.events.onRoomStateUpdated?.(this.currentRoom)
          resolve(id)
        })

        peerInstance.on('connection', (conn) => {
          this.handleHostIncomingConnection(conn)
        })

        peerInstance.on('error', (err) => {
          const msg = `Host Peer error: ${err.message || 'Koneksi gagal'}`
          this.events.onConnectionError?.(msg)
          reject(new Error(msg))
        })

        peerInstance.on('disconnected', () => {
          this.events.onDisconnected?.()
        })
      } catch (err) {
        reject(err)
      }
    })
  }

  /**
   * Connects client to an existing host room.
   */
  public async joinRoom(
    roomCode: string,
    player: Omit<RoomPlayer, 'peerId' | 'isHost' | 'isReady'>,
  ): Promise<void> {
    this.disconnect()

    this.localPlayerId = player.id
    this.isHost = false
    const clientPeerId = getClientPeerId(roomCode, player.id)
    const hostPeerId = getHostPeerId(roomCode)

    return new Promise((resolve, reject) => {
      try {
        const peerInstance = new Peer(clientPeerId, {
          debug: 1,
        })
        this.peer = peerInstance

        peerInstance.on('open', () => {
          const conn = peerInstance.connect(hostPeerId, {
            reliable: true,
          })

          this.hostConnection = conn

          conn.on('open', () => {
            // Send Join Request to Host
            const joinMsg: NetworkMessage = {
              type: 'JOIN_REQUEST',
              playerId: player.id,
              username: player.username,
              teamId: player.teamId,
            }
            conn.send(joinMsg)
            this.startPingHeartbeat()
            resolve()
          })

          conn.on('data', (raw) => {
            this.handleClientIncomingData(raw)
          })

          conn.on('error', (err) => {
            const msg = `Koneksi ke host terputus: ${err.message}`
            this.events.onConnectionError?.(msg)
          })

          conn.on('close', () => {
            this.events.onDisconnected?.()
          })
        })

        peerInstance.on('error', (err) => {
          let errorMsg = `Gagal bergabung ke room: ${err.message}`
          if (err.type === 'peer-unavailable') {
            errorMsg = `Room ${roomCode.toUpperCase()} tidak ditemukan atau Host sedang offline.`
          }
          this.events.onConnectionError?.(errorMsg)
          reject(new Error(errorMsg))
        })
      } catch (err) {
        reject(err)
      }
    })
  }

  /**
   * Player requests team change.
   */
  public setTeam(teamId: TeamId): void {
    if (!this.currentRoom) return

    if (this.isHost) {
      const me = this.currentRoom.players.find((p) => p.id === this.localPlayerId)
      if (me) {
        me.teamId = teamId
        this.broadcastRoomState()
      }
    } else if (this.hostConnection?.open) {
      const msg: NetworkMessage = {
        type: 'SET_TEAM',
        playerId: this.localPlayerId,
        teamId,
      }
      this.hostConnection.send(msg)
    }
  }

  /**
   * Player toggles ready state.
   */
  public setReady(isReady: boolean): void {
    if (!this.currentRoom) return

    if (this.isHost) {
      const me = this.currentRoom.players.find((p) => p.id === this.localPlayerId)
      if (me) {
        me.isReady = isReady
        this.broadcastRoomState()
      }
    } else if (this.hostConnection?.open) {
      const msg: NetworkMessage = {
        type: 'SET_READY',
        playerId: this.localPlayerId,
        isReady,
      }
      this.hostConnection.send(msg)
    }
  }

  /**
   * Host starts the match.
   */
  public startMatch(): boolean {
    if (!this.isHost || !this.currentRoom) return false

    const check = isMatchStartable(this.currentRoom.players)
    if (!check.startable) {
      this.events.onConnectionError?.(check.reason ?? 'Syarat mulai belum terpenuhi.')
      return false
    }

    this.currentRoom.status = 'playing'
    const startTime = Date.now() + 1000

    const msg: NetworkMessage = {
      type: 'MATCH_START',
      startTime,
    }

    this.broadcastMessage(msg)
    this.events.onMatchStarted?.(startTime)
    return true
  }

  /**
   * Closes all peer connections and resets state.
   */
  public disconnect(): void {
    if (this.pingIntervalId) {
      clearInterval(this.pingIntervalId)
      this.pingIntervalId = null
    }

    for (const conn of this.clientConnections.values()) {
      conn.close()
    }
    this.clientConnections.clear()

    if (this.hostConnection) {
      this.hostConnection.close()
      this.hostConnection = null
    }

    if (this.peer) {
      this.peer.destroy()
      this.peer = null
    }

    this.currentRoom = null
    this.isHost = false
  }

  // --- Private Host Methods ---

  private handleHostIncomingConnection(conn: DataConnection): void {
    conn.on('open', () => {
      this.clientConnections.set(conn.peer, conn)
    })

    conn.on('data', (raw) => {
      const msg = parseNetworkMessage(raw)
      if (!msg || !this.currentRoom) return

      switch (msg.type) {
        case 'JOIN_REQUEST': {
          if (this.currentRoom.players.length >= this.currentRoom.maxPlayers) {
            const resp: NetworkMessage = {
              type: 'JOIN_RESPONSE',
              accepted: false,
              reason: 'Room sudah penuh.',
            }
            conn.send(resp)
            conn.close()
            return
          }

          const newPlayer: RoomPlayer = {
            id: msg.playerId,
            peerId: conn.peer,
            username: msg.username,
            teamId: msg.teamId,
            isReady: false,
            isHost: false,
          }

          // Replace existing if reconnecting or add new
          const existingIdx = this.currentRoom.players.findIndex((p) => p.id === msg.playerId)
          if (existingIdx !== -1) {
            this.currentRoom.players[existingIdx] = newPlayer
          } else {
            this.currentRoom.players.push(newPlayer)
          }

          const resp: NetworkMessage = {
            type: 'JOIN_RESPONSE',
            accepted: true,
            room: this.currentRoom,
          }
          conn.send(resp)
          this.broadcastRoomState()
          break
        }

        case 'SET_TEAM': {
          const player = this.currentRoom.players.find((p) => p.id === msg.playerId)
          if (player) {
            player.teamId = msg.teamId
            this.broadcastRoomState()
          }
          break
        }

        case 'SET_READY': {
          const player = this.currentRoom.players.find((p) => p.id === msg.playerId)
          if (player) {
            player.isReady = msg.isReady
            this.broadcastRoomState()
          }
          break
        }

        case 'PING': {
          const pong: NetworkMessage = {
            type: 'PONG',
            timestamp: msg.timestamp,
          }
          conn.send(pong)
          break
        }
      }
    })

    conn.on('close', () => {
      this.clientConnections.delete(conn.peer)
      if (this.currentRoom) {
        this.currentRoom.players = this.currentRoom.players.filter((p) => p.peerId !== conn.peer)
        this.broadcastRoomState()
      }
    })
  }

  private broadcastRoomState(): void {
    if (!this.currentRoom) return

    const msg: NetworkMessage = {
      type: 'ROOM_STATE_SYNC',
      room: this.currentRoom,
    }

    this.broadcastMessage(msg)
    this.events.onRoomStateUpdated?.(this.currentRoom)
  }

  private broadcastMessage(msg: NetworkMessage): void {
    for (const conn of this.clientConnections.values()) {
      if (conn.open) {
        conn.send(msg)
      }
    }
  }

  // --- Private Client Methods ---

  private handleClientIncomingData(raw: unknown): void {
    const msg = parseNetworkMessage(raw)
    if (!msg) return

    switch (msg.type) {
      case 'JOIN_RESPONSE': {
        if (msg.accepted && msg.room) {
          this.currentRoom = msg.room
          this.events.onRoomStateUpdated?.(msg.room)
        } else {
          this.events.onConnectionError?.(msg.reason ?? 'Permintaan bergabung ditolak.')
        }
        break
      }

      case 'ROOM_STATE_SYNC': {
        this.currentRoom = msg.room
        this.events.onRoomStateUpdated?.(msg.room)
        break
      }

      case 'MATCH_START': {
        this.events.onMatchStarted?.(msg.startTime)
        break
      }

      case 'PONG': {
        const rtt = Date.now() - msg.timestamp
        this.events.onLatencyUpdated?.(Math.max(1, Math.round(rtt / 2)))
        break
      }
    }
  }

  private startPingHeartbeat(): void {
    if (this.pingIntervalId) clearInterval(this.pingIntervalId)

    this.pingIntervalId = setInterval(() => {
      if (this.hostConnection?.open) {
        const ping: NetworkMessage = {
          type: 'PING',
          timestamp: Date.now(),
        }
        this.hostConnection.send(ping)
      }
    }, 3000)
  }
}

export const peerNetworkManager = new PeerNetworkManager()

