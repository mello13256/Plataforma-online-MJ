// Jogador e inimigos: movimento, combate (ataques, bloqueio, rolamentos, equilíbrio) e inteligência artificial.
import * as THREE from '../vendor/three.js';
import { criarHumanoide, criarLobo, Animador, trocarArma } from './modelos.js';
import { altura, declive } from './mundo.js';
import { ARMAS } from './dados.js';

const GRAUS = Math.PI / 180;
const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();

function angDif(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function rodarPara(atual, alvo, max) {
  const d = angDif(atual, alvo);
  return atual + Math.max(-max, Math.min(max, d));
}

// Move um ator respeitando terreno, água funda, encostas e obstáculos.
function moverAtor(ator, dx, dz, colisoes) {
  const ox = ator.pos.x;
  const oz = ator.pos.z;
  const nx = ox + dx;
  const nz = oz + dz;
  const h0 = altura(ox, oz);
  const h1 = altura(nx, nz);
  const dist = Math.hypot(dx, dz);
  let ok = true;
  if (h1 < -1.25 && h1 < h0) ok = false; // água funda
  if (dist > 1e-4 && h1 > h0 && (h1 - h0) / dist > 1.15 && declive(nx, nz) > 0.42) ok = false; // encosta íngreme
  if (ok) {
    ator.pos.x = nx;
    ator.pos.z = nz;
  } else {
    // tenta deslizar ao longo de um dos eixos
    const hx = altura(ox + dx, oz);
    const hz = altura(ox, oz + dz);
    if (hx > -1.25 && !(hx > h0 && Math.abs(dx) > 1e-4 && (hx - h0) / Math.abs(dx) > 1.15)) ator.pos.x += dx;
    else if (hz > -1.25 && !(hz > h0 && Math.abs(dz) > 1e-4 && (hz - h0) / Math.abs(dz) > 1.15)) ator.pos.z += dz;
  }
  colisoes.resolver(ator.pos, ator.raio);
  ator.pos.x = Math.max(-688, Math.min(688, ator.pos.x));
  ator.pos.z = Math.max(-688, Math.min(688, ator.pos.z));
  ator.pos.y = altura(ator.pos.x, ator.pos.z);
}

// =====================================================================================
// JOGADOR
// =====================================================================================

export class Jogador {
  constructor(ctx, M) {
    this.ctx = ctx;
    this.M = M;
    this.rig = criarHumanoide('jogador', M);
    this.anim = new Animador(this.rig);
    ctx.cena.add(this.rig.raiz);
    this.pos = new THREE.Vector3();
    this.rot = 0;
    this.vel = new THREE.Vector3();
    this.raio = 0.42;
    this.altura = 1.8;
    this.atrib = { vitalidade: 10, resistencia: 10, forca: 10 };
    this.nivel = 1;
    this.almas = 0;
    this.frascosMax = 3;
    this.frascos = 3;
    this.armas = ['espada'];
    this.arma = 'espada';
    this.estado = 'livre';
    this.t = 0;
    this.hp = this.hpMax;
    this.energia = this.energiaMax;
    this.atrasoEnergia = 0;
    this.buffer = null;
    this.alvo = null;
    this.combo = 0;
    this.bloqueando = false;
    this.hpVisivel = this.hp;
    this.qBloq = new THREE.Quaternion();
    this.qId = new THREE.Quaternion();
    this.passoFase = 0;
  }

  get hpMax() {
    return Math.round(400 + (this.atrib.vitalidade - 10) * 42);
  }

  get energiaMax() {
    return Math.round(100 + (this.atrib.resistencia - 10) * 6);
  }

  get multDano() {
    return 1 + (this.atrib.forca - 10) * ARMAS[this.arma].escala;
  }

  get invulneravel() {
    if (this.estado === 'rolar') return this.t > 0.04 && this.t < 0.44;
    if (this.estado === 'derrubado') return this.t > 0.35;
    if (this.estado === 'nevoeiro' || this.estado === 'sentado' || this.estado === 'acender') return true;
    return false;
  }

  equiparArma(nome) {
    this.arma = nome;
    const tipo = nome === 'espada' ? 'espada' : nome;
    trocarArma(this.rig, tipo, this.M);
  }

  colocar(x, z, rot = 0) {
    this.pos.set(x, altura(x, z), z);
    this.rot = rot;
    this.vel.set(0, 0, 0);
    this.sincronizar();
  }

  restaurar() {
    this.hp = this.hpMax;
    this.hpVisivel = this.hp;
    this.energia = this.energiaMax;
    this.frascos = this.frascosMax;
    this.estado = 'livre';
    this.t = 0;
    this.anim.parar();
    this.rig.frasco.visible = false;
  }

  frente(v = tmp) {
    return v.set(Math.sin(this.rot), 0, Math.cos(this.rot));
  }

  mudarEstado(e) {
    this.estado = e;
    this.t = 0;
  }

  gastar(e) {
    this.energia -= e;
    this.atrasoEnergia = 0.65;
  }

  // ----------------------------------------------------------- ciclo
  atualizar(dt, entrada, yawCam) {
    const ctx = this.ctx;
    this.t += dt;
    // memória de botões (permite carregar um pouco antes do fim da ação anterior)
    for (const a of ['ataque', 'forte', 'rolar', 'frasco']) {
      if (entrada.premido(a)) this.buffer = { a, t: 0.4 };
    }
    if (this.buffer) {
      this.buffer.t -= dt;
      if (this.buffer.t <= 0) this.buffer = null;
    }

    const m = entrada.movimento();
    const mag = Math.hypot(m.x, m.y);
    const fx = Math.sin(yawCam), fz = Math.cos(yawCam);
    const rx = -Math.cos(yawCam), rz = Math.sin(yawCam);
    const dirX = fx * m.y + rx * m.x;
    const dirZ = fz * m.y + rz * m.x;
    const angEntrada = Math.atan2(dirX, dirZ);
    const temAlvo = this.alvo && this.alvo.vivo;
    const angAlvo = temAlvo ? Math.atan2(this.alvo.pos.x - this.pos.x, this.alvo.pos.z - this.pos.z) : 0;

    const querBloquear = entrada.ativoAcao('bloquear');
    this.bloqueando = querBloquear && this.estado === 'livre';
    this.anim.bloqueio += ((this.bloqueando ? 1 : 0) - this.anim.bloqueio) * Math.min(1, dt * 14);

    let velAlvo = 0;
    let corrida = 0;
    let dirMov = angEntrada;
    let a = this.buffer?.a;

    switch (this.estado) {
      case 'livre': {
        if (a === 'rolar' && this.energia > 0) {
          this.buffer = null;
          this.iniciarRolamento(mag > 0.2 ? angEntrada : null);
          break;
        }
        if ((a === 'ataque' || a === 'forte') && this.energia > 0) {
          this.buffer = null;
          this.iniciarAtaque(a === 'forte', mag > 0.2 ? angEntrada : null);
          break;
        }
        if (a === 'frasco') {
          this.buffer = null;
          if (this.frascos > 0) {
            this.mudarEstado('beber');
            this.anim.tocar('beber', 1.35);
            this.rig.frasco.visible = true;
            this.curou = false;
          } else ctx.hud.aviso('O frasco está vazio');
          break;
        }
        if (mag > 0.1) {
          const correr = entrada.ativoAcao('correr') && this.energia > 1 && !this.bloqueando && mag > 0.5;
          if (correr) {
            velAlvo = 7.2;
            corrida = 1;
            this.gastar(16 * dt);
            this.atrasoEnergia = 0.4;
          } else velAlvo = this.bloqueando ? 2.0 : mag < 0.55 ? 2.0 : 4.3;
          velAlvo *= Math.min(1, mag * 1.2);
          if (temAlvo && !correr) this.rot = rodarPara(this.rot, angAlvo, dt * 10);
          else this.rot = rodarPara(this.rot, angEntrada, dt * (correr ? 9 : 12));
        } else if (temAlvo) {
          this.rot = rodarPara(this.rot, angAlvo, dt * 8);
        }
        break;
      }
      case 'ataque': {
        const at = this.ataque;
        const d = at.def;
        const tn = this.t / d.dur;
        // orientação durante a preparação
        if (tn < d.ini / d.dur * 0.85) {
          if (temAlvo) this.rot = rodarPara(this.rot, angAlvo, dt * 9);
          else if (mag > 0.2) this.rot = rodarPara(this.rot, angEntrada, dt * 8);
        }
        // pequeno avanço no golpe
        if (this.t > d.ini - 0.12 && this.t < d.ini + 0.06) {
          velAlvo = at.forte ? 3.6 : 2.8;
          dirMov = this.rot;
          if (temAlvo && Math.hypot(this.alvo.pos.x - this.pos.x, this.alvo.pos.z - this.pos.z) < this.alvo.raio + 1.2) velAlvo = 0;
        }
        if (!at.somou && this.t > d.ini - 0.1) {
          at.somou = true;
          ctx.audio.golpeAr(at.forte || this.arma === 'espadao');
        }
        if (this.t >= d.ini && this.t <= d.fim) this.verificarGolpe(at);
        // cancelar recuperação com rolamento ou encadear combo
        if (this.t > d.fim) {
          if (a === 'rolar' && this.energia > 0) {
            this.buffer = null;
            this.iniciarRolamento(mag > 0.2 ? angEntrada : null);
            break;
          }
          if ((a === 'ataque' || a === 'forte') && this.t > d.fim + 0.04 && this.energia > 0) {
            this.buffer = null;
            this.iniciarAtaque(a === 'forte', mag > 0.2 ? angEntrada : null);
            break;
          }
        }
        if (this.t >= d.dur) {
          this.mudarEstado('livre');
          this.combo = 0;
        }
        break;
      }
      case 'rolar': {
        const D = 0.66;
        const k = this.t / D;
        velAlvo = this.rolTras ? (k < 0.5 ? 5.5 : 1) : k < 0.62 ? 6.8 : k < 0.85 ? 2.5 : 0.5;
        dirMov = this.dirRolar;
        if (this.t >= D) {
          this.mudarEstado('livre');
        } else if (this.t > D * 0.78 && (a === 'ataque' || a === 'forte') && this.energia > 0) {
          this.buffer = null;
          this.iniciarAtaque(a === 'forte', mag > 0.2 ? angEntrada : null);
        }
        break;
      }
      case 'beber': {
        velAlvo = mag > 0.1 ? 1.3 : 0;
        if (mag > 0.1) this.rot = rodarPara(this.rot, temAlvo ? angAlvo : angEntrada, dt * 6);
        if (!this.curou && this.t > 0.6) {
          this.curou = true;
          this.frascos--;
          this.hp = Math.min(this.hpMax, this.hp + this.hpMax * 0.42);
          ctx.audio.beber();
          ctx.efeitos.cura(tmp2.set(this.pos.x, this.pos.y + 1, this.pos.z));
        }
        if (this.t > 1.0) this.rig.frasco.visible = false;
        if (this.t >= 1.35) this.mudarEstado('livre');
        break;
      }
      case 'atordoado':
        if (this.t >= this.durAtordoado) this.mudarEstado('livre');
        velAlvo = this.t < 0.15 ? 2.2 : 0;
        dirMov = this.dirEmpurrao;
        break;
      case 'derrubado':
        velAlvo = this.t < 0.35 ? 4 : 0;
        dirMov = this.dirEmpurrao;
        if (this.t >= 1.7) this.mudarEstado('livre');
        break;
      case 'nevoeiro':
        velAlvo = 1.4;
        dirMov = this.rot;
        if (this.t >= 2.6) {
          this.mudarEstado('livre');
          ctx.aoAtravessarNevoeiro?.();
        }
        break;
      case 'acender':
        if (this.t >= 1.6) this.mudarEstado('livre');
        break;
      case 'sentado':
      case 'morto':
      default:
        break;
    }

    // velocidade com aceleração suave
    const alvoVX = Math.sin(dirMov) * velAlvo;
    const alvoVZ = Math.cos(dirMov) * velAlvo;
    const acel = this.estado === 'livre' ? 14 : 30;
    this.vel.x += (alvoVX - this.vel.x) * Math.min(1, dt * acel);
    this.vel.z += (alvoVZ - this.vel.z) * Math.min(1, dt * acel);
    const naAgua = this.pos.y < 0.05;
    const lento = naAgua ? 0.62 : 1;
    if (this.estado !== 'nevoeiro') {
      moverAtor(this, this.vel.x * dt * lento, this.vel.z * dt * lento, ctx.mundo.colisoes);
    } else {
      this.pos.x += this.vel.x * dt;
      this.pos.z += this.vel.z * dt;
      this.pos.y = altura(this.pos.x, this.pos.z);
    }

    // energia
    this.atrasoEnergia -= dt;
    if (this.atrasoEnergia <= 0 && this.estado !== 'ataque' && this.estado !== 'rolar') {
      this.energia = Math.min(this.energiaMax, this.energia + dt * (this.bloqueando ? 18 : 48));
    }
    this.hpVisivel += (this.hp - this.hpVisivel) * Math.min(1, dt * 2.5);
    if (this.hpVisivel < this.hp) this.hpVisivel = this.hp;

    // animação
    const v = Math.hypot(this.vel.x, this.vel.z);
    let lateral = 0;
    let atras = false;
    // na primeira pessoa o corpo olha sempre para onde olha a câmara (só se vê a sua sombra)
    const fp = ctx.primeiraPessoa && !['morto', 'sentado', 'rolar', 'derrubado', 'nevoeiro'].includes(this.estado);
    if (fp) this.rot = yawCam;
    if ((temAlvo || fp) && v > 0.3) {
      const fl = Math.sin(this.rot) * this.vel.x + Math.cos(this.rot) * this.vel.z;
      const lt = -Math.cos(this.rot) * this.vel.x + Math.sin(this.rot) * this.vel.z;
      lateral = Math.abs(lt) > Math.abs(fl) ? Math.sign(lt) : 0;
      atras = fl < -0.5;
    }
    const vAnim = this.estado === 'livre' || this.estado === 'beber' || this.estado === 'nevoeiro' ? v * lento : 0;
    this.velAtual = vAnim;
    this.anim.atualizar(dt, vAnim, { corrida, lateral, atras });

    // passos
    if (vAnim > 0.5) {
      const antes = Math.sin(this.passoFase);
      this.passoFase = this.anim.fase;
      if (Math.sign(Math.sin(this.passoFase)) !== Math.sign(antes)) {
        ctx.audio.passo(naAgua ? 'agua' : ctx.superficie?.(this.pos) || 'terra');
        if (naAgua) ctx.efeitos.emitir(tmp2.set(this.pos.x, 0.1, this.pos.z), { n: 4, cor: 0x9aa8a0, vel: 1.5, vida: 0.4, tam: 0.1, gravidade: -6, aditivo: false });
      }
    }
    this.sincronizar();
  }

  sincronizar() {
    const r = this.rig.raiz;
    r.position.copy(this.pos);
    r.rotation.y = this.rot;
    // o escudo vira-se para a frente quando se bloqueia
    const J = this.rig.J;
    if (J.escudo) {
      const w = this.anim.bloqueio;
      if (w > 0.01) {
        r.updateMatrixWorld(true);
        const qPai = J.cotoveloE.getWorldQuaternion(new THREE.Quaternion());
        const qAlvo = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.rot - Math.PI / 2);
        this.qBloq.copy(qPai.invert().multiply(qAlvo));
        J.escudo.quaternion.slerpQuaternions(this.qId, this.qBloq, w);
      } else J.escudo.quaternion.identity();
    }
  }

  iniciarRolamento(ang) {
    this.gastar(19);
    this.mudarEstado('rolar');
    this.rolTras = ang === null;
    if (ang === null) {
      this.dirRolar = this.rot + Math.PI;
      this.anim.tocar('golpeado', 0.45);
    } else {
      this.dirRolar = ang;
      this.rot = ang;
      this.anim.tocar('rolar', 0.66);
    }
    this.ctx.audio.rolar();
  }

  iniciarAtaque(forte, ang) {
    const arma = ARMAS[this.arma];
    const def = forte ? arma.forte : arma.leve;
    this.gastar(def.est);
    if (ang !== null && !(this.alvo && this.alvo.vivo)) this.rot = rodarPara(this.rot, ang, Math.PI * 0.6);
    this.mudarEstado('ataque');
    const anim = forte ? 'forte' : this.combo % 2 === 0 ? 'leve1' : 'leve2';
    this.combo++;
    this.ataque = { def, forte, anim, golpeados: new Set(), somou: false };
    this.anim.tocar(anim, def.dur);
  }

  verificarGolpe(at) {
    const arma = ARMAS[this.arma];
    const f = this.frente();
    for (const ini of this.ctx.inimigos) {
      if (!ini.vivo || !ini.ativo || at.golpeados.has(ini)) continue;
      tmp2.set(ini.pos.x - this.pos.x, 0, ini.pos.z - this.pos.z);
      const d = tmp2.length();
      if (d - ini.raio > arma.alcance) continue;
      if (Math.abs(ini.pos.y - this.pos.y) > 2.5 + ini.raio) continue;
      const ang = d > 0.01 ? Math.acos(Math.max(-1, Math.min(1, tmp2.dot(f) / d))) : 0;
      if (ang > (arma.arco / 2) * GRAUS && d > ini.raio + 0.6) continue;
      at.golpeados.add(ini);
      const dano = arma.dano * at.def.mult * this.multDano * (0.95 + Math.random() * 0.1);
      ini.receberDano(dano, at.def.equil, this, at.forte);
    }
  }

  // tipo: 'normal' | 'derrubar'
  receberDano(dano, { equil = 20, tipo = 'normal', origem, fogo = false } = {}) {
    const ctx = this.ctx;
    if (this.estado === 'morto') return 'nada';
    if (this.invulneravel) return 'esquivou';
    const angOrigem = Math.atan2(origem.x - this.pos.x, origem.z - this.pos.z);
    const pontoImpacto = tmp2.set(this.pos.x, this.pos.y + 1.2, this.pos.z);
    // bloqueio
    if (this.bloqueando && Math.abs(angDif(this.rot, angOrigem)) < 75 * GRAUS) {
      const custo = equil * 1.1 + dano * 0.12;
      this.gastar(custo);
      this.atrasoEnergia = 0.9;
      const chip = fogo ? 0.35 : tipo === 'derrubar' ? 0.15 : 0;
      ctx.efeitos.faiscas(tmp2.set(this.pos.x + Math.sin(this.rot) * 0.5, this.pos.y + 1.2, this.pos.z + Math.cos(this.rot) * 0.5));
      if (this.energia < 0) {
        this.energia = 0;
        this.hp -= dano * 0.4;
        ctx.audio.quebraGuarda();
        this.atordoar(1.1, angOrigem + Math.PI);
        ctx.hud.aviso('Guarda quebrada!');
      } else {
        this.hp -= dano * chip;
        ctx.audio.bloqueio();
        this.vel.x -= Math.sin(angOrigem) * 3;
        this.vel.z -= Math.cos(angOrigem) * 3;
      }
      ctx.tremer(0.15);
      if (this.hp <= 0) this.morrer();
      return 'bloqueou';
    }
    this.hp -= dano;
    ctx.audio.impactoCarne(dano > 80);
    ctx.efeitos.sangue(pontoImpacto);
    if (fogo) ctx.efeitos.emitir(pontoImpacto, { n: 14, cor: 0xff7020, vel: 3, vida: 0.6, tam: 0.2, gravidade: 3 });
    ctx.tremer(Math.min(0.6, 0.15 + dano / 300));
    ctx.pararTempo(0.06);
    if (this.hp <= 0) {
      this.morrer();
      return 'morreu';
    }
    // super-armadura durante a parte final da preparação dos ataques fortes
    const superArmadura = this.estado === 'ataque' && this.ataque.forte && this.t > this.ataque.def.ini * 0.5 && this.t < this.ataque.def.fim && equil < 45;
    if (tipo === 'derrubar') {
      this.mudarEstado('derrubado');
      this.dirEmpurrao = angOrigem + Math.PI;
      this.anim.tocar('derrubado', 1.7);
      this.rig.frasco.visible = false;
    } else if (!superArmadura) {
      this.atordoar(0.42, angOrigem + Math.PI);
    }
    return 'acertou';
  }

  atordoar(dur, dir) {
    this.mudarEstado('atordoado');
    this.durAtordoado = dur;
    this.dirEmpurrao = dir;
    this.anim.tocar(dur > 0.8 ? 'atordoado' : 'golpeado', dur);
    this.rig.frasco.visible = false;
  }

  morrer() {
    this.hp = 0;
    this.mudarEstado('morto');
    this.anim.tocar('morrer', 1.6, { manter: true });
    this.rig.frasco.visible = false;
    this.ctx.aoMorrerJogador();
  }
}

