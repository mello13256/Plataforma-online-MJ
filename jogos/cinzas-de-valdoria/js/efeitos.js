// Partículas e efeitos: faíscas, sangue, pó, almas, ondas de choque e anéis de fogo.
import * as THREE from '../vendor/three.js';
import { altura } from './mundo.js';

export class Efeitos {
  constructor(cena, tex) {
    this.cena = cena;
    this.tex = tex;
    this.pool = [];
    this.ativas = [];
    this.aneis = [];
    for (let i = 0; i < 260; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex.brilho, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      s.visible = false;
      cena.add(s);
      this.pool.push(s);
    }
    // sprites normais (pó, sangue) usam mistura normal
    this.poolNormal = [];
    for (let i = 0; i < 120; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.brilho, transparent: true, depthWrite: false }));
      s.visible = false;
      cena.add(s);
      this.poolNormal.push(s);
    }
  }

  emitir(pos, { n = 10, cor = 0xffaa55, vel = 4, vida = 0.5, tam = 0.15, gravidade = -9, aditivo = true, subida = 1, espalhar = 0.1, alvo = null } = {}) {
    const pool = aditivo ? this.pool : this.poolNormal;
    for (let i = 0; i < n; i++) {
      const s = pool.find((p) => !p.visible);
      if (!s) return;
      s.visible = true;
      s.material.color.set(cor);
      s.material.opacity = 1;
      s.position.set(pos.x + (Math.random() - 0.5) * espalhar, pos.y + (Math.random() - 0.5) * espalhar, pos.z + (Math.random() - 0.5) * espalhar);
      const d = new THREE.Vector3(Math.random() - 0.5, Math.random() * subida, Math.random() - 0.5).normalize().multiplyScalar(vel * (0.4 + Math.random() * 0.8));
      s.scale.setScalar(tam * (0.6 + Math.random() * 0.8));
      this.ativas.push({ s, v: d, vida, t: 0, gravidade, tam: s.scale.x, alvo });
    }
  }

  faiscas(pos) {
    this.emitir(pos, { n: 16, cor: 0xffc070, vel: 6, vida: 0.35, tam: 0.09, gravidade: -12 });
    this.emitir(pos, { n: 1, cor: 0xffe0b0, vel: 0, vida: 0.12, tam: 0.9, gravidade: 0 });
  }

  sangue(pos) {
    this.emitir(pos, { n: 14, cor: 0x5a0606, vel: 3.5, vida: 0.55, tam: 0.12, gravidade: -10, aditivo: false });
  }

  poeira(pos, raio = 1, n = 16) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const p = new THREE.Vector3(pos.x + Math.cos(a) * raio * 0.5, pos.y + 0.2, pos.z + Math.sin(a) * raio * 0.5);
      this.emitir(p, { n: 1, cor: 0x8a7c66, vel: 2 + raio, vida: 0.9, tam: 0.9 + raio * 0.3, gravidade: 0.5, aditivo: false, subida: 0.3, espalhar: 0.3 });
    }
  }

  almas(pos, alvo) {
    this.emitir(pos, { n: 26, cor: 0xd8e8ff, vel: 2.5, vida: 1.4, tam: 0.18, gravidade: 1, subida: 1, espalhar: 0.6, alvo });
  }

  cura(pos) {
    this.emitir(pos, { n: 22, cor: 0xffa040, vel: 1.2, vida: 1.0, tam: 0.14, gravidade: 2.5, espalhar: 0.8 });
  }

  brasas(pos, n = 4) {
    this.emitir(pos, { n, cor: 0xff6a20, vel: 1.2, vida: 0.9, tam: 0.08, gravidade: 3, espalhar: 0.6 });
  }

  // Onda de choque visível (anel a expandir) — o dano é tratado por quem a cria.
  onda(pos, raioMax, cor = 0xd0c0a0, dur = 0.5, fogo = false) {
    const g = new THREE.RingGeometry(0.85, 1, 48, 1);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.MeshBasicMaterial({
      color: cor, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false,
      blending: fogo ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(pos.x, altura(pos.x, pos.z) + 0.15, pos.z);
    this.cena.add(mesh);
    const anel = { mesh, t: 0, dur, raioMax, fogo, raio: 0, centro: pos.clone(), atingiu: false };
    this.aneis.push(anel);
    return anel;
  }

  atualizar(dt, jogadorPos) {
    for (let i = this.ativas.length - 1; i >= 0; i--) {
      const p = this.ativas[i];
      p.t += dt;
      if (p.t >= p.vida) {
        p.s.visible = false;
        this.ativas.splice(i, 1);
        continue;
      }
      if (p.alvo) {
        // almas a voar até ao jogador
        const a = new THREE.Vector3(p.alvo.x, p.alvo.y + 1.1, p.alvo.z).sub(p.s.position);
        p.v.addScaledVector(a, dt * 6).multiplyScalar(1 - dt * 2);
      } else {
        p.v.y += p.gravidade * dt;
      }
      p.s.position.addScaledVector(p.v, dt);
      const k = p.t / p.vida;
      p.s.material.opacity = 1 - k * k;
      if (p.gravidade > 0 && !p.alvo && p.tam > 0.5) p.s.scale.setScalar(p.tam * (1 + k * 1.5));
    }
    for (let i = this.aneis.length - 1; i >= 0; i--) {
      const a = this.aneis[i];
      a.t += dt;
      const k = Math.min(1, a.t / a.dur);
      a.raio = a.raioMax * (1 - Math.pow(1 - k, 2));
      a.mesh.scale.setScalar(Math.max(0.01, a.raio));
      a.mesh.material.opacity = (1 - k) * (a.fogo ? 1 : 0.6);
      if (a.fogo && Math.random() < 0.8) {
        const ang = Math.random() * Math.PI * 2;
        const p = new THREE.Vector3(a.centro.x + Math.cos(ang) * a.raio, 0, a.centro.z + Math.sin(ang) * a.raio);
        p.y = altura(p.x, p.z) + 0.3;
        this.emitir(p, { n: 2, cor: 0xff6020, vel: 2, vida: 0.5, tam: 0.35, gravidade: 4 });
      }
      if (k >= 1) {
        this.cena.remove(a.mesh);
        a.mesh.geometry.dispose();
        a.mesh.material.dispose();
        this.aneis.splice(i, 1);
      }
    }
  }
}
