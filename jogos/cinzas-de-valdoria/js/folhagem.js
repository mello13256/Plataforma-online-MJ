// Folhagem: texturas de folhas recortadas (com transparência) e geometria de árvores, arbustos,
// fetos, juncos, nenúfares, troncos caídos e cepos. As copas são feitas de "cartões" cruzados,
// como nos jogos 3D, em vez de bolas lisas.
import * as THREE from '../vendor/three.js';
import { aleatorio } from './ruido.js';
import { criarCanvas } from './texturas.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

function texturaCanvas(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.anisotropy = 4;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

const hsl = (h, s, l, a = 1) => `hsla(${h}, ${s}%, ${l}%, ${a})`;

// cacho de folhas visto de lado: denso ao centro, solto nas bordas, com raminhos
function texturaFolhas(T, semente, { matiz, sat, luz, var: dv = 10, n = 260, larg = 0.045 }) {
  const c = criarCanvas(T);
  const x = c.getContext('2d');
  const rnd = aleatorio(semente);
  x.strokeStyle = 'rgba(60, 42, 26, 0.95)';
  x.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const a = rnd() * Math.PI * 2;
    x.lineWidth = T * (0.008 + rnd() * 0.01);
    x.beginPath();
    x.moveTo(T / 2, T * 0.62);
    x.quadraticCurveTo(T / 2 + Math.cos(a) * T * 0.15, T * 0.5 + Math.sin(a) * T * 0.12, T / 2 + Math.cos(a) * T * 0.38, T * 0.5 + Math.sin(a) * T * 0.33);
    x.stroke();
  }
  // miolo denso (mantém a copa cheia quando a textura é vista de longe)
  for (let i = 0; i < 14; i++) {
    const a = rnd() * Math.PI * 2;
    const r = rnd() * 0.2;
    x.fillStyle = hsl(matiz + (rnd() - 0.5) * dv, sat * 0.8, luz * 0.55);
    x.beginPath();
    x.arc(T / 2 + Math.cos(a) * r * T, T / 2 + Math.sin(a) * r * T * 0.9, T * (0.08 + rnd() * 0.08), 0, Math.PI * 2);
    x.fill();
  }
  for (let i = 0; i < n; i++) {
    // distribuição em disco, mais densa ao centro
    const r = Math.pow(rnd(), 0.7) * 0.44;
    const a = rnd() * Math.PI * 2;
    const px = T / 2 + Math.cos(a) * r * T;
    const py = T / 2 + Math.sin(a) * r * T * 0.9;
    const prof = 1 - r / 0.44; // folhas de dentro mais escuras
    const l = luz * (0.62 + rnd() * 0.5) * (0.75 + 0.35 * (1 - prof));
    x.fillStyle = hsl(matiz + (rnd() - 0.5) * dv * 2, sat * (0.8 + rnd() * 0.3), Math.min(90, l));
    x.save();
    x.translate(px, py);
    x.rotate(a + (rnd() - 0.5) * 1.2);
    const w = T * larg * (0.7 + rnd() * 0.6);
    x.beginPath();
    x.ellipse(0, 0, w, w * 0.45, 0, 0, Math.PI * 2);
    x.fill();
    x.restore();
  }
  return texturaCanvas(c);
}