// =====================================================================================
// INIMIGOS
// =====================================================================================

const A = (anim, dur, ini, fim, extra = {}) => ({ anim, dur, ini, fim, alcance: 2.3, arco: 100, mult: 1, equil: 20, peso: 1, distMax: 3, ...extra });

export const TIPOS = {
  esvaziado: {
    nome: 'Esvaziado', rig: 'humano', estilo: 'esvaziado', escala: 0.97, hp: 110, dano: 36, equilMax: 25, vel: 1.6, corrida: 3.6,
    raio: 0.4, visao: 17, almas: 45, rastreio: 6, recuo: [0.8, 1.8], cadencia: [0.6, 1.6], hiperArmadura: false, grave: 1,
    ataques: [
      A('forte', 1.55, 0.86, 0.98, { alcance: 2.2, arco: 80, mult: 1.15, avanco: [0.48, 0.62, 2.5], equil: 25 }),
      A('leve1', 1.15, 0.5, 0.62, { alcance: 2.1, arco: 110, mult: 0.9, avanco: [0.35, 0.5, 2] }),
      A('estocada', 1.3, 0.68, 0.8, { alcance: 2.6, arco: 50, mult: 1, avanco: [0.48, 0.6, 4.5], distMax: 4.2, distMin: 2 }),
    ],
  },
  cavaleiro: {
    nome: 'Cavaleiro Caído', rig: 'humano', estilo: 'cavaleiro', escala: 1.05, hp: 420, dano: 58, equilMax: 75, vel: 1.9, corrida: 4.4,
    raio: 0.45, visao: 22, almas: 260, rastreio: 7, recuo: [0.6, 1.4], cadencia: [0.4, 1.2], escudo: true, hiperArmadura: true, grave: 1.3,
    ataques: [
      A('leve1', 0.95, 0.42, 0.54, { alcance: 2.6, arco: 110, avanco: [0.3, 0.5, 2.5], combo: 'leve2', probCombo: 0.6 }),
      A('leve2', 0.95, 0.42, 0.54, { alcance: 2.6, arco: 110, avanco: [0.3, 0.5, 2.5], peso: 0, combo: 'forte', probCombo: 0.35 }),
      A('forte', 1.5, 0.78, 0.9, { alcance: 2.8, arco: 70, mult: 1.6, avanco: [0.45, 0.6, 3.2], equil: 45 }),
      A('estocada', 1.25, 0.62, 0.74, { alcance: 3.0, arco: 45, mult: 1.2, avanco: [0.45, 0.6, 6], distMax: 5.5, distMin: 2.5 }),
    ],
  },
  lobo: {
    nome: 'Lobo Sombrio', rig: 'lobo', escala: 1, hp: 80, dano: 30, equilMax: 15, vel: 2.6, corrida: 7.8,
    raio: 0.5, visao: 24, almas: 55, rastreio: 9, recuo: [0.5, 1.4], cadencia: [0.3, 1.0], hiperArmadura: false, grave: 1,
    ataques: [
      A('morder', 0.85, 0.4, 0.52, { alcance: 1.8, arco: 70, avanco: [0.3, 0.5, 3.5] }),
      A('salto', 1.25, 0.5, 0.64, { alcance: 2.0, arco: 70, mult: 1.25, avanco: [0.35, 0.62, 'alvo'], distMax: 7.5, distMin: 3 }),
    ],
  },
  loboAncestral: {
    nome: 'Fenrath, o Lobo Ancestral', rig: 'lobo', ancestral: true, escala: 2.7, hp: 1700, dano: 92, equilMax: 220, vel: 3.2, corrida: 9.5,
    raio: 1.4, visao: 30, almas: 3500, rastreio: 4.5, recuo: [0.4, 1.2], cadencia: [0.2, 0.9], hiperArmadura: true, chefe: true, grave: 2.2,
    ataques: [
      A('morder', 1.0, 0.48, 0.6, { alcance: 4.4, arco: 80, avanco: [0.3, 0.55, 5], combo: 'morder', probCombo: 0.45 }),
      A('salto', 1.5, 0.6, 0.75, { alcance: 4.2, arco: 80, mult: 1.35, avanco: [0.35, 0.68, 'alvo'], distMax: 18, distMin: 6, tipo: 'derrubar', equil: 50, area: { dist: 2.6, raio: 3.4 } }),
      A('cauda', 1.3, 0.5, 0.66, { alcance: 4.6, arco: 360, mult: 0.9, distMax: 4.8, giro: true, tipo: 'derrubar' }),
      A('uivar', 2.2, 0.75, 0.82, { alcance: 7, arco: 360, mult: 0.5, distMax: 6, peso: 0.4, area: { dist: 0, raio: 7 }, tipo: 'derrubar', uivo: true }),
    ],
  },
  reiCaido: {
    nome: 'Valdor, o Rei Caído', rig: 'humano', estilo: 'rei', escala: 2.2, hp: 3400, dano: 105, equilMax: 330, vel: 2.1, corrida: 5.5,
    raio: 1.0, visao: 60, almas: 15000, rastreio: 3.6, recuo: [0.4, 1.2], cadencia: [0.3, 1.0], hiperArmadura: true, chefe: true, grave: 2.6,
    ataques: [
      A('varrer', 1.75, 0.98, 1.12, { alcance: 5.4, arco: 170, mult: 1.0, avanco: [0.5, 0.65, 2.5], combo: 'leve2', probCombo: 0.4 }),
      A('leve2', 1.4, 0.68, 0.8, { alcance: 5.2, arco: 140, mult: 0.9, peso: 0, avanco: [0.4, 0.6, 3], combo: 'forte', probCombo: 0.5 }),
      A('forte', 2.0, 1.12, 1.24, { alcance: 5.4, arco: 60, mult: 1.5, avanco: [0.45, 0.6, 3], equil: 60, tipo: 'derrubar', area: { dist: 4.2, raio: 2.8 }, onda: true }),
      A('estocada', 1.7, 0.92, 1.06, { alcance: 6.5, arco: 40, mult: 1.25, avanco: [0.5, 0.66, 9], distMax: 10, distMin: 4 }),
      A('salto', 2.3, 1.38, 1.5, { alcance: 4.5, arco: 360, mult: 1.6, avanco: [0.3, 0.62, 'alvo'], distMax: 22, distMin: 7, tipo: 'derrubar', area: { dist: 3.2, raio: 4.2 }, onda: true, peso: 0.8 }),
    ],
  },
};

