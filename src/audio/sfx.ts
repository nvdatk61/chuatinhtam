/**
 * Âm thanh tổng hợp bằng Web Audio API – không dùng file mp3 nên không lo bản quyền.
 * Mỗi hàm tạo ra node mới, tự huỷ khi phát xong.
 */
class Sfx {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private ambient: { stop: () => void } | null = null
  private _muted = false
  private volume = 1

  /** Phát âm thanh với âm lượng tạm thời (dùng cho âm thanh của người chơi khác ở xa) */
  at(volume: number, play: (s: Sfx) => void) {
    this.volume = volume
    try { play(this) } finally { this.volume = 1 }
  }

  /** Trình duyệt chỉ cho phát âm thanh sau thao tác của người dùng → gọi trong onClick */
  unlock() {
    if (!this.ctx) {
      this.ctx = new AudioContext()
      this.master = this.ctx.createGain()
      this.master.gain.value = 0.8
      this.master.connect(this.ctx.destination)
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  set muted(v: boolean) {
    this._muted = v
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(v ? 0 : 0.8, this.ctx.currentTime, 0.1)
  }
  get muted() { return this._muted }

  private get ready(): { ctx: AudioContext; out: AudioNode } | null {
    if (!this.ctx || !this.master) return null
    if (this.volume >= 1) return { ctx: this.ctx, out: this.master }
    const g = this.ctx.createGain()
    g.gain.value = this.volume
    g.connect(this.master)
    return { ctx: this.ctx, out: g }
  }

  /** Tiếng mõ gỗ: xung ngắn + cộng hưởng ~ 700Hz, tắt rất nhanh */
  mo() {
    const r = this.ready; if (!r) return
    const { ctx, out } = r
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(780, t)
    osc.frequency.exponentialRampToValueAtTime(620, t + 0.12)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.9, t + 0.004)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18)
    // lớp "cốc" của dùi gỗ
    const noise = this.noiseSource(ctx, 0.05)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 3
    const ng = ctx.createGain()
    ng.gain.setValueAtTime(0.5, t)
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.04)
    osc.connect(g).connect(out)
    noise.connect(bp).connect(ng).connect(out)
    osc.start(t); osc.stop(t + 0.2); noise.start(t)
  }

  /** Tiếng chuông đồng: nhiều partial không điều hoà, ngân dài */
  bell(base = 110, duration = 7) {
    const r = this.ready; if (!r) return
    const { ctx, out } = r
    const t = ctx.currentTime
    const partials: Array<[number, number, number]> = [
      // [hệ số tần số, âm lượng, độ dài tương đối]
      [0.5, 0.35, 1], [1, 0.5, 0.9], [1.19, 0.25, 0.7], [1.56, 0.2, 0.55],
      [2, 0.18, 0.5], [2.74, 0.12, 0.35], [3.76, 0.08, 0.25], [5.4, 0.05, 0.15],
    ]
    for (const [mul, vol, len] of partials) {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = base * mul * (1 + (Math.random() - 0.5) * 0.004)
      const g = ctx.createGain()
      const d = duration * len
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(vol, t + 0.01)
      g.gain.exponentialRampToValueAtTime(0.0001, t + d)
      // rung nhẹ (beating) cho cảm giác chuông thật
      const lfo = ctx.createOscillator()
      lfo.frequency.value = 0.8 + Math.random() * 1.5
      const lfoGain = ctx.createGain()
      lfoGain.gain.value = vol * 0.25
      lfo.connect(lfoGain).connect(g.gain)
      osc.connect(g).connect(out)
      osc.start(t); osc.stop(t + d); lfo.start(t); lfo.stop(t + d)
    }
  }

  /** Chuông gia trì nhỏ, dùng khi bắt đầu/kết thúc thiền và khi lạy */
  smallBell() { this.bell(520, 4) }

  /** Tiếng hạt gỗ chạm nhau khi lần tràng hạt */
  bead() {
    const r = this.ready; if (!r) return
    const { ctx, out } = r
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    osc.frequency.value = 2200 + Math.random() * 300
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.003)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06)
    osc.connect(g).connect(out)
    osc.start(t); osc.stop(t + 0.08)
  }

  /** Tiếng lắc ống xăm */
  shake() {
    const r = this.ready; if (!r) return
    const { ctx, out } = r
    for (let i = 0; i < 9; i++) {
      const t = ctx.currentTime + i * 0.07 + Math.random() * 0.02
      const n = this.noiseSource(ctx, 0.03)
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'; bp.frequency.value = 2500 + Math.random() * 1500; bp.Q.value = 6
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.4, t)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03)
      n.connect(bp).connect(g).connect(out)
      n.start(t)
    }
  }

  /** Nền: gió nhẹ + một hợp âm trầm ngân, lặp vô hạn */
  startAmbient() {
    const r = this.ready; if (!r || this.ambient) return
    const { ctx, out } = r
    const bus = ctx.createGain()
    bus.gain.value = 0
    bus.gain.setTargetAtTime(0.18, ctx.currentTime, 2)
    bus.connect(out)

    // gió
    const wind = this.noiseSource(ctx, 4, true)
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'; lp.frequency.value = 500
    const windLfo = ctx.createOscillator()
    windLfo.frequency.value = 0.07
    const windLfoGain = ctx.createGain()
    windLfoGain.gain.value = 250
    windLfo.connect(windLfoGain).connect(lp.frequency)
    const windGain = ctx.createGain()
    windGain.gain.value = 0.35
    wind.connect(lp).connect(windGain).connect(bus)

    // drone trầm (quãng 5)
    const oscs = [65.4, 98, 130.8].map((f, i) => {
      const o = ctx.createOscillator()
      o.type = 'triangle'
      o.frequency.value = f
      o.detune.value = (i - 1) * 4
      const g = ctx.createGain()
      g.gain.value = 0.12 / (i + 1)
      o.connect(g).connect(bus)
      return o
    })
    wind.start(); windLfo.start(); oscs.forEach((o) => o.start())
    this.ambient = {
      stop: () => {
        bus.gain.setTargetAtTime(0, ctx.currentTime, 0.5)
        setTimeout(() => { wind.stop(); windLfo.stop(); oscs.forEach((o) => o.stop()) }, 2000)
      },
    }
  }

  private noiseSource(ctx: AudioContext, seconds: number, loop = false) {
    const len = Math.floor(ctx.sampleRate * seconds)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.loop = loop
    return src
  }
}

export const sfx = new Sfx()
