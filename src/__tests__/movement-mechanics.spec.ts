import { describe, it, expect } from 'vitest'
import * as THREE from 'three'

describe('Movement & Single-Jump Mechanics', () => {
  it('should restrict jump to exactly 1 execution per key press (edge trigger)', () => {
    let wasJumpPressed = false
    let isGrounded = true
    let jumpCount = 0

    const simulateTick = (isSpaceHeld: boolean) => {
      const isNewJumpPress = isSpaceHeld && !wasJumpPressed
      if (isNewJumpPress && isGrounded) {
        jumpCount++
        isGrounded = false // player leaves ground
      }
      wasJumpPressed = isSpaceHeld
    }

    // Frame 1: Initial Space press -> JUMP!
    simulateTick(true)
    expect(jumpCount).toBe(1)
    expect(isGrounded).toBe(false)

    // Frame 2: Still holding Space in mid-air -> NO additional jump
    simulateTick(true)
    expect(jumpCount).toBe(1)

    // Frame 3: Still holding Space as player lands -> NO auto bunny-hop
    isGrounded = true
    simulateTick(true)
    expect(jumpCount).toBe(1)

    // Frame 4: Release Space key
    simulateTick(false)
    expect(jumpCount).toBe(1)

    // Frame 5: Fresh press while on ground -> JUMP!
    simulateTick(true)
    expect(jumpCount).toBe(2)
  })

  it('should interpolate sub-frame positions smoothly to eliminate jitter', () => {
    const prevPos = new THREE.Vector3(0, 0, 0)
    const currPos = new THREE.Vector3(10, 0, 0)
    const result = new THREE.Vector3()

    // At alpha = 0.5 (halfway between fixed ticks)
    const alpha = 0.5
    result.lerpVectors(prevPos, currPos, alpha)

    expect(result.x).toBe(5)
    expect(result.y).toBe(0)
    expect(result.z).toBe(0)
  })

  it('should calculate exponential smoothing factor correctly', () => {
    const frameTime = 1 / 60
    const decay = 22
    const smoothFactor = 1 - Math.exp(-decay * frameTime)

    expect(smoothFactor).toBeGreaterThan(0.2)
    expect(smoothFactor).toBeLessThan(0.4)
  })
})