// ramo de pinheiro: eixo ao longo de v (base em baixo), agulhas para os lados
function texturaAgulhas(T, semente) {
  const c = criarCanvas(T);
  const x = c.getContext('2d');
  const rnd = aleatorio(semente);
  x.lineCap = 'round';
  const ramo = (x0, y0, x1, y1, larg, nivel) => {
    x.strokeStyle = 'rgba(55, 40, 28, 1)';
    x.lineWidth = larg;
    x.beginPath();
    x.moveTo(x0, y0);
    x.lineTo(x1, y1);
    x.stroke();
    const n = 26 - nivel * 10;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const px = x0 + (x1 - x0) * t;
      const py = y0 + (y1 - y0) * t;
      const comp = T * (0.075 - nivel * 0.02) * (1 - t * 0.55);
      for (const lado of [-1, 1]) {
        const ang = Math.atan2(y1 - y0, x1 - x0) + lado * (0.85 + rnd() * 0.35);
        x.strokeStyle = hsl(105 + rnd() * 25, 32 + rnd() * 15, 14 + rnd() * 14);
        x.lineWidth = T * 0.011;
        x.beginPath();
        x.moveTo(px, py);
        x.lineTo(px + Math.cos(ang) * comp, py + Math.sin(ang) * comp);
        x.stroke();
      }
    }
  };
  // silhueta do ramo (folhagem densa) por baixo das agulhas
  x.fillStyle = hsl(110, 30, 12);
  x.beginPath();
  x.moveTo(T * 0.5, T * 0.98);
  x.quadraticCurveTo(T * 0.08, T * 0.6, T * 0.42, T * 0.05);
  x.lineTo(T * 0.58, T * 0.05);
  x.quadraticCurveTo(T * 0.92, T * 0.6, T * 0.5, T * 0.98);
  x.fill();
  ramo(T / 2, T, T / 2, T * 0.03, T * 0.014, 0);
  for (let i = 0; i < 7; i++) {
    const t = 0.15 + i * 0.11;
    const y0 = T * (1 - t);
    const lado = i % 2 ? 1 : -1;
    const comp = T * (0.36 - t * 0.25);
    ramo(T / 2, y0, T / 2 + lado * comp, y0 - comp * 0.65, T * 0.007, 1);
  }
  return texturaCanvas(c);
}

// fronde de feto: caule curvo e folíolos aos pares
function texturaFeto(T, semente) {
  const c = criarCanvas(T);
  const x = c.getContext('2d');
  const rnd = aleatorio(semente);
  x.lineCap = 'round';
  x.strokeStyle = 'rgb(70, 82, 34)';
  x.lineWidth = T * 0.012;
  x.beginPath();
  x.moveTo(T / 2, T);
  x.lineTo(T / 2, T * 0.02);
  x.stroke();
  const n = 22;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const y = T * (0.95 - t * 0.92);
    const comp = T * 0.42 * Math.sin((1 - t) * Math.PI * 0.85 + 0.25) * (1 - t * 0.4);
    for (const lado of [-1, 1]) {
      x.fillStyle = hsl(78 + rnd() * 18, 40 + rnd() * 15, 22 + rnd() * 12);
      x.beginPath();
      x.moveTo(T / 2, y);
      x.quadraticCurveTo(T / 2 + lado * comp * 0.5, y - T * 0.035, T / 2 + lado * comp, y - T * 0.02);
      x.quadraticCurveTo(T / 2 + lado * comp * 0.5, y + T * 0.012, T / 2, y + T * 0.012);
      x.fill();
    }
  }
  return texturaCanvas(c);
}

export function criarTexturasFolhagem(qualidade) {
  const T = qualidade === 'alta' ? 512 : 256;
  return {
    ouro: texturaFolhas(T, 11, { matiz: 40, sat: 75, luz: 46, var: 9, n: 300 }),
    verde: texturaFolhas(T, 12, { matiz: 85, sat: 30, luz: 26, var: 14, n: 320, larg: 0.04 }),
    seco: texturaFolhas(T, 13, { matiz: 28, sat: 45, luz: 30, var: 10, n: 240 }),
    agulhas: texturaAgulhas(T, 14),
    feto: texturaFeto(T, 15),
  };
}

// ---------------------------------------------------------------- geometria

function naoIndexada(g) {
  const r = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(r.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') r.deleteAttribute(k);
  return r;
}

// quadrado de folhagem com as normais a apontar para fora do centro da copa (iluminação "volumétrica")
function cartao(larg, alt, centro, orientacao, posicao, centroCopa, curvar = 0) {
  const g = new THREE.PlaneGeometry(larg, alt, curvar ? 1 : 1, curvar ? 4 : 1);
  if (curvar) {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const t = (p.getY(i) + alt / 2) / alt;
      p.setZ(i, -curvar * t * t * alt);
    }
  }
  g.translate(centro.x, centro.y, centro.z);
  g.applyQuaternion(orientacao);
  g.translate(posicao.x, posicao.y, posicao.z);
  const p = g.attributes.position;
  const n = g.attributes.normal;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.set(p.getX(i) - centroCopa.x, p.getY(i) - centroCopa.y + 0.6, p.getZ(i) - centroCopa.z).normalize();
    n.setXYZ(i, v.x, v.y, v.z);
  }
  return naoIndexada(g);
}

