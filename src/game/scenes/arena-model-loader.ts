import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

/**
 * Visual-only arena model exported from assets/3d/arena_modular_master.blend
 * (built by assets/3d/scripts/build_arena_modular.py). Physics colliders stay in
 * ArenaGreybox; this module only loads and caches the render meshes.
 */
export const ARENA_MODEL_URL = '/models/arena_modular.glb'

let cachedArenaTemplate: THREE.Group | null = null
let arenaLoadPromise: Promise<THREE.Group | null> | null = null

export function getArenaModelTemplate(): THREE.Group | null {
  return cachedArenaTemplate
}

export function setArenaModelTemplate(template: THREE.Group | null): void {
  cachedArenaTemplate = template ? prepareArenaTemplate(template) : null
}

function prepareArenaTemplate(template: THREE.Group): THREE.Group {
  template.name = 'ArenaModel_Root'
  template.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      node.castShadow = true
      node.receiveShadow = true
    }
  })
  return template
}

function canFetchOverHttp(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof fetch !== 'undefined' &&
    !!window.location?.protocol?.startsWith('http')
  )
}

/** Resolves to null (greybox fallback) when not in a browser or when loading fails. */
export function preloadArenaModel(url = ARENA_MODEL_URL): Promise<THREE.Group | null> {
  if (cachedArenaTemplate) return Promise.resolve(cachedArenaTemplate)
  if (arenaLoadPromise) return arenaLoadPromise
  if (!canFetchOverHttp()) return Promise.resolve(null)

  arenaLoadPromise = new Promise<THREE.Group | null>((resolve) => {
    new GLTFLoader().load(
      url,
      (gltf) => {
        setArenaModelTemplate(gltf.scene)
        resolve(cachedArenaTemplate)
      },
      undefined,
      (err) => {
        console.warn('[ArenaModel] Could not load GLTF model, using greybox:', err)
        arenaLoadPromise = null
        resolve(null)
      },
    )
  })

  return arenaLoadPromise
}

