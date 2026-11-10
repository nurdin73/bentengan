import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as THREE from 'three'
import {
  CharacterAvatar,
  setCharacterModelTemplate,
  getCharacterModelTemplate,
  type OutfitPresetId,
} from '../game/entities/character-avatar'
import { PhysicsWorld } from '../game/physics/physics-world'
import { PlayerController } from '../game/entities/player-controller'
import { RemotePlayerController } from '../game/entities/remote-player-controller'
import { BotController } from '../game/entities/bot-controller'

function buildMockCharacterGLTF(): THREE.Group {
  const root = new THREE.Group()
  root.name = 'Character_Root'

  const torsoPivot = new THREE.Group()
  torsoPivot.name = 'Pivot_Torso'
  root.add(torsoPivot)

  const headPivot = new THREE.Group()
  headPivot.name = 'Pivot_Head'
  torsoPivot.add(headPivot)

  const armLPivot = new THREE.Group()
  armLPivot.name = 'Pivot_Arm_L'
  torsoPivot.add(armLPivot)

  const armRPivot = new THREE.Group()
  armRPivot.name = 'Pivot_Arm_R'
  torsoPivot.add(armRPivot)

  const legLPivot = new THREE.Group()
  legLPivot.name = 'Pivot_Leg_L'
  root.add(legLPivot)

  const legRPivot = new THREE.Group()
  legRPivot.name = 'Pivot_Leg_R'
  root.add(legRPivot)

  // Outfits 1 to 6 Top, Bottom, Hat
  const matPrimary = new THREE.MeshStandardMaterial({ name: 'Mat_Team_Primary' })
  const matSecondary = new THREE.MeshStandardMaterial({ name: 'Mat_Team_Secondary' })

  for (let i = 1; i <= 6; i++) {
    const pad = i.toString().padStart(2, '0')
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.3), matPrimary)
    top.name = `Top${pad}_Item`
    torsoPivot.add(top)

    const bot = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.3), matSecondary)
    bot.name = `Bot${pad}_Item`
    root.add(bot)

    const hat = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.4), matPrimary)
    hat.name = `Hat${pad}_Item`
    headPivot.add(hat)
  }

  // Base mesh
  const baseHead = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5))
  baseHead.name = 'Head_Base'
  headPivot.add(baseHead)

  return root
}

