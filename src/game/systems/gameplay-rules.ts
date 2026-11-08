import { GAME_CONFIG } from '../core/constants'
import type { GameplayEntity, TeamId } from '../../types/game.types'

export class GameplayRules {
  public static distance3D(
    p1: { x: number; y: number; z: number },
    p2: { x: number; y: number; z: number },
  ): number {
    const dx = p1.x - p2.x
    const dy = p1.y - p2.y
    const dz = p1.z - p2.z
    return Math.sqrt(dx * dx + dy * dy + dz * dz)
  }

  public static distance2D(
    p1: { x: number; z: number },
    p2: { x: number; z: number },
  ): number {
    const dx = p1.x - p2.x
    const dz = p1.z - p2.z
    return Math.sqrt(dx * dx + dz * dz)
  }

  public static isInEnemyTerritory(entity: GameplayEntity): boolean {
    const pos = entity.getPosition()
    // Arena center dividing line is at Z = 0: Blue territory is Z <= 0, Red territory is Z >= 0
    if (entity.teamId === 'blue') {
      return pos.z > 0
    } else {
      return pos.z < 0
    }
  }

  public static canCapture(
    hunter: GameplayEntity,
    target: GameplayEntity,
    now: number,
    radius = GAME_CONFIG.gameplay.captureRadius,
  ): boolean {
    // 1. Teams must be opposite
    if (hunter.teamId === target.teamId) return false

    // 2. Hunter must be active (not jailed, not stunned)
    if (hunter.status === 'jailed' || hunter.status === 'stunned') return false

    // 3. Target cannot be already jailed
    if (target.status === 'jailed') return false

    // 4. Target cannot have active immunity
    if (now < target.immunityUntil) return false

    // 5. Traditional Bentengan Territory Rule: Target can ONLY be captured when inside enemy territory
    if (!GameplayRules.isInEnemyTerritory(target)) return false

    // 6. Distance check (3D radius <= 1.5m)
    const dist = GameplayRules.distance3D(hunter.getPosition(), target.getPosition())
    return dist <= radius
  }

  public static canRescue(
    rescuer: GameplayEntity,
    target: GameplayEntity,
    radius = GAME_CONFIG.gameplay.rescueRadius,
  ): boolean {
    // 1. Rescuer and target must be on the same team
    if (rescuer.teamId !== target.teamId) return false

    // 2. Rescuer must be active (not jailed, not stunned)
    if (rescuer.status === 'jailed' || rescuer.status === 'stunned') return false

    // 3. Target must currently be in jail
    if (target.status !== 'jailed') return false

    // 4. Distance check
    const dist = GameplayRules.distance3D(rescuer.getPosition(), target.getPosition())
    return dist <= radius
  }

  public static canCaptureBase(
    player: GameplayEntity,
    enemyTeam: TeamId,
    enemyBasePosition: { x: number; y: number; z: number },
    radius = GAME_CONFIG.gameplay.baseCaptureRadius,
  ): boolean {
    // 1. Player must be on the opposite team from the base
    if (player.teamId === enemyTeam) return false

    // 2. Player cannot touch base if jailed or stunned (immune players CAN touch base per PRD Section 5.2)
    if (player.status === 'jailed' || player.status === 'stunned') return false

    // 3. Horizontal distance check to base pillar
    const dist = GameplayRules.distance2D(player.getPosition(), enemyBasePosition)
    return dist <= radius
  }

  public static checkTeamElimination(players: GameplayEntity[]): TeamId | null {
    const bluePlayers = players.filter((p) => p.teamId === 'blue')
    const redPlayers = players.filter((p) => p.teamId === 'red')

    if (bluePlayers.length === 0 || redPlayers.length === 0) return null

    const allBlueJailed = bluePlayers.every((p) => p.status === 'jailed')
    const allRedJailed = redPlayers.every((p) => p.status === 'jailed')

    if (allRedJailed) return 'blue'
    if (allBlueJailed) return 'red'

    return null
  }
}

