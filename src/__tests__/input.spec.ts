import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { InputManager } from '../game/input/input-manager'

describe('InputManager', () => {
  let input: InputManager
  let element: HTMLDivElement

  beforeEach(() => {
    element = document.createElement('div')
    document.body.appendChild(element)
    input = new InputManager()
    input.attach(element)
  })

  afterEach(() => {
    input.dispose()
    document.body.removeChild(element)
  })

  it('should initialize with no active inputs', () => {
    const movement = input.getMovementInput(0)
    expect(movement.forward).toBe(false)
    expect(movement.backward).toBe(false)
    expect(movement.left).toBe(false)
    expect(movement.right).toBe(false)
    expect(movement.sprint).toBe(false)
    expect(movement.jump).toBe(false)
    expect(movement.interact).toBe(false)
    expect(movement.cameraYaw).toBe(0)
  })

  it('should detect W key as forward movement', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }))
    const movement = input.getMovementInput(1.5)
    expect(movement.forward).toBe(true)
    expect(movement.cameraYaw).toBe(1.5)

    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }))
    expect(input.getMovementInput(0).forward).toBe(false)
  })

  it('should detect sprint and jump key states', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ShiftLeft' }))
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }))

    const movement = input.getMovementInput(0)
    expect(movement.sprint).toBe(true)
    expect(movement.jump).toBe(true)
  })
})
