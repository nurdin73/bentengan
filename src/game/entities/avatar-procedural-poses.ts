import * as THREE from 'three'
import type { AvatarRigPivots } from './avatar-animation.types'

function safeDamping(rate: number, dt: number): number {
  const safeDt = Number.isFinite(dt) && dt > 0 ? dt : 0
  return 1 - Math.exp(-rate * safeDt)
}

export function applyStunnedPose(rig: AvatarRigPivots, nowMs: number): void {
  const wobble = Math.sin(nowMs * 0.008) * 0.16
  if (rig.pivotHead) rig.pivotHead.rotation.z = wobble
  rig.pivotTorso.rotation.z = wobble * 0.6
  if (rig.pivotArmL) rig.pivotArmL.rotation.x = 0.2
  if (rig.pivotArmR) rig.pivotArmR.rotation.x = 0.2
}

export function applyJailedStrugglePose(
  rig: AvatarRigPivots,
  dt: number,
  nowMs: number,
): void {
  const damping = safeDamping(10, dt)
  const tugPhase = Math.sin(nowMs * 0.006)
  const headShake = Math.sin(nowMs * 0.0045) * 0.14

  rig.pivotTorso.rotation.x = THREE.MathUtils.lerp(
    rig.pivotTorso.rotation.x,
    0.12 + tugPhase * 0.04,
    damping,
  )
  rig.pivotTorso.rotation.z = THREE.MathUtils.lerp(rig.pivotTorso.rotation.z, 0, damping)

  if (rig.pivotHead) {
    rig.pivotHead.rotation.x = THREE.MathUtils.lerp(rig.pivotHead.rotation.x, 0.14, damping)
    rig.pivotHead.rotation.y = THREE.MathUtils.lerp(rig.pivotHead.rotation.y, headShake, damping)
    rig.pivotHead.rotation.z = THREE.MathUtils.lerp(rig.pivotHead.rotation.z, 0, damping)
  }
  if (rig.pivotArmL) {
    rig.pivotArmL.rotation.x = THREE.MathUtils.lerp(
      rig.pivotArmL.rotation.x,
      -0.45 + tugPhase * 0.18,
      damping,
    )
  }
  if (rig.pivotArmR) {
    rig.pivotArmR.rotation.x = THREE.MathUtils.lerp(
      rig.pivotArmR.rotation.x,
      -0.45 - tugPhase * 0.18,
      damping,
    )
  }
  if (rig.pivotLegL) rig.pivotLegL.rotation.x = THREE.MathUtils.lerp(rig.pivotLegL.rotation.x, 0, damping)
  if (rig.pivotLegR) rig.pivotLegR.rotation.x = THREE.MathUtils.lerp(rig.pivotLegR.rotation.x, 0, damping)
}

export function applyVictoryTauntPose(
  rig: AvatarRigPivots,
  dt: number,
  nowMs: number,
): void {
  const damping = safeDamping(12, dt)
  const bounce = Math.abs(Math.sin(nowMs * 0.008))
  const wave = Math.sin(nowMs * 0.012) * 0.22

  rig.pivotTorso.rotation.x = THREE.MathUtils.lerp(rig.pivotTorso.rotation.x, -0.06, damping)
  rig.pivotTorso.rotation.z = THREE.MathUtils.lerp(rig.pivotTorso.rotation.z, wave * 0.25, damping)
  rig.rootGroup.scale.y = THREE.MathUtils.lerp(rig.rootGroup.scale.y, 1 + bounce * 0.05, damping)

  if (rig.pivotArmL) {
    rig.pivotArmL.rotation.x = THREE.MathUtils.lerp(rig.pivotArmL.rotation.x, -2.55 + wave, damping)
  }
  if (rig.pivotArmR) {
    rig.pivotArmR.rotation.x = THREE.MathUtils.lerp(rig.pivotArmR.rotation.x, -2.55 - wave, damping)
  }
  if (rig.pivotHead) {
    rig.pivotHead.rotation.x = THREE.MathUtils.lerp(rig.pivotHead.rotation.x, -0.1, damping)
    rig.pivotHead.rotation.y = THREE.MathUtils.lerp(rig.pivotHead.rotation.y, 0, damping)
  }
  if (rig.pivotLegL) {
    rig.pivotLegL.rotation.x = THREE.MathUtils.lerp(rig.pivotLegL.rotation.x, bounce * 0.25, damping)
  }
  if (rig.pivotLegR) {
    rig.pivotLegR.rotation.x = THREE.MathUtils.lerp(rig.pivotLegR.rotation.x, -bounce * 0.25, damping)
  }
}

