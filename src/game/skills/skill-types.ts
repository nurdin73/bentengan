export type SkillId = 'dash' | 'smoke' | 'adrenaline'

export interface SkillDefinition {
  id: SkillId
  name: string
  hotkey: string
  cooldownMs: number
  durationMs: number
  description: string
}

export interface SkillState {
  id: SkillId
  name: string
  hotkey: string
  ready: boolean
  cooldownUntil: number
  cooldownRemainingSec: number
  cooldownProgress: number // 0 (ready) to 1 (just used)
  activeUntil: number
  isActive: boolean
}

export type SkillsStateMap = Record<SkillId, SkillState>

export interface SkillActivationResult {
  success: boolean
  reason?: 'cooldown' | 'jailed' | 'stunned' | 'invalid_skill' | 'already_active'
}

export interface SmokeEventPayload {
  x: number
  y: number
  z: number
  radius: number
  durationMs: number
  sourceTeamId: 'blue' | 'red'
}