let proxId = 1;

export class Inimigo {
  constructor(ctx, dados, M) {
    this.id = proxId++;
    this.ctx = ctx;
    this.dados = dados;
    this.cfg = TIPOS[dados.tipo];
    const c = this.cfg;
    this.rig = c.rig === 'humano' ? criarHumanoide(c.estilo, M) : criarLobo(M, c.ancestral);
    this.rig.raiz.scale.setScalar(c.escala);
    this.anim = new Animador(this.rig);
    ctx.cena.add(this.rig.raiz);
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.raio = c.raio;
    this.altura = (c.rig === 'humano' ? 1.8 : 1.1) * c.escala;
    this.chefe = !!c.chefe;
    this.nome = c.nome;
    this.M = M;
    this.materiais = [];
    this.rig.raiz.traverse((o) => {
      if (o.isMesh) this.materiais.push(o);
    });
    this.repor();
  }

  repor() {
    const d = this.dados;
    const c = this.cfg;
    this.pos.set(d.x, altura(d.x, d.z), d.z);
    this.rot = (d.rot || 0) * GRAUS;
    this.hpMax = c.hp;
    this.hp = c.hp;
    this.hpVisivel = c.hp;
    this.equil = c.equilMax;
    this.tSemDano = 0;
    this.vivo = true;
    this.ativo = true;
    this.fase = 1;
    this.alerta = false;
    this.estado = d.sentado ? 'sentado' : 'ocioso';
    this.t = 0;
    this.espera = 0;
    this.ultimoAtaque = null;
    this.repetidos = 0;
    this.tDanoRecente = 0;
    this.danoAcum = 0;
    this.vel.set(0, 0, 0);
    this.rig.raiz.visible = true;
    this.rig.raiz.scale.setScalar(c.escala);
    this.anim.parar();
    this.rig.raiz.position.copy(this.pos);
    this.rig.raiz.rotation.y = this.rot;
    if (this.estado === 'sentado') this.anim.tocar('sentado', 2, { manter: true });
    if (this.cfg.estilo === 'rei') {
      this.M.laminaRei.emissiveIntensity = 0;
      this.M.fendasRei.emissiveIntensity = 0;
    }
    // chefes ficam à espera até serem despertados pelo jogo
    if (this.chefe) {
      this.estado = 'aguardar';
      if (c.rig === 'humano') this.anim.tocar('sentado', 2, { manter: true });
    }
  }

