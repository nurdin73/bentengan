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
    minSprintThreshold: 20,
  },

  gameplay: {
    captureRadius: 1.5,
    rescueRadius: 1.5,
    rescueCooldownMs: 30000,
    immunityDurationMs: 2000,
    stunDurationMs: 2000,
    baseCaptureRadius: 2.6,
  },

  skills: {
    dash: {
      id: 'dash',
      name: 'Kilat',
      hotkey: 'Q',
      cooldownMs: 8000,
      durationMs: 350,
      speedMultiplier: 2.2,
      description: 'Impulsi maju kencang untuk manuver menghindar',
    },
    smoke: {
      id: 'smoke',
      name: 'Asap',
      hotkey: 'F',
      cooldownMs: 18000,
      durationMs: 3000,
      radius: 7.0,
      description: 'Mengaburkan pandangan lawan & memutus kejaran',
    },
    adrenaline: {
      id: 'adrenaline',
      name: 'Adrenalin',
      hotkey: 'C',
      cooldownMs: 35000,
      durationMs: 3500,
      immunityDurationMs: 1500,
      description: 'Isi penuh stamina & bebas drain stamina untuk eksekusi krusial',
    },
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