export function applyDashLungePose(
  rig: AvatarRigPivots,
  dt: number,
  walkCycle: number,
): void {
  const damping = safeDamping(16, dt)
  const sinWalk = Math.sin(walkCycle)

  rig.pivotTorso.rotation.x = THREE.MathUtils.lerp(rig.pivotTorso.rotation.x, 0.36, damping)
  rig.pivotTorso.rotation.z = THREE.MathUtils.lerp(rig.pivotTorso.rotation.z, sinWalk * 0.05, damping)

  if (rig.pivotArmL) {
    rig.pivotArmL.rotation.x = THREE.MathUtils.lerp(rig.pivotArmL.rotation.x, 0.85, damping)
  }
  if (rig.pivotArmR) {
    rig.pivotArmR.rotation.x = THREE.MathUtils.lerp(rig.pivotArmR.rotation.x, 0.85, damping)
  }
  if (rig.pivotLegL) rig.pivotLegL.rotation.x = -sinWalk * 0.82
  if (rig.pivotLegR) rig.pivotLegR.rotation.x = sinWalk * 0.82
  if (rig.pivotHead) {
    rig.pivotHead.rotation.x = THREE.MathUtils.lerp(rig.pivotHead.rotation.x, -0.2, damping)
    rig.pivotHead.rotation.y = THREE.MathUtils.lerp(rig.pivotHead.rotation.y, 0, damping)
    rig.pivotHead.rotation.z = 0
  }
}

export function applyLocomotionPose(
  rig: AvatarRigPivots,
  dt: number,
  walkCycle: number,
  isSprinting: boolean,
): void {
  const armAmp = isSprinting ? 0.75 : 0.45
  const legAmp = isSprinting ? 0.68 : 0.38
  const sinWalk = Math.sin(walkCycle)

  if (rig.pivotArmL) rig.pivotArmL.rotation.x = sinWalk * armAmp
  if (rig.pivotArmR) rig.pivotArmR.rotation.x = -sinWalk * armAmp
  if (rig.pivotLegL) rig.pivotLegL.rotation.x = -sinWalk * legAmp
  if (rig.pivotLegR) rig.pivotLegR.rotation.x = sinWalk * legAmp

  const targetTorsoTilt = isSprinting ? 0.18 : 0.08
  const tiltDamping = safeDamping(12, dt)
  rig.pivotTorso.rotation.x = THREE.MathUtils.lerp(
    rig.pivotTorso.rotation.x,
    targetTorsoTilt,
    tiltDamping,
  )
  rig.pivotTorso.rotation.z = sinWalk * (isSprinting ? 0.04 : 0.02)

  if (rig.pivotHead) {
    rig.pivotHead.rotation.x = Math.sin(walkCycle * 2) * 0.04
    rig.pivotHead.rotation.y = THREE.MathUtils.lerp(rig.pivotHead.rotation.y, 0, tiltDamping)
    rig.pivotHead.rotation.z = 0
  }
}

export function applyAirbornePose(rig: AvatarRigPivots, dt: number): void {
  const jumpDamping = safeDamping(10, dt)
  if (rig.pivotArmL) {
    rig.pivotArmL.rotation.x = THREE.MathUtils.lerp(rig.pivotArmL.rotation.x, -0.35, jumpDamping)
  }
  if (rig.pivotArmR) {
    rig.pivotArmR.rotation.x = THREE.MathUtils.lerp(rig.pivotArmR.rotation.x, -0.35, jumpDamping)
  }
  if (rig.pivotLegL) {
    rig.pivotLegL.rotation.x = THREE.MathUtils.lerp(rig.pivotLegL.rotation.x, 0.3, jumpDamping)
  }
  if (rig.pivotLegR) {
    rig.pivotLegR.rotation.x = THREE.MathUtils.lerp(rig.pivotLegR.rotation.x, 0.3, jumpDamping)
  }
  rig.pivotTorso.rotation.x = THREE.MathUtils.lerp(rig.pivotTorso.rotation.x, 0.05, jumpDamping)
}

