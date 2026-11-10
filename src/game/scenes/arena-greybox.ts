import * as THREE from 'three'
import type { PhysicsWorld } from '../physics/physics-world'
import { GAME_CONFIG } from '../core/constants'

export interface ArenaZones {
  blueBasePosition: THREE.Vector3
  redBasePosition: THREE.Vector3
  blueJailPosition: THREE.Vector3
  redJailPosition: THREE.Vector3
}

export class ArenaGreybox {
  public readonly scene: THREE.Scene
  public readonly group: THREE.Group
  private readonly physics: PhysicsWorld

  // Reusable materials to satisfy rule 3.B (Zero asset waste, shared materials)
  private readonly materials: {
    ground: THREE.MeshStandardMaterial
    wall: THREE.MeshStandardMaterial
    obstacle: THREE.MeshStandardMaterial
    jumpable: THREE.MeshStandardMaterial
    blueBase: THREE.MeshStandardMaterial
    redBase: THREE.MeshStandardMaterial
    blueJail: THREE.MeshStandardMaterial
    redJail: THREE.MeshStandardMaterial
  }

  public readonly zones: ArenaZones

  constructor(scene: THREE.Scene, physics: PhysicsWorld) {
    this.scene = scene
    this.physics = physics
    this.group = new THREE.Group()
    this.scene.add(this.group)

    this.materials = {
      ground: new THREE.MeshStandardMaterial({ color: 0x2e3440, roughness: 0.8 }),
      wall: new THREE.MeshStandardMaterial({ color: 0x4c566a, roughness: 0.6 }),
      obstacle: new THREE.MeshStandardMaterial({ color: 0xd8dee9, roughness: 0.5 }),
      jumpable: new THREE.MeshStandardMaterial({ color: 0xebcb8b, roughness: 0.4 }),
      blueBase: new THREE.MeshStandardMaterial({
        color: 0x3b82f6,
        roughness: 0.3,
        emissive: 0x1d4ed8,
        emissiveIntensity: 0.3,
      }),
      redBase: new THREE.MeshStandardMaterial({
        color: 0xef4444,
        roughness: 0.3,
        emissive: 0xb91c1c,
        emissiveIntensity: 0.3,
      }),
      blueJail: new THREE.MeshStandardMaterial({
        color: 0x60a5fa,
        transparent: true,
        opacity: 0.4,
        wireframe: true,
      }),
      redJail: new THREE.MeshStandardMaterial({
        color: 0xf87171,
        transparent: true,
        opacity: 0.4,
        wireframe: true,
      }),
    }

    const halfLength = GAME_CONFIG.arena.length / 2 // 30
    this.zones = {
      blueBasePosition: new THREE.Vector3(0, 0, -halfLength + 5),
      redBasePosition: new THREE.Vector3(0, 0, halfLength - 5),
      blueJailPosition: new THREE.Vector3(10, 0, halfLength - 10), // In enemy (Red) side
      redJailPosition: new THREE.Vector3(-10, 0, -halfLength + 10), // In enemy (Blue) side
    }

    this.build()
  }

