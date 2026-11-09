import { defineStore } from 'pinia'
import type { PlayerStatus, TeamId, MatchResult } from '../types/game.types'
import type { SkillId, SkillsStateMap } from '../game/skills/skill-types'
import { GAME_CONFIG } from '../game/core/constants'

export const useGameStore = defineStore('game', {
  state: () => ({
    playerTeam: 'blue' as TeamId,
    stamina: GAME_CONFIG.stamina.max as number,
    maxStamina: GAME_CONFIG.stamina.max as number,
    isSprinting: false,
    status: 'normal' as PlayerStatus,
    stunUntil: 0,
    immunityUntil: 0,
    immunitySource: null as 'skill' | 'rescue' | null,
    rescueCooldownUntil: 0,
    isPointerLocked: false,
    isPaused: false,
    gameTimeSeconds: 0,

    // Milestone 2 Core Gameplay State
    canRescueNearby: false,
    isInEnemyTerritory: false,
    capturesCount: 0,
    rescuesCount: 0,
    timesCapturedCount: 0,

    blueJailedCount: 0,
    blueTotalCount: 2,
    redJailedCount: 0,
    redTotalCount: 2,

    matchResult: null as MatchResult | null,

    // Tactical Active Skills State
    skills: {
      dash: {
        id: 'dash' as SkillId,
        name: 'Kilat',
        hotkey: 'Q',
        ready: true,
        cooldownUntil: 0,
        cooldownRemainingSec: 0,
        cooldownProgress: 0,
        activeUntil: 0,
        isActive: false,
      },
      smoke: {
        id: 'smoke' as SkillId,
        name: 'Asap',
        hotkey: 'F',
        ready: true,
        cooldownUntil: 0,
        cooldownRemainingSec: 0,
        cooldownProgress: 0,
        activeUntil: 0,
        isActive: false,
      },
      adrenaline: {
        id: 'adrenaline' as SkillId,
        name: 'Adrenalin',
        hotkey: 'C',
        ready: true,
        cooldownUntil: 0,
        cooldownRemainingSec: 0,
        cooldownProgress: 0,
        activeUntil: 0,
        isActive: false,
      },
    } as SkillsStateMap,
  }),

  getters: {
    staminaPercentage: (state) => Math.round((state.stamina / state.maxStamina) * 100),
    isStunned: (state) => state.status === 'stunned',
    isJailed: (state) => state.status === 'jailed',
    isImmune: (state) => performance.now() < state.immunityUntil,
    immunityRemainingSeconds: (state) => {
      const remainingMs = Math.max(0, state.immunityUntil - performance.now())
      return (remainingMs / 1000).toFixed(1)
    },
    isRescueOnCooldown: (state) => performance.now() < state.rescueCooldownUntil,
    rescueCooldownRemainingSeconds: (state) => {
      const remainingMs = Math.max(0, state.rescueCooldownUntil - performance.now())
      return Math.ceil(remainingMs / 1000)
    },
  },

  actions: {
    updateLocalPlayerState(payload: {
      stamina: number
      isSprinting: boolean
      status: PlayerStatus
      stunUntil: number
      immunityUntil: number
      rescueCooldownUntil?: number
      immunitySource?: 'skill' | 'rescue' | null
    }) {
      this.stamina = payload.stamina
      this.isSprinting = payload.isSprinting
      this.status = payload.status
      this.stunUntil = payload.stunUntil
      this.immunityUntil = payload.immunityUntil
      if (payload.rescueCooldownUntil !== undefined) {
        this.rescueCooldownUntil = payload.rescueCooldownUntil
      }
      if (payload.immunitySource !== undefined) {
        this.immunitySource = payload.immunitySource
      }
    },

    updateRosterCounts(payload: {
      blueJailed: number
      blueTotal: number
      redJailed: number
      redTotal: number
      canRescue: boolean
      isInEnemyTerritory: boolean
    }) {
      this.blueJailedCount = payload.blueJailed
      this.blueTotalCount = payload.blueTotal
      this.redJailedCount = payload.redJailed
      this.redTotalCount = payload.redTotal
      this.canRescueNearby = payload.canRescue
      this.isInEnemyTerritory = payload.isInEnemyTerritory
    },

    updateSkillsState(skills: SkillsStateMap) {
      this.skills = skills
    },

    recordCapture() {
      this.capturesCount++
    },

    recordRescue() {
      this.rescuesCount++
      this.rescueCooldownUntil = performance.now() + GAME_CONFIG.gameplay.rescueCooldownMs
    },

    recordTimesCaptured() {
      this.timesCapturedCount++
    },

    finishMatch(result: MatchResult) {
      this.matchResult = result
    },

    resetStats() {
      this.capturesCount = 0
      this.rescuesCount = 0
      this.timesCapturedCount = 0
      this.matchResult = null
      this.canRescueNearby = false
      this.stamina = GAME_CONFIG.stamina.max
      this.isSprinting = false
      this.status = 'normal'
      this.stunUntil = 0
      this.immunityUntil = 0
      this.immunitySource = null
      this.rescueCooldownUntil = 0
      this.isInEnemyTerritory = false
      this.blueJailedCount = 0
      this.redJailedCount = 0
      this.blueTotalCount = 2
      this.redTotalCount = 2
      this.gameTimeSeconds = 0
      this.isPaused = false
      this.skills = {
        dash: {
          id: 'dash',
          name: 'Kilat',
          hotkey: 'Q',
          ready: true,
          cooldownUntil: 0,
          cooldownRemainingSec: 0,
          cooldownProgress: 0,
          activeUntil: 0,
          isActive: false,
        },
        smoke: {
          id: 'smoke',
          name: 'Asap',
          hotkey: 'F',
          ready: true,
          cooldownUntil: 0,
          cooldownRemainingSec: 0,
          cooldownProgress: 0,
          activeUntil: 0,
          isActive: false,
        },
        adrenaline: {
          id: 'adrenaline',
          name: 'Adrenalin',
          hotkey: 'C',
          ready: true,
          cooldownUntil: 0,
          cooldownRemainingSec: 0,
          cooldownProgress: 0,
          activeUntil: 0,
          isActive: false,
        },
      }
    },

    setPaused(paused: boolean) {
      this.isPaused = paused
    },

    setPointerLocked(locked: boolean) {
      this.isPointerLocked = locked
    },

    setTeam(team: TeamId) {
      this.playerTeam = team
    },
  },
})