  frente(v = tmp) {
    return v.set(Math.sin(this.rot), 0, Math.cos(this.rot));
  }

  mudarEstado(e) {
    this.estado = e;
    this.t = 0;
  }

  despertar() {
    if (this.estado === 'aguardar' || this.estado === 'sentado') {
      this.mudarEstado('levantar');
      this.anim.tocar(this.cfg.rig === 'humano' ? 'levantar' : 'uivar', this.chefe ? 2.2 : 1.1);
      if (this.cfg.rig === 'lobo') this.ctx.audio.uivo(this.cfg.grave);
      else this.ctx.audio.grunhido(this.cfg.grave);
    }
  }

  atualizar(dt) {
    if (!this.ativo) return;
    const ctx = this.ctx;
    const J = ctx.jogador;
    this.t += dt;
    this.tSemDano += dt;
    this.tDanoRecente -= dt;
    this.tDanoAcum = (this.tDanoAcum || 0) - dt;
    if (this.tSemDano > 3) this.equil = Math.min(this.cfg.equilMax, this.equil + dt * this.cfg.equilMax * 0.3);
    this.hpVisivel += (this.hp - this.hpVisivel) * Math.min(1, dt * 2.5);

    const dx = J.pos.x - this.pos.x;
    const dz = J.pos.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    const angJ = Math.atan2(dx, dz);
    const jogadorVivo = J.estado !== 'morto';
    const c = this.cfg;
    let velAlvo = 0;
    let dirMov = this.rot;
    let corrida = 0;
    let lateral = 0;

    const longeCasa = Math.hypot(this.pos.x - this.dados.x, this.pos.z - this.dados.z);

    switch (this.estado) {
      case 'morto': {
        // dissolve-se depois de cair
        if (this.t > 1.6) {
          const k = Math.min(1, (this.t - 1.6) / 1.2);
          this.rig.raiz.scale.setScalar(c.escala * (1 - k * 0.98));
          if (Math.random() < 0.6) ctx.efeitos.emitir(tmp2.set(this.pos.x, this.pos.y + 0.5 * c.escala, this.pos.z), { n: 1, cor: 0xbfd0ff, vel: 1, vida: 0.8, tam: 0.12 * c.escala, gravidade: 2, espalhar: c.escala });
          if (k >= 1) {
            this.rig.raiz.visible = false;
            this.ativo = false;
          }
        }
        break;
      }
      case 'aguardar':
        break;
      case 'sentado':
        if (jogadorVivo && dist < 5.5) this.despertar();
        break;
      case 'levantar':
        if (this.t >= (this.chefe ? 2.2 : 1.1)) {
          this.alerta = true;
          this.mudarEstado('perseguir');
        }
        break;
      case 'ocioso': {
        // pequena ronda à volta da posição inicial
        if (jogadorVivo && this.detetar(dist, angJ)) {
          this.alertar();
          break;
        }
        this.espera -= dt;
        if (this.espera <= 0) {
          this.espera = 3 + Math.random() * 4;
          this.destinoRonda = Math.random() < 0.5 ? null : [this.dados.x + (Math.random() - 0.5) * 10, this.dados.z + (Math.random() - 0.5) * 10];
        }
        if (this.destinoRonda) {
          const ddx = this.destinoRonda[0] - this.pos.x;
          const ddz = this.destinoRonda[1] - this.pos.z;
          if (Math.hypot(ddx, ddz) > 0.8) {
            velAlvo = c.vel * 0.6;
            dirMov = Math.atan2(ddx, ddz);
            this.rot = rodarPara(this.rot, dirMov, dt * 3);
          } else this.destinoRonda = null;
        }
        break;
      }
      case 'perseguir': {
        if (!jogadorVivo || (!this.chefe && longeCasa > 65)) {
          this.mudarEstado('regressar');
          break;
        }
        this.rot = rodarPara(this.rot, angJ, dt * c.rastreio);
        const at = this.escolherAtaque(dist);
        this.espera -= dt;
        if (at && this.espera <= 0 && Math.abs(angDif(this.rot, angJ)) < 0.6) {
          this.iniciarAtaque(at);
          break;
        }
        const alcanceIdeal = Math.max(1.5, ...c.ataques.map((a) => a.alcance)) * 0.7;
        if (dist > alcanceIdeal) {
          velAlvo = dist > 8 ? c.corrida : c.vel * 1.4;
          corrida = dist > 8 ? 1 : 0;
          dirMov = this.rot;
        }
        break;
      }
      case 'rondar': {
        if (!jogadorVivo) {
          this.mudarEstado('regressar');
          break;
        }
        this.rot = rodarPara(this.rot, angJ, dt * c.rastreio);
        velAlvo = c.vel * 0.8;
        const ideal = c.raio + 3.2;
        const radial = dist > ideal + 1 ? 1 : dist < ideal - 1 ? -1 : 0;
        const lado = this.ladoRonda;
        dirMov = angJ + (radial === 0 ? lado * Math.PI / 2 : radial > 0 ? lado * 0.6 : Math.PI - lado * 0.6);
        lateral = radial === 0 ? lado : 0;
        if (this.t > this.durRonda) {
          this.mudarEstado('perseguir');
        }
        break;
      }
      case 'atacar': {
        const at = this.ataque;
        const d = at.def;
        const tn = this.t / at.dur;
        if (this.t < at.ini * 0.8) this.rot = rodarPara(this.rot, angJ, dt * c.rastreio * (d.giro ? 0.3 : 1));
        if (d.avanco) {
          const [t0, t1, v] = d.avanco;
          if (tn >= t0 && tn <= t1) {
            if (v === 'alvo') {
              if (at.velSalto === undefined) {
                const alvoDist = Math.max(0, dist - c.raio - 0.8 - (d.area ? d.area.dist * 0.5 : 0));
                at.velSalto = Math.min(16, alvoDist / ((t1 - t0) * at.dur));
              }
              velAlvo = at.velSalto;
            } else velAlvo = dist < c.raio + 1.0 ? 0 : v;
            dirMov = this.rot;
          }
        }
        if (d.giro && this.t > at.ini - 0.1 && this.t < at.fim + 0.1) {
          this.rig.raiz.rotation.y = this.rot + ((this.t - at.ini + 0.1) / (at.fim - at.ini + 0.2)) * Math.PI * 2;
        }
        if (!at.somou && this.t > at.ini - 0.18) {
          at.somou = true;
          if (d.uivo) {
            ctx.audio.uivo(c.grave);
          } else ctx.audio.golpeAr(this.chefe);
          if (c.rig === 'lobo' && !d.uivo) ctx.audio.rosnar(c.grave);
        }
        if (this.t >= at.ini && this.t <= at.fim && !at.acertou) this.verificarGolpe(at, dist, angJ);
        if (this.t >= at.dur) {
          if (d.combo && Math.random() < (d.probCombo || 0) * (this.fase === 2 ? 1.4 : 1) && dist < 7) {
            const prox = c.ataques.find((a) => a.anim === d.combo);
            this.iniciarAtaque(prox);
          } else {
            this.ladoRonda = Math.random() < 0.5 ? -1 : 1;
            this.durRonda = c.recuo[0] + Math.random() * (c.recuo[1] - c.recuo[0]);
            this.espera = c.cadencia[0] + Math.random() * (c.cadencia[1] - c.cadencia[0]);
            if (this.fase === 2) this.espera *= 0.6;
            this.mudarEstado(this.chefe && Math.random() < 0.5 ? 'perseguir' : 'rondar');
          }
        }
        break;
      }
      case 'atordoado':
        if (this.t >= this.durAtordoado) this.mudarEstado('perseguir');
        break;
      case 'golpeado':
        velAlvo = this.t < 0.12 ? 1.8 : 0;
        dirMov = angJ + Math.PI;
        if (this.t >= 0.4) this.mudarEstado('perseguir');
        break;
      case 'transformar':
        if (this.t > 0.9 && !this.ondaFase) {
          this.ondaFase = true;
          ctx.audio.fogo();
          ctx.audio.estrondo();
          const anel = ctx.efeitos.onda(this.pos, 9, 0xff7030, 0.8, true);
          ctx.ondaDano(anel, this, 0.4, 'derrubar', true);
          ctx.tremer(0.6);
          this.M.laminaRei.emissiveIntensity = 2.5;
          this.M.fendasRei.emissiveIntensity = 3;
        }
        if (this.t >= 2.4) this.mudarEstado('perseguir');
        break;
      case 'regressar': {
        const ddx = this.dados.x - this.pos.x;
        const ddz = this.dados.z - this.pos.z;
        if (jogadorVivo && dist < 10 && longeCasa < 40) {
          this.mudarEstado('perseguir');
          break;
        }
        if (Math.hypot(ddx, ddz) < 1.2) {
          this.hp = this.hpMax;
          this.alerta = false;
          this.mudarEstado('ocioso');
        } else {
          velAlvo = c.vel * 1.3;
          dirMov = Math.atan2(ddx, ddz);
          this.rot = rodarPara(this.rot, dirMov, dt * 5);
          this.hp = Math.min(this.hpMax, this.hp + this.hpMax * 0.1 * dt);
        }
        break;
      }
      default:
        break;
    }

    // movimento
    const ax = Math.sin(dirMov) * velAlvo;
    const az = Math.cos(dirMov) * velAlvo;
    this.vel.x += (ax - this.vel.x) * Math.min(1, dt * 10);
    this.vel.z += (az - this.vel.z) * Math.min(1, dt * 10);
    if (this.estado !== 'morto' && this.estado !== 'aguardar') {
      moverAtor(this, this.vel.x * dt, this.vel.z * dt, ctx.mundo.colisoes);
      // não atravessa o jogador
      if (jogadorVivo && dist < this.raio + J.raio) {
        const m = (this.raio + J.raio - dist) / (dist || 1);
        const peso = this.chefe ? 0.1 : 0.5;
        this.pos.x -= dx * m * peso;
        this.pos.z -= dz * m * peso;
        J.pos.x += dx * m * (1 - peso);
        J.pos.z += dz * m * (1 - peso);
      }
    }
    const v = Math.hypot(this.vel.x, this.vel.z);
    const animVel = ['perseguir', 'rondar', 'ocioso', 'regressar'].includes(this.estado) ? v / this.cfg.escala ** 0.5 : 0;
    this.anim.atualizar(dt, animVel, { corrida, lateral });
    this.rig.raiz.position.copy(this.pos);
    if (!(this.estado === 'atacar' && this.ataque.def.giro && this.t > this.ataque.ini - 0.1 && this.t < this.ataque.fim + 0.1)) {
      this.rig.raiz.rotation.y = this.rot;
    }
  }

