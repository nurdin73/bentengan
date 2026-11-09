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

  it('should regenerate stamina during the 2-second stun duration', () => {
    let stamina = 0
    let isExhausted = true
    const dt = 1 / 60

    // Simulate 2 seconds (120 ticks) of being immobilized in stun
    for (let i = 0; i < 120; i++) {
      stamina = Math.min(
        GAME_CONFIG.stamina.max,
        stamina + GAME_CONFIG.stamina.regenerationPerSecond * dt,
      )
      if (stamina >= GAME_CONFIG.stamina.minSprintThreshold) {
        isExhausted = false
      }
    }

    // After 2 seconds of stun, stamina should have recovered to 36 points
    expect(stamina).toBeCloseTo(36, 1)
    // isExhausted should have been cleared because 36 >= minSprintThreshold (20)
    expect(isExhausted).toBe(false)
  })

  it('should prevent sprint activation while exhausted until minSprintThreshold is satisfied', () => {
    let stamina = 0
    let isExhausted = true

    // Attempting sprint while exhausted with low stamina (< 20) must be rejected
    stamina = 10
    const canSprintLow = stamina > 0 && !isExhausted
    expect(canSprintLow).toBe(false)

    // Reaching minSprintThreshold (20) resets exhaustion
    stamina = GAME_CONFIG.stamina.minSprintThreshold
    if (stamina >= GAME_CONFIG.stamina.minSprintThreshold) {
      isExhausted = false
    }

    const canSprintAfterThreshold = stamina > 0 && !isExhausted
    expect(canSprintAfterThreshold).toBe(true)
  })

  it('should break the infinite stun loop when sprint input is held continuously', () => {
    let stamina = 0
    let status: 'normal' | 'stunned' = 'stunned'
    let isExhausted = true
    let stunCount = 1
    const dt = 1 / 60
    const stunDurationTicks = 120 // 2 seconds at 60Hz

    // Step 1: Character is stunned for 2 seconds
    for (let i = 0; i < stunDurationTicks; i++) {
      stamina = Math.min(
        GAME_CONFIG.stamina.max,
        stamina + GAME_CONFIG.stamina.regenerationPerSecond * dt,
      )
      if (stamina >= GAME_CONFIG.stamina.minSprintThreshold) {
        isExhausted = false
      }
    }
    status = 'normal'

    // Step 2: Now in normal status with ~36 stamina, user holds sprint
    // Next 10 ticks (160ms) of sprinting
    for (let i = 0; i < 10; i++) {
      const canSprint = stamina > 0 && !isExhausted
      if (canSprint) {
        stamina = Math.max(0, stamina - GAME_CONFIG.stamina.sprintDrainPerSecond * dt)
        if (stamina === 0) {
          status = 'stunned'
          isExhausted = true
          stunCount++
        }
      }
    }

    // Verify stun was NOT immediately re-triggered on frame 1 or 2
    expect(status).toBe('normal')
    expect(stunCount).toBe(1)
    // Stamina drained ~4.16 points from 36 -> ~31.8
    expect(stamina).toBeGreaterThan(30)
  })
})
