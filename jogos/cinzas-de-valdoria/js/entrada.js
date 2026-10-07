// Controlos: teclado + rato (com bloqueio do ponteiro), comando (Gamepad API) e ecrã tátil.

const TECLAS = {
  KeyW: 'frente', ArrowUp: 'frente', KeyS: 'tras', ArrowDown: 'tras', KeyA: 'esq', ArrowLeft: 'esq', KeyD: 'dir', ArrowRight: 'dir',
  ShiftLeft: 'correr', ShiftRight: 'correr', Space: 'rolar', KeyF: 'forte', KeyQ: 'alvo', KeyR: 'frasco', KeyE: 'interagir',
  KeyX: 'arma', KeyM: 'mapa', KeyP: 'pausa', KeyC: 'andar',
};

export class Entrada {
  constructor(alvo) {
    this.alvo = alvo;
    this.estado = new Set();
    this.premidos = new Set();
    this.dx = 0;
    this.dy = 0;
    this.roda = 0;
    this.sensibilidade = 1;
    this.inverterY = false;
    this.ativo = false; // só capta ações de jogo quando está a jogar
    this.toque = matchMedia('(pointer: coarse)').matches;
    this.comando = null;
    this.botoesAnteriores = [];
    this.bHoraPremido = 0;
    this.joy = { id: null, x: 0, y: 0, ox: 0, oy: 0 };
    this.cam = { id: null, x: 0, y: 0 };

    addEventListener('keydown', (e) => {
      const a = TECLAS[e.code];
      if (!a) return;
      e.preventDefault();
      if (!this.estado.has(a)) this.premidos.add(a);
      this.estado.add(a);
    });
    addEventListener('keyup', (e) => {
      const a = TECLAS[e.code];
      if (a) this.estado.delete(a);
    });
    addEventListener('blur', () => this.estado.clear());

    alvo.addEventListener('mousedown', (e) => {
      if (!this.ativo) return;
      if (document.pointerLockElement !== alvo) {
        this.pedirBloqueio();
        return;
      }
      const a = e.button === 0 ? 'ataque' : e.button === 2 ? 'bloquear' : e.button === 1 ? 'alvo' : null;
      if (a) {
        this.premidos.add(a);
        this.estado.add(a);
      }
      e.preventDefault();
    });
    addEventListener('mouseup', (e) => {
      const a = e.button === 0 ? 'ataque' : e.button === 2 ? 'bloquear' : e.button === 1 ? 'alvo' : null;
      if (a) this.estado.delete(a);
    });
    alvo.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === alvo) {
        this.dx += e.movementX;
        this.dy += e.movementY;
      }
    });
    addEventListener('wheel', (e) => {
      if (this.ativo) this.roda += Math.sign(e.deltaY);
    }, { passive: true });

    addEventListener('gamepadconnected', (e) => {
      this.comando = e.gamepad.index;
      this.aoMudarDispositivo?.('comando');
    });
    addEventListener('gamepaddisconnected', () => {
      this.comando = null;
    });

    if (this.toque) this.prepararToque();
  }

  pedirBloqueio() {
    if (this.toque) return;
    try {
      const p = this.alvo.requestPointerLock({ unadjustedMovement: true });
      if (p && p.catch) p.catch(() => this.alvo.requestPointerLock());
    } catch {
      this.alvo.requestPointerLock();
    }
  }

  get bloqueado() {
    return document.pointerLockElement === this.alvo;
  }

  prepararToque() {
    document.body.classList.add('toque');
    const zona = document.getElementById('zona-toque');
    const base = document.getElementById('joy-base');
    const pega = document.getElementById('joy-pega');
    zona.addEventListener('touchstart', (e) => {
      for (const t of e.changedTouches) {
        if (t.clientX < innerWidth * 0.4 && this.joy.id === null) {
          this.joy = { id: t.identifier, x: 0, y: 0, ox: t.clientX, oy: t.clientY };
          base.style.display = 'block';
          base.style.left = `${t.clientX - 60}px`;
          base.style.top = `${t.clientY - 60}px`;
          pega.style.transform = 'translate(0px, 0px)';
        } else if (this.cam.id === null) {
          this.cam = { id: t.identifier, x: t.clientX, y: t.clientY };
        }
      }
      e.preventDefault();
    }, { passive: false });
    zona.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.joy.id) {
          let x = (t.clientX - this.joy.ox) / 55;
          let y = (t.clientY - this.joy.oy) / 55;
          const l = Math.hypot(x, y);
          if (l > 1) { x /= l; y /= l; }
          this.joy.x = x;
          this.joy.y = y;
          pega.style.transform = `translate(${x * 45}px, ${y * 45}px)`;
        } else if (t.identifier === this.cam.id) {
          this.dx += (t.clientX - this.cam.x) * 2.2;
          this.dy += (t.clientY - this.cam.y) * 2.2;
          this.cam.x = t.clientX;
          this.cam.y = t.clientY;
        }
      }
      e.preventDefault();
    }, { passive: false });
    const fim = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.joy.id) {
          this.joy = { id: null, x: 0, y: 0, ox: 0, oy: 0 };
          base.style.display = 'none';
        } else if (t.identifier === this.cam.id) this.cam.id = null;
      }
    };
    zona.addEventListener('touchend', fim);
    zona.addEventListener('touchcancel', fim);
    for (const b of document.querySelectorAll('[data-acao]')) {
      const a = b.dataset.acao;
      b.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.premidos.add(a);
        this.estado.add(a);
        b.classList.add('ativo');
      }, { passive: false });
      const solta = (e) => {
        e.preventDefault();
        this.estado.delete(a);
        b.classList.remove('ativo');
      };
      b.addEventListener('touchend', solta);
      b.addEventListener('touchcancel', solta);
    }
  }

  // Lê o comando uma vez por fotograma e converte em ações.
  lerComando() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = this.comando !== null ? pads[this.comando] : null;
    if (!gp) gp = [...pads].find((p) => p);
    if (!gp) return null;
    const b = gp.buttons.map((x) => x.pressed || x.value > 0.5);
    const antes = this.botoesAnteriores;
    const premiu = (i) => b[i] && !antes[i];
    const mapa = { 0: 'interagir', 2: 'frasco', 3: 'arma', 4: 'bloquear', 5: 'ataque', 7: 'forte', 11: 'alvo', 10: 'alvo', 9: 'pausa', 8: 'mapa', 6: 'forte' };
    for (const [i, a] of Object.entries(mapa)) {
      if (premiu(+i)) this.premidos.add(a);
    }
    // B: toque curto = rolar, manter = correr
    if (premiu(1)) this.bHoraPremido = performance.now();
    if (b[1] && performance.now() - this.bHoraPremido > 260) this.estado.add('correrComando');
    else this.estado.delete('correrComando');
    if (!b[1] && antes[1] && performance.now() - this.bHoraPremido <= 260) this.premidos.add('rolar');
    this.estadoComando = { bloquear: b[4], b };
    this.botoesAnteriores = b;
    const zona = (v) => (Math.abs(v) < 0.15 ? 0 : (v - Math.sign(v) * 0.15) / 0.85);
    const ax = gp.axes;
    if (Math.abs(ax[2] || 0) > 0.15 || Math.abs(ax[3] || 0) > 0.15) {
      this.dx += zona(ax[2]) * 14;
      this.dy += zona(ax[3]) * 10;
    }
    // trocar de alvo com o manípulo direito (movimento rápido)
    this.direitoX = zona(ax[2] || 0);
    if (b[12]) this.premidos.add('dpadCima');
    return { x: zona(ax[0] || 0), y: zona(ax[1] || 0) };
  }

  // Devolve o vetor de movimento (x: direita, y: frente) com magnitude 0..1
  movimento() {
    let x = 0;
    let y = 0;
    if (this.estado.has('frente')) y += 1;
    if (this.estado.has('tras')) y -= 1;
    if (this.estado.has('dir')) x += 1;
    if (this.estado.has('esq')) x -= 1;
    let l = Math.hypot(x, y);
    if (l > 0) {
      const m = this.estado.has('andar') ? 0.45 : 1;
      x = (x / l) * m;
      y = (y / l) * m;
    }
    if (this.mc && (Math.abs(this.mc.x) > 0 || Math.abs(this.mc.y) > 0)) {
      x = this.mc.x;
      y = -this.mc.y;
    }
    if (this.joy.id !== null) {
      x = this.joy.x;
      y = -this.joy.y;
    }
    l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    return { x, y };
  }

  preparar() {
    this.mc = this.lerComando();
  }

  premido(a) {
    if (this.premidos.has(a)) {
      this.premidos.delete(a);
      return true;
    }
    return false;
  }

  ativoAcao(a) {
    if (a === 'correr') return this.estado.has('correr') || this.estado.has('correrComando');
    if (a === 'bloquear') return this.estado.has('bloquear') || !!this.estadoComando?.bloquear;
    return this.estado.has(a);
  }

  consumirRato() {
    const r = { dx: this.dx * this.sensibilidade, dy: this.dy * this.sensibilidade * (this.inverterY ? -1 : 1), roda: this.roda };
    this.dx = 0;
    this.dy = 0;
    this.roda = 0;
    return r;
  }

  limpar() {
    this.premidos.clear();
  }
}