  detetar(dist, angJ) {
    const c = this.cfg;
    if (dist > c.visao) return false;
    if (dist < 6) return true;
    return Math.abs(angDif(this.rot, angJ)) < 75 * GRAUS;
  }

  alertar() {
    if (this.alerta && this.estado !== 'ocioso') return;
    this.alerta = true;
    if (this.estado === 'sentado') {
      this.despertar();
      return;
    }
    this.mudarEstado('perseguir');
    this.espera = 0.3 + Math.random() * 0.5;
    if (this.cfg.rig === 'lobo') this.ctx.audio.rosnar(this.cfg.grave);
    else this.ctx.audio.grunhido(this.cfg.grave);
    // os vizinhos também acordam
    for (const o of this.ctx.inimigos) {
      if (o !== this && o.vivo && !o.chefe && (o.estado === 'ocioso') && o.pos.distanceTo(this.pos) < 12) {
        o.alerta = true;
        o.mudarEstado('perseguir');
        o.espera = 0.5 + Math.random();
      }
    }
  }

  escolherAtaque(dist) {
    const c = this.cfg;
    const validos = c.ataques.filter((a) => a.peso > 0 && dist >= (a.distMin || 0) * (c.escala > 1.5 ? 1 : 1) && dist <= Math.max(a.distMax, a.alcance + this.raio * 0.5));
    if (!validos.length) return null;
    let total = 0;
    for (const a of validos) total += a.peso * (a === this.ultimoAtaque ? 0.4 : 1);
    let r = Math.random() * total;
    for (const a of validos) {
      r -= a.peso * (a === this.ultimoAtaque ? 0.4 : 1);
      if (r <= 0) return a;
    }
    return validos[0];
  }

