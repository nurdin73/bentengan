import * as THREE from 'three'
import { PhysicsWorld } from '../physics/physics-world'
import { ArenaGreybox } from '../scenes/arena-greybox'
import { preloadArenaModel } from '../scenes/arena-model-loader'
import { InputManager } from '../input/input-manager'
import { ThirdPersonCameraController } from '../camera/third-person'
import { PlayerController } from '../entities/player-controller'
import { BotController } from '../entities/bot-controller'
import { RemotePlayerController } from '../entities/remote-player-controller'
import { preloadCharacterModel } from '../entities/character-avatar'
import { GameplayRules } from '../systems/gameplay-rules'
import { GAME_CONFIG } from './constants'
import { peerNetworkManager } from '../network/peer-network-manager'
import { SkillManager } from '../skills/skill-manager'
import { useDevStore, type TeleportTarget } from '../../stores/dev-store'
import { useSettingsStore } from '../../stores/settings-store'
import { soundManager } from '../audio/sound-manager'
import { VFXManager } from '../vfx/vfx-manager'
import type {
  SkillId,
  SkillsStateMap,
  SkillActivationResult,
  SmokeEventPayload,
} from '../skills/skill-types'
import type {
  PlayerNetworkState,
  PlayerUpdateMessage,
  WorldSnapshotMessage,
  GameEventMessage,
} from '../network/network-protocol'
import type {
  TeamId,
  PlayerStatus,
  MatchResult,
  MatchEndReason,
  GameplayEntity,
  MovementInput,
  RoomPlayer,
} from '../../types/game.types'

export interface GameEngineInitOptions {
  localPlayerId?: string
  localPlayerUsername?: string
  teamId?: TeamId
  outfitId?: number
  roomPlayers?: RoomPlayer[]
  isPractice?: boolean
  isHost?: boolean
}

export interface GameEngineStateCallback {
  onPlayerStateChange: (state: {
    stamina: number
    isSprinting: boolean
    status: PlayerStatus
    stunUntil: number
    immunityUntil: number
    rescueCooldownUntil: number
    rescueCooldownRemainingSeconds?: number
    immunitySource?: 'skill' | 'rescue' | null
  }) => void
  onSkillStateChange?: (skills: SkillsStateMap) => void
  onRosterUpdate: (roster: {
    blueJailed: number
    blueTotal: number
    redJailed: number
    redTotal: number
    canRescue: boolean
    isInEnemyTerritory: boolean
    isNearJailedAlly?: boolean
  }) => void
  onCapture: (hunterName: string, targetName: string) => void
  onRescue: (rescuerName: string, targetName: string) => void
  onMatchEnd: (result: MatchResult) => void
}