function ramoCilindro(base, dir, len, r0, r1, segs = 6) {
  const g = new THREE.CylinderGeometry(r1, r0, len, segs, 1);
  g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir.clone().normalize()));
  g.translate(base.x, base.y, base.z);
  return naoIndexada(g);
}

// cacho de cartões cruzados à volta de um ponto
function cacho(alvo, centro, raio, rnd, n, centroCopa, simples = false) {
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  for (let i = 0; i < n; i++) {
    e.set((rnd() - 0.5) * 1.2, rnd() * Math.PI, (rnd() - 0.5) * 1.2);
    q.setFromEuler(e);
    const s = raio * (1.5 + rnd() * 0.8);
    const off = V((rnd() - 0.5) * raio, (rnd() - 0.5) * raio * 0.6, (rnd() - 0.5) * raio);
    // versão de longe: menos cartões, maiores, para a copa continuar cheia
    if (simples && i % 2) continue;
    alvo.push(cartao(simples ? s * 1.3 : s, simples ? s * 1.3 : s, V(0, 0, 0), q, centro.clone().add(off), centroCopa));
  }
}

// Árvore de folhas douradas: tronco, ramos e copa de cachos de folhas.
export function arvoreDourada(semente, simples = false) {
  const rnd = aleatorio(semente);
  const troncos = [];
  const folhas = [];
  const H = 5 + rnd() * 2;
  troncos.push(ramoCilindro(V(0, -0.4, 0), V((rnd() - 0.5) * 0.15, 1, (rnd() - 0.5) * 0.15), H + 0.4, 0.5, 0.26, 9));
  // raízes à superfície
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + rnd();
    const raiz = ramoCilindro(V(0, 0.5, 0), V(Math.cos(a), -0.45, Math.sin(a)), 1.4, 0.22, 0.05, 5);
    if (!simples) troncos.push(raiz);
  }
  const centroCopa = V(0, H + 1.2, 0);
  const nRamos = 5 + Math.floor(rnd() * 2);
  for (let i = 0; i < nRamos; i++) {
    const a = (i / nRamos) * Math.PI * 2 + rnd() * 0.6;
    const dir = V(Math.cos(a) * 0.75, 0.7 + rnd() * 0.3, Math.sin(a) * 0.75).normalize();
    const len = 2.6 + rnd() * 1.6;
    const by = H * (0.55 + rnd() * 0.35);
    const base = V(0, by, 0);
    troncos.push(ramoCilindro(base, dir, len, 0.2, 0.08, 6));
    const fim = base.clone().addScaledVector(dir, len);
    // sub-ramo
    const d2 = dir.clone().applyAxisAngle(V(0, 1, 0), (rnd() - 0.5) * 1.6).add(V(0, 0.3, 0)).normalize();
    const meio = base.clone().addScaledVector(dir, len * 0.6);
    const sub = ramoCilindro(meio, d2, len * 0.6, 0.09, 0.04, 5);
    if (!simples) troncos.push(sub);
    cacho(folhas, fim, 1.25 + rnd() * 0.4, rnd, 4, centroCopa, simples);
    cacho(folhas, meio.clone().addScaledVector(d2, len * 0.6), 1.0, rnd, 3, centroCopa, simples);
  }
  cacho(folhas, V(0, H + 1.4, 0), 1.7, rnd, 6, centroCopa, simples);
  const geo = THREE.mergeGeometries([THREE.mergeGeometries(troncos, false), THREE.mergeGeometries(folhas, false)], true);
  return geo;
}

