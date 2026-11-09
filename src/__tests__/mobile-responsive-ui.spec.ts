import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import HomeView from '../views/HomeView.vue'
import LobbyModeSelector from '../components/lobby/LobbyModeSelector.vue'
import GameControlsModal from '../components/guide/GameControlsModal.vue'
import GameRulesModal from '../components/guide/GameRulesModal.vue'
import LobbyWaitingRoom from '../components/lobby/LobbyWaitingRoom.vue'
import GameHUD from '../components/hud/GameHUD.vue'
import ConfirmDialog from '../components/ui/ConfirmDialog.vue'
import ResultsModal from '../components/results/ResultsModal.vue'
import { useRoomStore } from '../stores/room-store'
import { useGameStore } from '../stores/game-store'

const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
  }),
  useRoute: () => ({
    params: { code: 'TEST99' },
  }),
  onBeforeRouteLeave: vi.fn(),
}))

describe('Mobile Responsive Layout & Icon Integration', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('HomeView Responsive Adaptation', () => {
    it('renders with mobile-friendly dynamic viewport min-h-dvh', () => {
      const wrapper = mount(HomeView)
      const container = wrapper.find('[data-testid="home-view"]')
      expect(container.exists()).toBe(true)
      expect(container.classes()).toContain('min-h-dvh')
      expect(container.classes()).toContain('overflow-y-auto')
    })

    it('renders responsive navbar buttons and opens modals on mobile', async () => {
      const wrapper = mount(HomeView)

      const rulesBtn = wrapper.find('[data-testid="navbar-rules-btn"]')
      const controlsBtn = wrapper.find('[data-testid="navbar-controls-btn"]')
      const practiceBtn = wrapper.find('[data-testid="navbar-practice-btn"]')

      expect(rulesBtn.exists()).toBe(true)
      expect(controlsBtn.exists()).toBe(true)
      expect(practiceBtn.exists()).toBe(true)

      // Open rules modal
      await rulesBtn.trigger('click')
      expect(wrapper.find('[data-testid="game-rules-modal-card"]').exists()).toBe(true)

      // Open controls modal
      await controlsBtn.trigger('click')
      expect(wrapper.find('[data-testid="game-controls-modal-card"]').exists()).toBe(true)
    })

    it('opens and interacts with mobile navigation drawer sheet', async () => {
      const wrapper = mount(HomeView)

      const mobileMenuBtn = wrapper.find('[data-testid="navbar-mobile-menu-btn"]')
      expect(mobileMenuBtn.exists()).toBe(true)

      // Drawer is initially closed
      expect(wrapper.find('[data-testid="navbar-mobile-drawer"]').exists()).toBe(false)

      // Click hamburger button to open drawer
      await mobileMenuBtn.trigger('click')
      expect(wrapper.find('[data-testid="navbar-mobile-drawer"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="mobile-drawer-rules-btn"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="mobile-drawer-controls-btn"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="mobile-drawer-practice-btn"]').exists()).toBe(true)

      // Click rules button from drawer
      await wrapper.find('[data-testid="mobile-drawer-rules-btn"]').trigger('click')
      expect(wrapper.find('[data-testid="navbar-mobile-drawer"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="game-rules-modal-card"]').exists()).toBe(true)
    })
  })

  describe('LobbyModeSelector Mobile UX & iOS Auto-Zoom Prevention', () => {
    it('applies text-base to input fields to prevent iOS Safari auto-zoom', () => {
      const wrapper = mount(LobbyModeSelector, {
        props: {
          initialUsername: 'Pemain Keren',
          initialTeam: 'blue',
          isConnecting: false,
          connectionError: null,
        },
      })

      const usernameInput = wrapper.find('[data-testid="lobby-username-input"]')
      const roomCodeInput = wrapper.find('[data-testid="join-room-code-input"]')

      expect(usernameInput.classes()).toContain('text-base')
      expect(roomCodeInput.classes()).toContain('text-base')
      expect(roomCodeInput.attributes('autocapitalize')).toBe('characters')
      expect(roomCodeInput.attributes('autocomplete')).toBe('off')
    })

    it('emits create-host when Buat Ruangan is clicked', async () => {
      const wrapper = mount(LobbyModeSelector, {
        props: {
          initialUsername: 'Host123',
          initialTeam: 'blue',
          isConnecting: false,
          connectionError: null,
        },
      })

      const createBtn = wrapper.find('[data-testid="lobby-create-room-btn"]')
      await createBtn.trigger('click')

      expect(wrapper.emitted('create-host')).toBeTruthy()
      const emittedPayload = (wrapper.emitted('create-host')?.[0] as unknown[])[0] as {
        username: string
        team: string
        maxPlayers: number
      }
      expect(emittedPayload.username).toBe('Host123')
      expect(emittedPayload.team).toBe('blue')
      expect(emittedPayload.maxPlayers).toBe(8)
    })
  })

  describe('GameControlsModal: Desktop vs Touch Screen Tabs', () => {
    it('defaults to Desktop tab and switches to Touch tab on mobile click', async () => {
      const wrapper = mount(GameControlsModal)

      expect(wrapper.find('[data-testid="controls-grid-desktop"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="controls-grid-touch"]').exists()).toBe(false)

      const touchTabBtn = wrapper.find('[data-testid="controls-tab-touch"]')
      await touchTabBtn.trigger('click')

      expect(wrapper.find('[data-testid="controls-grid-desktop"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="controls-grid-touch"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="controls-grid-touch"]').text()).toContain('Virtual Joystick')
      expect(wrapper.find('[data-testid="controls-grid-touch"]').text()).toContain('Sprint Sentuh')
      expect(wrapper.find('[data-testid="controls-grid-touch"]').text()).toContain('Lompat Sentuh')
    })

    it('emits close event when close button is clicked', async () => {
      const wrapper = mount(GameControlsModal)
      const closeBtn = wrapper.find('[data-testid="controls-modal-close-btn"]')
      await closeBtn.trigger('click')
      expect(wrapper.emitted('close')).toBeTruthy()
    })
  })

  describe('GameRulesModal Visual Rendering', () => {
    it('renders all 4 game rule cards and close button', async () => {
      const wrapper = mount(GameRulesModal)
      expect(wrapper.find('[data-testid="game-rules-modal-card"]').exists()).toBe(true)
      expect(wrapper.text()).toContain('Garis Tengah Pembatas')
      expect(wrapper.text()).toContain('Siapa Terakhir Keluar, Menang!')
      expect(wrapper.text()).toContain('Selamatkan Teman Satu Tim!')
      expect(wrapper.text()).toContain('Rebut Tiang Benteng Lawan!')

      const closeBtn = wrapper.find('[data-testid="rules-modal-close-btn"]')
      await closeBtn.trigger('click')
      expect(wrapper.emitted('close')).toBeTruthy()
    })
  })

  describe('LobbyWaitingRoom: Mobile UX, Sticky CTA & Team Tabs', () => {
    it('renders capacity badge and sticky actions container', () => {
      const roomStore = useRoomStore()
      roomStore.roomCode = 'BENTENG7'
      roomStore.maxPlayers = 8

      const wrapper = mount(LobbyWaitingRoom)

      const capacityBadge = wrapper.find('[data-testid="waiting-room-capacity-badge"]')
      expect(capacityBadge.exists()).toBe(true)
      expect(capacityBadge.text()).toContain('4 vs 4')

      const stickyActions = wrapper.find('[data-testid="waiting-sticky-actions"]')
      expect(stickyActions.exists()).toBe(true)
      expect(stickyActions.classes()).toContain('sticky')
    })

    it('allows mobile user to switch between blue and red team tabs', async () => {
      const roomStore = useRoomStore()
      roomStore.roomCode = 'ROOM88'
      roomStore.players = [
        { id: 'p1', peerId: 'peer-1', username: 'Alpha', teamId: 'blue', isHost: true, isReady: true },
        { id: 'p2', peerId: 'peer-2', username: 'Beta', teamId: 'red', isHost: false, isReady: false },
      ]

      const wrapper = mount(LobbyWaitingRoom)

      const tabSelector = wrapper.find('[data-testid="mobile-team-tab-selector"]')
      expect(tabSelector.exists()).toBe(true)

      const blueTab = wrapper.find('[data-testid="mobile-tab-blue"]')
      const redTab = wrapper.find('[data-testid="mobile-tab-red"]')

      expect(blueTab.text()).toContain('Benteng Biru (1)')
      expect(redTab.text()).toContain('Benteng Merah (1)')

      // Switch to red tab
      await redTab.trigger('click')
      const rosterRed = wrapper.find('[data-testid="roster-red"]')
      expect(rosterRed.classes()).toContain('flex')
    })

    it('toggles ready state when clicking ready CTA button with Ready and Batal copy', async () => {
      const roomStore = useRoomStore()
      roomStore.isHost = false
      roomStore.myPlayerId = 'p-me'
      roomStore.players = [{ id: 'p-me', peerId: 'peer-me', username: 'Hero', teamId: 'blue', isHost: false, isReady: false }]

      const wrapper = mount(LobbyWaitingRoom)

      // Non-host: Leave button and Ready button side-by-side
      const leaveBtn = wrapper.find('[data-testid="waiting-leave-btn"]')
      expect(leaveBtn.exists()).toBe(true)
      expect(leaveBtn.text()).toContain('Keluar')

      const readyBtn = wrapper.find('[data-testid="waiting-toggle-ready-btn"]')
      expect(readyBtn.exists()).toBe(true)
      expect(readyBtn.text()).toContain('Ready')
      expect(readyBtn.classes()).toContain('timbul-btn-emerald')
      expect(wrapper.find('[data-testid="waiting-start-match-btn"]').exists()).toBe(false)

      await readyBtn.trigger('click')
      expect(roomStore.players[0]!.isReady).toBe(true)

      // Re-mount or wait for reactivity
      const wrapperReady = mount(LobbyWaitingRoom)
      const cancelBtn = wrapperReady.find('[data-testid="waiting-toggle-ready-btn"]')
      expect(cancelBtn.text()).toContain('Batal')
      expect(cancelBtn.classes()).toContain('timbul-btn-red')
    })

    it('opens leave confirmation dialog when clicking leave button and confirms exit', async () => {
      const roomStore = useRoomStore()
      roomStore.isHost = false
      const leaveSpy = vi.spyOn(roomStore, 'leaveRoom')

      const wrapper = mount(LobbyWaitingRoom)

      expect(wrapper.find('[data-testid="dialog-leave-room"]').exists()).toBe(false)

      // Click leave button -> opens dialog
      await wrapper.find('[data-testid="waiting-leave-btn"]').trigger('click')
      expect(wrapper.find('[data-testid="dialog-leave-room"]').exists()).toBe(true)

      // Click cancel inside dialog -> closes dialog
      await wrapper.find('[data-testid="dialog-cancel-btn"]').trigger('click')
      expect(wrapper.find('[data-testid="dialog-leave-room"]').exists()).toBe(false)
      expect(leaveSpy).not.toHaveBeenCalled()

      // Click leave again and confirm
      await wrapper.find('[data-testid="waiting-leave-btn"]').trigger('click')
      await wrapper.find('[data-testid="dialog-confirm-btn"]').trigger('click')
      expect(leaveSpy).toHaveBeenCalled()
      expect(mockPush).toHaveBeenCalledWith('/')
    })

    it('opens start match confirmation dialog for host and confirms start', async () => {
      const roomStore = useRoomStore()
      roomStore.isHost = true
      roomStore.roomCode = 'BNTG9'
      roomStore.players = [
        { id: 'h1', peerId: 'p-h1', username: 'Host', teamId: 'blue', isHost: true, isReady: true },
        { id: 'g1', peerId: 'p-g1', username: 'Guest', teamId: 'red', isHost: false, isReady: true },
      ]
      const startSpy = vi.spyOn(roomStore, 'startMatch')

      const wrapper = mount(LobbyWaitingRoom)

      const startBtn = wrapper.find('[data-testid="waiting-start-match-btn"]')
      expect(startBtn.exists()).toBe(true)

      // Click start button -> opens dialog
      await startBtn.trigger('click')
      expect(wrapper.find('[data-testid="dialog-start-match"]').exists()).toBe(true)

      // Confirm start in dialog
      await wrapper.find('[data-testid="dialog-confirm-btn"]').trigger('click')
      expect(startSpy).toHaveBeenCalled()
      expect(wrapper.find('[data-testid="dialog-start-match"]').exists()).toBe(false)
    })
  })

  describe('ConfirmDialog Standalone Component', () => {
    it('renders alert dialog with single confirm button', async () => {
      const wrapper = mount(ConfirmDialog, {
        props: {
          type: 'alert',
          title: 'Perhatian',
          message: 'Ini pesan peringatan penting.',
        },
      })

      expect(wrapper.find('[data-testid="dialog-title"]').text()).toBe('Perhatian')
      expect(wrapper.find('[data-testid="dialog-message"]').text()).toBe('Ini pesan peringatan penting.')
      expect(wrapper.find('[data-testid="dialog-cancel-btn"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="dialog-confirm-btn"]').exists()).toBe(true)

      await wrapper.find('[data-testid="dialog-confirm-btn"]').trigger('click')
      expect(wrapper.emitted('confirm')).toBeTruthy()
    })

    it('renders confirm dialog with 2 buttons and emits cancel and close', async () => {
      const wrapper = mount(ConfirmDialog, {
        props: {
          type: 'confirm',
          title: 'Apakah Anda Yakin?',
          confirmText: 'Lanjutkan',
          cancelText: 'Batalkan',
        },
      })

      expect(wrapper.find('[data-testid="dialog-cancel-btn"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="dialog-confirm-btn"]').exists()).toBe(true)

      await wrapper.find('[data-testid="dialog-cancel-btn"]').trigger('click')
      expect(wrapper.emitted('cancel')).toBeTruthy()
      expect(wrapper.emitted('close')).toBeTruthy()
    })
  })

  describe('GameHUD In-Game Signal Widget', () => {
    it('renders network signal widget with green icon when ping is low', () => {
      const roomStore = useRoomStore()
      roomStore.latencyMs = 35
      roomStore.roomCode = 'BNTG9'

      const wrapper = mount(GameHUD)
      const signalWidget = wrapper.find('[data-testid="hud-network-signal"]')
      expect(signalWidget.exists()).toBe(true)
      expect(signalWidget.text()).toContain('35 ms')
      expect(signalWidget.text()).toContain('BNTG9')

      const signalIcon = wrapper.find('[data-testid="hud-signal-icon"]')
      expect(signalIcon.classes()).toContain('text-emerald-400')
    })

    it('renders network signal icon with red color and pulse when ping is high', () => {
      const roomStore = useRoomStore()
      roomStore.latencyMs = 180

      const wrapper = mount(GameHUD)
      const signalIcon = wrapper.find('[data-testid="hud-signal-icon"]')
      expect(signalIcon.classes()).toContain('text-rose-500')
      expect(signalIcon.classes()).toContain('animate-pulse')
    })

    it('renders compact mobile HUD testing toggle button in top right of GameHUD', () => {
      const wrapper = mount(GameHUD)
      const toggleBtn = wrapper.find('[data-testid="hud-toggle-mobile-controls-btn"]')
      expect(toggleBtn.exists()).toBe(true)
      expect(toggleBtn.text()).toContain('HUD HP')
    })

    it('toggles mobile HUD controls and persists state in sessionStorage', async () => {
      sessionStorage.clear()
      const wrapper = mount(GameHUD)
      const toggleBtn = wrapper.find('[data-testid="hud-toggle-mobile-controls-btn"]')

      // Initially MobileTouchControls is not shown on desktop
      expect(wrapper.find('[data-testid="mobile-touch-controls"]').exists()).toBe(false)

      // Click to toggle ON
      await toggleBtn.trigger('click')
      expect(sessionStorage.getItem('bentengan_force_mobile_hud')).toBe('true')
      expect(wrapper.find('[data-testid="mobile-touch-controls"]').exists()).toBe(true)
      expect(toggleBtn.classes()).toContain('text-amber-300')

      // Click again to toggle OFF
      await toggleBtn.trigger('click')
      expect(sessionStorage.getItem('bentengan_force_mobile_hud')).toBe('false')
      expect(wrapper.find('[data-testid="mobile-touch-controls"]').exists()).toBe(false)
    })
  })

  describe('ResultsModal Mobile Landscape & Fullscreen Responsiveness', () => {
    it('renders with overflow containment and 2-column landscape structure', () => {
      const gameStore = useGameStore()
      const roomStore = useRoomStore()

      roomStore.myTeam = 'blue'
      roomStore.roomCode = 'LOKAL'
      gameStore.matchResult = {
        matchId: 'match-1',
        winner: 'blue',
        reason: 'base_capture',
        duration: 45,
        players: [],
      }
      gameStore.capturesCount = 3
      gameStore.rescuesCount = 1

      const wrapper = mount(ResultsModal)

      const backdrop = wrapper.find('[data-testid="results-modal-backdrop"]')
      const card = wrapper.find('[data-testid="results-modal-card"]')

      expect(backdrop.exists()).toBe(true)
      expect(card.exists()).toBe(true)

      // Verified overflow containment for mobile landscape
      expect(card.classes()).toContain('max-h-[92dvh]')
      expect(card.classes()).toContain('overflow-y-auto')
      expect(card.classes()).toContain('overscroll-contain')

      // Verified 2-column structure exists
      expect(wrapper.find('.results-landscape-col-left').exists()).toBe(true)
      expect(wrapper.find('.results-landscape-col-right').exists()).toBe(true)

      // Verified content
      expect(wrapper.find('[data-testid="results-winner-title"]').text()).toBe('KEMENANGAN!')
      expect(wrapper.find('[data-testid="results-team-label"]').text()).toContain('Tim Benteng Biru Menang')
      expect(wrapper.find('[data-testid="results-win-reason"]').text()).toContain('Base Capture')
      expect(wrapper.find('[data-testid="results-stat-duration"]').text()).toBe('45s')
      expect(wrapper.find('[data-testid="results-stat-captures"]').text()).toBe('3')
      expect(wrapper.find('[data-testid="results-stat-rescues"]').text()).toBe('1')
    })

    it('emits restart event when restart button is clicked', async () => {
      const gameStore = useGameStore()
      const roomStore = useRoomStore()

      roomStore.myTeam = 'blue'
      roomStore.roomCode = 'LOKAL'
      gameStore.matchResult = {
        matchId: 'match-2',
        winner: 'blue',
        reason: 'base_capture',
        duration: 30,
        players: [],
      }

      const wrapper = mount(ResultsModal)
      const restartBtn = wrapper.find('[data-testid="results-restart-btn"]')
      expect(restartBtn.exists()).toBe(true)

      await restartBtn.trigger('click')
      expect(wrapper.emitted('restart')).toBeTruthy()
    })

    it('handles leave room to home when leave button is clicked', async () => {
      const gameStore = useGameStore()
      const roomStore = useRoomStore()

      roomStore.myTeam = 'blue'
      roomStore.roomCode = 'TEST88'
      gameStore.matchResult = {
        matchId: 'match-3',
        winner: 'blue',
        reason: 'base_capture',
        duration: 30,
        players: [],
      }

      const wrapper = mount(ResultsModal)
      const leaveBtn = wrapper.find('[data-testid="results-leave-home-btn"]')
      expect(leaveBtn.exists()).toBe(true)

      await leaveBtn.trigger('click')
      expect(mockPush).toHaveBeenCalledWith('/')
    })
  })
})