function calculateSpawnPosition(
  team: TeamId,
  indexInTeam: number,
  teamTotal: number,
): [number, number, number] {
  const spawnZ = team === 'blue' ? -20 : 20
  const spacing = 4.5
  const startX = -((teamTotal - 1) * spacing) / 2
  const spawnX = teamTotal <= 1 ? 0 : startX + indexInTeam * spacing
  return [spawnX, 1, spawnZ]
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
  public readonly remotePlayers = new Map<string, RemotePlayerController>()
  public roomPlayers: RoomPlayer[] = []
  public skillManager!: SkillManager
  public readonly vfx: VFXManager

  // Network & Multiplayer State
  public isHost = false
  public isPractice = true
  public localPlayerId = 'local-player'
  public localPlayerUsername = 'Anda'
  private networkTimer = 0
  private worldTick = 0

  // Fixed timestep accumulator
  private isRunning = false
  private isPaused = false
  private pausedAt = 0
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
    this.scene.background = new THREE.Color(0x7dd3fc)
    this.scene.fog = new THREE.Fog(0x7dd3fc, 45, 95)

    const aspect = container.clientWidth / (container.clientHeight || 1)
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 150)
    this.cameraController = new ThirdPersonCameraController(this.camera)

    // 2. WebGL Renderer with Shadow Map
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    })
    this.renderer.setSize(container.clientWidth, container.clientHeight)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    let shadowsEnabled = true
    try {
      const settings = useSettingsStore()
      shadowsEnabled = settings.shadowsEnabled
    } catch {
      // In headless test environments
    }
    this.renderer.shadowMap.enabled = shadowsEnabled
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    container.appendChild(this.renderer.domElement)

    // 3. Lighting Setup
    this.setupLighting()

    // 4. VFX Manager Setup
    this.vfx = new VFXManager(this.scene)

    // 5. Input Manager
    this.input = new InputManager()
    this.input.attach(this.renderer.domElement)

    window.addEventListener('resize', this.onResizeBound)
  }

  private setupLighting(): void {
    // Stylized dual-tone hemisphere light (sky blue upper, grass green ground bounce)
    const hemiLight = new THREE.HemisphereLight(0xbae6fd, 0x4d7c0f, 0.65)
    this.scene.add(hemiLight)

    // Soft ambient fill to avoid pitch-black crevices in low-poly geometry
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.25)
    this.scene.add(ambientLight)

    // Warm direct sunlight with shadow map for arena depth
    const sunLight = new THREE.DirectionalLight(0xfffbeb, 1.25)
    sunLight.position.set(22, 38, 18)
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

  public async init(optionsOrTeam: TeamId | GameEngineInitOptions = 'blue'): Promise<void> {
    const options: GameEngineInitOptions =
      typeof optionsOrTeam === 'string' ? { teamId: optionsOrTeam } : optionsOrTeam

    const teamId = options.teamId ?? 'blue'
    this.playerTeam = teamId
    this.isMatchFinished = false
    this.isPractice =
      options.isPractice ?? (options.roomPlayers && options.roomPlayers.length > 1 ? false : true)
    this.isHost = options.isHost ?? false
    this.localPlayerId = options.localPlayerId ?? 'local-player'
    this.localPlayerUsername = options.localPlayerUsername ?? 'Anda'

    // 1. Initialize Audio and Rapier Physics World
    soundManager.init()
    this.physics = await PhysicsWorld.create()

    // Preload 3D character + arena models in parallel (null -> procedural fallback)
    await Promise.all([
      preloadCharacterModel().catch(() => null),
      preloadArenaModel().catch(() => null),
    ])

    // 2. Create Symmetrical Arena
    this.arena = new ArenaGreybox(this.scene, this.physics)

    // 3. Initialize Tactical Skill Manager
    this.skillManager = new SkillManager(this.scene, {
      onSkillStateChange: (skills) => {
        this.callbacks.onSkillStateChange?.(skills)
      },
      onSmokeTriggered: (payload) => {
        this.handleSmokeTriggered(payload)
      },
    })

    // Clear any lingering remote players
    for (const remote of this.remotePlayers.values()) {
      remote.dispose(this.scene)
    }
    this.remotePlayers.clear()

    const roomPlayers = options.roomPlayers ?? []
    this.roomPlayers = [...roomPlayers]

    if (this.isPractice) {
      // 3. Spawn Local Player for Practice Mode
      const spawnZ = teamId === 'blue' ? -20 : 20
      this.localPlayer = new PlayerController(this.scene, this.physics, {
        id: this.localPlayerId,
        name: this.localPlayerUsername,
        teamId,
        initialPosition: [0, 1, spawnZ],
        outfitId: options.outfitId ?? 1,
      })

      // 4. Spawn Milestone 2 Simulated Roster (Solo Practice against AI)
      this.spawnSimulatedBots(teamId)
    } else {
      // Multiplayer Room: Spawn real players from room roster (No fake bots)
      const bluePlayers = roomPlayers.filter((p) => p.teamId === 'blue')
      const redPlayers = roomPlayers.filter((p) => p.teamId === 'red')

      // A. Spawn Local Player
      const myTeamPlayers = teamId === 'blue' ? bluePlayers : redPlayers
      const myIdx = Math.max(
        0,
        myTeamPlayers.findIndex((p) => p.id === this.localPlayerId),
      )
      const myRoomPlayer = roomPlayers.find((p) => p.id === this.localPlayerId)
      const localSpawnPos = calculateSpawnPosition(teamId, myIdx, Math.max(1, myTeamPlayers.length))

      this.localPlayer = new PlayerController(this.scene, this.physics, {
        id: this.localPlayerId,
        name: this.localPlayerUsername,
        teamId,
        initialPosition: localSpawnPos,
        outfitId: myRoomPlayer?.outfitId ?? options.outfitId ?? (myIdx % 6) + 1,
      })

      // B. Spawn Remote Players (Opponents & Teammates)
      for (const p of roomPlayers) {
        if (p.id === this.localPlayerId) continue

        const pTeamPlayers = p.teamId === 'blue' ? bluePlayers : redPlayers
        const pIdx = Math.max(
          0,
          pTeamPlayers.findIndex((tp) => tp.id === p.id),
        )
        const pSpawnPos = calculateSpawnPosition(p.teamId, pIdx, Math.max(1, pTeamPlayers.length))

        const remote = new RemotePlayerController(this.scene, this.physics, {
          id: p.id,
          name: p.username,
          teamId: p.teamId,
          initialPosition: pSpawnPos,
          outfitId: p.outfitId ?? (pIdx % 6) + 1,
        })

        // Orient remote player towards the opposing fortress
        const facingYaw = p.teamId === 'blue' ? Math.PI : 0
        remote.setTargetTransform(pSpawnPos, facingYaw)

        this.remotePlayers.set(p.id, remote)
      }
    }

    const initialYaw = teamId === 'blue' ? Math.PI : 0
    this.cameraController.setYaw(initialYaw)
    this.cameraController.snap(this.localPlayer.getPosition())

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
      playerTeam === 'blue' ? this.arena.zones.blueJailPosition : this.arena.zones.redJailPosition

    const playerBasePos =
      playerTeam === 'blue' ? this.arena.zones.blueBasePosition : this.arena.zones.redBasePosition

    const enemyBasePos =
      enemyTeam === 'blue' ? this.arena.zones.blueBasePosition : this.arena.zones.redBasePosition

    const enemyJailPos =
      enemyTeam === 'blue' ? this.arena.zones.blueJailPosition : this.arena.zones.redJailPosition

    // A. Jailed Ally Bot (starts in enemy jail; when rescued, attacks enemy base)
    const allyBot = new BotController(this.scene, this.physics, {
      id: 'bot-ally-1',
      name: playerTeam === 'blue' ? 'Kawan Biru (Tahanan)' : 'Kawan Merah (Tahanan)',
      teamId: playerTeam,
      role: 'attacker',
      initialPosition: [allyJailPos.x, 1, allyJailPos.z],
      targetObjective: [enemyBasePos.x, enemyBasePos.y, enemyBasePos.z],
      enemyBasePosition: [enemyBasePos.x, enemyBasePos.y, enemyBasePos.z],
      allyJailPosition: [allyJailPos.x, 1, allyJailPos.z],
      outfitId: 2,
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
      enemyBasePosition: [playerBasePos.x, playerBasePos.y, playerBasePos.z],
      allyJailPosition: [enemyJailPos.x, 1, enemyJailPos.z],
      outfitId: 3,
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
      enemyBasePosition: [playerBasePos.x, playerBasePos.y, playerBasePos.z],
      allyJailPosition: [enemyJailPos.x, 1, enemyJailPos.z],
      outfitId: 4,
    })
    this.bots.push(enemyBot2)
  }

  private loop(currentTime: number): void {
    if (!this.isRunning) return

    if (this.isPractice && this.isPaused) {
      this.lastTime = currentTime
      this.accumulator = 0
      this.renderer.render(this.scene, this.camera)
      this.animationFrameId = requestAnimationFrame((t) => this.loop(t))
      return
    }

    const frameTime = Math.min((currentTime - this.lastTime) / 1000, 0.1)
    this.lastTime = currentTime
    this.accumulator += frameTime

    const mouseDelta = this.isPaused ? { deltaX: 0, deltaY: 0 } : this.input.consumeMouseDelta()
    const now = performance.now()

    if (this.localPlayer && !this.isPaused && this.skillManager) {
      const triggeredSkills = this.input.consumePendingSkills()
      for (const skillId of triggeredSkills) {
        this.skillManager.triggerSkill(skillId, this.localPlayer, now)
      }
      this.skillManager.update(frameTime, now)
      this.callbacks.onSkillStateChange?.(this.skillManager.getAllSkillsState(now))
    }

    // Fixed timestep physics update (60 Hz)
    while (this.accumulator >= this.fixedDt) {
      this.applyDevModifiers(now)

      const allEntities: GameplayEntity[] = [
        ...(this.localPlayer ? [this.localPlayer] : []),
        ...this.remotePlayers.values(),
        ...this.bots,
      ]

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
        if (!this.isPaused) {
          input = this.input.getMovementInput(this.cameraController.getYaw())
        }
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
      this.localPlayer.syncVisuals(alpha, frameTime, now)
      this.cameraController.update(
        this.localPlayer.mesh.position,
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

      if (this.localPlayer.rescueCooldownUntil > 0 && now >= this.localPlayer.rescueCooldownUntil) {
        this.localPlayer.rescueCooldownUntil = 0
      }
      const remainingRescueMs = Math.max(0, this.localPlayer.rescueCooldownUntil - now)
      const rescueCooldownRemainingSeconds = Math.ceil(remainingRescueMs / 1000)

      // Emit player state to Pinia
      this.callbacks.onPlayerStateChange({
        stamina: this.localPlayer.stamina,
        isSprinting: this.localPlayer.isSprinting,
        status: this.localPlayer.status,
        stunUntil: this.localPlayer.stunUntil,
        immunityUntil: this.localPlayer.immunityUntil,
        rescueCooldownUntil: this.localPlayer.rescueCooldownUntil,
        rescueCooldownRemainingSeconds,
        immunitySource: this.localPlayer.immunitySource,
      })
    }

    for (const bot of this.bots) {
      bot.syncVisuals(alpha, frameTime, now)
    }

    for (const remote of this.remotePlayers.values()) {
      remote.updateInterpolation(frameTime, now)
    }

    // Network synchronization tick (20 Hz per PRD Section 11.4)
    if (!this.isPractice) {
      this.networkTimer += frameTime
      if (this.networkTimer >= 0.05) {
        this.networkTimer = 0
        this.syncNetworkTick()
      }
    }

    // Update VFX Particles & Sprint Dust
    this.vfx.update(frameTime)
    if (this.localPlayer && this.localPlayer.isSprinting && this.localPlayer.isGrounded) {
      this.vfx.spawnSprintDust(this.localPlayer.mesh.position)
    }
    // Remote opponent sprint dust
    for (const remote of this.remotePlayers.values()) {
      if (remote.isSprinting && remote.status === 'normal') {
        this.vfx.spawnSprintDust(remote.mesh.position)
      }
    }
    // Bot sprint dust
    for (const bot of this.bots) {
      if (bot.isSprinting && bot.status === 'normal') {
        this.vfx.spawnSprintDust(bot.getPosition())
      }
    }

    // Render frame
    this.renderer.render(this.scene, this.camera)

    this.animationFrameId = requestAnimationFrame((t) => this.loop(t))
  }

  private syncNetworkTick(): void {
    if (!this.localPlayer) return

    const now = performance.now()
    const localPos = this.localPlayer.getPosition()
    const localRemainingImmunity = Math.max(0, this.localPlayer.immunityUntil - now)
    const localRemainingStun = Math.max(0, this.localPlayer.stunUntil - now)

    const localState: PlayerNetworkState = {
      id: this.localPlayerId,
      position: [localPos.x, localPos.y, localPos.z],
      rotationY: this.localPlayer.mesh.rotation.y,
      status: this.localPlayer.status,
      isSprinting: this.localPlayer.isSprinting,
      immunityUntil: localRemainingImmunity,
      stunUntil: localRemainingStun,
    }

    if (this.isHost) {
      // Host authoritative world snapshot
      const allStates: PlayerNetworkState[] = [localState]
      const seenIds = new Set<string>([this.localPlayerId])

      for (const [id, remote] of this.remotePlayers.entries()) {
        if (!id || id === this.localPlayerId || seenIds.has(id)) continue
        seenIds.add(id)

        const rPos = remote.getPosition()
        const rRemainingImmunity = Math.max(0, remote.immunityUntil - now)
        const rRemainingStun = Math.max(0, remote.stunUntil - now)

        allStates.push({
          id,
          position: [rPos.x, rPos.y, rPos.z],
          rotationY: remote.mesh.rotation.y,
          status: remote.status,
          isSprinting: remote.isSprinting,
          immunityUntil: rRemainingImmunity,
          stunUntil: rRemainingStun,
        })
      }
      peerNetworkManager.broadcastWorldSnapshot(this.worldTick++, allStates)
    } else {
      // Client sends local transform to Host
      peerNetworkManager.sendPlayerUpdate(localState)
    }
  }

  public updateRoomPlayers(players: RoomPlayer[]): void {
    this.roomPlayers = [...players]
  }

  public spawnOrRestoreRemotePlayer(
    player: RoomPlayer,
    initialPos?: [number, number, number],
  ): RemotePlayerController | null {
    if (!player || player.id === this.localPlayerId) {
      return null
    }

    const existing = this.remotePlayers.get(player.id)
    if (existing) {
      if (initialPos) {
        existing.setTargetTransform(initialPos, player.teamId === 'blue' ? Math.PI : 0)
      }
      return existing
    }

    // Clean up any lingering/orphaned 3D mesh for this player in the scene
    const orphanedMesh = this.scene.children.find((c) => c.userData?.playerId === player.id)
    if (orphanedMesh) {
      this.scene.remove(orphanedMesh)
    }

    const defaultZ = player.teamId === 'blue' ? -20 : 20
    const spawnPos: [number, number, number] = initialPos ?? [0, 1, defaultZ]

    const sameTeamPlayers = this.roomPlayers.filter((p) => p.teamId === player.teamId)
    const pIdx = Math.max(
      0,
      sameTeamPlayers.findIndex((p) => p.id === player.id),
    )
    const outfitId = player.outfitId ?? (pIdx % 6) + 1

    const remote = new RemotePlayerController(this.scene, this.physics, {
      id: player.id,
      name: player.username,
      teamId: player.teamId,
      initialPosition: spawnPos,
      outfitId,
    })

    const facingYaw = player.teamId === 'blue' ? Math.PI : 0
    remote.setTargetTransform(spawnPos, facingYaw)

    this.remotePlayers.set(player.id, remote)

    // Keep internal roomPlayers roster in sync
    const rIdx = this.roomPlayers.findIndex((p) => p.id === player.id)
    if (rIdx !== -1) {
      this.roomPlayers[rIdx] = player
    } else {
      this.roomPlayers.push(player)
    }

    return remote
  }

  public onPlayerUpdate(update: PlayerUpdateMessage): void {
    if (update.playerId === this.localPlayerId) return

    const now = performance.now()
    let remote = this.remotePlayers.get(update.playerId)
    if (!remote && this.isHost) {
      const playerInfo = this.roomPlayers.find((p) => p.id === update.playerId)
      if (playerInfo) {
        remote = this.spawnOrRestoreRemotePlayer(playerInfo, update.state.position) ?? undefined
      }
    }
    if (remote) {
      const targetImmunityUntil =
        update.state.immunityUntil > 0 ? now + update.state.immunityUntil : 0
      const targetStunUntil = update.state.stunUntil > 0 ? now + update.state.stunUntil : 0
      remote.setTargetTransform(
        update.state.position,
        update.state.rotationY,
        update.state.status,
        update.state.isSprinting,
        targetImmunityUntil,
        targetStunUntil,
      )
    }
  }

  public onWorldSnapshot(snapshot: WorldSnapshotMessage): void {
    const seenPlayerIds = new Set<string>()
    const now = performance.now()

    for (const pState of snapshot.players) {
      if (!pState.id || pState.id === this.localPlayerId || seenPlayerIds.has(pState.id)) {
        if (pState.id === this.localPlayerId && this.localPlayer) {
          // Authoritative reconciliation for local player if jailed or stunned
          if (pState.status !== this.localPlayer.status) {
            // Prevent remote snapshot from prematurely clearing active local stamina stun
            if (this.localPlayer.status === 'stunned' && pState.status === 'normal') {
              // Local stamina stun remains authoritative until local timer and stamina recovery complete
            } else {
              this.localPlayer.status = pState.status
              if (pState.status === 'jailed') {
                const jailPos =
                  this.playerTeam === 'blue'
                    ? this.arena.zones.blueJailPosition
                    : this.arena.zones.redJailPosition
                this.localPlayer.teleportTo(jailPos.x, jailPos.y, jailPos.z)
              }
            }
          }
        }
        continue
      }

      seenPlayerIds.add(pState.id)

      let remote = this.remotePlayers.get(pState.id)
      if (!remote) {
        const playerInfo = this.roomPlayers.find((p) => p.id === pState.id)
        if (playerInfo) {
          remote = this.spawnOrRestoreRemotePlayer(playerInfo, pState.position) ?? undefined
        }
      }
      if (remote) {
        const targetImmunityUntil = pState.immunityUntil > 0 ? now + pState.immunityUntil : 0
        const targetStunUntil = pState.stunUntil > 0 ? now + pState.stunUntil : 0
        remote.setTargetTransform(
          pState.position,
          pState.rotationY,
          pState.status,
          pState.isSprinting,
          targetImmunityUntil,
          targetStunUntil,
        )
      }
    }
  }

  public onGameEvent(event: GameEventMessage): void {
    if (event.event === 'capture') {
      soundManager.playCapture()
      this.callbacks.onCapture(event.sourceId ?? '', event.targetId ?? '')
    } else if (event.event === 'rescue') {
      soundManager.playRescue()
      if (
        this.localPlayer &&
        (event.sourceId === 'Anda' || event.sourceId === this.localPlayer.name)
      ) {
        this.localPlayer.rescueCooldownUntil =
          performance.now() + GAME_CONFIG.gameplay.rescueCooldownMs
      }
      if (
        this.localPlayer &&
        (event.targetId === 'Anda' || event.targetId === this.localPlayer.name)
      ) {
        this.localPlayer.immunitySource = 'rescue'
      }
      this.callbacks.onRescue(event.sourceId ?? '', event.targetId ?? '')
    } else if (event.event === 'match_end' && event.winner && event.reason) {
      this.endMatch(event.winner, event.reason)
    } else if (event.event === 'smoke' && event.position) {
      const [sx, sy, sz] = event.position
      const duration = event.durationMs ?? GAME_CONFIG.skills.smoke.durationMs
      // Replicate 3D visual smoke volume if event originated from a remote player/opponent
      if (event.sourceId !== this.localPlayerId) {
        this.skillManager?.spawnSmokeVisual(sx, sy, sz, duration)
      }
      // If host, confound enemy bots within smoke radius
      if (this.isHost) {
        const radius = event.radius ?? GAME_CONFIG.skills.smoke.radius
        for (const bot of this.bots) {
          if (bot.status !== 'jailed') {
            const d = GameplayRules.distance3D({ x: sx, y: sy, z: sz }, bot.getPosition())
            if (d <= radius) {
              bot.applySmokeConfound(duration)
            }
          }
        }
      }
    }
  }

  public removeRemotePlayer(playerId: string): void {
    const remote = this.remotePlayers.get(playerId)
    if (remote) {
      remote.dispose(this.scene)
      this.remotePlayers.delete(playerId)
    }
  }

  private getDevStore(): ReturnType<typeof useDevStore> | null {
    try {
      return useDevStore()
    } catch {
      return null
    }
  }

  public teleportPlayerTo(target: TeleportTarget): void {
    if (!this.localPlayer || !this.arena) return
    const enemyTeam: TeamId = this.playerTeam === 'blue' ? 'red' : 'blue'
    let dest = { x: 0, y: 1, z: 0 }
    if (target === 'enemy_base') {
      const basePos =
        enemyTeam === 'blue' ? this.arena.zones.blueBasePosition : this.arena.zones.redBasePosition
      dest = { x: basePos.x, y: 1, z: basePos.z }
    } else if (target === 'own_base') {
      const basePos =
        this.playerTeam === 'blue'
          ? this.arena.zones.blueBasePosition
          : this.arena.zones.redBasePosition
      dest = { x: basePos.x, y: 1, z: basePos.z }
    } else if (target === 'enemy_jail') {
      const jailPos =
        enemyTeam === 'blue' ? this.arena.zones.blueJailPosition : this.arena.zones.redJailPosition
      dest = { x: jailPos.x, y: 1, z: jailPos.z }
    } else if (target === 'own_jail') {
      const jailPos =
        this.playerTeam === 'blue'
          ? this.arena.zones.blueJailPosition
          : this.arena.zones.redJailPosition
      dest = { x: jailPos.x, y: 1, z: jailPos.z }
    }
    this.localPlayer.teleportTo(dest.x, dest.y, dest.z)
  }

  private applyDevModifiers(now: number): void {
    const dev = this.getDevStore()
    if (!dev || !dev.isUnlocked) return

    // 1. Bot freezing
    const freezeEnemy = dev.freezeEnemyBots
    const freezeAll = dev.freezeAllBots
    for (const bot of this.bots) {
      bot.isFrozen = freezeAll || (freezeEnemy && bot.teamId !== this.playerTeam)
    }

    // 2. God mode & Speed
    if (this.localPlayer) {
      this.localPlayer.isGodMode = dev.godMode
      this.localPlayer.speedMultiplier = dev.speedMultiplier
      if (dev.infiniteStamina) {
        this.localPlayer.stamina = GAME_CONFIG.stamina.max
        this.localPlayer.isExhausted = false
      }
    }

    // 3. Zero Cooldowns
    if (dev.zeroCooldowns) {
      if (this.skillManager) {
        this.skillManager.resetAllCooldowns(now)
      }
      if (this.localPlayer) {
        this.localPlayer.rescueCooldownUntil = 0
      }
    }

    // 4. Pending Teleport
    const teleportTarget = dev.consumeTeleportRequest()
    if (teleportTarget) {
      this.teleportPlayerTo(teleportTarget)
    }

    // 5. Pending Instant Win
    if (dev.consumeInstantWinRequest() && !this.isMatchFinished) {
      this.endMatch(this.playerTeam, 'base_capture')
    }
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
        targetTeam === 'blue' ? this.arena.zones.blueBasePosition : this.arena.zones.redBasePosition

      if (GameplayRules.canCaptureBase(entity, targetTeam, targetBasePos)) {
        this.endMatch(entity.teamId, 'base_capture')
        return
      }
    }

    let canRescueAny = false
    let isNearJailedAlly = false

    // 2. Teammate Rescues
    // A. Player rescuing allies (triggers on 'E' / rescue button press OR direct proximity touch / "tempel")
    if (
      this.localPlayer &&
      this.localPlayer.status !== 'jailed' &&
      this.localPlayer.status !== 'stunned'
    ) {
      for (const entity of allEntities) {
        if (entity.teamId === this.playerTeam && entity.status === 'jailed') {
          const dist = GameplayRules.distance3D(
            this.localPlayer.getPosition(),
            entity.getPosition(),
          )
          if (dist <= GAME_CONFIG.gameplay.rescueRadius) {
            isNearJailedAlly = true
          }
          const inRescueRadius = GameplayRules.canRescue(this.localPlayer, entity, now)
          if (inRescueRadius) {
            canRescueAny = true
            // Rescue triggers on pressing 'E' / rescue button OR direct proximity touch ("tempel")
            if (input.interact || inRescueRadius) {
              this.localPlayer.rescueCooldownUntil = now + GAME_CONFIG.gameplay.rescueCooldownMs
              entity.status = 'normal'
              entity.immunityUntil = now + GAME_CONFIG.gameplay.immunityDurationMs
              if (entity instanceof PlayerController) {
                entity.immunitySource = 'rescue'
              }
              if (entity instanceof BotController) {
                entity.isRetreating = true
              }
              this.vfx.spawnRescueSparkles(entity.getPosition())
              soundManager.playRescue()
              this.callbacks.onRescue('Anda', entity.name)
              if (this.isHost && !this.isPractice) {
                peerNetworkManager.broadcastGameEvent({
                  event: 'rescue',
                  sourceId: 'Anda',
                  targetId: entity.name,
                })
              }
            }
          }
        }
      }
    }

    // B. Other free entities (bots and remote players) rescuing allies via proximity touch ("tempel")
    for (const rescuer of allEntities) {
      if (rescuer === this.localPlayer) continue
      if (rescuer.status === 'jailed' || rescuer.status === 'stunned') continue
      for (const target of allEntities) {
        if (target.teamId === rescuer.teamId && target.status === 'jailed') {
          if (GameplayRules.canRescue(rescuer, target, now)) {
            rescuer.rescueCooldownUntil = now + GAME_CONFIG.gameplay.rescueCooldownMs
            target.status = 'normal'
            target.immunityUntil = now + GAME_CONFIG.gameplay.immunityDurationMs
            if (target instanceof PlayerController) {
              target.immunitySource = 'rescue'
            }
            if (target instanceof BotController) {
              target.isRetreating = true
            }
            this.vfx.spawnRescueSparkles(target.getPosition())
            soundManager.playRescue()
            const rescuerName = rescuer.name
            const targetName = target === this.localPlayer ? 'Anda' : target.name
            this.callbacks.onRescue(rescuerName, targetName)
            if (this.isHost && !this.isPractice) {
              peerNetworkManager.broadcastGameEvent({
                event: 'rescue',
                sourceId: rescuerName,
                targetId: targetName,
              })
            }
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
          this.vfx.spawnCaptureRing(target.getPosition())
          soundManager.playCapture()

          const hunterName = hunter === this.localPlayer ? 'Anda' : hunter.name
          const targetName = target === this.localPlayer ? 'Anda' : target.name
          this.callbacks.onCapture(hunterName, targetName)
          if (this.isHost && !this.isPractice) {
            peerNetworkManager.broadcastGameEvent({
              event: 'capture',
              sourceId: hunterName,
              targetId: targetName,
            })
          }
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
      isNearJailedAlly,
    })
  }

  private updateDynamicTeamRoles(allEntities: GameplayEntity[]): void {
    const teams: TeamId[] = ['blue', 'red']

    for (const team of teams) {
      const freeMembers = allEntities.filter((e) => e.teamId === team && e.status !== 'jailed')
      const targetBasePos =
        team === 'blue' ? this.arena.zones.redBasePosition : this.arena.zones.blueBasePosition

      const allyJailPos =
        team === 'blue' ? this.arena.zones.blueJailPosition : this.arena.zones.redJailPosition

      // Rule: If a team has only 1 active free member left, any surviving bot adopts the 'hybrid' dual-role!
      if (freeMembers.length === 1) {
        const survivor = freeMembers[0]
        if (survivor instanceof BotController) {
          survivor.setRole('hybrid', targetBasePos, allyJailPos)
        }
      } else if (freeMembers.length > 1) {
        // Multiple free members: maintain role balance (attacker + defender)
        const teamBots = this.bots.filter((b) => b.teamId === team && b.status !== 'jailed')
        if (teamBots.length === 2) {
          const hasAttacker = teamBots.some((b) => b.role === 'attacker')
          const bot1 = teamBots[0]
          const bot2 = teamBots[1]
          if (!hasAttacker && bot1 && bot2) {
            bot1.setRole('attacker', targetBasePos, allyJailPos)
            bot2.setRole('defender', targetBasePos, allyJailPos)
          }
        }
      }
    }
  }

  private endMatch(winner: TeamId, reason: MatchEndReason): void {
    if (this.isMatchFinished) return
    this.isMatchFinished = true

    if (this.isHost && !this.isPractice) {
      peerNetworkManager.broadcastGameEvent({
        event: 'match_end',
        winner,
        reason,
      })
    }

    if (reason === 'base_capture' && this.arena) {
      const basePos =
        winner === 'blue' ? this.arena.zones.redBasePosition : this.arena.zones.blueBasePosition
      this.vfx.triggerBaseBeacon(basePos, winner === 'blue' ? 0x3b82f6 : 0xef4444)
      soundManager.playBaseTouch()
    }

    if (winner === this.playerTeam) {
      soundManager.playVictory()
    } else if (winner) {
      soundManager.playDefeat()
    }

    const durationSeconds = Math.round((performance.now() - this.matchStartTime) / 1000)

    const result: MatchResult = {
      matchId: `match-${Date.now()}`,
      winner,
      reason,
      duration: durationSeconds,
      players: [
        {
          playerId: this.localPlayerId,
          teamId: this.playerTeam,
          captures: 0,
          rescues: 0,
          timesCaptured: 0,
        },
      ],
    }

    this.callbacks.onMatchEnd(result)
  }

  public setPaused(paused: boolean): void {
    if (this.isPaused === paused) return
    this.isPaused = paused

    if (paused) {
      this.pausedAt = performance.now()
      this.input.reset()
      if (document.pointerLockElement) {
        document.exitPointerLock?.()
      }
    } else {
      const pausedDuration = performance.now() - this.pausedAt
      this.matchStartTime += pausedDuration
      this.lastTime = performance.now()
      this.accumulator = 0
      this.input.reset()

      if (this.isPractice) {
        if (this.localPlayer) {
          if (this.localPlayer.stunUntil > this.pausedAt) {
            this.localPlayer.stunUntil += pausedDuration
          }
          if (this.localPlayer.immunityUntil > this.pausedAt) {
            this.localPlayer.immunityUntil += pausedDuration
          }
        }
        for (const bot of this.bots) {
          if (bot.stunUntil > this.pausedAt) {
            bot.stunUntil += pausedDuration
          }
          if (bot.immunityUntil > this.pausedAt) {
            bot.immunityUntil += pausedDuration
          }
        }
      }
    }
  }

  private handleSmokeTriggered(payload: SmokeEventPayload): void {
    const smokePos = { x: payload.x, y: payload.y, z: payload.z }
    for (const bot of this.bots) {
      if (bot.teamId !== payload.sourceTeamId && bot.status !== 'jailed') {
        const d = GameplayRules.distance3D(smokePos, bot.getPosition())
        if (d <= payload.radius) {
          bot.applySmokeConfound(payload.durationMs)
        }
      }
    }

    if (!this.isPractice) {
      peerNetworkManager.broadcastGameEvent({
        event: 'smoke',
        sourceId: this.localPlayerId,
        position: [payload.x, payload.y, payload.z],
        radius: payload.radius,
        durationMs: payload.durationMs,
      })
    }
  }

  public triggerSkill(skillId: SkillId): SkillActivationResult {
    if (!this.localPlayer || !this.skillManager) {
      return { success: false, reason: 'jailed' }
    }
    return this.skillManager.triggerSkill(skillId, this.localPlayer, performance.now())
  }

  public getIsPaused(): boolean {
    return this.isPaused
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
    if (this.skillManager) {
      this.skillManager.dispose()
    }
    if (this.localPlayer) {
      this.localPlayer.dispose()
    }
    for (const bot of this.bots) {
      bot.dispose()
    }
    this.bots.length = 0

    for (const remote of this.remotePlayers.values()) {
      remote.dispose(this.scene)
    }
    this.remotePlayers.clear()

    if (this.arena) {
      this.arena.dispose()
    }
    if (this.physics) {
      this.physics.dispose()
    }

    if (this.vfx) {
      this.vfx.dispose()
    }
    soundManager.dispose()

    this.renderer.dispose()
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement)
    }
  }
}
