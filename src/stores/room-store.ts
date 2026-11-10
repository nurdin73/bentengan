import { defineStore } from 'pinia'
import type { Room, RoomPlayer, RoomStatus, TeamId } from '../types/game.types'
import { isMatchStartable } from '../game/network/network-protocol'
import { peerNetworkManager } from '../game/network/peer-network-manager'
import { useGameStore } from './game-store'

function getOrGeneratePlayerId(): string {
  try {
    const existing = sessionStorage.getItem('bentengan_player_id')
    if (existing) return existing
    const newId = `p-${Math.random().toString(36).substring(2, 7)}`
    sessionStorage.setItem('bentengan_player_id', newId)
    return newId
  } catch {
    return `p-${Math.random().toString(36).substring(2, 7)}`
  }
}

export const useRoomStore = defineStore('room', {
  state: () => ({
    roomCode: '',
    isHost: false,
    status: 'waiting' as RoomStatus,
    myPlayerId: getOrGeneratePlayerId(),
    myUsername: 'Pemain ' + Math.floor(10 + Math.random() * 90),
    myTeam: 'blue' as TeamId,
    players: [] as RoomPlayer[],
    maxPlayers: 8 as 8 | 12,

    // Multiplayer & Rules Briefing Gate
    hasAcknowledgedRules: false,
    isConnecting: false,
    isReconnecting: false,
    reconnectMessage: '',
    activeToasts: [] as Array<{
      id: string
      message: string
      type: 'warn' | 'info' | 'success'
      timestamp: number
    }>,
    connectionError: null as string | null,
    latencyMs: 0,
  }),

  getters: {
    bluePlayers: (state) => state.players.filter((p) => p.teamId === 'blue'),
    redPlayers: (state) => state.players.filter((p) => p.teamId === 'red'),
    myPlayer: (state) => state.players.find((p) => p.id === state.myPlayerId),
    isReady: (state) => {
      const me = state.players.find((p) => p.id === state.myPlayerId)
      return me ? me.isReady : false
    },
    startableStatus: (state) => isMatchStartable(state.players),
    canStartMatch: (state) => {
      if (state.roomCode === 'LOKAL') return true
      if (!state.isHost) return false
      return isMatchStartable(state.players).startable
    },
  },

  actions: {
    initNetworkListeners() {
      peerNetworkManager.events = {
        onRoomStateUpdated: (room: Room) => {
          this.roomCode = room.roomCode
          this.status = room.status
          this.players = [...room.players]
          this.maxPlayers = room.maxPlayers
          this.isConnecting = false
          this.connectionError = null

          const me = this.players.find((p) => p.id === this.myPlayerId)
          if (me) {
            this.myTeam = me.teamId
          }
        },
        onMatchStarted: (_startTime: number) => {
          this.status = 'playing'
          this.isConnecting = false
        },
        onConnectionError: (errorMsg: string) => {
          this.connectionError = errorMsg
          this.isConnecting = false
        },
        onDisconnected: () => {
          this.isReconnecting = false
          this.reconnectMessage = ''
          if (this.status === 'playing') {
            const gameStore = useGameStore()
            gameStore.finishMatch({
              matchId: `match-${Date.now()}`,
              winner: null,
              reason: 'host_disconnect',
              duration: 0,
              players: [],
            })
            this.connectionError = 'Tuan rumah (Host) telah keluar. Permainan selesai.'
            this.status = 'finished'
          } else {
            this.leaveRoom()
          }
        },
        onLatencyUpdated: (latencyMs: number) => {
          this.latencyMs = latencyMs
        },
        onReconnecting: (msg: string) => {
          this.isReconnecting = true
          this.reconnectMessage = msg
          this.pushToast(msg, 'warn')
        },
        onReconnected: () => {
          this.isReconnecting = false
          this.reconnectMessage = ''
          this.pushToast('Koneksi berhasil dipulihkan!', 'success')
        },
        onPeerStatusNotification: (n) => {
          const msg =
            n.status === 'reconnected'
              ? `✅ ${n.username} terhubung kembali!`
              : `⚠️ ${n.username} terputus dari ruangan...`
          this.pushToast(msg, n.status === 'reconnected' ? 'success' : 'warn')
        },
      }
    },

    pushToast(message: string, type: 'warn' | 'info' | 'success' = 'info') {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      this.activeToasts.push({
        id,
        message,
        type,
        timestamp: Date.now(),
      })
      setTimeout(() => {
        this.removeToast(id)
      }, 4000)
    },

    removeToast(id: string) {
      this.activeToasts = this.activeToasts.filter((t) => t.id !== id)
    },

    manualRetryReconnect() {
      if (!this.isHost) {
        peerNetworkManager.attemptClientReconnect()
      }
    },

    acknowledgeRules() {
      this.hasAcknowledgedRules = true
    },

    initLocalPractice(team: TeamId = 'blue') {
      peerNetworkManager.disconnect()
      this.roomCode = 'LOKAL'
      this.isHost = true
      this.status = 'playing'
      this.myTeam = team
      this.hasAcknowledgedRules = true
      this.connectionError = null
      this.players = [
        {
          id: this.myPlayerId,
          peerId: 'local-peer',
          username: this.myUsername,
          teamId: team,
          isReady: true,
          isHost: true,
        },
      ]
    },

    async createHostRoom(roomCode: string, team: TeamId = 'blue', maxPlayers: 8 | 12 = 8) {
      this.initNetworkListeners()
      this.isConnecting = true
      this.connectionError = null
      this.roomCode = roomCode.toUpperCase()
      this.isHost = true
      this.myTeam = team
      this.maxPlayers = maxPlayers
      this.hasAcknowledgedRules = true // Host creates room and already knows rules

      try {
        sessionStorage.setItem('bentengan_hosted_room', this.roomCode)
      } catch {
        // Ignore storage errors in restricted contexts
      }

      try {
        await peerNetworkManager.initHost(
          this.roomCode,
          {
            id: this.myPlayerId,
            username: this.myUsername,
            teamId: team,
            isReady: true,
          },
          maxPlayers,
        )
      } catch (err) {
        this.isConnecting = false
        this.connectionError = err instanceof Error ? err.message : 'Gagal membuat room.'
      }
    },

    async joinRemoteRoom(roomCode: string, team: TeamId = 'red') {
      this.initNetworkListeners()
      this.isConnecting = true
      this.connectionError = null
      this.roomCode = roomCode.toUpperCase()
      this.isHost = false
      this.myTeam = team

      try {
        await peerNetworkManager.joinRoom(this.roomCode, {
          id: this.myPlayerId,
          username: this.myUsername,
          teamId: team,
        })
      } catch (err) {
        this.isConnecting = false
        this.connectionError = err instanceof Error ? err.message : 'Gagal bergabung ke room.'
      }
    },

    setTeam(team: TeamId) {
      this.myTeam = team
      const me = this.players.find((p) => p.id === this.myPlayerId)
      if (me) me.teamId = team

      if (this.roomCode !== 'LOKAL') {
        peerNetworkManager.setTeam(team)
      }
    },

    toggleReady() {
      const me = this.players.find((p) => p.id === this.myPlayerId)
      if (!me) return

      const nextReady = !me.isReady
      me.isReady = nextReady

      if (this.roomCode !== 'LOKAL') {
        peerNetworkManager.setReady(nextReady)
      }
    },

    startMatch(): boolean {
      if (this.roomCode === 'LOKAL') {
        this.status = 'playing'
        return true
      }
      return peerNetworkManager.startMatch()
    },

    leaveRoom() {
      try {
        sessionStorage.removeItem('bentengan_hosted_room')
      } catch {
        // Ignore storage errors
      }
      peerNetworkManager.disconnect()
      this.roomCode = ''
      this.isHost = false
      this.status = 'waiting'
      this.players = []
      this.isConnecting = false
      this.isReconnecting = false
      this.reconnectMessage = ''
      this.activeToasts = []
      this.connectionError = null
      this.hasAcknowledgedRules = false
      this.latencyMs = 0
    },

    setMatchStatus(status: RoomStatus) {
      this.status = status
    },

    returnToLobbyForRematch() {
      // Only the Host or a solo practice player can initiate returning room to lobby
      if (!this.isHost && this.roomCode !== 'LOKAL') {
        return
      }

      this.status = 'waiting'
      for (const p of this.players) {
        p.isReady = false
      }
      if (this.isHost && this.roomCode !== 'LOKAL') {
        peerNetworkManager.returnToLobby()
      }
    },
  },
})
