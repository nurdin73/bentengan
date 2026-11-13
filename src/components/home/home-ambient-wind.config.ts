export type LeafTone = 'emerald' | 'lime' | 'amber'
export type LeafShape = 'oval' | 'tapered'

export interface LeafParticleConfig {
  id: number
  startXPercent: number
  sizePx: number
  durationSec: number
  delaySec: number
  driftXRem: number
  swayXRem: number
  rotateStartDeg: number
  rotateEndDeg: number
  opacity: number
  tone: LeafTone
  shape: LeafShape
}

export interface WindStreakConfig {
  id: number
  topPercent: number
  widthPx: number
  durationSec: number
  delaySec: number
  opacity: number
}

export const LEAF_TONE_COLORS: Record<LeafTone, { fill: string; vein: string }> = {
  emerald: { fill: '#34d399', vein: '#059669' },
  lime: { fill: '#a3e635', vein: '#4d7c0f' },
  amber: { fill: '#fbbf24', vein: '#b45309' },
}

export const LOW_DENSITY_LEAF_LIMIT = 6
export const LOW_DENSITY_STREAK_LIMIT = 2

export const LEAF_PARTICLES: readonly LeafParticleConfig[] = [
  {
    id: 1,
    startXPercent: -4,
    sizePx: 20,
    durationSec: 11.5,
    delaySec: -2.1,
    driftXRem: 20,
    swayXRem: 2.4,
    rotateStartDeg: -20,
    rotateEndDeg: 290,
    opacity: 0.72,
    tone: 'emerald',
    shape: 'oval',
  },
  {
    id: 2,
    startXPercent: 8,
    sizePx: 16,
    durationSec: 13.8,
    delaySec: -7.4,
    driftXRem: 17,
    swayXRem: 1.8,
    rotateStartDeg: 35,
    rotateEndDeg: -260,
    opacity: 0.62,
    tone: 'lime',
    shape: 'tapered',
  },
  {
    id: 3,
    startXPercent: 18,
    sizePx: 22,
    durationSec: 10.6,
    delaySec: -4.8,
    driftXRem: 23,
    swayXRem: 2.8,
    rotateStartDeg: 10,
    rotateEndDeg: 340,
    opacity: 0.75,
    tone: 'amber',
    shape: 'oval',
  },
  {
    id: 4,
    startXPercent: 28,
    sizePx: 15,
    durationSec: 14.5,
    delaySec: -10.2,
    driftXRem: 15,
    swayXRem: 1.5,
    rotateStartDeg: -45,
    rotateEndDeg: 240,
    opacity: 0.56,
    tone: 'emerald',
    shape: 'tapered',
  },
  {
    id: 5,
    startXPercent: 39,
    sizePx: 24,
    durationSec: 12.2,
    delaySec: -1.4,
    driftXRem: 21,
    swayXRem: 2.5,
    rotateStartDeg: 25,
    rotateEndDeg: -310,
    opacity: 0.68,
    tone: 'lime',
    shape: 'oval',
  },
  {
    id: 6,
    startXPercent: 49,
    sizePx: 18,
    durationSec: 11.1,
    delaySec: -6.3,
    driftXRem: 22,
    swayXRem: 2.1,
    rotateStartDeg: -15,
    rotateEndDeg: 315,
    opacity: 0.7,
    tone: 'amber',
    shape: 'tapered',
  },
  {
    id: 7,
    startXPercent: 58,
    sizePx: 16,
    durationSec: 15.2,
    delaySec: -11.6,
    driftXRem: 16,
    swayXRem: 1.7,
    rotateStartDeg: 50,
    rotateEndDeg: -220,
    opacity: 0.54,
    tone: 'emerald',
    shape: 'oval',
  },
  {
    id: 8,
    startXPercent: 68,
    sizePx: 21,
    durationSec: 10.9,
    delaySec: -3.7,
    driftXRem: 19,
    swayXRem: 2.6,
    rotateStartDeg: -30,
    rotateEndDeg: 285,
    opacity: 0.72,
    tone: 'lime',
    shape: 'tapered',
  },
  {
    id: 9,
    startXPercent: 78,
    sizePx: 17,
    durationSec: 13.1,
    delaySec: -8.9,
    driftXRem: 18,
    swayXRem: 2.0,
    rotateStartDeg: 18,
    rotateEndDeg: -290,
    opacity: 0.6,
    tone: 'amber',
    shape: 'oval',
  },
  {
    id: 10,
    startXPercent: 86,
    sizePx: 19,
    durationSec: 12.6,
    delaySec: -5.5,
    driftXRem: 14,
    swayXRem: 1.9,
    rotateStartDeg: -55,
    rotateEndDeg: 250,
    opacity: 0.64,
    tone: 'emerald',
    shape: 'tapered',
  },
  {
    id: 11,
    startXPercent: 3,
    sizePx: 14,
    durationSec: 16.0,
    delaySec: -13.0,
    driftXRem: 24,
    swayXRem: 1.6,
    rotateStartDeg: 40,
    rotateEndDeg: 360,
    opacity: 0.5,
    tone: 'lime',
    shape: 'oval',
  },
  {
    id: 12,
    startXPercent: 23,
    sizePx: 23,
    durationSec: 9.8,
    delaySec: -7.9,
    driftXRem: 25,
    swayXRem: 2.7,
    rotateStartDeg: -10,
    rotateEndDeg: -330,
    opacity: 0.74,
    tone: 'emerald',
    shape: 'oval',
  },
  {
    id: 13,
    startXPercent: 44,
    sizePx: 15,
    durationSec: 14.1,
    delaySec: -9.5,
    driftXRem: 17,
    swayXRem: 1.8,
    rotateStartDeg: 65,
    rotateEndDeg: 350,
    opacity: 0.55,
    tone: 'amber',
    shape: 'tapered',
  },
  {
    id: 14,
    startXPercent: 63,
    sizePx: 20,
    durationSec: 11.8,
    delaySec: -0.9,
    driftXRem: 20,
    swayXRem: 2.3,
    rotateStartDeg: -25,
    rotateEndDeg: -275,
    opacity: 0.66,
    tone: 'lime',
    shape: 'tapered',
  },
  {
    id: 15,
    startXPercent: 73,
    sizePx: 16,
    durationSec: 13.4,
    delaySec: -12.2,
    driftXRem: 16,
    swayXRem: 1.6,
    rotateStartDeg: 12,
    rotateEndDeg: 300,
    opacity: 0.58,
    tone: 'emerald',
    shape: 'oval',
  },
  {
    id: 16,
    startXPercent: 12,
    sizePx: 19,
    durationSec: 12.0,
    delaySec: -4.2,
    driftXRem: 22,
    swayXRem: 2.2,
    rotateStartDeg: -40,
    rotateEndDeg: 270,
    opacity: 0.65,
    tone: 'amber',
    shape: 'oval',
  },
]

export const WIND_STREAKS: readonly WindStreakConfig[] = [
  { id: 1, topPercent: 16, widthPx: 220, durationSec: 6.4, delaySec: -1.2, opacity: 0.22 },
  { id: 2, topPercent: 34, widthPx: 170, durationSec: 7.8, delaySec: -4.9, opacity: 0.16 },
  { id: 3, topPercent: 52, widthPx: 250, durationSec: 5.9, delaySec: -2.8, opacity: 0.24 },
  { id: 4, topPercent: 68, widthPx: 190, durationSec: 8.4, delaySec: -6.1, opacity: 0.15 },
  { id: 5, topPercent: 81, widthPx: 210, durationSec: 6.9, delaySec: -0.4, opacity: 0.18 },
]

