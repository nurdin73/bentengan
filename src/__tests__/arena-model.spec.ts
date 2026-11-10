import { describe, it, expect, afterEach } from 'vitest'
import * as THREE from 'three'
import { ArenaGreybox } from '../game/scenes/arena-greybox'
import { getArenaModelTemplate, setArenaModelTemplate } from '../game/scenes/arena-model-loader'
import { PhysicsWorld } from '../game/physics/physics-world'

function createFakeArenaTemplate(): THREE.Group {
  const template = new THREE.Group()
  template.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial()))
  return template
}

async function buildArena(): Promise<{ arena: ArenaGreybox; physics: PhysicsWorld; colliders: number }> {
  const physics = await PhysicsWorld.create()
  const arena = new ArenaGreybox(new THREE.Scene(), physics)
  return { arena, physics, colliders: physics.world.colliders.len() }
}

describe('Arena Blender model integration', () => {
  afterEach(() => setArenaModelTemplate(null))

  it('keeps the procedural greybox when no arena model is preloaded', async () => {
    const { arena, physics } = await buildArena()

    expect(getArenaModelTemplate()).toBeNull()
    expect(arena.group.getObjectByName('ArenaModel_Root')).toBeUndefined()
    expect(arena.group.children.length).toBeGreaterThan(15)

    arena.dispose()
    physics.dispose()
  })

  it('swaps greybox visuals for the model while keeping identical Rapier colliders', async () => {
    const greybox = await buildArena()
    const greyboxColliders = greybox.colliders
    greybox.arena.dispose()
    greybox.physics.dispose()

    setArenaModelTemplate(createFakeArenaTemplate())
    const modelled = await buildArena()

    expect(modelled.arena.group.children).toHaveLength(1)
    expect(modelled.arena.group.children[0]?.name).toBe('ArenaModel_Root')
    expect(modelled.colliders).toBe(greyboxColliders)

    modelled.arena.dispose()
    modelled.physics.dispose()
  })

  it('enables shadows on template meshes and clones instead of reparenting the cached template', async () => {
    const template = createFakeArenaTemplate()
    setArenaModelTemplate(template)
    const mesh = template.children[0] as THREE.Mesh

    expect(mesh.castShadow).toBe(true)
    expect(mesh.receiveShadow).toBe(true)

    const { arena, physics } = await buildArena()
    expect(arena.group.children[0]).not.toBe(template)
    expect(template.parent).toBeNull()

    arena.dispose()
    physics.dispose()
  })
})