  iniciarAtaque(def) {
    const vel = this.fase === 2 ? 1.18 : 1;
    this.ultimoAtaque = def;
    this.ataque = { def, dur: def.dur / vel, ini: def.ini / vel, fim: def.fim / vel, somou: false, acertou: false, areaFeita: false };
    this.mudarEstado('atacar');
    this.anim.tocar(def.anim, this.ataque.dur);
  }

  verificarGolpe(at, dist, angJ) {
    const d = at.def;
    const J = this.ctx.jogador;
    const ctx = this.ctx;
    const dano = this.cfg.dano * d.mult * (this.fase === 2 ? 1.15 : 1);
    if (d.area && !at.areaFeita) {
      at.areaFeita = true;
      const centro = tmp2.copy(this.pos).addScaledVector(this.frente(), d.area.dist);
      ctx.efeitos.poeira(centro, d.area.raio, 18);
      ctx.audio.estrondo();
      ctx.tremer(this.chefe ? 0.7 : 0.3);
      if (d.uivo) ctx.efeitos.onda(this.pos, d.area.raio, 0xc8d8ff, 0.6);
      else ctx.efeitos.onda(centro, d.area.raio * 1.4, 0xb0a080, 0.45);
      if (Math.hypot(J.pos.x - centro.x, J.pos.z - centro.z) < d.area.raio + J.raio) {
        J.receberDano(dano, { equil: d.equil, tipo: d.tipo || 'normal', origem: centro.clone() });
        at.acertou = true;
      }
      // na segunda fase o rei solta uma onda de fogo
      if (this.fase === 2 && d.onda) {
        const anel = ctx.efeitos.onda(centro.clone(), 11, 0xff6a20, 1.0, true);
        ctx.ondaDano(anel, this, 0.45, 'normal', true);
        ctx.audio.fogo();
      }
      return;
    }
    if (dist - J.raio > d.alcance) return;
    if (Math.abs(J.pos.y - this.pos.y) > 2.5 + this.cfg.escala) return;
    const dif = Math.abs(angDif(d.giro ? this.rig.raiz.rotation.y : this.rot, angJ));
    if (d.arco < 360 && dif > (d.arco / 2) * GRAUS && dist > this.raio + 0.5) return;
    const r = J.receberDano(dano, { equil: d.equil, tipo: d.tipo || 'normal', origem: this.pos.clone(), fogo: this.fase === 2 });
    if (r !== 'esquivou') at.acertou = true;
    if (r === 'bloqueou' && !this.chefe && J.energia > 0 && Math.random() < 0.15) {
      // um bloqueio perfeito pode fazer o inimigo recuar
      this.mudarEstado('golpeado');
      this.anim.tocar('golpeado', 0.4);
    }
  }

