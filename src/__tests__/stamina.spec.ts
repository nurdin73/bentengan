import { describe, it, expect } from 'vitest'
import { GAME_CONFIG } from '../game/core/constants'

describe('Stamina and Stun State Mechanics', () => {
  it('should drain stamina linearly at 25 points per second', () => {
    let stamina = 100
    const dt = 1 / 60 // 1 frame at 60Hz

    // Simulate 1 second of sprinting (60 ticks)
    for (let i = 0; i < 60; i++) {
      stamina = Math.max(0, stamina - GAME_CONFIG.stamina.sprintDrainPerSecond * dt)
    }

    expect(stamina).toBeCloseTo(75, 1)
  })

  it('should trigger stun when stamina depletes to zero', () => {
    let stamina = 10
    let status = 'normal'
    let stunUntil = 0
    const now = 1000
    const dt = 0.5 // 0.5s drain = 12.5 points

    stamina = Math.max(0, stamina - GAME_CONFIG.stamina.sprintDrainPerSecond * dt)
    if (stamina === 0) {
      status = 'stunned'
      stunUntil = now + GAME_CONFIG.gameplay.stunDurationMs
    }

    expect(stamina).toBe(0)
    expect(status).toBe('stunned')
    expect(stunUntil).toBe(3000)
  })

  it('should regenerate stamina at 18 points per second when resting', () => {
    let stamina = 50
    const dt = 1 / 60

    // Simulate 1 second of resting
    for (let i = 0; i < 60; i++) {
      stamina = Math.min(
        GAME_CONFIG.stamina.max,
        stamina + GAME_CONFIG.stamina.regenerationPerSecond * dt,
      )
    }

    expect(stamina).toBeCloseTo(68, 1)
  })
})
