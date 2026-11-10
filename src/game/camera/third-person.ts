import * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
import type { PhysicsWorld } from '../physics/physics-world'
import { GAME_CONFIG } from '../core/constants'
import { useSettingsStore } from '../../stores/settings-store'

export class ThirdPersonCameraController {
  public readonly camera: THREE.PerspectiveCamera
  private yaw = 0
  private pitch = 0
  private currentTarget = new THREE.Vector3()
  private idealPosition = new THREE.Vector3()
  private targetOffset = new THREE.Vector3(0, GAME_CONFIG.camera.heightOffset, 0)
  private isInitialized = false

  // SpringArm current dynamic distance
  private currentDistance: number = Number(GAME_CONFIG.camera.distance)

  // Scratch objects to satisfy Rule 3.A (Zero allocation in per-frame tick/render loops)
  private readonly scratchLookTarget = new THREE.Vector3()
  private readonly scratchRayDir = new THREE.Vector3()
  private springRay: RAPIER.Ray | null = null

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera
    this.camera.position.set(0, 5, 10)
  }

  public update(
    targetPosition: THREE.Vector3,
    deltaX: number,
    deltaY: number,
    frameTime: number,
    physics?: PhysicsWorld,
    excludeCollider?: RAPIER.Collider,
  ): void {
    const {
      sensitivity,
      minPitch,
      maxPitch,
      distance: maxDistance,
      minDistance,
      wallBuffer,
    } = GAME_CONFIG.camera

    // 1. Accumulate mouse rotations with user settings
    let userSensitivity = 1.0
    let invertY = false
    try {
      const settings = useSettingsStore()
      userSensitivity = settings.mouseSensitivity
      invertY = settings.invertY
    } catch {
      // In headless test environments where Pinia store is not active
    }

    const effectiveSens = sensitivity * userSensitivity
    this.yaw -= deltaX * effectiveSens
    this.pitch += (invertY ? deltaY : -deltaY) * effectiveSens
    this.pitch = Math.max(minPitch, Math.min(maxPitch, this.pitch))

    // 2. Compute camera target (player head / focal point)
    this.scratchLookTarget.copy(targetPosition).add(this.targetOffset)

    // 3. Calculate full directional offset vector
    const cosPitch = Math.cos(this.pitch)
    const sinPitch = Math.sin(this.pitch)
    const dirX = cosPitch * Math.sin(this.yaw)
    const dirY = sinPitch
    const dirZ = cosPitch * Math.cos(this.yaw)

    this.scratchRayDir.set(dirX, dirY, dirZ).normalize()

    // 4. SpringArm Physics Raycast Obstacle Collision
    let targetDistance: number = maxDistance

    if (physics) {
      if (!this.springRay) {
        this.springRay = new physics.rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 })
      }

      this.springRay.origin.x = this.scratchLookTarget.x
      this.springRay.origin.y = this.scratchLookTarget.y
      this.springRay.origin.z = this.scratchLookTarget.z

      this.springRay.dir.x = this.scratchRayDir.x
      this.springRay.dir.y = this.scratchRayDir.y
      this.springRay.dir.z = this.scratchRayDir.z

      const hit = physics.world.castRay(
        this.springRay,
        maxDistance,
        true,
        undefined,
        undefined,
        excludeCollider,
      )

      if (hit !== null) {
        // Clamp distance before wall, respecting minimum radius
        targetDistance = Math.max(minDistance, hit.timeOfImpact - wallBuffer)
      }
    }

    // 5. Asymmetric Distance Smoothing (Fast-in to avoid wall penetration, Smooth-out for clearance)
    const dt = Math.max(0.001, frameTime)
    if (targetDistance < this.currentDistance) {
      // Zooming in (hit wall): very fast response
      const fastInFactor = 1 - Math.exp(-35 * dt)
      this.currentDistance = THREE.MathUtils.lerp(
        this.currentDistance,
        targetDistance,
        fastInFactor,
      )
    } else {
      // Zooming out (open area): smooth relaxed recovery
      const smoothOutFactor = 1 - Math.exp(-12 * dt)
      this.currentDistance = THREE.MathUtils.lerp(
        this.currentDistance,
        targetDistance,
        smoothOutFactor,
      )
    }

    // 6. Compute ideal camera position with clamped dynamic distance
    const effectiveHDist = this.currentDistance * cosPitch
    const effectiveVDist = this.currentDistance * sinPitch

    this.idealPosition.set(
      this.scratchLookTarget.x + effectiveHDist * Math.sin(this.yaw),
      this.scratchLookTarget.y + effectiveVDist,
      this.scratchLookTarget.z + effectiveHDist * Math.cos(this.yaw),
    )

    if (!this.isInitialized) {
      this.camera.position.copy(this.idealPosition)
      this.currentTarget.copy(this.scratchLookTarget)
      this.isInitialized = true
    } else {
      // Frame-rate independent exponential smoothing
      const smoothFactor = 1 - Math.exp(-24 * dt)
      this.camera.position.lerp(this.idealPosition, smoothFactor)
      this.currentTarget.lerp(this.scratchLookTarget, smoothFactor)
    }

    this.camera.lookAt(this.currentTarget)
  }

  public snap(targetPosition: THREE.Vector3): void {
    this.scratchLookTarget.copy(targetPosition).add(this.targetOffset)
    this.currentDistance = GAME_CONFIG.camera.distance

    const cosPitch = Math.cos(this.pitch)
    const sinPitch = Math.sin(this.pitch)
    const hDist = this.currentDistance * cosPitch
    const vDist = this.currentDistance * sinPitch

    this.idealPosition.set(
      this.scratchLookTarget.x + hDist * Math.sin(this.yaw),
      this.scratchLookTarget.y + vDist,
      this.scratchLookTarget.z + hDist * Math.cos(this.yaw),
    )
    this.camera.position.copy(this.idealPosition)
    this.currentTarget.copy(this.scratchLookTarget)
    this.camera.lookAt(this.currentTarget)
    this.isInitialized = true
  }

  public getCurrentDistance(): number {
    return this.currentDistance
  }

  public getYaw(): number {
    return this.yaw
  }

  public setYaw(yaw: number): void {
    this.yaw = yaw
  }
}
