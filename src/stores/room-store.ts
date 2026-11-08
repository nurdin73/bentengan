import { defineStore } from 'pinia'
import type { Room, RoomPlayer, RoomStatus, TeamId } from '../types/game.types'
import { isMatchStartable } from '../game/network/network-protocol'
import { peerNetworkManager } from '../game/network/peer-network-manager'

function generatePlayerId(): string {
  return `p-${Math.random().toString(36).substring(2, 7)}`
}

export const useRoomStore = defineStore('room', {
  state: () => ({
    roomCode: '',
    isHost: false,
    status: 'waiting' as RoomStatus,
    myPlayerId: generatePlayerId(),
    myUsername: 'Pemain ' + Math.floor(10 + Math.random() * 90),
    myTeam: 'blue' as TeamId,
    players: [] as RoomPlayer[],

    // Multiplayer & Rules Briefing Gate
    hasAcknowledgedRules: false,
    isConnecting: false,
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
          if (this.status === 'playing') {
            this.connectionError = 'Koneksi terputus dari room.'
            this.status = 'finished'
          } else {
            this.leaveRoom()
          }
        },
        onLatencyUpdated: (latencyMs: number) => {
          this.latencyMs = latencyMs
        },
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

    async createHostRoom(roomCode: string, team: TeamId = 'blue') {
      this.initNetworkListeners()
      this.isConnecting = true
      this.connectionError = null
      this.roomCode = roomCode.toUpperCase()
      this.isHost = true
      this.myTeam = team
      this.hasAcknowledgedRules = true // Host creates room and already knows rules

      try {
        await peerNetworkManager.initHost(this.roomCode, {
          id: this.myPlayerId,
          username: this.myUsername,
          teamId: team,
          isReady: true,
        })
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
      peerNetworkManager.disconnect()
      this.roomCode = ''
      this.isHost = false
      this.status = 'waiting'
      this.players = []
      this.isConnecting = false
      this.connectionError = null
      this.hasAcknowledgedRules = false
      this.latencyMs = 0
    },

    setMatchStatus(status: RoomStatus) {
      this.status = status
    },
  },
})
