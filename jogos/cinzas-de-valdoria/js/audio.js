// Sons sintetizados com Web Audio: golpes, passos, fogueiras, vento e música dos chefes.

export class Audio {
  constructor() {
    this.ctx = null;
    this.volume = 0.8;
    this.ultimoPasso = 0;
  }

  iniciar() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.mestre = this.ctx.createGain();
    this.mestre.gain.value = this.volume;
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.mestre.connect(comp);
    comp.connect(this.ctx.destination);

    // reverberação curta (impulso sintético) para dar espaço
    this.reverb = this.ctx.createConvolver();
    const len = this.ctx.sampleRate * 2.2;
    const imp = this.ctx.createBuffer(2, len, this.ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = imp.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    this.reverb.buffer = imp;
    this.envioReverb = this.ctx.createGain();
    this.envioReverb.gain.value = 0.25;
    this.envioReverb.connect(this.reverb);
    this.reverb.connect(this.mestre);

    const n = this.ctx.sampleRate * 2;
    this.ruidoBuf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = this.ruidoBuf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;

    this.iniciarVento();
  }

  definirVolume(v) {
    this.volume = v;
    if (this.mestre) this.mestre.gain.value = v;
  }

  saida(reverb = 0.3) {
    const g = this.ctx.createGain();
    g.connect(this.mestre);
    if (reverb > 0) {
      const r = this.ctx.createGain();
      r.gain.value = reverb;
      g.connect(r);
      r.connect(this.envioReverb);
    }
    return g;
  }

