import * as THREE from 'three'

export type LeafShapeVariant = 'tropical-broad' | 'tropical-slender'

interface LeafVariantProfile {
  bladeLength: number
  maxHalfWidth: number
  petioleLength: number
  asymmetryCurve: number
  leftWidthBias: number
  rightWidthBias: number
  foldHeight: number
  archHeight: number
  tipDroop: number
  twistAngle: number
}

const LEAF_PROFILES: Record<LeafShapeVariant, LeafVariantProfile> = {
  'tropical-broad': {
    bladeLength: 0.64,
    maxHalfWidth: 0.165,
    petioleLength: 0.13,
    asymmetryCurve: 0.032,
    leftWidthBias: 1.05,
    rightWidthBias: 0.95,
    foldHeight: 0.036,
    archHeight: 0.038,
    tipDroop: 0.026,
    twistAngle: 0.08,
  },
  'tropical-slender': {
    bladeLength: 0.68,
    maxHalfWidth: 0.12,
    petioleLength: 0.14,
    asymmetryCurve: -0.028,
    leftWidthBias: 0.96,
    rightWidthBias: 1.04,
    foldHeight: 0.03,
    archHeight: 0.042,
    tipDroop: 0.032,
    twistAngle: -0.1,
  },
}

const BLADE_SEGMENTS = 10
const BLADE_COLUMNS = [-1, -0.48, 0, 0.48, 1] as const
const RIB_SEGMENTS = 11
const VEIN_TEXTURE_SIZE = 128

/**
 * Evaluates a rounded-base, acute-tip tropical leaf width contour for t in [0, 1].
 * Peaks around t ≈ 0.33 (lower-middle belly) with a rapid rounded shoulder at t → 0.
 */
function evaluateLeafWidthFactor(t: number): number {
  if (t <= 0 || t >= 1) return 0
  const raw = Math.pow(t, 0.36) * Math.pow(1 - t, 0.74)
  // Normalize by peak at t = 0.36 / (0.36 + 0.74) ≈ 0.3273 (raw peak ≈ 0.4992)
  return Math.min(1, raw * 2.004)
}

function evaluateSpineCenterX(t: number, profile: LeafVariantProfile): number {
  return Math.sin(t * Math.PI) * profile.asymmetryCurve
}

function evaluateSpineArchY(t: number, profile: LeafVariantProfile): number {
  return Math.sin(t * Math.PI) * profile.archHeight - Math.pow(Math.max(0, t), 1.6) * profile.tipDroop
}

interface GeometryBuffers {
  positions: number[]
  uvs: number[]
  colors: number[]
  indices: number[]
}

function pushVertex(
  buf: GeometryBuffers,
  x: number,
  y: number,
  z: number,
  u: number,
  v: number,
  r: number,
  g: number,
  b: number,
): number {
  const idx = buf.positions.length / 3
  buf.positions.push(x, y, z)
  buf.uvs.push(u, v)
  buf.colors.push(r, g, b)
  return idx
}