export function applyIdleBreathingPose(
  rig: AvatarRigPivots,
  dt: number,
  nowMs: number,
  isExhausted: boolean,
): void {
  const returnDamping = safeDamping(12, dt)
  const breathRate = isExhausted ? 0.011 : 0.0028
  const breathAmp = isExhausted ? 0.065 : 0.022
  const breath = Math.sin(nowMs * breathRate)
  const headScan = isExhausted ? 0 : Math.sin(nowMs * 0.0012) * 0.08

  const baseTorsoPitch = isExhausted ? 0.22 + breath * 0.05 : breath * breathAmp
  const baseArmSwing = isExhausted ? 0.18 + breath * 0.04 : breath * 0.03

  if (rig.pivotArmL) {
    rig.pivotArmL.rotation.x = THREE.MathUtils.lerp(rig.pivotArmL.rotation.x, baseArmSwing, returnDamping)
  }
  if (rig.pivotArmR) {
    rig.pivotArmR.rotation.x = THREE.MathUtils.lerp(rig.pivotArmR.rotation.x, baseArmSwing, returnDamping)
  }
  if (rig.pivotLegL) {
    rig.pivotLegL.rotation.x = THREE.MathUtils.lerp(rig.pivotLegL.rotation.x, 0, returnDamping)
  }
  if (rig.pivotLegR) {
    rig.pivotLegR.rotation.x = THREE.MathUtils.lerp(rig.pivotLegR.rotation.x, 0, returnDamping)
  }
  rig.pivotTorso.rotation.x = THREE.MathUtils.lerp(rig.pivotTorso.rotation.x, baseTorsoPitch, returnDamping)
  rig.pivotTorso.rotation.z = THREE.MathUtils.lerp(rig.pivotTorso.rotation.z, 0, returnDamping)
  if (rig.pivotHead) {
    const headPitch = isExhausted ? 0.18 + breath * 0.04 : -breath * 0.015
    rig.pivotHead.rotation.x = THREE.MathUtils.lerp(rig.pivotHead.rotation.x, headPitch, returnDamping)
    rig.pivotHead.rotation.y = THREE.MathUtils.lerp(rig.pivotHead.rotation.y, headScan, returnDamping)
    rig.pivotHead.rotation.z = THREE.MathUtils.lerp(rig.pivotHead.rotation.z, 0, returnDamping)
  }
}

export function applyTagSwipeOverlay(
  rig: AvatarRigPivots,
  tagSwipeProgress: number,
): void {
  if (!Number.isFinite(tagSwipeProgress) || tagSwipeProgress <= 0) return
  const arc = Math.sin(Math.min(1, tagSwipeProgress) * Math.PI)
  if (rig.pivotArmR) {
    rig.pivotArmR.rotation.x = THREE.MathUtils.lerp(rig.pivotArmR.rotation.x, -1.35, arc)
  }
  rig.pivotTorso.rotation.y = THREE.MathUtils.lerp(rig.pivotTorso.rotation.y, 0.35 * arc, arc)
  rig.pivotTorso.rotation.x += 0.14 * arc
}

export function applyLandSquashOverlay(
  rig: AvatarRigPivots,
  dt: number,
  landSquashProgress: number,
): void {
  const damping = safeDamping(18, dt)
  if (Number.isFinite(landSquashProgress) && landSquashProgress > 0) {
    const squash = Math.sin(Math.min(1, landSquashProgress) * Math.PI)
    rig.rootGroup.scale.set(1 + squash * 0.1, 1 - squash * 0.16, 1 + squash * 0.1)
    rig.pivotTorso.rotation.x += squash * 0.16
    return
  }

  rig.rootGroup.scale.x = THREE.MathUtils.lerp(rig.rootGroup.scale.x, 1, damping)
  rig.rootGroup.scale.y = THREE.MathUtils.lerp(rig.rootGroup.scale.y, 1, damping)
  rig.rootGroup.scale.z = THREE.MathUtils.lerp(rig.rootGroup.scale.z, 1, damping)
  rig.pivotTorso.rotation.y = THREE.MathUtils.lerp(rig.pivotTorso.rotation.y, 0, damping)
}

