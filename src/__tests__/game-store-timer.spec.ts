import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useGameStore } from '../stores/game-store'
import type { MatchResult } from '../types/game.types'

describe('GameStore Match Timer & Timeout Resolution', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('formats remaining match duration correctly into MM:SS', () => {
    const gameStore = useGameStore()

    // Default 300s -> 05:00
    expect(gameStore.formattedRemainingTime).toBe('05:00')

    // 125s -> 02:05
    gameStore.updateMatchTimer(125, 300)
    expect(gameStore.formattedRemainingTime).toBe('02:05')

    // 9s -> 00:09
    gameStore.updateMatchTimer(9, 300)
    expect(gameStore.formattedRemainingTime).toBe('00:09')

    // 0s -> 00:00
    gameStore.updateMatchTimer(0, 300)
    expect(gameStore.formattedRemainingTime).toBe('00:00')

    // Unlimited (0s limit) -> ∞
    gameStore.updateMatchTimer(120, 0)
    expect(gameStore.formattedRemainingTime).toBe('∞')
  })

  it('correctly records and finishes match with timeout reason', () => {
    const gameStore = useGameStore()

    const timeoutResult: MatchResult = {
      matchId: 'match-timeout-1',
      winner: 'blue',
      reason: 'timeout',
      duration: 300,
      players: [
        {
          playerId: 'p1',
          teamId: 'blue',
          captures: 2,
          rescues: 1,
          timesCaptured: 0,
        },
      ],
    }

    gameStore.finishMatch(timeoutResult)
    expect(gameStore.matchResult).toEqual(timeoutResult)
    expect(gameStore.matchResult?.reason).toBe('timeout')
    expect(gameStore.matchResult?.winner).toBe('blue')
  })

  it('resets timer values back to defaults on resetStats', () => {
    const gameStore = useGameStore()
    gameStore.updateMatchTimer(15, 300)
    expect(gameStore.remainingTimeSec).toBe(15)

    gameStore.resetStats()
    expect(gameStore.remainingTimeSec).toBe(300)
    expect(gameStore.matchDurationLimitSec).toBe(300)
    expect(gameStore.formattedRemainingTime).toBe('05:00')
  })
})