  receberDano(dano, equilDano, fonte, forte) {
    if (!this.vivo) return;
    const ctx = this.ctx;
    const c = this.cfg;
    const p = tmp2.set(this.pos.x, this.pos.y + this.altura * 0.6, this.pos.z);
    // cavaleiros bloqueiam golpes frontais quando não estão a atacar
    if (c.escudo && (this.estado === 'rondar' || this.estado === 'perseguir') && Math.random() < 0.45) {
      const angF = Math.atan2(fonte.pos.x - this.pos.x, fonte.pos.z - this.pos.z);
      if (Math.abs(angDif(this.rot, angF)) < 60 * GRAUS) {
        dano *= 0.18;
        equilDano *= 0.4;
        ctx.audio.bloqueio();
        ctx.efeitos.faiscas(p);
        fonte.gastar?.(10);
        this.aplicarDano(dano, equilDano, forte, true);
        return;
      }
    }
    ctx.audio.impactoCarne(forte);
    if (c.estilo === 'cavaleiro' || c.estilo === 'rei') ctx.efeitos.faiscas(p);
    ctx.efeitos.sangue(p);
    ctx.pararTempo(forte ? 0.09 : 0.05);
    ctx.tremer(forte ? 0.25 : 0.1);
    this.aplicarDano(dano, equilDano, forte, false);
  }

