import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { TeamId } from '../../types/game.types'

export type OutfitPresetId = 1 | 2 | 3 | 4 | 5 | 6

export interface OutfitPresetMeta {
  id: OutfitPresetId
  name: string
  subtitle: string
  description: string
  hatName: string
  topName: string
  bottomName: string
  shoesName: string
}

export const OUTFIT_PRESETS: OutfitPresetMeta[] = [
  {
    id: 1,
    name: 'Casual Striker',
    subtitle: 'Street Casual',
    description: 'Topi trucker dua warna, kaos santai boxy, celana jeans rolled-cuff, dan sepatu boot chunky.',
    hatName: 'Trucker Cap',
    topName: 'Boxy Tee',
    bottomName: 'Rolled Jeans',
    shoesName: 'Chunky Boots',
  },
  {
    id: 2,
    name: 'Jawara Nusantara',
    subtitle: 'Pendekar Tradisional',
    description: 'Udeng ikat kepala batik, baju pangsi pesilat, sabuk emas nusantara, dan celana komprang.',
    hatName: 'Udeng Tradisional',
    topName: 'Baju Pangsi & Sabuk',
    bottomName: 'Celana Komprang',
    shoesName: 'Sandal Jawara',
  },
  {
    id: 3,
    name: 'Street Sprinter',
    subtitle: 'Urban Runner',
    description: 'Topi terbalik dengan jambul rambut, hoodie santai saku kanguru, dan celana training garis samping.',
    hatName: 'Backwards Cap & Tuft',
    topName: 'Kangaroo Hoodie',
    bottomName: 'Trackpants',
    shoesName: 'Running Kicks',
  },
  {
    id: 4,
    name: 'Athletic Runner',
    subtitle: 'Sporty Sprinter',
    description: 'Rambut spike energik, sweatband dahi, tank top tanpa lengan, dan celana pendek atletik.',
    hatName: 'Sweatband & Hair',
    topName: 'Athletic Tank',
    bottomName: 'Sport Shorts',
    shoesName: 'Sport Shoes',
  },
  {
    id: 5,
    name: 'Bocil Pramuka',
    subtitle: 'Seragam Sekolah',
    description: 'Baret miring emblem emas garuda, kemeja kacu merah-putih, celana pendek seragam, dan kaus kaki tinggi.',
    hatName: 'Baret Pramuka',
    topName: 'Kemeja Kacu',
    bottomName: 'Celana Seragam',
    shoesName: 'High Socks & Shoes',
  },
  {
    id: 6,
    name: 'Urban Puffer',
    subtitle: 'Musim Dingin Kota',
    description: 'Kupluk pom-pom beanie tebal, rompi puffer ber-zipper modern, dan celana kargo saku samping.',
    hatName: 'Pom-Pom Beanie',
    topName: 'Puffer Vest',
    bottomName: 'Cargo Pants',
    shoesName: 'Winter Boots',
  },
]

export interface CharacterAvatarOptions {
  teamId: TeamId
  outfitId?: number
}

let cachedTemplateScene: THREE.Group | null = null
let loadPromise: Promise<THREE.Group | null> | null = null

export function setCharacterModelTemplate(template: THREE.Group): void {
  cachedTemplateScene = template
}

export function getCharacterModelTemplate(): THREE.Group | null {
  return cachedTemplateScene
}

export async function preloadCharacterModel(
  url = '/models/character_modular.glb',
): Promise<THREE.Group | null> {
  if (cachedTemplateScene) return cachedTemplateScene
  if (loadPromise) return loadPromise

  // Check if running in browser / environment with valid HTTP URL handling
  if (
    typeof window === 'undefined' ||
    typeof fetch === 'undefined' ||
    !window.location ||
    !window.location.protocol ||
    !window.location.protocol.startsWith('http')
  ) {
    return null
  }

  loadPromise = new Promise<THREE.Group | null>((resolve) => {
    try {
      const loader = new GLTFLoader()
      loader.load(
        url,
        (gltf) => {
          cachedTemplateScene = gltf.scene
          resolve(cachedTemplateScene)
        },
        undefined,
        (err) => {
          console.warn('[CharacterAvatar] Could not load GLTF model:', err)
          resolve(null)
        },
      )
    } catch {
      resolve(null)
    }
  })

  return loadPromise
}

