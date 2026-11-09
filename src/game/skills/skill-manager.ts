import * as THREE from 'three'
import { GAME_CONFIG } from '../core/constants'
import type { PlayerController } from '../entities/player-controller'
import type {
  SkillId,
  SkillState,
  SkillsStateMap,
  SkillActivationResult,
  SmokeEventPayload,
} from './skill-types'

export interface SkillManagerCallbacks {
  onSkillStateChange?: (states: SkillsStateMap) => void
  onSmokeTriggered?: (payload: SmokeEventPayload) => void
}

interface ActiveSmokeEffect {
  meshGroup: THREE.Group
  createdAt: number
  durationMs: number
  materials: THREE.MeshBasicMaterial[]
}

export class SkillManager {
  private readonly scene: THREE.Scene
  private readonly callbacks: SkillManagerCallbacks

  private readonly cooldowns: Record<SkillId, number> = {
    dash: 0,
    smoke: 0,
    adrenaline: 0,
  }

  private readonly activeUntil: Record<SkillId, number> = {
    dash: 0,
    smoke: 0,
    adrenaline: 0,
  }

  private readonly activeSmokeEffects: ActiveSmokeEffect[] = []

  // Shared geometries for smoke puffs (Zero allocation per puff)
  private readonly smokePuffGeo = new THREE.DodecahedronGeometry(0.8, 1)

  constructor(scene: THREE.Scene, callbacks: SkillManagerCallbacks = {}) {
    this.scene = scene
    this.callbacks = callbacks
  }

  public getSkillState(id: SkillId, now: number = performance.now()): SkillState {
    const config = GAME_CONFIG.skills[id]
    const cdUntil = this.cooldowns[id]
    const actUntil = this.activeUntil[id]

    const remainingMs = Math.max(0, cdUntil - now)
    const ready = remainingMs <= 0
    const isActive = now < actUntil

    const totalCd = config.cooldownMs
    const progress = ready ? 0 : Math.min(1, Math.max(0, remainingMs / totalCd))

    return {
      id,
      name: config.name,
      hotkey: config.hotkey,
      ready,
      cooldownUntil: cdUntil,
      cooldownRemainingSec: Math.ceil(remainingMs / 1000),
      cooldownProgress: progress,
      activeUntil: actUntil,
      isActive,
    }
  }

  public getAllSkillsState(now: number = performance.now()): SkillsStateMap {
    return {
      dash: this.getSkillState('dash', now),
      smoke: this.getSkillState('smoke', now),
      adrenaline: this.getSkillState('adrenaline', now),
    }
  }

  public canActivate(id: SkillId, player: PlayerController, now: number = performance.now()): SkillActivationResult {
    if (player.status === 'jailed') {
      return { success: false, reason: 'jailed' }
    }
    if (player.status === 'stunned') {
      return { success: false, reason: 'stunned' }
    }
    if (now < this.cooldowns[id]) {
      return { success: false, reason: 'cooldown' }
    }
    return { success: true }
  }

  public triggerSkill(
    id: SkillId,
    player: PlayerController,
    now: number = performance.now(),
  ): SkillActivationResult {
    const check = this.canActivate(id, player, now)
    if (!check.success) return check

    if (id === 'dash') {
      const config = GAME_CONFIG.skills.dash
      this.cooldowns.dash = now + config.cooldownMs
      this.activeUntil.dash = now + config.durationMs
      player.applyDash(config.durationMs, config.speedMultiplier)
    } else if (id === 'smoke') {
      const config = GAME_CONFIG.skills.smoke
      this.cooldowns.smoke = now + config.cooldownMs
      this.activeUntil.smoke = now + config.durationMs

      const pos = player.getPosition()
      const payload: SmokeEventPayload = {
        x: pos.x,
        y: pos.y,
        z: pos.z,
        radius: config.radius,
        durationMs: config.durationMs,
        sourceTeamId: player.teamId,
      }

      this.spawnSmokeVisual(pos.x, pos.y, pos.z, config.durationMs)
      this.callbacks.onSmokeTriggered?.(payload)
    } else if (id === 'adrenaline') {
      const config = GAME_CONFIG.skills.adrenaline
      this.cooldowns.adrenaline = now + config.cooldownMs
      this.activeUntil.adrenaline = now + config.durationMs

      // Instantly restore full stamina and grant immunity boost
      player.applyAdrenaline(config.durationMs, config.immunityDurationMs)
    }

    this.callbacks.onSkillStateChange?.(this.getAllSkillsState(now))
    return { success: true }
  }

  public resetAllCooldowns(now: number = performance.now()): void {
    this.cooldowns.dash = 0
    this.cooldowns.smoke = 0
    this.cooldowns.adrenaline = 0
    this.activeUntil.dash = 0
    this.activeUntil.smoke = 0
    this.activeUntil.adrenaline = 0
    this.clearAllSmokeVisuals()
    this.callbacks.onSkillStateChange?.(this.getAllSkillsState(now))
  }

  private spawnSmokeVisual(x: number, y: number, z: number, durationMs: number): void {
    const group = new THREE.Group()
    group.position.set(x, y + 0.3, z)

    const materials: THREE.MeshBasicMaterial[] = []
    const puffCount = 8
    for (let i = 0; i < puffCount; i++) {
      const angle = (i * Math.PI * 2) / puffCount
      const dist = 1.0 + Math.random() * 1.5
      const mat = new THREE.MeshBasicMaterial({
        color: 0xe2e8f0,
        transparent: true,
        opacity: 0.65,
      })
      materials.push(mat)

      const mesh = new THREE.Mesh(this.smokePuffGeo, mat)
      mesh.position.set(
        Math.cos(angle) * dist,
        Math.random() * 0.8,
        Math.sin(angle) * dist,
      )
      mesh.scale.setScalar(0.7 + Math.random() * 0.6)
      group.add(mesh)
    }

    this.scene.add(group)
    this.activeSmokeEffects.push({
      meshGroup: group,
      createdAt: performance.now(),
      durationMs,
      materials,
    })
  }

  public update(dt: number, now: number = performance.now()): void {
    // 1. Update active smoke cloud visuals
    for (let i = this.activeSmokeEffects.length - 1; i >= 0; i--) {
      const effect = this.activeSmokeEffects[i]!
      const age = now - effect.createdAt
      if (age >= effect.durationMs) {
        this.scene.remove(effect.meshGroup)
        for (const mat of effect.materials) {
          mat.dispose()
        }
        this.activeSmokeEffects.splice(i, 1)
      } else {
        const lifeRatio = age / effect.durationMs
        // Expand puff and fade out
        const scale = 1.0 + lifeRatio * 1.8
        effect.meshGroup.scale.set(scale, 1.0 + lifeRatio * 0.8, scale)
        const opacity = Math.max(0, 0.7 * (1.0 - lifeRatio))
        for (const mat of effect.materials) {
          mat.opacity = opacity
        }
      }
    }
  }

  private clearAllSmokeVisuals(): void {
    for (const effect of this.activeSmokeEffects) {
      this.scene.remove(effect.meshGroup)
      for (const mat of effect.materials) {
        mat.dispose()
      }
    }
    this.activeSmokeEffects.length = 0
  }

  public dispose(): void {
    this.clearAllSmokeVisuals()
    this.smokePuffGeo.dispose()
  }
}
