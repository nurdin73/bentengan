import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PracticeView from '../views/PracticeView.vue'
import { useRoomStore } from '../stores/room-store'
import { useGameStore } from '../stores/game-store'
import { GAME_CONFIG } from '../game/core/constants'

const mockPush = vi.fn<(to: string) => void>()
let mockRouteQuery: Record<string, string> = { team: 'blue' }

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn<() => void>(),
  }),
  useRoute: () => ({
    query: mockRouteQuery,
  }),
  onBeforeRouteLeave: vi.fn<(fn: () => void) => void>((fn: () => void) => {
    mockBeforeRouteLeaveHook = fn
  }),
}))

let mockBeforeRouteLeaveHook: (() => void) | null = null

describe('Practice Mode Restart & Reset Mechanics', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockRouteQuery = { team: 'blue' }
    mockBeforeRouteLeaveHook = null
  })

  it('initializes practice match on mount with chosen team and playing status', async () => {
    mockRouteQuery = { team: 'red' }
    const wrapper = mount(PracticeView, {
      global: {
        stubs: {
          GameCanvas: {
            template: '<div data-testid="game-canvas-mock" />',
          },
          GameHUD: {
            template: '<div data-testid="game-hud-mock" />',
          },
          ResultsModal: {
            template: '<div data-testid="results-modal-mock" />',
          },
        },
      },
    })
    await wrapper.vm.$nextTick()

    const roomStore = useRoomStore()
    expect(roomStore.roomCode).toBe('LOKAL')
    expect(roomStore.status).toBe('playing')
    expect(roomStore.myTeam).toBe('red')
    expect(wrapper.find('[data-testid="game-canvas-mock"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="game-hud-mock"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="results-modal-mock"]').exists()).toBe(false)
  })

  it('displays ResultsModal when match finishes and hides HUD', async () => {
    const wrapper = mount(PracticeView, {
      global: {
        stubs: {
          GameCanvas: {
            template: '<div data-testid="game-canvas-mock" />',
          },
          GameHUD: {
            template: '<div data-testid="game-hud-mock" />',
          },
          ResultsModal: {
            template: '<div data-testid="results-modal-mock"><button data-testid="modal-restart" @click="$emit(\'restart\')">Restart</button></div>',
          },
        },
      },
    })

    const roomStore = useRoomStore()
    expect(roomStore.status).toBe('playing')

    // Simulate match end
    roomStore.setMatchStatus('finished')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="results-modal-mock"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="game-hud-mock"]').exists()).toBe(false)
  })

  it('resets gameStore completely on resetStats call', () => {
    const gameStore = useGameStore()

    // Mutate store state as if an intense match just occurred
    gameStore.capturesCount = 4
    gameStore.rescuesCount = 2
    gameStore.timesCapturedCount = 1
    gameStore.stamina = 12
    gameStore.isSprinting = true
    gameStore.status = 'jailed'
    gameStore.stunUntil = Date.now() + 5000
    gameStore.immunityUntil = Date.now() + 3000
    gameStore.isInEnemyTerritory = true
    gameStore.blueJailedCount = 1
    gameStore.redJailedCount = 2
    gameStore.canRescueNearby = true
    gameStore.finishMatch({
      matchId: 'test-match-1',
      winner: 'red',
      reason: 'base_capture',
      duration: 45,
      players: [],
    })

    // Reset
    gameStore.resetStats()

    expect(gameStore.capturesCount).toBe(0)
    expect(gameStore.rescuesCount).toBe(0)
    expect(gameStore.timesCapturedCount).toBe(0)
    expect(gameStore.matchResult).toBeNull()
    expect(gameStore.canRescueNearby).toBe(false)
    expect(gameStore.stamina).toBe(GAME_CONFIG.stamina.max)
    expect(gameStore.isSprinting).toBe(false)
    expect(gameStore.status).toBe('normal')
    expect(gameStore.stunUntil).toBe(0)
    expect(gameStore.immunityUntil).toBe(0)
    expect(gameStore.isInEnemyTerritory).toBe(false)
    expect(gameStore.blueJailedCount).toBe(0)
    expect(gameStore.redJailedCount).toBe(0)
    expect(gameStore.blueTotalCount).toBe(2)
    expect(gameStore.redTotalCount).toBe(2)
  })

  it('remounts GameCanvas with updated key and resets state when restart is triggered', async () => {
    const canvasMountSpy = vi.fn<() => void>()
    const canvasUnmountSpy = vi.fn<() => void>()

    const wrapper = mount(PracticeView, {
      global: {
        stubs: {
          GameCanvas: {
            template: '<div data-testid="game-canvas-mock" />',
            mounted: canvasMountSpy,
            unmounted: canvasUnmountSpy,
          },
          GameHUD: {
            template: '<div data-testid="game-hud-mock" />',
          },
          ResultsModal: {
            template: '<div data-testid="results-modal-mock"><button data-testid="modal-restart" @click="$emit(\'restart\')">Restart</button></div>',
          },
        },
      },
    })
    await wrapper.vm.$nextTick()

    const roomStore = useRoomStore()
    const gameStore = useGameStore()

    // 1. Initially mounted once
    expect(canvasMountSpy).toHaveBeenCalledTimes(1)

    // 2. Simulate match finishing with degraded player state
    gameStore.stamina = 15
    gameStore.status = 'jailed'
    gameStore.capturesCount = 3
    roomStore.setMatchStatus('finished')
    await wrapper.vm.$nextTick()

    // 3. Trigger restart via ResultsModal
    const restartBtn = wrapper.find('[data-testid="modal-restart"]')
    expect(restartBtn.exists()).toBe(true)
    await restartBtn.trigger('click')
    await wrapper.vm.$nextTick()

    // 4. Verify GameCanvas was remounted (unmounted previous, mounted new instance)
    expect(canvasUnmountSpy).toHaveBeenCalledTimes(1)
    expect(canvasMountSpy).toHaveBeenCalledTimes(2)

    // 5. Verify roomStore status is back to 'playing'
    expect(roomStore.status).toBe('playing')

    // 6. Verify gameStore stats were restored to clean defaults
    expect(gameStore.stamina).toBe(GAME_CONFIG.stamina.max)
    expect(gameStore.status).toBe('normal')
    expect(gameStore.capturesCount).toBe(0)
    expect(gameStore.blueJailedCount).toBe(0)
    expect(gameStore.redJailedCount).toBe(0)

    // 7. Verify UI transitions: ResultsModal is gone, HUD is visible
    expect(wrapper.find('[data-testid="results-modal-mock"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="game-hud-mock"]').exists()).toBe(true)
  })

  it('cleans up room state when leaving via quick exit button', async () => {
    const wrapper = mount(PracticeView, {
      global: {
        stubs: {
          GameCanvas: true,
          GameHUD: true,
          ResultsModal: true,
        },
      },
    })

    const roomStore = useRoomStore()
    expect(roomStore.roomCode).toBe('LOKAL')

    // Exit via button
    const exitBtn = wrapper.find('button[type="button"]')
    expect(exitBtn.text()).toContain('Keluar Latihan')
    await exitBtn.trigger('click')

    expect(roomStore.roomCode).toBe('')
    expect(roomStore.status).toBe('waiting')
    expect(mockPush).toHaveBeenCalledWith('/')
  })

  it('cleans up room state when onBeforeRouteLeave triggers', () => {
    mount(PracticeView, {
      global: {
        stubs: {
          GameCanvas: true,
          GameHUD: true,
          ResultsModal: true,
        },
      },
    })

    const roomStore = useRoomStore()
    expect(mockBeforeRouteLeaveHook).not.toBeNull()
    roomStore.initLocalPractice('red')
    expect(roomStore.roomCode).toBe('LOKAL')

    const leaveHook = mockBeforeRouteLeaveHook as () => void
    leaveHook()

    expect(roomStore.roomCode).toBe('')
    expect(roomStore.status).toBe('waiting')
  })
})