export class CharacterAvatar {
  public readonly rootGroup: THREE.Group
  public teamId: TeamId
  public outfitId: number

  public pivotTorso: THREE.Object3D | null = null
  public pivotHead: THREE.Object3D | null = null
  public pivotArmL: THREE.Object3D | null = null
  public pivotArmR: THREE.Object3D | null = null
  public pivotLegL: THREE.Object3D | null = null
  public pivotLegR: THREE.Object3D | null = null

  private readonly materials = new Set<THREE.Material>()
  private walkCycle = 0
  private isModelAttached = false

  constructor(options: CharacterAvatarOptions) {
    this.teamId = options.teamId
    this.outfitId = Math.max(1, Math.min(6, options.outfitId ?? 1))
    this.rootGroup = new THREE.Group()
    this.rootGroup.name = 'CharacterAvatar_Root'

    // Offset so feet align with ground when parent mesh is centered at Y=0.8m
    this.rootGroup.position.set(0, -0.8, 0)

    if (cachedTemplateScene) {
      this.attachTemplateModel(cachedTemplateScene)
    } else {
      this.buildFallbackMesh()
      // Trigger background load if in browser
      if (
        typeof window !== 'undefined' &&
        typeof fetch !== 'undefined' &&
        window.location &&
        window.location.protocol &&
        window.location.protocol.startsWith('http')
      ) {
        preloadCharacterModel().then((template) => {
          if (template && !this.isModelAttached) {
            this.attachTemplateModel(template)
          }
        }).catch(() => null)
      }
    }
  }