// Pinheiro: tronco e andares de ramos (cartões de agulhas a pender) até à ponta.
export function pinheiro(semente, simples = false) {
  const rnd = aleatorio(semente);
  const H = 10 + rnd() * 5;
  const troncos = [ramoCilindro(V(0, -0.4, 0), V(0, 1, 0), H + 0.4, 0.38, 0.06, simples ? 5 : 8)];
  const ramos = [];
  const centroCopa = V(0, H * 0.55, 0);
  const niveis = 12;
  const q = new THREE.Quaternion();
  const q2 = new THREE.Quaternion();
  const e = new THREE.Euler();
  const rodaY = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), Math.PI / 2);
  for (let k = 0; k < niveis; k++) {
    const f = k / (niveis - 1);
    const y = H * (0.18 + f * 0.76);
    const r = 3.0 * (1 - f * 0.85) + 0.45;
    const n = Math.max(5, Math.round(9 - f * 4));
    const a0 = rnd() * Math.PI;
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n) * Math.PI * 2 + (rnd() - 0.5) * 0.4;
      const larg = 1.0 + r * 0.3;
      // o cartão sai do tronco e pende para baixo; um segundo cartão cruzado dá-lhe volume
      e.set(Math.PI / 2 + 0.3 + rnd() * 0.3, -a + Math.PI / 2, 0, 'YXZ');
      q.setFromEuler(e);
      // versão de longe: metade dos andares e só os cartões cruzados (sem curvatura)
      if (simples) {
        if (k % 2 === 0 && i % 2 === 0) {
          q2.copy(q).multiply(rodaY);
          ramos.push(cartao(larg * 1.6, r * 1.2, V(0, r * 0.55, 0), q, V(0, y, 0), centroCopa));
          ramos.push(cartao(larg * 1.3, r * 1.1, V(0, r * 0.52, 0), q2, V(0, y - 0.15, 0), centroCopa));
        }
        continue;
      }
      ramos.push(cartao(larg, r * 1.15, V(0, r * 0.55, 0), q, V(0, y, 0), centroCopa, 0.15));
      q2.copy(q).multiply(rodaY);
      ramos.push(cartao(larg * 0.8, r * 1.05, V(0, r * 0.52, 0), q2, V(0, y - 0.15, 0), centroCopa));
      if (k < 4) troncos.push(ramoCilindro(V(0, y, 0), V(Math.cos(a), -0.2, Math.sin(a)), r * 0.75, 0.07, 0.03, 4));
    }
  }
  // ponta
  for (let i = 0; i < 2; i++) {
    q.setFromEuler(e.set(0, i * Math.PI / 2, 0));
    ramos.push(cartao(1.3, 2.2, V(0, 1.1, 0), q, V(0, H * 0.9, 0), V(0, H * 0.8, 0)));
  }
  return THREE.mergeGeometries([THREE.mergeGeometries(troncos, false), THREE.mergeGeometries(ramos, false)], true);
}

// Arbusto: só cartões de folhas
export function arbusto(semente) {
  const rnd = aleatorio(semente);
  const folhas = [];
  const c = V(0, 0.55, 0);
  cacho(folhas, c, 0.7, rnd, 6, V(0, 0.2, 0));
  cacho(folhas, V(0.4, 0.4, 0.2), 0.5, rnd, 3, V(0, 0.2, 0));
  cacho(folhas, V(-0.35, 0.35, -0.25), 0.5, rnd, 3, V(0, 0.2, 0));
  return THREE.mergeGeometries(folhas, false);
}

// Feto: frondes em arco à volta do centro
export function feto(semente) {
  const rnd = aleatorio(semente);
  const fr = [];
  const n = 7;
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd() * 0.5;
    e.set(-(0.5 + rnd() * 0.4), a, 0, 'YXZ');
    q.setFromEuler(e);
    const L = 0.8 + rnd() * 0.5;
    fr.push(cartao(0.42 * L, L, V(0, L / 2, 0), q, V(0, 0.02, 0), V(0, -0.6, 0), -0.35));
  }
  return THREE.mergeGeometries(fr, false);
}

