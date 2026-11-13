import type * as THREE from 'three'

export interface AvatarAnimationExtras {
  isDashing?: boolean
  isAdrenaline?: boolean
  isExhausted?: boolean
  tagSwipeProgress?: number
  landSquashProgress?: number
  isVictorious?: boolean
}

export interface AvatarRigPivots {
  rootGroup: THREE.Group
  pivotTorso: THREE.Object3D
  pivotHead: THREE.Object3D | null
  pivotArmL: THREE.Object3D | null
  pivotArmR: THREE.Object3D | null
  pivotLegL: THREE.Object3D | null
  pivotLegR: THREE.Object3D | null
}