function appendLeafBlade(
  buf: GeometryBuffers,
  profile: LeafVariantProfile,
  baseZ: number,
): void {
  const baseIndex = pushVertex(
    buf,
    evaluateSpineCenterX(0, profile),
    evaluateSpineArchY(0, profile),
    baseZ,
    0.5,
    0,
    0.78,
    0.82,
    0.74,
  )

  const ringStarts: number[] = []

  for (let i = 1; i < BLADE_SEGMENTS; i++) {
    const t = i / BLADE_SEGMENTS
    const widthFactor = evaluateLeafWidthFactor(t)
    const halfW = profile.maxHalfWidth * widthFactor
    const centerX = evaluateSpineCenterX(t, profile)
    const centerY = evaluateSpineArchY(t, profile)
    const z = baseZ - t * profile.bladeLength
    const twist = (t - 0.35) * profile.twistAngle

    ringStarts.push(buf.positions.length / 3)

    for (let c = 0; c < BLADE_COLUMNS.length; c++) {
      const s = BLADE_COLUMNS[c]!
      const bias = s < 0 ? profile.leftWidthBias : profile.rightWidthBias
      const localX = s * halfW * bias
      // Shallow V-fold lifting the lateral margins above the midrib
      const absS = Math.abs(s)
      const foldLift = Math.pow(absS, 0.92) * profile.foldHeight * (0.45 + 0.55 * widthFactor)
      const localY = foldLift + localX * Math.sin(twist)

      // Subtle neutral-luminance shading so LEAF_COLORS stay pure while depth reads clearly
      const marginShade = 1.0 - absS * 0.08
      const lengthShade = 0.78 + 0.1 * Math.sin(t * Math.PI * 0.85)
      const shade = lengthShade * marginShade

      pushVertex(
        buf,
        centerX + localX,
        centerY + localY,
        z,
        0.5 + s * 0.5,
        t,
        shade * 0.96,
        shade,
        shade * 0.93,
      )
    }
  }

  const tipIndex = pushVertex(
    buf,
    evaluateSpineCenterX(1, profile),
    evaluateSpineArchY(1, profile),
    baseZ - profile.bladeLength,
    0.5,
    1,
    0.86,
    0.88,
    0.8,
  )

  const colsPerRing = BLADE_COLUMNS.length
  const firstRing = ringStarts[0]!
  for (let c = 0; c < colsPerRing - 1; c++) {
    buf.indices.push(baseIndex, firstRing + c, firstRing + c + 1)
  }

  for (let r = 0; r < ringStarts.length - 1; r++) {
    const r0 = ringStarts[r]!
    const r1 = ringStarts[r + 1]!
    for (let c = 0; c < colsPerRing - 1; c++) {
      const a = r0 + c
      const b = r0 + c + 1
      const d = r1 + c
      const e = r1 + c + 1
      buf.indices.push(a, d, b)
      buf.indices.push(b, d, e)
    }
  }

  const lastRing = ringStarts[ringStarts.length - 1]!
  for (let c = 0; c < colsPerRing - 1; c++) {
    buf.indices.push(lastRing + c, tipIndex, lastRing + c + 1)
  }
}

function appendMidribAndPetiole(
  buf: GeometryBuffers,
  profile: LeafVariantProfile,
  baseZ: number,
): void {
  const ribStartT = -profile.petioleLength / profile.bladeLength
  const ribEndT = 0.97
  const ribRingStarts: number[] = []

  // 4-sided diamond prism around the spine so the raised midrib & petiole read in 3D from both sides
  const crossOffsets: ReadonlyArray<readonly [number, number]> = [
    [0, 1.0],
    [1.0, 0.08],
    [0, -0.75],
    [-1.0, 0.08],
  ]

  for (let i = 0; i <= RIB_SEGMENTS; i++) {
    const u = i / RIB_SEGMENTS
    const t = ribStartT + (ribEndT - ribStartT) * u
    const clampedT = Math.max(0, t)

    const centerX =
      t < 0
        ? t * profile.asymmetryCurve * 0.9
        : evaluateSpineCenterX(clampedT, profile)
    const centerY =
      t < 0
        ? Math.abs(t) * 0.015
        : evaluateSpineArchY(clampedT, profile)
    const z = baseZ - t * profile.bladeLength

    // Thickest at petiole & blade junction, tapering smoothly toward the leaf tip
    const radius =
      t < 0
        ? 0.0135
        : 0.0145 * Math.pow(1 - clampedT * 0.88, 0.85) + 0.0018

    ribRingStarts.push(buf.positions.length / 3)
    const vCoord = Math.max(0, Math.min(1, clampedT))

    for (let k = 0; k < crossOffsets.length; k++) {
      const [ox, oy] = crossOffsets[k]!
      // Brighter warm-neutral highlight on the midrib & petiole ridge
      const topHighlight = oy > 0.5 ? 1.0 : 0.91
      pushVertex(
        buf,
        centerX + ox * radius,
        centerY + oy * radius + 0.002,
        z,
        0.5,
        vCoord,
        0.96 * topHighlight,
        1.0 * topHighlight,
        0.84 * topHighlight,
      )
    }
  }

  for (let r = 0; r < ribRingStarts.length - 1; r++) {
    const r0 = ribRingStarts[r]!
    const r1 = ribRingStarts[r + 1]!
    for (let k = 0; k < 4; k++) {
      const next = (k + 1) % 4
      const a = r0 + k
      const b = r0 + next
      const d = r1 + k
      const e = r1 + next
      buf.indices.push(a, d, b)
      buf.indices.push(b, d, e)
    }
  }

  // Cap petiole end cleanly
  const petioleStart = ribRingStarts[0]!
  buf.indices.push(petioleStart, petioleStart + 1, petioleStart + 2)
  buf.indices.push(petioleStart, petioleStart + 2, petioleStart + 3)
}