// Juncos com espigas, para a margem do pântano
export function juncos(semente) {
  const rnd = aleatorio(semente);
  const partes = [];
  for (let i = 0; i < 14; i++) {
    const x = (rnd() - 0.5) * 0.7, z = (rnd() - 0.5) * 0.7;
    const h = 1.1 + rnd() * 0.8;
    const inc = V((rnd() - 0.5) * 0.25, 1, (rnd() - 0.5) * 0.25);
    partes.push(ramoCilindro(V(x, -0.2, z), inc, h, 0.012, 0.006, 3));
    if (rnd() < 0.45) {
      const topo = V(x, -0.2, z).addScaledVector(inc.clone().normalize(), h * 0.85);
      partes.push(ramoCilindro(topo, inc, 0.18, 0.022, 0.022, 5));
    }
  }
  return THREE.mergeGeometries(partes, false);
}

// Nenúfar: folha redonda com um corte
export function nenufar() {
  const g = new THREE.CircleGeometry(0.45, 14, 0.25, Math.PI * 2 - 0.5);
  g.rotateX(-Math.PI / 2);
  return naoIndexada(g);
}

// Tronco caído com ramos partidos
export function troncoCaido(semente) {
  const rnd = aleatorio(semente);
  const L = 5 + rnd() * 3;
  const partes = [ramoCilindro(V(-L / 2, 0.3, 0), V(1, 0.04, 0), L, 0.38, 0.28, 9)];
  for (let i = 0; i < 3; i++) {
    const x = -L / 2 + L * (0.3 + rnd() * 0.6);
    partes.push(ramoCilindro(V(x, 0.4, 0), V(rnd() - 0.5, 0.6 + rnd() * 0.4, rnd() - 0.5), 0.6 + rnd() * 0.9, 0.1, 0.04, 5));
  }
  return THREE.mergeGeometries(partes, false);
}

// Cepo com raízes
export function cepo(semente) {
  const rnd = aleatorio(semente);
  const partes = [ramoCilindro(V(0, -0.3, 0), V(0, 1, 0), 0.75 + rnd() * 0.4, 0.5, 0.42, 9)];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + rnd();
    partes.push(ramoCilindro(V(0, 0.15, 0), V(Math.cos(a), -0.5, Math.sin(a)), 0.9, 0.17, 0.04, 5));
  }
  return THREE.mergeGeometries(partes, false);
}

// Balanço das folhas com o vento (cartões mais altos mexem-se mais).
const COLAPSO = `
  #ifdef USE_INSTANCING
  vec3 wq = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  if (distance(wq.xz, uPerto.xy) < uPerto.z) transformed *= 0.0;
  #endif`;

// Material de tronco/rocha para as árvores de longe: as que estão perto são escondidas (desenha-as a versão detalhada).
export function materialLonge(params, uPerto) {
  const m = new THREE.MeshStandardMaterial(params);
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uPerto = uPerto;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uPerto;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>${COLAPSO}`);
  };
  m.customProgramCacheKey = () => 'longe';
  return m;
}

export function materialFolhas(map, uTempo, extra = {}, uPerto = null) {
  const m = new THREE.MeshStandardMaterial({ map, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 0.85, ...extra });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTempo = uTempo;
    if (uPerto) sh.uniforms.uPerto = uPerto;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\nuniform float uTempo;${uPerto ? '\nuniform vec3 uPerto;' : ''}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
        vec3 wb = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        #else
        vec3 wb = vec3(0.0);
        #endif
        float alto = max(0.0, position.y) * 0.06;
        transformed.x += sin(uTempo * 1.3 + wb.x * 0.2 + position.y * 0.6) * alto * 0.35;
        transformed.z += sin(uTempo * 1.1 + wb.z * 0.2 + position.x * 0.8) * alto * 0.3;${uPerto ? COLAPSO : ''}`);
  };
  m.customProgramCacheKey = () => (uPerto ? 'folhas-longe' : 'folhas');
  return m;
}
