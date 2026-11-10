import { Peer, type DataConnection } from 'peerjs'
import type { Room, RoomPlayer, TeamId } from '../../types/game.types'
import {
  getHostPeerId,
  parseNetworkMessage,
  type NetworkMessage,
  type PlayerNetworkState,
  type PlayerUpdateMessage,
  type WorldSnapshotMessage,
  type GameEventMessage,
  type PeerStatusNotification,
  isMatchStartable,
} from './network-protocol'

const PEER_CONFIG = {
  debug: 1,
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' },
    ],
  },
}

export interface PeerNetworkEvents {
  onRoomStateUpdated: (room: Room) => void
  onMatchStarted: (startTime: number) => void
  onConnectionError: (errorMsg: string) => void
  onDisconnected: () => void
  onLatencyUpdated: (latencyMs: number) => void
  onPlayerUpdate: (update: PlayerUpdateMessage) => void
  onWorldSnapshot: (snapshot: WorldSnapshotMessage) => void
  onGameEvent: (event: GameEventMessage) => void
  onPlayerLeft: (playerId: string) => void
  onPlayerReconnected: (player: RoomPlayer) => void
  onReconnecting: (message: string) => void
  onReconnected: () => void
  onPeerStatusNotification: (notification: PeerStatusNotification) => void
}

export class PeerNetworkManager {
  private peer: Peer | null = null
  private hostConnection: DataConnection | null = null
  private clientConnections = new Map<string, DataConnection>()
  private pingIntervalId: ReturnType<typeof setInterval> | null = null

  private currentRoom: Room | null = null
  private localPlayerId = ''
  private isHost = false
  private isIntentionalDisconnect = false
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempts = 0
  private disconnectGraceTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private cachedClientParams: {
    roomCode: string
    player: Omit<RoomPlayer, 'peerId' | 'isHost' | 'isReady'>
  } | null = null

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
    this.isIntentionalDisconnect = false
    this.reconnectAttempts = 0
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    const hostPeerId = getHostPeerId(roomCode)
    this.localPlayerId = player.id
    this.isHost = true