/**
 * Builds a 3D tropical leaf BufferGeometry with a rounded base, pointed tip,
 * V-fold lateral wings, raised 3D midrib ridge, protruding petiole stem, UVs,
 * and neutral-luminance vertex colors.
 */
export function createLeafGeometry(variant: LeafShapeVariant = 'tropical-broad'): THREE.BufferGeometry {
  const profile = LEAF_PROFILES[variant]
  const baseZ = profile.bladeLength * 0.42
  const buf: GeometryBuffers = {
    positions: [],
    uvs: [],
    colors: [],
    indices: [],
  }

  appendLeafBlade(buf, profile, baseZ)
  appendMidribAndPetiole(buf, profile, baseZ)

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(buf.positions, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(buf.uvs, 2))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(buf.colors, 3))
  geo.setIndex(buf.indices)
  geo.computeVertexNormals()
  return geo
}

/**
 * Generates a pure-memory RGBA DataTexture encoding diagonal lateral leaf veins
 * and subtle organic grain without relying on DOM <canvas> or external assets.
 */
export function createLeafVeinTexture(): THREE.DataTexture {
  const size = VEIN_TEXTURE_SIZE
  const data = new Uint8Array(size * size * 4)

  for (let y = 0; y < size; y++) {
    const v = y / (size - 1)
    for (let x = 0; x < size; x++) {
      const u = x / (size - 1)
      const distFromMidrib = Math.abs(u - 0.5) * 2.0

      // Parallel diagonal lateral veins angling forward toward the tip
      const veinPhase = (v - distFromMidrib * 0.28) * 14.0
      const veinWave = Math.abs(Math.sin(veinPhase * Math.PI))
      const veinLine = Math.pow(1.0 - veinWave, 5.0)
      const veinFade = (1.0 - distFromMidrib * 0.35) * Math.min(1.0, distFromMidrib * 6.0)

      // Subtle organic micro-grain (deterministic, no random)
      const grain =
        Math.sin(u * 47.0 + v * 31.0) * 0.015 +
        Math.cos(u * 83.0 - v * 61.0) * 0.01

      // Bright midrib center band
      const midribBand = Math.max(0, 1.0 - distFromMidrib / 0.07)

      const edgeDarken = 0.06 * distFromMidrib * distFromMidrib
      const lum = Math.max(
        0.72,
        Math.min(
          1.0,
          0.85 - edgeDarken + veinLine * veinFade * 0.13 + midribBand * 0.12 + grain,
        ),
      )

      const idx = (y * size + x) * 4
      data[idx] = Math.round(lum * 250)
      data[idx + 1] = Math.round(lum * 255)
      data[idx + 2] = Math.round(lum * 242)
      data[idx + 3] = 255
    }
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.magFilter = THREE.LinearFilter
  texture.minFilter = THREE.LinearFilter
  texture.needsUpdate = true
  return texture
}

/**
 * Creates a tapered, curved ribbon strip geometry for wind streaks.
 */
export function createRibbonGeometry(): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry()
  const segments = 8
  const length = 7.5
  const positions: number[] = []
  const indices: number[] = []

  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const z = (t - 0.5) * length
    const xOffset = Math.sin(t * Math.PI) * 0.8
    const halfWidth = Math.sin(t * Math.PI) * 0.14 + 0.02

    positions.push(xOffset - halfWidth, 0, z)
    positions.push(xOffset + halfWidth, 0, z)

    if (i < segments) {
      const base = i * 2
      indices.push(base, base + 1, base + 2)
      indices.push(base + 1, base + 3, base + 2)
    }
  }

  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

/**
 * Generates a pure-memory 32x32 soft radial circle DataTexture for ambient dust motes.
 */
export function createDustMoteTexture(): THREE.DataTexture {
  const size = 32
  const data = new Uint8Array(size * size * 4)

  for (let y = 0; y < size; y++) {
    const dy = ((y + 0.5) / size) * 2 - 1
    for (let x = 0; x < size; x++) {
      const dx = ((x + 0.5) / size) * 2 - 1
      const dist = Math.hypot(dx, dy)
      const falloff = Math.pow(Math.max(0, 1 - dist), 1.8)
      const idx = (y * size + x) * 4
      data[idx] = 255
      data[idx + 1] = 255
      data[idx + 2] = 255
      data[idx + 3] = Math.round(falloff * 255)
    }
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.magFilter = THREE.LinearFilter
  texture.minFilter = THREE.LinearFilter
  texture.needsUpdate = true
  return texture
}