  private build(): void {
    const { length, width, wallHeight } = GAME_CONFIG.arena
    const halfL = length / 2
    const halfW = width / 2

    // 1. Ground Plane
    const groundGeo = new THREE.PlaneGeometry(width, length)
    const groundMesh = new THREE.Mesh(groundGeo, this.materials.ground)
    groundMesh.rotation.x = -Math.PI / 2
    groundMesh.receiveShadow = true
    this.group.add(groundMesh)

    // Physics ground collider
    this.physics.createStaticBox({
      translation: { x: 0, y: -0.5, z: 0 },
      halfExtents: { x: halfW, y: 0.5, z: halfL },
    })

    // 2. Grid lines & Central division
    const gridHelper = new THREE.GridHelper(length, 30, 0x5e81ac, 0x434c5e)
    gridHelper.position.y = 0.01
    this.group.add(gridHelper)

    // Center dividing line with distinct territory separation
    const centerLineGeo = new THREE.BoxGeometry(width, 0.08, 0.5)
    const centerLineMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 0.35,
      roughness: 0.3,
    })
    const centerLine = new THREE.Mesh(centerLineGeo, centerLineMat)
    centerLine.position.set(0, 0.04, 0)
    centerLine.receiveShadow = true
    this.group.add(centerLine)

    // 3. Perimeter Boundary Walls
    this.createStaticWall(width, wallHeight, 1, 0, wallHeight / 2, -halfL) // North
    this.createStaticWall(width, wallHeight, 1, 0, wallHeight / 2, halfL) // South
    this.createStaticWall(1, wallHeight, length, -halfW, wallHeight / 2, 0) // West
    this.createStaticWall(1, wallHeight, length, halfW, wallHeight / 2, 0) // East

    // 4. Bases (Benteng Blue & Red)
    this.createBaseZone(this.zones.blueBasePosition, this.materials.blueBase, 'Benteng Biru')
    this.createBaseZone(this.zones.redBasePosition, this.materials.redBase, 'Benteng Merah')

    // 5. Jails (Penjara)
    this.createJailZone(this.zones.blueJailPosition, this.materials.blueJail, 'Penjara Biru')
    this.createJailZone(this.zones.redJailPosition, this.materials.redJail, 'Penjara Merah')

    // 6. Obstacles: Symmetrical path blockers & jumpable low covers
    this.createObstacles()
  }

  private createStaticWall(w: number, h: number, d: number, x: number, y: number, z: number): void {
    const geo = new THREE.BoxGeometry(w, h, d)
    const mesh = new THREE.Mesh(geo, this.materials.wall)
    mesh.position.set(x, y, z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    this.group.add(mesh)

    this.physics.createStaticBox({
      translation: { x, y, z },
      halfExtents: { x: w / 2, y: h / 2, z: d / 2 },
    })
  }

  private createObstacles(): void {
    // Central cover structures (left & right flanking routes)
    const structures = [
      // Central mid pillars
      { w: 2.5, h: 2.5, d: 2.5, x: -6, z: 0, jumpable: false },
      { w: 2.5, h: 2.5, d: 2.5, x: 6, z: 0, jumpable: false },
      // Jumpable fences near center
      { w: 4, h: 0.8, d: 0.6, x: 0, z: 5, jumpable: true },
      { w: 4, h: 0.8, d: 0.6, x: 0, z: -5, jumpable: true },
      // Blue side covers
      { w: 2, h: 2.0, d: 4, x: -8, z: -14, jumpable: false },
      { w: 2, h: 2.0, d: 4, x: 8, z: -14, jumpable: false },
      { w: 3, h: 0.8, d: 0.6, x: -4, z: -20, jumpable: true },
      // Red side covers
      { w: 2, h: 2.0, d: 4, x: -8, z: 14, jumpable: false },
      { w: 2, h: 2.0, d: 4, x: 8, z: 14, jumpable: false },
      { w: 3, h: 0.8, d: 0.6, x: 4, z: 20, jumpable: true },
    ]

    for (const s of structures) {
      const geo = new THREE.BoxGeometry(s.w, s.h, s.d)
      const mat = s.jumpable ? this.materials.jumpable : this.materials.obstacle
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(s.x, s.h / 2, s.z)
      mesh.castShadow = true
      mesh.receiveShadow = true
      this.group.add(mesh)

      this.physics.createStaticBox({
        translation: { x: s.x, y: s.h / 2, z: s.z },
        halfExtents: { x: s.w / 2, y: s.h / 2, z: s.d / 2 },
      })
    }
  }

  private createBaseZone(
    pos: THREE.Vector3,
    material: THREE.MeshStandardMaterial,
    _name: string,
  ): void {
    // 1. Lower stepped pedestal
    const pedestalGeo = new THREE.CylinderGeometry(1.6, 1.8, 0.4, 16)
    const pedestal = new THREE.Mesh(pedestalGeo, material)
    pedestal.position.set(pos.x, 0.2, pos.z)
    pedestal.receiveShadow = true
    this.group.add(pedestal)

    // 2. Main Fortress Pillar
    const pillarGeo = new THREE.CylinderGeometry(1.2, 1.4, 2.5, 16)
    const pillar = new THREE.Mesh(pillarGeo, material)
    pillar.position.set(pos.x, 1.25, pos.z)
    pillar.castShadow = true
    this.group.add(pillar)

    // 3. Fortress Crown & Glowing Crest
    const crownGeo = new THREE.OctahedronGeometry(0.45, 0)
    const crownMat = new THREE.MeshStandardMaterial({
      color: material.color,
      emissive: material.color,
      emissiveIntensity: 0.8,
      roughness: 0.1,
    })
    const crown = new THREE.Mesh(crownGeo, crownMat)
    crown.position.set(pos.x, 2.8, pos.z)
    this.group.add(crown)

    // 4. Territory Floor Ring Marker
    const ringGeo = new THREE.RingGeometry(1.9, 2.5, 32)
    const ringMat = new THREE.MeshBasicMaterial({
      color: material.color,
      side: THREE.DoubleSide,
    })
    const ring = new THREE.Mesh(ringGeo, ringMat)
    ring.rotation.x = -Math.PI / 2
    ring.position.set(pos.x, 0.03, pos.z)
    this.group.add(ring)

    // Base pillar solid physics collider (Preserved exact coordinates)
    this.physics.createStaticBox({
      translation: { x: pos.x, y: 1.25, z: pos.z },
      halfExtents: { x: 1.2, y: 1.25, z: 1.2 },
    })
  }

  private createJailZone(
    pos: THREE.Vector3,
    material: THREE.MeshStandardMaterial,
    _name: string,
  ): void {
    // Wireframe jail boundary cube
    const jailGeo = new THREE.BoxGeometry(4, 2.5, 4)
    const jailMesh = new THREE.Mesh(jailGeo, material)
    jailMesh.position.set(pos.x, 1.25, pos.z)
    this.group.add(jailMesh)

    // Illuminated Floor Perimeter Outline
    const floorOutlineGeo = new THREE.RingGeometry(2.4, 2.6, 4)
    const floorOutlineMat = new THREE.MeshBasicMaterial({
      color: material.color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6,
    })
    const floorOutline = new THREE.Mesh(floorOutlineGeo, floorOutlineMat)
    floorOutline.rotation.x = -Math.PI / 2
    floorOutline.rotation.z = Math.PI / 4 // Rotate to form square boundary
    floorOutline.position.set(pos.x, 0.03, pos.z)
    this.group.add(floorOutline)
  }

  public dispose(): void {
    this.group.clear()
    Object.values(this.materials).forEach((m) => m.dispose())
  }
}
