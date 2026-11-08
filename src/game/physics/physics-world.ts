import RAPIER from '@dimforge/rapier3d-compat'
import { GAME_CONFIG } from '../core/constants'

export interface BoxColliderDescriptor {
  translation: { x: number; y: number; z: number }
  halfExtents: { x: number; y: number; z: number }
  isSensor?: boolean
}

export class PhysicsWorld {
  private static isInitialized = false
  public readonly world: RAPIER.World
  public readonly rapier: typeof RAPIER

  private constructor(world: RAPIER.World) {
    this.world = world
    this.rapier = RAPIER
  }

  public static async create(): Promise<PhysicsWorld> {
    if (!PhysicsWorld.isInitialized) {
      await RAPIER.init()
      PhysicsWorld.isInitialized = true
    }

    const gravity = new RAPIER.Vector3(0.0, GAME_CONFIG.movement.gravity, 0.0)
    const world = new RAPIER.World(gravity)
    return new PhysicsWorld(world)
  }

  public createStaticBox(desc: BoxColliderDescriptor): {
    body: RAPIER.RigidBody
    collider: RAPIER.Collider
  } {
    const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(
      desc.translation.x,
      desc.translation.y,
      desc.translation.z,
    )
    const body = this.world.createRigidBody(bodyDesc)

    const colliderDesc = RAPIER.ColliderDesc.cuboid(
      desc.halfExtents.x,
      desc.halfExtents.y,
      desc.halfExtents.z,
    )
      .setFriction(0.0)
      .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min)

    if (desc.isSensor) {
      colliderDesc.setSensor(true)
    }

    const collider = this.world.createCollider(colliderDesc, body)
    return { body, collider }
  }

  public step(): void {
    this.world.step()
  }

  public dispose(): void {
    this.world.free()
  }
}
