import { describe, it, expect } from 'vitest'
import { GAME_CONFIG } from '../game/core/constants'

describe('Game Configuration & Baseline Rules', () => {
  it('should match PRD movement baseline parameters', () => {
    expect(GAME_CONFIG.movement.walkSpeed).toBe(4.5)
    expect(GAME_CONFIG.movement.sprintSpeed).toBe(7.0)
    expect(GAME_CONFIG.movement.jumpImpulse).toBe(6.5)
    expect(GAME_CONFIG.movement.gravity).toBe(-20.0)
  })

  it('should match PRD stamina and stun specifications', () => {
    expect(GAME_CONFIG.stamina.max).toBe(100)
    expect(GAME_CONFIG.stamina.sprintDrainPerSecond).toBe(25)
    expect(GAME_CONFIG.stamina.regenerationPerSecond).toBe(18)
    expect(GAME_CONFIG.gameplay.stunDurationMs).toBe(2000)
    expect(GAME_CONFIG.gameplay.immunityDurationMs).toBe(2000)
    expect(GAME_CONFIG.gameplay.rescueCooldownMs).toBe(30000)
  })

  it('should configure 60Hz fixed simulation timestep', () => {
    expect(GAME_CONFIG.simulationHz).toBe(60)
    expect(GAME_CONFIG.fixedDeltaTime).toBeCloseTo(1 / 60, 5)
  })
})
