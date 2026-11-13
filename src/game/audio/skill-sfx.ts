export function triggerDashSfx(
  ctx: AudioContext,
  dest: AudioNode,
  noiseBuffer: AudioBuffer | null,
): void {
  const now = ctx.currentTime

  // Aerodynamic whoosh burst
  if (noiseBuffer) {
    const noise = ctx.createBufferSource()
    noise.buffer = noiseBuffer

    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(520, now)
    filter.frequency.exponentialRampToValueAtTime(2200, now + 0.09)
    filter.frequency.exponentialRampToValueAtTime(640, now + 0.24)
    filter.Q.value = 1.6

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.001, now)
    gain.gain.linearRampToValueAtTime(0.42, now + 0.03)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25)

    noise.connect(filter)
    filter.connect(gain)
    gain.connect(dest)
    noise.start(now)
    noise.stop(now + 0.26)
  }

  // Crisp upward kinetic snap
  const osc = ctx.createOscillator()
  const oscGain = ctx.createGain()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(240, now)
  osc.frequency.exponentialRampToValueAtTime(580, now + 0.14)
  oscGain.gain.setValueAtTime(0.24, now)
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16)

  osc.connect(oscGain)
  oscGain.connect(dest)
  osc.start(now)
  osc.stop(now + 0.17)
}

export function triggerSmokeSfx(
  ctx: AudioContext,
  dest: AudioNode,
  noiseBuffer: AudioBuffer | null,
): void {
  const now = ctx.currentTime

  // Deep canister pop
  const pop = ctx.createOscillator()
  const popGain = ctx.createGain()
  pop.type = 'sine'
  pop.frequency.setValueAtTime(190, now)
  pop.frequency.exponentialRampToValueAtTime(58, now + 0.12)
  popGain.gain.setValueAtTime(0.36, now)
  popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.13)
  pop.connect(popGain)
  popGain.connect(dest)
  pop.start(now)
  pop.stop(now + 0.14)

  // Pressurized gas hiss
  if (noiseBuffer) {
    const hiss = ctx.createBufferSource()
    hiss.buffer = noiseBuffer

    const filter = ctx.createBiquadFilter()
    filter.type = 'highpass'
    filter.frequency.setValueAtTime(1400, now)
    filter.frequency.exponentialRampToValueAtTime(620, now + 0.45)

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.001, now)
    gain.gain.linearRampToValueAtTime(0.32, now + 0.04)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.48)

    hiss.connect(filter)
    filter.connect(gain)
    gain.connect(dest)
    hiss.start(now)
    hiss.stop(now + 0.5)
  }
}

export function triggerAdrenalineSfx(ctx: AudioContext, dest: AudioNode): void {
  const now = ctx.currentTime
  const notes = [330, 440, 659.25]

  notes.forEach((freq, idx) => {
    const start = now + idx * 0.055
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(freq, start)
    osc.frequency.exponentialRampToValueAtTime(freq * 1.12, start + 0.18)

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(1800, start)

    gain.gain.setValueAtTime(0.001, start)
    gain.gain.linearRampToValueAtTime(0.18, start + 0.025)
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.24)

    osc.connect(filter)
    filter.connect(gain)
    gain.connect(dest)
    osc.start(start)
    osc.stop(start + 0.25)
  })
}

export function triggerSkillDeniedSfx(ctx: AudioContext, dest: AudioNode): void {
  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = 'square'
  osc.frequency.setValueAtTime(165, now)
  osc.frequency.setValueAtTime(132, now + 0.06)

  gain.gain.setValueAtTime(0.12, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14)

  osc.connect(gain)
  gain.connect(dest)
  osc.start(now)
  osc.stop(now + 0.15)
}

export function triggerCaughtStingSfx(ctx: AudioContext, dest: AudioNode): void {
  const now = ctx.currentTime
  const freqs = [246.94, 174.61]

  freqs.forEach((freq, idx) => {
    const start = now + idx * 0.08
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(freq, start)
    osc.frequency.exponentialRampToValueAtTime(freq * 0.72, start + 0.22)

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(980, start)

    gain.gain.setValueAtTime(0.24, start)
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.24)

    osc.connect(filter)
    filter.connect(gain)
    gain.connect(dest)
    osc.start(start)
    osc.stop(start + 0.25)
  })
}

