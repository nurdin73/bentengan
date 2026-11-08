import type { MovementInput } from '../../types/game.types'

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

  public getMovementInput(cameraYaw: number): MovementInput {
    return {
      forward: Boolean(this.keys.KeyW || this.keys.ArrowUp),
      backward: Boolean(this.keys.KeyS || this.keys.ArrowDown),
      left: Boolean(this.keys.KeyA || this.keys.ArrowLeft),
      right: Boolean(this.keys.KeyD || this.keys.ArrowRight),
      sprint: Boolean(this.keys.ShiftLeft || this.keys.ShiftRight),
      jump: Boolean(this.keys.Space),
      interact: Boolean(this.keys.KeyE),
      cameraYaw,
    }
  }

  public reset(): void {
    Object.keys(this.keys).forEach((k) => {
      this.keys[k] = false
    })
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
