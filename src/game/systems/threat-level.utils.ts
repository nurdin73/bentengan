import type { GameplayEntity } from '../../types/game.types'
import { GameplayRules } from './gameplay-rules'

export function computeEnemyTerritoryThreat(
  localEntity: GameplayEntity,
  entities: Iterable<GameplayEntity>,
  maxDist = 14,
): number {
  if (localEntity.status !== 'normal') return 0
  if (!GameplayRules.isInEnemyTerritory(localEntity)) return 0
  if (!Number.isFinite(maxDist) || maxDist <= 0) return 0

  const localPos = localEntity.getPosition()
  let minDist = Infinity

  for (const other of entities) {
    if (other.id === localEntity.id) continue
    if (other.teamId === localEntity.teamId) continue
    if (other.status === 'jailed' || other.status === 'stunned') continue

    const dist = GameplayRules.distance3D(localPos, other.getPosition())
    if (dist < minDist) {
      minDist = dist
    }
  }

  if (!Number.isFinite(minDist) || minDist >= maxDist) {
    return 0
  }

  return Math.max(0, Math.min(1, 1 - minDist / maxDist))
}

