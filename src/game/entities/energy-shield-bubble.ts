import * as THREE from 'three'

/**
 * EnergyShieldBubble
 * Renders a stylized 3D force-field bubble indicating immunity status:
 * 1. Translucent glowing core sphere
 * 2. Geodesic wireframe force-field lattice
 * 3. Equatorial energetic accent ring
 * Featuring breathing pulse scaling and multi-axis rotation.
 */
export class EnergyShieldBubble {
  public readonly group: THREE.Group
  private readonly sphereMesh: THREE.Mesh
  private readonly latticeMesh: THREE.Mesh
  private readonly equatorRingMesh: THREE.Mesh

  private readonly sphereMat: THREE.MeshBasicMaterial
  private readonly latticeMat: THREE.MeshBasicMaterial
  private readonly equatorRingMat: THREE.MeshBasicMaterial

  private readonly sphereGeo: THREE.SphereGeometry
  private readonly latticeGeo: THREE.IcosahedronGeometry
  private readonly equatorRingGeo: THREE.TorusGeometry

  constructor() {
    this.group = new THREE.Group()
    this.group.visible = false

    // 1. Translucent glowing core sphere
    this.sphereGeo = new THREE.SphereGeometry(0.85, 16, 12)
    this.sphereMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    })
    this.sphereMesh = new THREE.Mesh(this.sphereGeo, this.sphereMat)
    this.group.add(this.sphereMesh)

    // 2. Geodesic sci-fi forcefield wireframe lattice
    this.latticeGeo = new THREE.IcosahedronGeometry(0.88, 1)
    this.latticeMat = new THREE.MeshBasicMaterial({
      color: 0xbae6fd,
      wireframe: true,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    })
    this.latticeMesh = new THREE.Mesh(this.latticeGeo, this.latticeMat)
    this.group.add(this.latticeMesh)

    // 3. Equatorial energy accent ring
    this.equatorRingGeo = new THREE.TorusGeometry(0.88, 0.025, 6, 24)
    this.equatorRingMat = new THREE.MeshBasicMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    })
    this.equatorRingMesh = new THREE.Mesh(this.equatorRingGeo, this.equatorRingMat)
    this.equatorRingMesh.rotation.x = Math.PI / 2
    this.group.add(this.equatorRingMesh)
  }

  public update(isImmune: boolean, now: number): void {
    this.group.visible = isImmune
    if (!isImmune) return

    // Breathing pulse oscillation
    const pulse = 1.0 + 0.05 * Math.sin(now * 0.008)
    this.group.scale.set(pulse, pulse, pulse)

    // Dynamic multi-axis rotation
    this.latticeMesh.rotation.y += 0.025
    this.latticeMesh.rotation.x = Math.sin(now * 0.003) * 0.08
    this.equatorRingMesh.rotation.z += 0.04
  }

  public dispose(): void {
    if (this.group.parent) {
      this.group.parent.remove(this.group)
    }
    this.sphereGeo.dispose()
    this.sphereMat.dispose()
    this.latticeGeo.dispose()
    this.latticeMat.dispose()
    this.equatorRingGeo.dispose()
    this.equatorRingMat.dispose()
  }
}
