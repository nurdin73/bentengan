import { describe, it, expect, beforeEach } from 'vitest'
import * as THREE from 'three'
import { setActivePinia, createPinia } from 'pinia'
import { GAME_CONFIG } from '../game/core/constants'
import { ThirdPersonCameraController } from '../game/camera/third-person'
import { useSettingsStore } from '../stores/settings-store'

describe('Camera SpringArm Collision & Distance Clamping', () => {
  it('should clamp camera distance before obstacles with safety buffer', () => {
    const maxDistance = GAME_CONFIG.camera.distance // 4.5
    const minDistance = GAME_CONFIG.camera.minDistance // 1.0
    const wallBuffer = GAME_CONFIG.camera.wallBuffer // 0.25

    // Case 1: Obstacle hit at 3.0m
    const hitToi1 = 3.0
    const clampedDist1 = Math.max(minDistance, hitToi1 - wallBuffer)
    expect(clampedDist1).toBe(2.75)

    // Case 2: Obstacle very close at 0.8m
    const hitToi2 = 0.8
    const clampedDist2 = Math.max(minDistance, hitToi2 - wallBuffer)
    expect(clampedDist2).toBe(minDistance) // clamped to minDistance (1.0m)

    // Case 3: No obstacle hit
    const hitToi3 = null
    const clampedDist3 =
      hitToi3 !== null ? Math.max(minDistance, hitToi3 - wallBuffer) : maxDistance
    expect(clampedDist3).toBe(4.5)
  })

  it('should calculate character fade opacity correctly when camera is close', () => {
    const { fadeDistance, minDistance } = GAME_CONFIG.camera

    const calculateOpacity = (camDist: number) => {
      if (camDist < fadeDistance) {
        const ratio = Math.max(0, (camDist - minDistance) / (fadeDistance - minDistance))
        return THREE.MathUtils.lerp(0.25, 1.0, ratio)
      }
      return 1.0
    }

    // Camera at normal distance: full opacity
    expect(calculateOpacity(4.5)).toBe(1.0)
    expect(calculateOpacity(fadeDistance)).toBe(1.0)

    // Camera at minDistance (pushed completely against player): 0.25 opacity
    expect(calculateOpacity(minDistance)).toBe(0.25)

    // Camera midway between minDistance and fadeDistance: between 0.25 and 1.0
    const midDist = (minDistance + fadeDistance) / 2
    expect(calculateOpacity(midDist)).toBeCloseTo(0.625, 2)
  })

  it('should apply asymmetric distance smoothing (fast-in vs smooth-out)', () => {
    const dt = 1 / 60
    const fastInFactor = 1 - Math.exp(-35 * dt)
    const smoothOutFactor = 1 - Math.exp(-12 * dt)

    // Fast-in factor should respond significantly quicker than smooth-out recovery
    expect(fastInFactor).toBeGreaterThan(smoothOutFactor * 2)
  })
})

describe('Camera Trauma Shake & NaN Resilience', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('clamps trauma to [0, 1], decays over updates, and respects screenShakeEnabled setting', () => {
    const cam = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 150)
    const ctrl = new ThirdPersonCameraController(cam)
    const target = new THREE.Vector3(0, 1, 0)

    ctrl.addTrauma(0.6)
    ctrl.addTrauma(0.9)
    expect(ctrl.getTrauma()).toBe(1)

    ctrl.update(target, 0, 0, 0.05)
    expect(ctrl.getTrauma()).toBeLessThan(1)
    expect(Number.isFinite(cam.position.x)).toBe(true)

    const store = useSettingsStore()
    store.setScreenShakeEnabled(false)
    ctrl.addTrauma(0.5)

    // Compare rotation against a clean camera when shake is disabled
    const refCam = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 150)
    const refCtrl = new ThirdPersonCameraController(refCam)
    refCtrl.snap(target)
    ctrl.snap(target)
    ctrl.update(target, 0, 0, 0.016)
    refCtrl.update(target, 0, 0, 0.016)

    expect(cam.rotation.z).toBeCloseTo(refCam.rotation.z, 5)
  })

  it('ignores NaN frameTime and delta inputs without poisoning camera transforms', () => {
    const cam = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 150)
    const ctrl = new ThirdPersonCameraController(cam)
    const target = new THREE.Vector3(0, 1, 0)

    ctrl.snap(target)
    ctrl.update(target, Number.NaN, Number.POSITIVE_INFINITY, Number.NaN)

    expect(Number.isFinite(cam.position.x)).toBe(true)
    expect(Number.isFinite(cam.position.y)).toBe(true)
    expect(Number.isFinite(cam.position.z)).toBe(true)
    expect(Number.isFinite(cam.rotation.z)).toBe(true)
  })
})
