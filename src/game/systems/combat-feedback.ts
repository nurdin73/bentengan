import type { GameplayEntity } from '../../types/game.types'
import { soundManager } from '../audio/sound-manager'
import { computeEnemyTerritoryThreat } from './threat-level.utils'

export interface CombatFeedbackState {
  dangerVignetteIntensity: number
  exhaustionVignetteIntensity: number
  threatLevel: number
}

export class CombatFeedback {
  private dangerIntensity = 0
  private exhaustionIntensity = 0
  private threatLevel = 0
  private readonly state: CombatFeedbackState = {
    dangerVignetteIntensity: 0,
    exhaustionVignetteIntensity: 0,
    threatLevel: 0,
  }

  public update(
    dt: number,
    localEntity: GameplayEntity,
    entities: Iterable<GameplayEntity>,
    isExhausted: boolean,
  ): CombatFeedbackState {
    const safeDt = Number.isFinite(dt) && dt > 0 ? Math.min(0.2, dt) : 0
    const rawThreat = computeEnemyTerritoryThreat(localEntity, entities)
    const damping = 1 - Math.exp(-8 * safeDt)

    this.threatLevel = rawThreat
    this.dangerIntensity += (rawThreat - this.dangerIntensity) * damping

    const targetExhaustion = isExhausted && localEntity.status === 'normal' ? 1 : 0
    this.exhaustionIntensity += (targetExhaustion - this.exhaustionIntensity) * damping

    soundManager.updateTension(safeDt, rawThreat, targetExhaustion > 0.5)

    this.state.dangerVignetteIntensity = this.dangerIntensity
    this.state.exhaustionVignetteIntensity = this.exhaustionIntensity
    this.state.threatLevel = this.threatLevel
    return this.state
  }

  public reset(): void {
    this.dangerIntensity = 0
    this.exhaustionIntensity = 0
    this.threatLevel = 0
    this.state.dangerVignetteIntensity = 0
    this.state.exhaustionVignetteIntensity = 0
    this.state.threatLevel = 0
    soundManager.resetTension()
  }
}

