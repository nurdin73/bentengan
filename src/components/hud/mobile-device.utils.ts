export function checkIsMobileTouchDevice(): boolean {
  if (typeof window === 'undefined') return false
  const hasTouchScreen = 'ontouchstart' in window || (navigator.maxTouchPoints > 0)
  const isCoarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false
  return hasTouchScreen && isCoarsePointer
}