  private buildFallbackMesh(): void {
    const torsoPivot = new THREE.Group()
    torsoPivot.name = 'Pivot_Torso'
    this.rootGroup.add(torsoPivot)
    this.pivotTorso = torsoPivot

    const headPivot = new THREE.Group()
    headPivot.name = 'Pivot_Head'
    torsoPivot.add(headPivot)
    this.pivotHead = headPivot

    const armLPivot = new THREE.Group()
    armLPivot.name = 'Pivot_Arm_L'
    torsoPivot.add(armLPivot)
    this.pivotArmL = armLPivot

    const armRPivot = new THREE.Group()
    armRPivot.name = 'Pivot_Arm_R'
    torsoPivot.add(armRPivot)
    this.pivotArmR = armRPivot

    const legLPivot = new THREE.Group()
    legLPivot.name = 'Pivot_Leg_L'
    this.rootGroup.add(legLPivot)
    this.pivotLegL = legLPivot

    const legRPivot = new THREE.Group()
    legRPivot.name = 'Pivot_Leg_R'
    this.rootGroup.add(legRPivot)
    this.pivotLegR = legRPivot

    const primaryColor = this.teamId === 'blue' ? 0x3b82f6 : 0xef4444
    const bodyMat = new THREE.MeshStandardMaterial({
      color: primaryColor,
      roughness: 0.35,
      name: 'Mat_Team_Primary',
    })
    this.materials.add(bodyMat)

    const torsoMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.3), bodyMat)
    torsoMesh.position.set(0, 0.65, 0)
    torsoPivot.add(torsoMesh)

    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xfed7aa,
      roughness: 0.5,
      name: 'Mat_Skin',
    })
    this.materials.add(skinMat)
    const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.5), skinMat)
    headMesh.position.set(0, 1.25, 0)
    headPivot.add(headMesh)
  }

  public attachTemplateModel(template: THREE.Group): void {
    if (this.isModelAttached) return
    this.isModelAttached = true

    // Clean existing children if any
    while (this.rootGroup.children.length > 0) {
      this.rootGroup.remove(this.rootGroup.children[0]!)
    }

    const clone = template.clone(true)
    clone.name = 'ModularCharacter_Instance'

    // Clone materials uniquely so team colors and opacity are strictly per-player
    this.materials.clear()
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        if (Array.isArray(child.material)) {
          child.material = child.material.map((m) => {
            const clonedMat = m.clone()
            this.materials.add(clonedMat)
            return clonedMat
          })
        } else {
          const clonedMat = child.material.clone()
          this.materials.add(clonedMat)
          child.material = clonedMat
        }
        child.castShadow = true
        child.receiveShadow = true
      }
    })

    // Query joint pivots
    this.pivotTorso = clone.getObjectByName('Pivot_Torso') || null
    this.pivotHead = clone.getObjectByName('Pivot_Head') || null
    this.pivotArmL = clone.getObjectByName('Pivot_Arm_L') || null
    this.pivotArmR = clone.getObjectByName('Pivot_Arm_R') || null
    this.pivotLegL = clone.getObjectByName('Pivot_Leg_L') || null
    this.pivotLegR = clone.getObjectByName('Pivot_Leg_R') || null

    this.rootGroup.add(clone)

    this.applyOutfit(this.outfitId)
    this.applyTeamColors(this.teamId)
  }

  public applyOutfit(outfitId: number): void {
    this.outfitId = Math.max(1, Math.min(6, outfitId))
    const targetStr = `0${this.outfitId}`
    const isOutfit2 = this.outfitId === 2

    this.rootGroup.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return

      const name = child.name

      // Base character anatomy meshes are always visible
      if (
        name.endsWith('_Base') ||
        name.startsWith('Neck_') ||
        name.startsWith('Head_') ||
        name.startsWith('Eye_') ||
        name.startsWith('Arm_')
      ) {
        child.visible = true
        return
      }

      // Shoes slot: Outfit 2 uses Shoes02 (sandals), all other outfits use Shoes01 (sneakers/boots)
      if (name.startsWith('Shoes02')) {
        child.visible = isOutfit2
        return
      }
      if (name.startsWith('Shoes01')) {
        child.visible = !isOutfit2
        return
      }

      // Outfit slots: Top, Bottom, Hat matching preset index
      const isMatch =
        name.startsWith(`Top${targetStr}`) ||
        name.startsWith(`Bot${targetStr}`) ||
        name.startsWith(`Hat${targetStr}`)

      child.visible = isMatch
    })
  }

  public applyTeamColors(teamId: TeamId): void {
    this.teamId = teamId
    const primaryHex = teamId === 'blue' ? 0x3b82f6 : 0xef4444
    const secondaryHex = teamId === 'blue' ? 0xbae6fd : 0xfecaca

    for (const mat of this.materials) {
      if ('color' in mat && mat instanceof THREE.MeshStandardMaterial) {
        if (mat.name.includes('Mat_Team_Primary')) {
          mat.color.setHex(primaryHex)
        } else if (mat.name.includes('Mat_Team_Secondary')) {
          mat.color.setHex(secondaryHex)
        }
      }
    }
  }

  public setOpacity(opacity: number): void {
    const isTransparent = opacity < 0.999
    for (const mat of this.materials) {
      mat.transparent = isTransparent
      mat.opacity = opacity
      mat.needsUpdate = true
    }
  }

  public updateAnimation(
    dt: number,
    speed: number,
    isGrounded: boolean,
    isSprinting: boolean,
    isStunned = false,
    isJailed = false,
  ): void {
    if (!this.pivotTorso) return

    const now = performance.now()

    if (isStunned) {
      // Stunned: Wobbling head and drooping torso
      const wobble = Math.sin(now * 0.008) * 0.16
      if (this.pivotHead) this.pivotHead.rotation.z = wobble
      if (this.pivotTorso) this.pivotTorso.rotation.z = wobble * 0.6
      if (this.pivotArmL) this.pivotArmL.rotation.x = 0.2
      if (this.pivotArmR) this.pivotArmR.rotation.x = 0.2
      return
    }

    if (isJailed) {
      // Jailed: Slumped posture
      const damping = 1 - Math.exp(-10 * dt)
      if (this.pivotTorso) this.pivotTorso.rotation.x = THREE.MathUtils.lerp(this.pivotTorso.rotation.x, 0.1, damping)
      if (this.pivotHead) this.pivotHead.rotation.x = THREE.MathUtils.lerp(this.pivotHead.rotation.x, 0.15, damping)
      if (this.pivotArmL) this.pivotArmL.rotation.x = THREE.MathUtils.lerp(this.pivotArmL.rotation.x, 0.1, damping)
      if (this.pivotArmR) this.pivotArmR.rotation.x = THREE.MathUtils.lerp(this.pivotArmR.rotation.x, 0.1, damping)
      return
    }

    const isMovingGrounded = speed > 0.4 && isGrounded

    if (isMovingGrounded) {
      const animSpeed = isSprinting ? 14 : 9
      this.walkCycle += dt * animSpeed

      const armAmp = isSprinting ? 0.75 : 0.45
      const legAmp = isSprinting ? 0.68 : 0.38

      const sinWalk = Math.sin(this.walkCycle)

      // Inverse limb swing
      if (this.pivotArmL) this.pivotArmL.rotation.x = sinWalk * armAmp
      if (this.pivotArmR) this.pivotArmR.rotation.x = -sinWalk * armAmp
      if (this.pivotLegL) this.pivotLegL.rotation.x = -sinWalk * legAmp
      if (this.pivotLegR) this.pivotLegR.rotation.x = sinWalk * legAmp

      // Subtle torso forward tilt & waddle
      const targetTorsoTilt = isSprinting ? 0.18 : 0.08
      const tiltDamping = 1 - Math.exp(-12 * dt)
      this.pivotTorso.rotation.x = THREE.MathUtils.lerp(this.pivotTorso.rotation.x, targetTorsoTilt, tiltDamping)
      this.pivotTorso.rotation.z = Math.sin(this.walkCycle) * (isSprinting ? 0.04 : 0.02)

      // Head bobbing
      if (this.pivotHead) {
        this.pivotHead.rotation.x = Math.sin(this.walkCycle * 2) * 0.04
        this.pivotHead.rotation.z = 0
      }
    } else if (!isGrounded) {
      // Airborne / Jump Pose: Arms up, legs bent back
      const jumpDamping = 1 - Math.exp(-10 * dt)
      if (this.pivotArmL) this.pivotArmL.rotation.x = THREE.MathUtils.lerp(this.pivotArmL.rotation.x, -0.35, jumpDamping)
      if (this.pivotArmR) this.pivotArmR.rotation.x = THREE.MathUtils.lerp(this.pivotArmR.rotation.x, -0.35, jumpDamping)
      if (this.pivotLegL) this.pivotLegL.rotation.x = THREE.MathUtils.lerp(this.pivotLegL.rotation.x, 0.3, jumpDamping)
      if (this.pivotLegR) this.pivotLegR.rotation.x = THREE.MathUtils.lerp(this.pivotLegR.rotation.x, 0.3, jumpDamping)
      this.pivotTorso.rotation.x = THREE.MathUtils.lerp(this.pivotTorso.rotation.x, 0.05, jumpDamping)
    } else {
      // Grounded Idle: Smoothly return all joints to zero
      const returnDamping = 1 - Math.exp(-12 * dt)
      if (this.pivotArmL) this.pivotArmL.rotation.x = THREE.MathUtils.lerp(this.pivotArmL.rotation.x, 0, returnDamping)
      if (this.pivotArmR) this.pivotArmR.rotation.x = THREE.MathUtils.lerp(this.pivotArmR.rotation.x, 0, returnDamping)
      if (this.pivotLegL) this.pivotLegL.rotation.x = THREE.MathUtils.lerp(this.pivotLegL.rotation.x, 0, returnDamping)
      if (this.pivotLegR) this.pivotLegR.rotation.x = THREE.MathUtils.lerp(this.pivotLegR.rotation.x, 0, returnDamping)
      this.pivotTorso.rotation.x = THREE.MathUtils.lerp(this.pivotTorso.rotation.x, 0, returnDamping)
      this.pivotTorso.rotation.z = THREE.MathUtils.lerp(this.pivotTorso.rotation.z, 0, returnDamping)
      if (this.pivotHead) {
        this.pivotHead.rotation.x = THREE.MathUtils.lerp(this.pivotHead.rotation.x, 0, returnDamping)
        this.pivotHead.rotation.z = THREE.MathUtils.lerp(this.pivotHead.rotation.z, 0, returnDamping)
      }
    }
  }

  public dispose(): void {
    if (this.rootGroup.parent) {
      this.rootGroup.parent.remove(this.rootGroup)
    }
    while (this.rootGroup.children.length > 0) {
      this.rootGroup.remove(this.rootGroup.children[0]!)
    }
    for (const mat of this.materials) {
      mat.dispose()
    }
    this.materials.clear()
  }
}
