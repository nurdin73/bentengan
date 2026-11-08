import { describe, it, expect } from 'vitest'

describe('Wall-Sliding Velocity Deflection & Slope Check', () => {
  it('should deflect velocity along wall tangent when moving into a vertical wall', () => {
    // Player moving forward-right diagonally (velX = 4, velZ = 4)
    // Wall is on the right with normal pointing left (normal = (-1, 0, 0))
    let velX = 4
    let velZ = 4
    const normal = { x: -1, y: 0, z: 0 }

    const dot = velX * normal.x + velZ * normal.z // 4 * (-1) = -4
    expect(dot).toBeLessThan(0) // moving into wall

    // Apply deflection formula: v = v - n * (v . n)
    velX -= normal.x * dot // 4 - (-1) * (-4) = 4 - 4 = 0
    velZ -= normal.z * dot // 4 - 0 = 4

    expect(velX).toBe(0) // completely stopped against wall
    expect(velZ).toBe(4) // smoothly slides along wall length
  })

  it('should not alter velocity when moving away from a wall', () => {
    let velX = -4
    let velZ = 4
    const normal = { x: -1, y: 0, z: 0 }

    const dot = velX * normal.x + velZ * normal.z // (-4) * (-1) = 4 (positive, moving away)
    if (dot < 0) {
      velX -= normal.x * dot
      velZ -= normal.z * dot
    }

    expect(velX).toBe(-4)
    expect(velZ).toBe(4)
  })

  it('should reject vertical wall surface as ground', () => {
    const isGroundSurface = (normalY: number) => normalY >= 0.5

    // Flat floor
    expect(isGroundSurface(1.0)).toBe(true)

    // Gentle 30-degree slope
    expect(isGroundSurface(0.866)).toBe(true)

    // Vertical wall face
    expect(isGroundSurface(0.0)).toBe(false)

    // Steep wall / pillar side
    expect(isGroundSurface(0.2)).toBe(false)
  })
})