  ruido(dur, { f0 = 1000, f1 = 1000, q = 1, tipo = 'bandpass', vol = 0.5, ataque = 0.005, reverb = 0.2, atraso = 0 } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + atraso;
    const src = this.ctx.createBufferSource();
    src.buffer = this.ruidoBuf;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = this.ctx.createBiquadFilter();
    f.type = tipo;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + ataque);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.saida(reverb));
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  tom(freq, dur, { tipo = 'sine', vol = 0.3, f1 = null, ataque = 0.005, reverb = 0.3, atraso = 0 } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + atraso;
    const o = this.ctx.createOscillator();
    o.type = tipo;
    o.frequency.setValueAtTime(freq, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + ataque);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.saida(reverb));
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  // ---------- efeitos ----------
  golpeAr(pesado = false) {
    this.ruido(pesado ? 0.45 : 0.28, { f0: pesado ? 400 : 700, f1: pesado ? 1600 : 2600, q: 1.4, vol: pesado ? 0.35 : 0.25, ataque: 0.06, reverb: 0.1 });
  }

  impactoCarne(forte = false) {
    this.ruido(0.18, { f0: 900, f1: 200, q: 0.8, vol: forte ? 0.7 : 0.5, tipo: 'lowpass' });
    this.tom(forte ? 90 : 120, 0.2, { tipo: 'sine', vol: 0.6, f1: 45 });
  }

  impactoMetal() {
    for (const f of [520, 1310, 2140, 3380]) this.tom(f * (0.97 + Math.random() * 0.06), 0.5 + Math.random() * 0.3, { tipo: 'sine', vol: 0.12, reverb: 0.5 });
    this.ruido(0.08, { f0: 4000, f1: 2000, q: 0.7, vol: 0.4, tipo: 'highpass' });
  }

  passo(superficie = 'terra') {
    const agora = performance.now();
    if (agora - this.ultimoPasso < 120) return;
    this.ultimoPasso = agora;
    if (superficie === 'agua') this.ruido(0.25, { f0: 1200, f1: 400, q: 0.6, vol: 0.12, tipo: 'lowpass', reverb: 0.05 });
    else if (superficie === 'pedra') this.ruido(0.07, { f0: 2500, f1: 1200, q: 1.5, vol: 0.09, reverb: 0.15 });
    else this.ruido(0.1, { f0: 700, f1: 300, q: 0.7, vol: 0.08, tipo: 'lowpass', reverb: 0.05 });
  }

  rolar() {
    this.ruido(0.4, { f0: 300, f1: 900, q: 0.5, vol: 0.18, tipo: 'lowpass', ataque: 0.05, reverb: 0.05 });
    this.ruido(0.15, { f0: 500, f1: 200, q: 0.6, vol: 0.2, tipo: 'lowpass', atraso: 0.35 });
  }

  bloqueio() {
    this.impactoMetal();
    this.tom(180, 0.25, { tipo: 'triangle', vol: 0.3, f1: 120 });
  }

  quebraGuarda() {
    this.impactoMetal();
    this.tom(140, 0.6, { tipo: 'sawtooth', vol: 0.2, f1: 60 });
  }

  beber() {
    this.ruido(0.5, { f0: 600, f1: 1200, q: 3, vol: 0.12, ataque: 0.1 });
    for (let i = 0; i < 5; i++) this.tom(700 + i * 180, 0.6, { vol: 0.05, atraso: 0.2 + i * 0.06, reverb: 0.6 });
  }

  almas() {
    for (let i = 0; i < 4; i++) this.tom(880 * Math.pow(1.26, i), 0.9, { vol: 0.05, atraso: i * 0.05, reverb: 0.8 });
  }

  acenderFogueira() {
    this.ruido(1.2, { f0: 200, f1: 2500, q: 0.6, vol: 0.4, ataque: 0.3, tipo: 'lowpass', reverb: 0.5 });
    for (const [f, a] of [[220, 0], [330, 0.1], [440, 0.2], [660, 0.3]]) this.tom(f, 2.5, { tipo: 'sine', vol: 0.08, atraso: a, ataque: 0.2, reverb: 0.8 });
  }

  crepitar() {
    if (!this.ctx || Math.random() > 0.35) return;
    this.ruido(0.03 + Math.random() * 0.04, { f0: 1500 + Math.random() * 3000, f1: 800, q: 2, vol: 0.05 + Math.random() * 0.08, reverb: 0.05 });
  }

  morteJogador() {
    this.tom(55, 3, { tipo: 'sawtooth', vol: 0.25, f1: 35, ataque: 0.05, reverb: 0.8 });
    this.tom(82, 3, { tipo: 'sine', vol: 0.4, f1: 41, ataque: 0.05, reverb: 0.8 });
    this.ruido(2.5, { f0: 300, f1: 60, q: 0.5, vol: 0.4, tipo: 'lowpass', reverb: 0.8 });
  }

  morteInimigo() {
    this.ruido(0.8, { f0: 2500, f1: 500, q: 0.8, vol: 0.15, ataque: 0.05, reverb: 0.6 });
  }

  grunhido(grave = 1) {
    this.tom(140 / grave, 0.35, { tipo: 'sawtooth', vol: 0.12, f1: 90 / grave, ataque: 0.04 });
    this.ruido(0.3, { f0: 500 / grave, f1: 250 / grave, q: 4, vol: 0.12, ataque: 0.04 });
  }

  rosnar(grave = 1) {
    this.ruido(0.6, { f0: 260 / grave, f1: 180 / grave, q: 6, vol: 0.25, ataque: 0.05 });
    this.tom(70 / grave, 0.6, { tipo: 'sawtooth', vol: 0.1, ataque: 0.05 });
  }

  uivo(grave = 1) {
    if (!this.ctx) return;
    this.tom(380 / grave, 2.2, { tipo: 'triangle', vol: 0.2, f1: 540 / grave, ataque: 0.4, reverb: 0.9 });
    this.tom(570 / grave, 2.2, { tipo: 'sine', vol: 0.08, f1: 760 / grave, ataque: 0.5, reverb: 0.9 });
  }

  estrondo() {
    this.tom(50, 1.2, { tipo: 'sine', vol: 0.8, f1: 28 });
    this.ruido(1.2, { f0: 800, f1: 80, q: 0.5, vol: 0.6, tipo: 'lowpass', reverb: 0.6 });
  }

  fogo() {
    this.ruido(1.0, { f0: 300, f1: 1800, q: 0.5, vol: 0.4, ataque: 0.15, tipo: 'lowpass', reverb: 0.4 });
  }

  item() {
    this.tom(660, 0.5, { vol: 0.12, reverb: 0.6 });
    this.tom(990, 0.7, { vol: 0.1, atraso: 0.08, reverb: 0.6 });
  }

  nevoeiro() {
    this.ruido(1.6, { f0: 400, f1: 3000, q: 0.4, vol: 0.25, ataque: 0.5, reverb: 0.9 });
  }

  subirNivel() {
    [523, 659, 784, 1046].forEach((f, i) => this.tom(f, 1.2, { vol: 0.1, atraso: i * 0.08, reverb: 0.8 }));
  }

  menu() {
    this.tom(420, 0.12, { vol: 0.06, tipo: 'triangle', reverb: 0.2 });
  }

  // ---------- ambiente ----------
  iniciarVento() {
    const src = this.ctx.createBufferSource();
    src.buffer = this.ruidoBuf;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 400;
    f.Q.value = 0.6;
    const g = this.ctx.createGain();
    g.gain.value = 0.05;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoG = this.ctx.createGain();
    lfoG.gain.value = 220;
    lfo.connect(lfoG);
    lfoG.connect(f.frequency);
    const lfo2 = this.ctx.createOscillator();
    lfo2.frequency.value = 0.11;
    const lfo2G = this.ctx.createGain();
    lfo2G.gain.value = 0.03;
    lfo2.connect(lfo2G);
    lfo2G.connect(g.gain);
    src.connect(f);
    f.connect(g);
    g.connect(this.mestre);
    src.start();
    lfo.start();
    lfo2.start();
    this.vento = g;
  }

  // Música dos chefes: notas graves, coro sintético e tambores.
  iniciarMusica(fase = 1) {
    if (!this.ctx) return;
    this.pararMusica();
    const ctx = this.ctx;
    const saida = ctx.createGain();
    saida.gain.setValueAtTime(0.0001, ctx.currentTime);
    saida.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime + 2);
    saida.connect(this.mestre);
    const rv = ctx.createGain();
    rv.gain.value = 0.6;
    saida.connect(rv);
    rv.connect(this.envioReverb);
    const nos = [];
    const acordes = fase === 1
      ? [[55, 82.4, 110, 130.8], [49, 73.4, 98, 116.5], [43.65, 65.4, 87.3, 103.8], [49, 73.4, 98, 123.5]]
      : [[55, 82.4, 110, 130.8, 164.8], [58.3, 87.3, 116.5, 138.6], [49, 73.4, 98, 116.5, 146.8], [51.9, 77.8, 103.8, 123.5]];
    const dur = fase === 1 ? 4 : 2.6;
    const filtro = ctx.createBiquadFilter();
    filtro.type = 'lowpass';
    filtro.frequency.value = fase === 1 ? 900 : 1500;
    filtro.connect(saida);
    let passo = 0;
    const tocar = () => {
      const t = ctx.currentTime + 0.05;
      const ac = acordes[passo % acordes.length];
      for (const f of ac) {
        for (const det of [-6, 6]) {
          const o = ctx.createOscillator();
          o.type = 'sawtooth';
          o.frequency.value = f;
          o.detune.value = det;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.03, t + dur * 0.3);
          g.gain.exponentialRampToValueAtTime(0.0001, t + dur * 1.05);
          o.connect(g);
          g.connect(filtro);
          o.start(t);
          o.stop(t + dur * 1.1);
        }
      }
      // tambores
      const batidas = fase === 1 ? [0, 0.75, 2, 2.5] : [0, 0.33, 0.66, 1.3, 1.6, 2.0];
      for (const b of batidas) {
        const tb = t + b * (dur / (fase === 1 ? 4 : 2.6));
        const o = ctx.createOscillator();
        o.frequency.setValueAtTime(90, tb);
        o.frequency.exponentialRampToValueAtTime(38, tb + 0.4);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, tb);
        g.gain.exponentialRampToValueAtTime(0.5, tb + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, tb + 0.6);
        o.connect(g);
        g.connect(saida);
        o.start(tb);
        o.stop(tb + 0.7);
      }
      passo++;
    };
    tocar();
    const id = setInterval(tocar, dur * 1000);
    this.musica = { saida, id, nos };
  }

  pararMusica(fade = 2) {
    if (!this.musica || !this.ctx) return;
    const { saida, id } = this.musica;
    clearInterval(id);
    const t = this.ctx.currentTime;
    saida.gain.cancelScheduledValues(t);
    saida.gain.setValueAtTime(saida.gain.value, t);
    saida.gain.exponentialRampToValueAtTime(0.0001, t + fade);
    setTimeout(() => saida.disconnect(), fade * 1000 + 200);
    this.musica = null;
  }
}
