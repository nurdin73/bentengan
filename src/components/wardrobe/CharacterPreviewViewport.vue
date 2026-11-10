<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as THREE from 'three'
import { RotateCw, Sparkles } from 'lucide-vue-next'
import { CharacterAvatar } from '../../game/entities/character-avatar'
import type { TeamId } from '../../types/game.types'

const props = defineProps<{
  outfitId: number
  teamId: TeamId
}>()

const containerRef = ref<HTMLDivElement | null>(null)

let renderer: THREE.WebGLRenderer | null = null
let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let avatar: CharacterAvatar | null = null
let characterRoot: THREE.Group | null = null
let pedestalRingMat: THREE.MeshBasicMaterial | null = null
let animationFrameId: number | null = null
let resizeObserver: ResizeObserver | null = null

let isDragging = false
let previousPointerX = 0
let lastTime = 0

const updatePedestalColor = (team: TeamId) => {
  if (!pedestalRingMat) return
  pedestalRingMat.color.setHex(team === 'blue' ? 0x3b82f6 : 0xef4444)
}

const initScene = () => {
  const container = containerRef.value
  if (!container) return

  // Check WebGL availability
  if (typeof window === 'undefined') return

  const width = Math.max(10, container.clientWidth)
  const height = Math.max(10, container.clientHeight)

  // 1. Scene & Camera Setup
  scene = new THREE.Scene()

  camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 50)
  camera.position.set(0, 0.85, 2.7)
  camera.lookAt(0, 0.72, 0)

  // 2. Lighting Setup
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.85)
  scene.add(ambientLight)

  const keyLight = new THREE.DirectionalLight(0xfffbeb, 1.4)
  keyLight.position.set(2, 3, 2.5)
  scene.add(keyLight)

  const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.6)
  fillLight.position.set(-2, 1, 1.5)
  scene.add(fillLight)

  const rimLight = new THREE.DirectionalLight(0xffffff, 0.9)
  rimLight.position.set(0, 2.5, -2)
  scene.add(rimLight)

  // 3. Circular Stage Pedestal
  const pedestalGeo = new THREE.CylinderGeometry(0.72, 0.8, 0.08, 32)
  const pedestalMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.35,
    metalness: 0.5,
  })
  const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat)
  pedestal.position.set(0, -0.04, 0)
  scene.add(pedestal)

  // Glowing Team Ring on Top of Pedestal
  const ringGeo = new THREE.RingGeometry(0.65, 0.71, 32)
  ringGeo.rotateX(-Math.PI / 2)
  pedestalRingMat = new THREE.MeshBasicMaterial({
    color: props.teamId === 'blue' ? 0x3b82f6 : 0xef4444,
    side: THREE.DoubleSide,
  })
  const ring = new THREE.Mesh(ringGeo, pedestalRingMat)
  ring.position.set(0, 0.002, 0)
  scene.add(ring)

  // 4. Character Avatar
  characterRoot = new THREE.Group()
  // Offset Y so feet stand precisely on Y = 0 (top of pedestal)
  characterRoot.position.set(0, 0.78, 0)

  avatar = new CharacterAvatar({
    teamId: props.teamId,
    outfitId: props.outfitId,
  })
  characterRoot.add(avatar.rootGroup)
  scene.add(characterRoot)

  // 5. WebGL Renderer
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'low-power',
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(width, height)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    container.appendChild(renderer.domElement)
  } catch (err) {
    console.warn('[CharacterPreviewViewport] WebGL init fallback:', err)
    return
  }

  // 6. Resize Observer
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(10, entry.contentRect.width)
        const h = Math.max(10, entry.contentRect.height)
        if (camera && renderer) {
          camera.aspect = w / h
          camera.updateProjectionMatrix()
          renderer.setSize(w, h)
        }
      }
    })
    resizeObserver.observe(container)
  }

  // 7. Animation Loop
  lastTime = performance.now()
  const animate = (currentTime: number) => {
    animationFrameId = requestAnimationFrame(animate)

    const dt = Math.min((currentTime - lastTime) / 1000, 0.1)
    lastTime = currentTime

    // Idle turntable rotation when not dragged
    if (!isDragging && characterRoot) {
      characterRoot.rotation.y += dt * 0.45
    }

    // Gentle breathing idle
    if (avatar) {
      avatar.updateAnimation(dt, 0, true, false, false, false)
    }

    if (renderer && scene && camera) {
      renderer.render(scene, camera)
    }
  }

  animationFrameId = requestAnimationFrame(animate)
}

// Watchers for immediate reactivity without re-mounting Three.js
watch(
  () => props.outfitId,
  (newOutfit) => {
    if (avatar) {
      avatar.applyOutfit(newOutfit)
    }
  },
)

watch(
  () => props.teamId,
  (newTeam) => {
    if (avatar) {
      avatar.applyTeamColors(newTeam)
    }
    updatePedestalColor(newTeam)
  },
)

// Interactive 360° Drag & Touch Handlers
const onPointerDown = (e: PointerEvent) => {
  isDragging = true
  previousPointerX = e.clientX
  containerRef.value?.setPointerCapture?.(e.pointerId)
}

const onPointerMove = (e: PointerEvent) => {
  if (!isDragging || !characterRoot) return
  const deltaX = e.clientX - previousPointerX
  previousPointerX = e.clientX

  // Smooth rotation sensitivity
  characterRoot.rotation.y += deltaX * 0.012
}

const onPointerUp = (e: PointerEvent) => {
  isDragging = false
  containerRef.value?.releasePointerCapture?.(e.pointerId)
}

onMounted(() => {
  initScene()
})

onUnmounted(() => {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }

  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }

  if (avatar) {
    avatar.dispose()
    avatar = null
  }

  if (pedestalRingMat) {
    pedestalRingMat.dispose()
    pedestalRingMat = null
  }

  if (renderer) {
    if (renderer.domElement.parentElement) {
      renderer.domElement.parentElement.removeChild(renderer.domElement)
    }
    renderer.dispose()
    renderer.forceContextLoss()
    renderer = null
  }

  scene = null
  camera = null
  characterRoot = null
})
</script>

<template>
  <div
    ref="containerRef"
    data-testid="character-preview-viewport"
    class="w-full h-full min-h-[175px] relative overflow-hidden rounded-2xl bg-radial from-neutral-800 to-neutral-950 border border-neutral-700/60 touch-none select-none cursor-grab active:cursor-grabbing shadow-inner flex items-center justify-center"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  >
    <!-- Top Left: 3D Live Indicator Badge -->
    <div
      data-testid="preview-live-badge"
      class="absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-xs border border-white/10 text-[9px] font-heading font-black uppercase tracking-wider text-neutral-300 pointer-events-none"
    >
      <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
      <span>Preview 3D</span>
    </div>

    <!-- Bottom Center: Rotate 360° Interaction Hint -->
    <div
      data-testid="preview-rotate-hint"
      class="absolute bottom-2 inset-x-0 mx-auto z-10 w-fit flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-black/50 backdrop-blur-xs border border-white/10 text-[9px] font-sans font-bold text-neutral-300 pointer-events-none select-none"
    >
      <RotateCw class="w-2.5 h-2.5 text-amber-400" />
      <span>Geser untuk memutar 360°</span>
    </div>
  </div>
</template>
