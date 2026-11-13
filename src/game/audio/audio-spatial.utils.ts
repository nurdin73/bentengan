export interface SpatialPoint {
  x: number
  y?: number
  z: number
}

export interface SpatialMix {
  gain: number
  pan: number
}

export function computeSpatialMix(
  listener: SpatialPoint | null,
  listenerYawRad: number,
  origin?: SpatialPoint,
  maxDist = 36,
): SpatialMix {
  if (!listener || !origin || !Number.isFinite(maxDist) || maxDist <= 0) {
    return { gain: 1, pan: 0 }
  }

  const dx = origin.x - listener.x
  const dz = origin.z - listener.z
  if (!Number.isFinite(dx) || !Number.isFinite(dz)) {
    return { gain: 1, pan: 0 }
  }

  const distSq = dx * dx + dz * dz
  if (distSq < 0.04) {
    return { gain: 1, pan: 0 }
  }

  const dist = Math.sqrt(distSq)
  if (dist >= maxDist) {
    return { gain: 0, pan: 0 }
  }

  // Smooth inverse-quadratic distance curve normalized at maxDist
  const t = dist / maxDist
  const gain = Math.max(0, Math.min(1, (1 - t) * (1 - t * 0.45)))

  const safeYaw = Number.isFinite(listenerYawRad) ? listenerYawRad : 0
  const rightX = Math.cos(safeYaw)
  const rightZ = -Math.sin(safeYaw)
  const rawPan = ((dx / dist) * rightX + (dz / dist) * rightZ) * Math.min(1, dist / 6)
  const pan = Math.max(-1, Math.min(1, rawPan))

  return { gain, pan }
}

