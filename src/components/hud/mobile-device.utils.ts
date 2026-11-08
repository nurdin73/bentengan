export function checkIsMobileTouchDevice(): boolean {
  if (typeof window === 'undefined') return false
  const hasTouchScreen = 'ontouchstart' in window || (navigator.maxTouchPoints > 0)
  const isCoarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false
  return hasTouchScreen && isCoarsePointer
}

export async function requestFullscreenAndLandscape(): Promise<void> {
  if (typeof document === 'undefined') return
  try {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen()
    }
    if (typeof screen !== 'undefined' && 'orientation' in screen && 'lock' in screen.orientation) {
      await (screen.orientation as { lock: (o: string) => Promise<void> }).lock('landscape')
    }
  } catch {
    // Gracefully ignore restrictions in unprivileged or unsupported browsers (e.g. iOS Safari)
  }
}

export async function toggleFullscreen(): Promise<void> {
  if (typeof document === 'undefined') return
  try {
    if (!document.fullscreenElement) {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen()
      }
      if (typeof screen !== 'undefined' && 'orientation' in screen && 'lock' in screen.orientation) {
        await (screen.orientation as { lock: (o: string) => Promise<void> }).lock('landscape')
      }
    } else {
      if (document.exitFullscreen) {
        await document.exitFullscreen()
      }
    }
  } catch {
    // Gracefully ignore
  }
}

