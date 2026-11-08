import type { MovementInput } from '../../types/game.types'

export interface VirtualMovementInput {
  forward: boolean
  backward: boolean
  left: boolean
  right: boolean
}

export class InputManager {
  private keys: Record<string, boolean> = {
    KeyW: false,
    KeyS: false,
    KeyA: false,
    KeyD: false,
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
    ShiftLeft: false,
    ShiftRight: false,
    Space: false,
    KeyE: false,
  }

  private virtualMovement: VirtualMovementInput = {
    forward: false,
    backward: false,
    left: false,
    right: false,
  }
  private isVirtualSprint = false
  private isVirtualJump = false
  private isVirtualInteract = false

  private mouseDeltaX = 0
  private mouseDeltaY = 0
  private isPointerLocked = false
  private domElement: HTMLElement | null = null

  private onKeyDownBound = this.onKeyDown.bind(this)
  private onKeyUpBound = this.onKeyUp.bind(this)
  private onMouseMoveBound = this.onMouseMove.bind(this)
  private onPointerLockChangeBound = this.onPointerLockChange.bind(this)

  public attach(element: HTMLElement): void {
    this.domElement = element
    window.addEventListener('keydown', this.onKeyDownBound)
    window.addEventListener('keyup', this.onKeyUpBound)
    document.addEventListener('mousemove', this.onMouseMoveBound)
    document.addEventListener('pointerlockchange', this.onPointerLockChangeBound)

    element.addEventListener('click', () => {
      this.requestPointerLock()
    })
  }

  public requestPointerLock(): void {
    if (this.domElement && document.pointerLockElement !== this.domElement) {
      this.domElement.requestPointerLock()
    }
  }

  public exitPointerLock(): void {
    if (document.pointerLockElement) {
      document.exitPointerLock()
    }
  }

  public getPointerLocked(): boolean {
    return this.isPointerLocked
  }

  private onPointerLockChange(): void {
    this.isPointerLocked = document.pointerLockElement === this.domElement
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (e.code in this.keys) {
      this.keys[e.code] = true
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    if (e.code in this.keys) {
      this.keys[e.code] = false
    }
  }

  private onMouseMove(e: MouseEvent): void {
    if (this.isPointerLocked) {
      this.mouseDeltaX += e.movementX
      this.mouseDeltaY += e.movementY
    }
  }

  public consumeMouseDelta(): { deltaX: number; deltaY: number } {
    const delta = {
      deltaX: this.mouseDeltaX,
      deltaY: this.mouseDeltaY,
    }
    this.mouseDeltaX = 0
    this.mouseDeltaY = 0
    return delta
  }

  public setVirtualMovement(movement: Partial<VirtualMovementInput>): void {
    this.virtualMovement = {
      ...this.virtualMovement,
      ...movement,
    }
  }

  public setVirtualSprint(sprint: boolean): void {
    this.isVirtualSprint = sprint
  }

  public setVirtualJump(jump: boolean): void {
    this.isVirtualJump = jump
  }

  public triggerVirtualInteract(): void {
    this.isVirtualInteract = true
  }

  public injectTouchDelta(deltaX: number, deltaY: number): void {
    this.mouseDeltaX += deltaX
    this.mouseDeltaY += deltaY
  }

  public getMovementInput(cameraYaw: number): MovementInput {
    const interact = Boolean(this.keys.KeyE || this.isVirtualInteract)
    this.isVirtualInteract = false

    return {
      forward: Boolean(this.keys.KeyW || this.keys.ArrowUp || this.virtualMovement.forward),
      backward: Boolean(this.keys.KeyS || this.keys.ArrowDown || this.virtualMovement.backward),
      left: Boolean(this.keys.KeyA || this.keys.ArrowLeft || this.virtualMovement.left),
      right: Boolean(this.keys.KeyD || this.keys.ArrowRight || this.virtualMovement.right),
      sprint: Boolean(this.keys.ShiftLeft || this.keys.ShiftRight || this.isVirtualSprint),
      jump: Boolean(this.keys.Space || this.isVirtualJump),
      interact,
      cameraYaw,
    }
  }

  public reset(): void {
    Object.keys(this.keys).forEach((k) => {
      this.keys[k] = false
    })
    this.virtualMovement = {
      forward: false,
      backward: false,
      left: false,
      right: false,
    }
    this.isVirtualSprint = false
    this.isVirtualJump = false
    this.isVirtualInteract = false
    this.mouseDeltaX = 0
    this.mouseDeltaY = 0
  }

  public dispose(): void {
    window.removeEventListener('keydown', this.onKeyDownBound)
    window.removeEventListener('keyup', this.onKeyUpBound)
    document.removeEventListener('mousemove', this.onMouseMoveBound)
    document.removeEventListener('pointerlockchange', this.onPointerLockChangeBound)
    this.reset()
  }
}
