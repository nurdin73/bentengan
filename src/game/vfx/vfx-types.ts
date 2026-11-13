import type * as THREE from 'three'

export interface Vector3Position {
  x: number
  y: number
  z: number
}

export interface Particle {
  mesh: THREE.Mesh
  active: boolean
  lifetime: number
  maxLifetime: number
  velocity: THREE.Vector3
  initialScale: number
  scaleMultiplier: number
  gravity?: number
  baseOpacity?: number
}

export interface ShockwaveRing {
  mesh: THREE.Mesh
  active: boolean
  lifetime: number
  maxLifetime: number
  startScale: number
  targetScale: number
  baseOpacity?: number
}

export interface DashGhost {
  mesh: THREE.Mesh
  active: boolean
  lifetime: number
  maxLifetime: number
}

export interface SpeedLine {
  mesh: THREE.Mesh
  active: boolean
  lifetime: number
  maxLifetime: number
  velocity: THREE.Vector3
}

