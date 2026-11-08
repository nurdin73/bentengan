import * as THREE from 'three'
import { PhysicsWorld } from '../physics/physics-world'
import { ArenaGreybox } from '../scenes/arena-greybox'
import { InputManager } from '../input/input-manager'
import { ThirdPersonCameraController } from '../camera/third-person'
import { PlayerController } from '../entities/player-controller'
import { BotController } from '../entities/bot-controller'
import { GameplayRules } from '../systems/gameplay-rules'
import { GAME_CONFIG } from './constants'
import type { TeamId, PlayerStatus, MatchResult, GameplayEntity, MovementInput } from '../../types/game.types'

export interface GameEngineStateCallback {
  onPlayerStateChange: (state: {
    stamina: number
    isSprinting: boolean
    status: PlayerStatus
    stunUntil: number
    immunityUntil: number
  }) => void
  onRosterUpdate: (roster: {
    blueJailed: number
    blueTotal: number
    redJailed: number
    redTotal: number
    canRescue: boolean
    isInEnemyTerritory: boolean
  }) => void
  onCapture: (hunterName: string, targetName: string) => void
  onRescue: (rescuerName: string, targetName: string) => void
  onMatchEnd: (result: MatchResult) => void
}

export class GameEngine {
  private readonly container: HTMLElement
  public readonly scene: THREE.Scene
  public readonly camera: THREE.PerspectiveCamera
  public readonly renderer: THREE.WebGLRenderer

  private physics!: PhysicsWorld
  public arena!: ArenaGreybox
  public readonly input: InputManager
  public cameraController!: ThirdPersonCameraController
  public localPlayer: PlayerController | null = null
  public readonly bots: BotController[] = []

  // Fixed timestep accumulator
  private isRunning = false
  private isMatchFinished = false
  private animationFrameId = 0
  private lastTime = 0
  private accumulator = 0
  private matchStartTime = 0
  private readonly fixedDt = GAME_CONFIG.fixedDeltaTime

  private playerTeam: TeamId = 'blue'
  private readonly callbacks: GameEngineStateCallback
  private onResizeBound = this.onResize.bind(this)

  constructor(container: HTMLElement, callbacks: GameEngineStateCallback) {
    this.container = container
    this.callbacks = callbacks

    // 1. Three.js Scene & Camera Setup
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x0f172a)