describe('CharacterAvatar Modular Soft-box Avatar System', () => {
  let mockGLTF: THREE.Group

  beforeEach(() => {
    mockGLTF = buildMockCharacterGLTF()
    setCharacterModelTemplate(mockGLTF)
  })

  afterEach(() => {
    setCharacterModelTemplate(null as unknown as THREE.Group)
  })

  it('initializes and discovers hierarchical pivots from GLTF template', () => {
    const avatar = new CharacterAvatar({ teamId: 'blue', outfitId: 1 })

    expect(avatar.pivotTorso).not.toBeNull()
    expect(avatar.pivotHead).not.toBeNull()
    expect(avatar.pivotArmL).not.toBeNull()
    expect(avatar.pivotArmR).not.toBeNull()
    expect(avatar.pivotLegL).not.toBeNull()
    expect(avatar.pivotLegR).not.toBeNull()
    expect(avatar.rootGroup.children.length).toBeGreaterThan(0)
  })

  it('activates meshes for preset outfit and hides meshes of other outfits', () => {
    const avatar = new CharacterAvatar({ teamId: 'blue', outfitId: 2 })

    // In Outfit 2:
    // Top02_Item should be visible, Top01_Item and Top03_Item should be invisible
    let top01Visible = false
    let top02Visible = false
    let top03Visible = false

    avatar.rootGroup.traverse((obj) => {
      if (obj.name === 'Top01_Item') top01Visible = obj.visible
      if (obj.name === 'Top02_Item') top02Visible = obj.visible
      if (obj.name === 'Top03_Item') top03Visible = obj.visible
    })

    expect(top02Visible).toBe(true)
    expect(top01Visible).toBe(false)
    expect(top03Visible).toBe(false)

    // Switch to outfit 3
    avatar.applyOutfit(3)
    avatar.rootGroup.traverse((obj) => {
      if (obj.name === 'Top01_Item') top01Visible = obj.visible
      if (obj.name === 'Top02_Item') top02Visible = obj.visible
      if (obj.name === 'Top03_Item') top03Visible = obj.visible
    })

    expect(top03Visible).toBe(true)
    expect(top02Visible).toBe(false)
    expect(top01Visible).toBe(false)
  })

  it('switches dynamic team colors for Mat_Team_Primary and Mat_Team_Secondary', () => {
    const avatar = new CharacterAvatar({ teamId: 'blue', outfitId: 1 })

    let primaryMat: THREE.MeshStandardMaterial | null = null
    let secondaryMat: THREE.MeshStandardMaterial | null = null

    avatar.rootGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        if (obj.material?.name === 'Mat_Team_Primary') primaryMat = obj.material
        if (obj.material?.name === 'Mat_Team_Secondary') secondaryMat = obj.material
      }
    })

    expect(primaryMat).not.toBeNull()
    expect(secondaryMat).not.toBeNull()

    // Blue Team: Primary is #3B82F6 (0x3B82F6)
    expect(primaryMat!.color.getHexString().toLowerCase()).toBe('3b82f6')
    expect(secondaryMat!.color.getHexString().toLowerCase()).toBe('bae6fd')

    // Switch to Red Team
    avatar.applyTeamColors('red')
    expect(primaryMat!.color.getHexString().toLowerCase()).toBe('ef4444')
    expect(secondaryMat!.color.getHexString().toLowerCase()).toBe('fecaca')
  })

  it('runs updateAnimation cleanly and adjusts leg/arm swing when moving', () => {
    const avatar = new CharacterAvatar({ teamId: 'blue', outfitId: 1 })

    expect(Math.abs(avatar.pivotLegL!.rotation.x)).toBe(0)
    expect(Math.abs(avatar.pivotLegR!.rotation.x)).toBe(0)

    // Running tick
    avatar.updateAnimation(0.016, 8.0, true, false, false, false)

    expect(avatar.pivotLegL!.rotation.x).not.toBe(0)
    expect(avatar.pivotLegR!.rotation.x).not.toBe(0)
    expect(avatar.pivotArmL!.rotation.x).not.toBe(0)
    expect(avatar.pivotArmR!.rotation.x).not.toBe(0)
  })

  it('applies airborne jump pose when not grounded', () => {
    const avatar = new CharacterAvatar({ teamId: 'blue', outfitId: 1 })

    // Step animation towards airborne pose
    for (let i = 0; i < 30; i++) {
      avatar.updateAnimation(0.016, 0, false, false, false, false)
    }

    expect(avatar.pivotLegL!.rotation.x).toBeCloseTo(0.3, 1)
    expect(avatar.pivotLegR!.rotation.x).toBeCloseTo(0.3, 1)
    expect(avatar.pivotArmL!.rotation.x).toBeCloseTo(-0.35, 1)
    expect(avatar.pivotArmR!.rotation.x).toBeCloseTo(-0.35, 1)
  })

  it('applies stunned dizzy wobble animation', () => {
    const avatar = new CharacterAvatar({ teamId: 'blue', outfitId: 1 })

    avatar.updateAnimation(0.016, 0, true, false, true, false)

    expect(avatar.pivotHead!.rotation.z).not.toBe(0)
    expect(avatar.pivotTorso!.rotation.z).not.toBe(0)
  })

  it('applies slumped defeated pose when jailed', () => {
    const avatar = new CharacterAvatar({ teamId: 'blue', outfitId: 1 })

    // Step animation towards jailed slumped pose
    for (let i = 0; i < 30; i++) {
      avatar.updateAnimation(0.016, 0, true, false, false, true)
    }

    expect(avatar.pivotTorso!.rotation.x).toBeCloseTo(0.1, 1)
    expect(avatar.pivotHead!.rotation.x).toBeCloseTo(0.15, 1)
  })

  it('updates opacity on all cloned materials and disposes properly', () => {
    const avatar = new CharacterAvatar({ teamId: 'blue', outfitId: 1 })

    avatar.setOpacity(0.5)

    avatar.rootGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.material) {
        expect(obj.material.transparent).toBe(true)
        expect(obj.material.opacity).toBe(0.5)
      }
    })

    avatar.dispose()
    expect(avatar.rootGroup.children.length).toBe(0)
  })

  it('falls back to procedural soft-box mesh if GLTF template is missing', () => {
    setCharacterModelTemplate(null as unknown as THREE.Group)

    const fallbackAvatar = new CharacterAvatar({ teamId: 'blue', outfitId: 1 })
    expect(fallbackAvatar.rootGroup.children.length).toBeGreaterThan(0)
    expect(fallbackAvatar.pivotTorso).not.toBeNull()
    expect(fallbackAvatar.pivotHead).not.toBeNull()

    fallbackAvatar.dispose()
  })
})

describe('Entity Controllers CharacterAvatar Integration', () => {
  let scene: THREE.Scene
  let physics: PhysicsWorld

  beforeEach(async () => {
    scene = new THREE.Scene()
    physics = await PhysicsWorld.create()
  })

  afterEach(() => {
    physics.dispose()
  })

  it('PlayerController initializes and exposes avatar instance with correct team and outfit', () => {
    const player = new PlayerController(scene, physics, {
      id: 'local-test',
      name: 'Player 1',
      teamId: 'blue',
      initialPosition: [0, 1, 0],
      outfitId: 3,
    })

    expect(player.avatar).toBeInstanceOf(CharacterAvatar)
    expect(player.avatar.teamId).toBe('blue')
    expect(player.avatar.outfitId).toBe(3)
    expect(player.bodyMesh.visible).toBe(false)

    player.dispose()
  })

  it('RemotePlayerController initializes and exposes avatar instance', () => {
    const remote = new RemotePlayerController(scene, physics, {
      id: 'remote-test',
      name: 'Remote Budi',
      teamId: 'red',
      initialPosition: [5, 1, 10],
      outfitId: 5,
    })

    expect(remote.avatar).toBeInstanceOf(CharacterAvatar)
    expect(remote.avatar.teamId).toBe('red')
    expect(remote.avatar.outfitId).toBe(5)

    remote.dispose(scene)
  })

  it('BotController initializes and exposes avatar instance', () => {
    const bot = new BotController(scene, physics, {
      id: 'bot-test',
      name: 'Bot Joko',
      teamId: 'blue',
      initialPosition: [-5, 1, -10],
      outfitId: 2,
    })

    expect(bot.avatar).toBeInstanceOf(CharacterAvatar)
    expect(bot.avatar.teamId).toBe('blue')
    expect(bot.avatar.outfitId).toBe(2)
    expect(bot.bodyMesh.visible).toBe(false)

    bot.dispose()
  })
})