    return new Promise((resolve, reject) => {
      try {
        const peerInstance = new Peer(hostPeerId, PEER_CONFIG)
        this.peer = peerInstance

        peerInstance.on('open', (id) => {
          if (this.currentRoom) {
            // Reconnected to signaling server with existing active room
            this.events.onReconnected?.()
            this.broadcastRoomState()
            resolve(id)
            return
          }

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
                isReady: false,
                isHost: true,
                outfitId: player.outfitId ?? 1,
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
          let msg = `Gagal membuat ruangan: ${err.message || 'Koneksi bermasalah'}`
          if (err.type === 'unavailable-id') {
            msg = `Kode ruangan ${roomCode.toUpperCase()} sedang aktif dipakai. Coba kode lain atau tunggu 1 menit.`
          }
          this.events.onConnectionError?.(msg)
          reject(new Error(msg))
        })

        peerInstance.on('disconnected', () => {
          if (!this.isIntentionalDisconnect && this.currentRoom) {
            this.events.onReconnecting?.('Koneksi server signaling terputus. Menyambung ulang...')
            try {
              peerInstance.reconnect()
            } catch (err) {
              console.warn('Gagal memanggil peer.reconnect():', err)
              this.events.onDisconnected?.()
            }
          } else {
            this.events.onDisconnected?.()
          }
        })
      } catch (err) {
        reject(err)
      }
    })
  }

  /**
   * Connects client to an existing host room using an auto-generated unique ID.
   */
  public async joinRoom(
    roomCode: string,
    player: Omit<RoomPlayer, 'peerId' | 'isHost' | 'isReady'>,
  ): Promise<void> {
    this.disconnect()
    this.isIntentionalDisconnect = false
    this.cachedClientParams = { roomCode, player }
    this.reconnectAttempts = 0
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    this.localPlayerId = player.id
    this.isHost = false
    const hostPeerId = getHostPeerId(roomCode)

    return new Promise((resolve, reject) => {
      try {
        // Auto-generated unique peer ID prevents ID-taken collisions on PeerServer Cloud
        const peerInstance = new Peer(PEER_CONFIG)
        this.peer = peerInstance

        let hasConnected = false

        peerInstance.on('open', () => {
          const conn = peerInstance.connect(hostPeerId, {
            reliable: true,
          })

          this.hostConnection = conn

          const handleOpen = () => {
            if (hasConnected) return
            hasConnected = true

            // Send Join Request to Host
            const joinMsg: NetworkMessage = {
              type: 'JOIN_REQUEST',
              playerId: player.id,
              username: player.username,
              teamId: player.teamId,
              outfitId: player.outfitId,
            }
            conn.send(joinMsg)
            this.startPingHeartbeat()
            resolve()
          }

          if (conn.open) {
            handleOpen()
          } else {
            conn.on('open', handleOpen)
          }

          conn.on('data', (raw) => {
            this.handleClientIncomingData(raw)
          })

          conn.on('error', (err) => {
            const msg = `Koneksi ke host terputus: ${err.message}`
            this.events.onConnectionError?.(msg)
            if (!hasConnected) reject(new Error(msg))
          })

          conn.on('close', () => {
            if (!this.isIntentionalDisconnect && hasConnected) {
              this.attemptClientReconnect()
            } else {
              this.events.onDisconnected?.()
            }
          })
        })

        peerInstance.on('error', (err) => {
          let errorMsg = `Gagal bergabung ke ruangan: ${err.message}`
          if (err.type === 'peer-unavailable') {
            errorMsg = `Ruangan ${roomCode.toUpperCase()} tidak ditemukan atau Host sedang offline.`
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
    } else if (this.hostConnection) {
      const msg: NetworkMessage = {
        type: 'SET_TEAM',
        playerId: this.localPlayerId,
        teamId,
      }
      try {
        if (this.hostConnection.open) {
          this.hostConnection.send(msg)
        }
      } catch (err) {
        console.warn('Gagal kirim SET_TEAM:', err)
      }
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
    } else if (this.hostConnection) {
      const msg: NetworkMessage = {
        type: 'SET_READY',
        playerId: this.localPlayerId,
        isReady,
      }
      try {
        if (this.hostConnection.open) {
          this.hostConnection.send(msg)
        }
      } catch (err) {
        console.warn('Gagal kirim SET_READY:', err)
      }
    }
  }

  /**
   * Player selects modular outfit (1..6).
   */
  public setOutfit(outfitId: number): void {
    if (!this.currentRoom) return

    if (this.isHost) {
      const me = this.currentRoom.players.find((p) => p.id === this.localPlayerId)
      if (me) {
        me.outfitId = outfitId
        this.broadcastRoomState()
      }
    } else if (this.hostConnection) {
      const msg: NetworkMessage = {
        type: 'SET_OUTFIT',
        playerId: this.localPlayerId,
        outfitId,
      }
      try {
        if (this.hostConnection.open) {
          this.hostConnection.send(msg)
        }
      } catch (err) {
        console.warn('Gagal kirim SET_OUTFIT:', err)
      }
    }
  }

  /**
   * Host resets match for a rematch, returning everyone to waiting room with unready state.
   */
  public returnToLobby(): void {
    if (!this.isHost || !this.currentRoom) return

    this.currentRoom.status = 'waiting'
    for (const p of this.currentRoom.players) {
      p.isReady = false
    }

    this.broadcastRoomState()
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
   * Client sends its local player transform and status to host (20 Hz).
   */
  public sendPlayerUpdate(state: PlayerNetworkState): void {
    if (this.isHost || !this.hostConnection?.open) return
    const msg: NetworkMessage = {
      type: 'PLAYER_UPDATE',
      playerId: this.localPlayerId,
      state,
    }
    try {
      this.hostConnection.send(msg)
    } catch {
      // Ignore transient send failures
    }
  }

  /**
   * Host broadcasts the authoritative world snapshot (all player positions/states) to all clients (20 Hz).
   */
  public broadcastWorldSnapshot(tick: number, players: PlayerNetworkState[]): void {
    if (!this.isHost) return
    const msg: NetworkMessage = {
      type: 'WORLD_SNAPSHOT',
      tick,
      timestamp: Date.now(),
      players,
    }
    this.broadcastMessage(msg)
  }

  /**
   * Broadcasts a discrete gameplay event (capture, rescue, base capture, match end, smoke) across the network.
   * If called on Host, broadcasts to all peers. If called on Client, sends to Host to relay.
   */
  public broadcastGameEvent(event: Omit<GameEventMessage, 'type' | 'timestamp'>): void {
    const msg: NetworkMessage = {
      type: 'GAME_EVENT',
      ...event,
      timestamp: Date.now(),
    }
    if (this.isHost) {
      this.broadcastMessage(msg)
    } else if (this.hostConnection?.open) {
      try {
        this.hostConnection.send(msg)
      } catch {
        // Transient send failure
      }
    }
  }

  /**
   * Closes all peer connections and resets state.
   */
  public disconnect(): void {
    this.isIntentionalDisconnect = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.reconnectAttempts = 0
    this.cachedClientParams = null

    for (const timer of this.disconnectGraceTimers.values()) {
      clearTimeout(timer)
    }
    this.disconnectGraceTimers.clear()

    if (this.pingIntervalId) {
      clearInterval(this.pingIntervalId)
      this.pingIntervalId = null
    }

    for (const conn of this.clientConnections.values()) {
      try {
        conn.close()
      } catch {
        // Ignore close errors
      }
    }
    this.clientConnections.clear()

    if (this.hostConnection) {
      try {
        this.hostConnection.close()
      } catch {
        // Ignore close errors
      }
      this.hostConnection = null
    }

    if (this.peer) {
      try {
        this.peer.destroy()
      } catch {
        // Ignore destroy errors
      }
      this.peer = null
    }

    this.currentRoom = null
    this.isHost = false
  }

  /**
   * Broadcasts peer connection status updates (disconnected, reconnected, left) to all peers.
   */
  public broadcastPeerStatus(
    playerId: string,
    username: string,
    status: 'disconnected' | 'reconnected' | 'left',
  ): void {
    const notif: PeerStatusNotification = {
      type: 'PEER_STATUS_NOTIFICATION',
      playerId,
      username,
      status,
      timestamp: Date.now(),
    }
    this.broadcastMessage(notif)
    this.events.onPeerStatusNotification?.(notif)
  }

  /**
   * Graceful client reconnection loop with exponential/interval retry.
   */
  public attemptClientReconnect(): void {
    if (!this.cachedClientParams || this.isIntentionalDisconnect) return

    const MAX_ATTEMPTS = 5
    const RETRY_INTERVAL_MS = 2500

    if (this.reconnectAttempts >= MAX_ATTEMPTS) {
      this.events.onConnectionError?.('Gagal terhubung kembali ke Host setelah 5 percobaan.')
      this.events.onDisconnected?.()
      return
    }

    this.reconnectAttempts++
    this.events.onReconnecting?.(
      `Koneksi ke Host terputus. Mencoba menghubungkan kembali (${this.reconnectAttempts}/${MAX_ATTEMPTS})...`,
    )

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    this.reconnectTimer = setTimeout(() => {
      if (this.isIntentionalDisconnect || !this.cachedClientParams) return

      const { roomCode, player } = this.cachedClientParams
      const hostPeerId = getHostPeerId(roomCode)

      if (this.peer && this.peer.disconnected && !this.peer.destroyed) {
        try {
          this.peer.reconnect()
        } catch {
          // Ignore
        }
      }

      if (!this.peer || this.peer.destroyed) {
        this.peer = new Peer(PEER_CONFIG)
      }

      const connectToHost = () => {
        if (!this.peer || this.peer.destroyed || this.isIntentionalDisconnect) return

        const conn = this.peer.connect(hostPeerId, {
          reliable: true,
        })
        this.hostConnection = conn

        let hasReconnected = false

        const handleOpen = () => {
          if (hasReconnected) return
          hasReconnected = true
          this.reconnectAttempts = 0
          if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer)
            this.reconnectTimer = null
          }

          const joinMsg: NetworkMessage = {
            type: 'JOIN_REQUEST',
            playerId: player.id,
            username: player.username,
            teamId: player.teamId,
            outfitId: player.outfitId,
          }
          conn.send(joinMsg)
          this.startPingHeartbeat()
          this.events.onReconnected?.()
        }

        if (conn.open) {
          handleOpen()
        } else {
          conn.on('open', handleOpen)
        }

        conn.on('data', (raw) => {
          this.handleClientIncomingData(raw)
        })

        conn.on('error', (_err) => {
          // Error will trigger close or next retry loop
        })

        conn.on('close', () => {
          if (!this.isIntentionalDisconnect) {
            this.attemptClientReconnect()
          }
        })
      }

      if (this.peer.open) {
        connectToHost()
      } else {
        this.peer.once('open', () => {
          connectToHost()
        })
        this.peer.once('error', () => {
          if (!this.isIntentionalDisconnect) {
            this.attemptClientReconnect()
          }
        })
      }
    }, RETRY_INTERVAL_MS)
  }

  // --- Private Host Methods ---

  private handleHostIncomingConnection(conn: DataConnection): void {
    // Immediately register connection to prevent missed open events
    this.clientConnections.set(conn.peer, conn)

    const onOpen = () => {
      this.clientConnections.set(conn.peer, conn)
    }

    if (conn.open) {
      onOpen()
    } else {
      conn.on('open', onOpen)
    }

    conn.on('data', (raw) => {
      const msg = parseNetworkMessage(raw)
      if (!msg || !this.currentRoom) return

      switch (msg.type) {
        case 'JOIN_REQUEST': {
          if (this.currentRoom.players.length >= this.currentRoom.maxPlayers) {
            const resp: NetworkMessage = {
              type: 'JOIN_RESPONSE',
              accepted: false,
              reason: 'Ruangan sudah penuh.',
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
            outfitId: msg.outfitId ?? 1,
          }

          // Replace existing if reconnecting or add new
          const existingIdx = this.currentRoom.players.findIndex((p) => p.id === msg.playerId)
          const isReconnecting = existingIdx !== -1
          if (isReconnecting) {
            const existingTimer = this.disconnectGraceTimers.get(msg.playerId)
            if (existingTimer) {
              clearTimeout(existingTimer)
              this.disconnectGraceTimers.delete(msg.playerId)
            }
            this.currentRoom.players[existingIdx] = newPlayer
          } else {
            this.currentRoom.players.push(newPlayer)
          }

          // Defensive deduplication to ensure currentRoom.players is strictly unique by ID
          const uniquePlayers: RoomPlayer[] = []
          const seenPlayerIds = new Set<string>()
          for (const p of this.currentRoom.players) {
            if (!seenPlayerIds.has(p.id)) {
              seenPlayerIds.add(p.id)
              uniquePlayers.push(p)
            }
          }
          this.currentRoom.players = uniquePlayers

          const resp: NetworkMessage = {
            type: 'JOIN_RESPONSE',
            accepted: true,
            room: this.currentRoom,
          }
          conn.send(resp)
          this.broadcastRoomState()

          if (isReconnecting) {
            this.broadcastPeerStatus(msg.playerId, msg.username, 'reconnected')
            this.events.onPlayerReconnected?.(newPlayer)
          }
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

        case 'SET_OUTFIT': {
          const player = this.currentRoom.players.find((p) => p.id === msg.playerId)
          if (player) {
            player.outfitId = msg.outfitId
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

        case 'PLAYER_UPDATE': {
          this.events.onPlayerUpdate?.(msg)
          break
        }

        case 'GAME_EVENT': {
          // Relay game event from client to all other connected peers, and process locally on host
          this.broadcastMessage(msg, conn.peer)
          this.events.onGameEvent?.(msg)
          break
        }
      }
    })

    conn.on('close', () => {
      const leavingPeerId = conn.peer
      this.clientConnections.delete(leavingPeerId)
      if (this.currentRoom) {
        const leftPlayer = this.currentRoom.players.find((p) => p.peerId === leavingPeerId)
        if (leftPlayer) {
          this.broadcastPeerStatus(leftPlayer.id, leftPlayer.username, 'disconnected')

          if (this.currentRoom.status === 'playing') {
            // Grace period of 15 seconds during active gameplay before permanent removal
            const existingTimer = this.disconnectGraceTimers.get(leftPlayer.id)
            if (existingTimer) clearTimeout(existingTimer)

            const timer = setTimeout(() => {
              this.disconnectGraceTimers.delete(leftPlayer.id)
              if (this.currentRoom) {
                this.events.onPlayerLeft?.(leftPlayer.id)
                this.currentRoom.players = this.currentRoom.players.filter(
                  (p) => p.id !== leftPlayer.id,
                )
                this.broadcastRoomState()
                this.broadcastPeerStatus(leftPlayer.id, leftPlayer.username, 'left')
              }
            }, 15000)

            this.disconnectGraceTimers.set(leftPlayer.id, timer)
          } else {
            // Immediate removal while in lobby waiting room
            this.events.onPlayerLeft?.(leftPlayer.id)
            this.currentRoom.players = this.currentRoom.players.filter(
              (p) => p.peerId !== leavingPeerId,
            )
            this.broadcastRoomState()
          }
        }
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

  private broadcastMessage(msg: NetworkMessage, excludePeerId?: string): void {
    for (const [peerId, conn] of this.clientConnections.entries()) {
      if (excludePeerId && peerId === excludePeerId) continue
      try {
        if (conn.open) {
          conn.send(msg)
        }
      } catch (err) {
        console.warn('Gagal broadcast ke peer:', peerId, err)
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

      case 'WORLD_SNAPSHOT': {
        this.events.onWorldSnapshot?.(msg)
        break
      }

      case 'GAME_EVENT': {
        this.events.onGameEvent?.(msg)
        break
      }

      case 'PEER_STATUS_NOTIFICATION': {
        this.events.onPeerStatusNotification?.(msg)
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