  aplicarDano(dano, equilDano, forte, bloqueado) {
    const c = this.cfg;
    const ctx = this.ctx;
    this.hp -= dano;
    this.tSemDano = 0;
    this.tDanoRecente = 3;
    this.danoAcum = (this.tDanoAcum > 0 ? this.danoAcum : 0) + dano;
    this.tDanoAcum = 1.6;
    this.equil -= equilDano;
    if (!this.alerta) this.alertar();
    if (this.estado === 'sentado' || this.estado === 'aguardar') {
      this.alerta = true;
      this.mudarEstado('perseguir');
    }
    if (this.hp <= 0) {
      this.morrer();
      return;
    }
    // segunda fase do rei
    if (c.estilo === 'rei' && this.fase === 1 && this.hp < this.hpMax * 0.5) {
      this.fase = 2;
      this.ondaFase = false;
      this.mudarEstado('transformar');
      this.anim.tocar('rugido', 2.4);
      ctx.audio.iniciarMusica(2);
      ctx.hud.aviso('O Rei Caído arde em fúria');
      return;
    }
    if (bloqueado) return;
    const emGolpe = this.estado === 'atacar' && this.t >= this.ataque.ini * 0.7;
    if (this.equil <= 0) {
      this.equil = c.equilMax;
      this.mudarEstado('atordoado');
      this.durAtordoado = this.chefe ? 2.2 : 1.3;
      this.anim.tocar('atordoado', this.durAtordoado);
      ctx.audio.grunhido(c.grave);
    } else if (!c.hiperArmadura && !emGolpe) {
      this.mudarEstado('golpeado');
      this.anim.tocar('golpeado', 0.4);
    }
  }

  morrer() {
    this.hp = 0;
    this.vivo = false;
    this.mudarEstado('morto');
    this.anim.tocar('morrer', 1.4, { manter: true });
    this.ctx.audio.morteInimigo();
    if (this.cfg.rig === 'lobo') this.ctx.audio.uivo(this.cfg.grave * 1.4);
    this.ctx.aoMatarInimigo(this);
  }
}
