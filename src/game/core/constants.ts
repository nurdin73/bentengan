export const GAME_CONFIG = {
  teamSizes: [4, 6] as const,

  simulationHz: 60,
  snapshotHz: 20,
  fixedDeltaTime: 1 / 60,

  movement: {
    walkSpeed: 4.5,
    sprintSpeed: 7.0,
    jumpImpulse: 6.5,
    gravity: -20.0,
    characterRadius: 0.4,
    characterHeight: 1.6,
  },

  stamina: {
    max: 100,
    sprintDrainPerSecond: 25,
    regenerationPerSecond: 18,
  },

  gameplay: {
    captureRadius: 1.5,
    rescueRadius: 1.5,
    immunityDurationMs: 2000,
    stunDurationMs: 2000,
    baseCaptureRadius: 2.6,
  },

  camera: {
    distance: 4.5,
    minDistance: 1.0,
    maxDistance: 8.0,
    heightOffset: 1.5,
    minPitch: -Math.PI / 3, // Look up limit
    maxPitch: Math.PI / 4, // Look down limit
    sensitivity: 0.0025,
    smoothing: 0.15,
    wallBuffer: 0.25,
    fadeDistance: 1.4,
  },

  arena: {
    length: 60,
    width: 30,
    wallHeight: 3.5,
  },

  networking: {
    hostReconnectWindowMs: 10000,
    heartbeatIntervalMs: 2000,
  },
} as const