    const aspect = container.clientWidth / (container.clientHeight || 1)
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 150)
    this.cameraController = new ThirdPersonCameraController(this.camera)

    // 2. WebGL Renderer with Shadow Map
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    this.renderer.setSize(container.clientWidth, container.clientHeight)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    container.appendChild(this.renderer.domElement)

    // 3. Lighting Setup
    this.setupLighting()

    // 4. Input Manager
    this.input = new InputManager()
    this.input.attach(this.renderer.domElement)

    window.addEventListener('resize', this.onResizeBound)
  }

  private setupLighting(): void {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7)
    this.scene.add(ambientLight)

    const sunLight = new THREE.DirectionalLight(0xfffbeb, 1.2)
    sunLight.position.set(20, 35, 15)
    sunLight.castShadow = true
    sunLight.shadow.mapSize.width = 2048
    sunLight.shadow.mapSize.height = 2048
    sunLight.shadow.camera.near = 0.5
    sunLight.shadow.camera.far = 100
    sunLight.shadow.camera.left = -30
    sunLight.shadow.camera.right = 30
    sunLight.shadow.camera.top = 35
    sunLight.shadow.camera.bottom = -35
    this.scene.add(sunLight)
  }

  public async init(teamId: TeamId = 'blue'): Promise<void> {
    this.playerTeam = teamId
    this.isMatchFinished = false

    // 1. Initialize Rapier Physics World
    this.physics = await PhysicsWorld.create()

    // 2. Create Symmetrical Arena
    this.arena = new ArenaGreybox(this.scene, this.physics)

    // 3. Spawn Local Player
    const spawnZ = teamId === 'blue' ? -20 : 20
    this.localPlayer = new PlayerController(this.scene, this.physics, {
      id: 'local-player',
      teamId,
      initialPosition: [0, 1, spawnZ],
    })

    const initialYaw = teamId === 'blue' ? Math.PI : 0
    this.cameraController.setYaw(initialYaw)
    this.cameraController.snap(this.localPlayer.getPosition())

    // 4. Spawn Milestone 2 Simulated Roster (1 Ally in Jail for Rescue test, 2 Enemy bots for Capture test)
    this.spawnSimulatedBots(teamId)

    // 5. Start Fixed Timestep Simulation & Render Loop
    this.isRunning = true
    this.matchStartTime = performance.now()
    this.lastTime = performance.now()
    this.loop(this.lastTime)
  }

  private spawnSimulatedBots(playerTeam: TeamId): void {
    const enemyTeam: TeamId = playerTeam === 'blue' ? 'red' : 'blue'

    // A. Ally Bot spawned inside Enemy territory Jail (starts 'jailed' for rescue test)
    const allyJailPos =
      playerTeam === 'blue'
        ? this.arena.zones.blueJailPosition
        : this.arena.zones.redJailPosition

    const playerBasePos =
      playerTeam === 'blue'
        ? this.arena.zones.blueBasePosition
        : this.arena.zones.redBasePosition

    const enemyBasePos =
      enemyTeam === 'blue'
        ? this.arena.zones.blueBasePosition
        : this.arena.zones.redBasePosition

    // A. Jailed Ally Bot (starts in enemy jail; when rescued, attacks enemy base)
    const allyBot = new BotController(this.scene, this.physics, {
      id: 'bot-ally-1',
      name: playerTeam === 'blue' ? 'Kawan Biru (Tahanan)' : 'Kawan Merah (Tahanan)',
      teamId: playerTeam,
      role: 'attacker',
      initialPosition: [allyJailPos.x, 1, allyJailPos.z],
      targetObjective: [enemyBasePos.x, enemyBasePos.y, enemyBasePos.z],
    })
    allyBot.status = 'jailed'
    this.bots.push(allyBot)

    // B. Enemy Bot 1 (Attacker / Infiltrator: invades player territory towards player base)
    const enemyBot1 = new BotController(this.scene, this.physics, {
      id: 'bot-enemy-1',
      name: enemyTeam === 'blue' ? 'Musuh Biru 1 (Penyerang)' : 'Musuh Merah 1 (Penyerang)',
      teamId: enemyTeam,
      role: 'attacker',
      initialPosition: [-5, 1, enemyTeam === 'red' ? 6 : -6],
      patrolCenter: [0, 1, 0],
      patrolRadius: 10,
      targetObjective: [playerBasePos.x, playerBasePos.y, playerBasePos.z],
    })
    this.bots.push(enemyBot1)

    // C. Enemy Bot 2 (Defender: guards base and catches intruders)
    const enemyBot2 = new BotController(this.scene, this.physics, {
      id: 'bot-enemy-2',
      name: enemyTeam === 'blue' ? 'Musuh Biru 2 (Penjaga)' : 'Musuh Merah 2 (Penjaga)',
      teamId: enemyTeam,
      role: 'defender',
      initialPosition: [5, 1, enemyBasePos.z * 0.7],
      patrolCenter: [enemyBasePos.x, 1, enemyBasePos.z * 0.7],
      patrolRadius: 8,
    })
    this.bots.push(enemyBot2)
  }

  private loop(currentTime: number): void {
    if (!this.isRunning) return

    const frameTime = Math.min((currentTime - this.lastTime) / 1000, 0.1)
    this.lastTime = currentTime
    this.accumulator += frameTime

    const mouseDelta = this.input.consumeMouseDelta()
    const now = performance.now()

    // Fixed timestep physics update (60 Hz)
    while (this.accumulator >= this.fixedDt) {
      const allEntities: GameplayEntity[] = this.localPlayer
        ? [this.localPlayer, ...this.bots]
        : [...this.bots]

      let input: MovementInput = {
        forward: false,
        backward: false,
        left: false,
        right: false,
        sprint: false,
        jump: false,
        interact: false,
        cameraYaw: 0,
      }

      if (this.localPlayer) {
        this.localPlayer.recordPreviousPosition()
        input = this.input.getMovementInput(this.cameraController.getYaw())
        this.localPlayer.updateFixed(input, this.fixedDt, now)
      }

      // Dynamic Role Orchestration: Ensure surviving lone bots adopt hybrid dual-role
      this.updateDynamicTeamRoles(allEntities)

      for (const bot of this.bots) {
        bot.recordPreviousPosition()
        bot.updateFixed(this.fixedDt, now, allEntities)
      }

      // Evaluate Milestone 2 Core Gameplay Interactions
      if (!this.isMatchFinished) {
        this.evaluateGameplayRules(input, now, allEntities)
      }

      this.physics.step()

      if (this.localPlayer) {
        this.localPlayer.recordCurrentPosition()
      }
      for (const bot of this.bots) {
        bot.recordCurrentPosition()
      }

      this.accumulator -= this.fixedDt
    }

    // Sub-frame interpolation alpha (0.0 to 1.0)
    const alpha = Math.min(1.0, Math.max(0.0, this.accumulator / this.fixedDt))

    // Sync visuals with sub-frame interpolation
    if (this.localPlayer) {
      this.localPlayer.syncVisuals(alpha, now)
      this.cameraController.update(
        this.localPlayer.getPosition(),
        mouseDelta.deltaX,
        mouseDelta.deltaY,
        frameTime,
        this.physics,
        this.localPlayer.collider,
      )

      // Character opacity fading when camera is pushed close by an obstacle
      const currentCamDist = this.cameraController.getCurrentDistance()
      const { fadeDistance, minDistance } = GAME_CONFIG.camera
      if (currentCamDist < fadeDistance) {
        const opacityRatio = Math.max(
          0,
          (currentCamDist - minDistance) / (fadeDistance - minDistance),
        )
        const targetOpacity = THREE.MathUtils.lerp(0.25, 1.0, opacityRatio)
        this.localPlayer.setVisualOpacity(targetOpacity)
      } else {
        this.localPlayer.setVisualOpacity(1.0)
      }

      // Emit player state to Pinia
      this.callbacks.onPlayerStateChange({
        stamina: this.localPlayer.stamina,
        isSprinting: this.localPlayer.isSprinting,
        status: this.localPlayer.status,
        stunUntil: this.localPlayer.stunUntil,
        immunityUntil: this.localPlayer.immunityUntil,
      })
    }

    for (const bot of this.bots) {
      bot.syncVisuals(alpha, now)
    }

    // Render frame
    this.renderer.render(this.scene, this.camera)

    this.animationFrameId = requestAnimationFrame((t) => this.loop(t))
  }

  private evaluateGameplayRules(
    input: { interact: boolean },
    now: number,
    allEntities: GameplayEntity[],
  ): void {
    // 1. Victory Condition A: Base Capture (Touching enemy base pillar while free)
    for (const entity of allEntities) {
      if (entity.status === 'jailed' || entity.status === 'stunned') continue

      const targetTeam: TeamId = entity.teamId === 'blue' ? 'red' : 'blue'
      const targetBasePos =
        targetTeam === 'blue'
          ? this.arena.zones.blueBasePosition
          : this.arena.zones.redBasePosition

      if (GameplayRules.canCaptureBase(entity, targetTeam, targetBasePos)) {
        this.endMatch(entity.teamId, 'base_capture')
        return
      }
    }

    let canRescueAny = false

    // 2. Teammate Rescues
    // A. Player rescuing allies
    if (
      this.localPlayer &&
      this.localPlayer.status !== 'jailed' &&
      this.localPlayer.status !== 'stunned'
    ) {
      for (const entity of allEntities) {
        if (entity.teamId === this.playerTeam && entity.status === 'jailed') {
          const inRescueRadius = GameplayRules.canRescue(this.localPlayer, entity)
          if (inRescueRadius) {
            canRescueAny = true
            // Rescue triggers on pressing 'E' or direct proximity
            if (input.interact) {
              entity.status = 'normal'
              entity.immunityUntil = now + GAME_CONFIG.gameplay.immunityDurationMs
              this.callbacks.onRescue('Anda', entity.name)
            }
          }
        }
      }
    }

    // B. Bots rescuing allies
    for (const bot of this.bots) {
      if (bot.status === 'jailed' || bot.status === 'stunned') continue
      for (const target of allEntities) {
        if (target.teamId === bot.teamId && target.status === 'jailed') {
          if (GameplayRules.canRescue(bot, target)) {
            target.status = 'normal'
            target.immunityUntil = now + GAME_CONFIG.gameplay.immunityDurationMs
            const rescuerName = bot.name
            const targetName = target === this.localPlayer ? 'Anda' : target.name
            this.callbacks.onRescue(rescuerName, targetName)
          }
        }
      }
    }

    // 3. Universal Capture Matrix (Every active entity vs all opponent entities)
    for (const hunter of allEntities) {
      if (hunter.status === 'jailed' || hunter.status === 'stunned') continue

      for (const target of allEntities) {
        if (hunter.teamId === target.teamId) continue
        if (target.status === 'jailed') continue

        if (GameplayRules.canCapture(hunter, target, now)) {
          target.status = 'jailed'
          const jailPos =
            target.teamId === 'blue'
              ? this.arena.zones.blueJailPosition
              : this.arena.zones.redJailPosition
          target.teleportTo(jailPos.x, jailPos.y, jailPos.z)

          const hunterName = hunter === this.localPlayer ? 'Anda' : hunter.name
          const targetName = target === this.localPlayer ? 'Anda' : target.name
          this.callbacks.onCapture(hunterName, targetName)
        }
      }
    }

    // 4. Victory Condition B: Team Elimination (All players on a team jailed)
    const winner = GameplayRules.checkTeamElimination(allEntities)
    if (winner !== null) {
      this.endMatch(winner, 'team_elimination')
      return
    }

    // 5. Update Roster Counts for HUD
    const bluePlayers = allEntities.filter((p) => p.teamId === 'blue')
    const redPlayers = allEntities.filter((p) => p.teamId === 'red')
    const blueJailed = bluePlayers.filter((p) => p.status === 'jailed').length
    const redJailed = redPlayers.filter((p) => p.status === 'jailed').length

    this.callbacks.onRosterUpdate({
      blueJailed,
      blueTotal: bluePlayers.length,
      redJailed,
      redTotal: redPlayers.length,
      canRescue: canRescueAny,
      isInEnemyTerritory: this.localPlayer
        ? GameplayRules.isInEnemyTerritory(this.localPlayer)
        : false,
    })
  }

  private updateDynamicTeamRoles(allEntities: GameplayEntity[]): void {
    const teams: TeamId[] = ['blue', 'red']

    for (const team of teams) {
      const freeMembers = allEntities.filter((e) => e.teamId === team && e.status !== 'jailed')
      const targetBasePos =
        team === 'blue'
          ? this.arena.zones.redBasePosition
          : this.arena.zones.blueBasePosition

      // Rule: If a team has only 1 active free member left, any surviving bot adopts the 'hybrid' dual-role!
      if (freeMembers.length === 1) {
        const survivor = freeMembers[0]
        if (survivor instanceof BotController) {
          survivor.setRole('hybrid', targetBasePos)
        }
      } else if (freeMembers.length > 1) {
        // Multiple free members: maintain role balance (attacker + defender)
        const teamBots = this.bots.filter((b) => b.teamId === team && b.status !== 'jailed')
        if (teamBots.length === 2) {
          const hasAttacker = teamBots.some((b) => b.role === 'attacker')
          const bot1 = teamBots[0]
          const bot2 = teamBots[1]
          if (!hasAttacker && bot1 && bot2) {
            bot1.setRole('attacker', targetBasePos)
            bot2.setRole('defender', targetBasePos)
          }
        }
      }
    }
  }

  private endMatch(winner: TeamId, reason: 'base_capture' | 'team_elimination'): void {
    if (this.isMatchFinished) return
    this.isMatchFinished = true

    const durationSeconds = Math.round((performance.now() - this.matchStartTime) / 1000)

    const result: MatchResult = {
      matchId: `match-${Date.now()}`,
      winner,
      reason,
      duration: durationSeconds,
      players: [
        {
          playerId: 'local-player',
          teamId: this.playerTeam,
          captures: 0,
          rescues: 0,
          timesCaptured: 0,
        },
      ],
    }

    this.callbacks.onMatchEnd(result)
  }

  private onResize(): void {
    if (!this.container) return
    const width = this.container.clientWidth
    const height = this.container.clientHeight || 1
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height)
  }

  public dispose(): void {
    this.isRunning = false
    cancelAnimationFrame(this.animationFrameId)
    window.removeEventListener('resize', this.onResizeBound)

    this.input.dispose()
    if (this.localPlayer) {
      this.localPlayer.dispose()
    }
    for (const bot of this.bots) {
      bot.dispose()
    }
    this.bots.length = 0

    if (this.arena) {
      this.arena.dispose()
    }
    if (this.physics) {
      this.physics.dispose()
    }

    this.renderer.dispose()
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement)
    }
  }
}
