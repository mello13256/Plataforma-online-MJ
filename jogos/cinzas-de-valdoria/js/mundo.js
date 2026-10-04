// O mundo aberto de Valdoria: terreno, céu, luz, água, vegetação, ruínas, fortaleza e colisões.
import * as THREE from '../vendor/three.js';
import { criarSimplex, fbm, cristas, suave, misturar, aleatorio, limitar } from './ruido.js';
import {
  MUNDO, CAMINHOS, ZONAS_PLANAS, PANTANO, FORTALEZA, FOGUEIRAS, ARENA_LOBO, ITENS, INIMIGOS, REGIOES,
} from './dados.js';
import {
  criarTexturasFolhagem, materialFolhas, materialLonge, arvoreDourada, pinheiro, arbusto, feto, juncos, nenufar, troncoCaido, cepo,
} from './folhagem.js';
import { criarHumanoide, Animador } from './modelos.js';

const s1 = criarSimplex(101);
const s2 = criarSimplex(202);
const s3 = criarSimplex(303);
const s4 = criarSimplex(404);
const s5 = criarSimplex(505);

const N = MUNDO.segmentos + 1;
const PASSO = MUNDO.tam / MUNDO.segmentos;
const alturas = new Float32Array(N * N);
const pesoCaminhoV = new Float32Array(N * N);
const pesoPantanoV = new Float32Array(N * N);
const decliveV = new Float32Array(N * N);
const secoV = new Float32Array(N * N);

// ---------------------------------------------------------------- funções do terreno

function distSegmento(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const t = limitar(((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz), 0, 1);
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

export function distCaminho(x, z) {
  let m = Infinity;
  for (const linha of CAMINHOS) {
    for (let i = 0; i < linha.length - 1; i++) {
      const [ax, az] = linha[i];
      const [bx, bz] = linha[i + 1];
      // teste rápido com caixa
      if (x < Math.min(ax, bx) - 20 || x > Math.max(ax, bx) + 20 || z < Math.min(az, bz) - 20 || z > Math.max(az, bz) + 20) continue;
      m = Math.min(m, distSegmento(x, z, ax, az, bx, bz));
    }
  }
  return m;
}

function fatorPantano(x, z) {
  const dp = Math.hypot(x - PANTANO.x, z - PANTANO.z) / PANTANO.r + fbm(s4, x * 0.01, z * 0.01, 2) * 0.25;
  return suave(1.0, 0.62, dp);
}

function fatorMontanha(x, z) {
  const d = Math.pow(Math.pow(Math.abs(x), 4) + Math.pow(Math.abs(z), 4), 0.25) / MUNDO.metade;
  return suave(0.74, 0.98, d + fbm(s4, x * 0.005, z * 0.005, 2) * 0.07);
}

function alturaBruta(x, z) {
  let h = fbm(s1, x * 0.0022, z * 0.0022, 5) * 24;
  h += fbm(s2, x * 0.012, z * 0.012, 3) * 2.2;
  h += (cristas(s3, x * 0.0017, z * 0.0017, 4) - 0.35) * 24;
  h += 9;
  if (h < 3) h = 3 - (3 - h) * 0.2;
  const fundo = -0.75 + fbm(s2, x * 0.03, z * 0.03, 2) * 1.5;
  h = misturar(h, fundo, fatorPantano(x, z));
  const m = fatorMontanha(x, z);
  if (m > 0) h += m * (70 + cristas(s3, x * 0.005, z * 0.005, 5) * 130);
  return h;
}

const zonas = [];

function prepararZonas() {
  for (const z of ZONAS_PLANAS) {
    zonas.push({ ...z, alvo: z.alvo ?? alturaBruta(z.x, z.z) + (z.delta || 0) });
  }
  // Garante que itens, inimigos e fogueiras do pântano não ficam em água funda.
  const pontos = [...ITENS, ...INIMIGOS, ...FOGUEIRAS];
  for (const p of pontos) {
    if (alturaBruta(p.x, p.z) < 0.3 && !zonas.some((z) => Math.hypot(z.x - p.x, z.z - p.z) < z.r)) {
      zonas.push({ x: p.x, z: p.z, r: 3.5, borda: 7, alvo: 0.35 });
    }
  }
}

function alturaFinal(x, z) {
  let h = alturaBruta(x, z);
  const dc = distCaminho(x, z);
  let wc = 0;
  if (dc < 8) {
    wc = 1 - suave(2.4, 6.5, dc);
    const media = (alturaBruta(x + 5, z) + alturaBruta(x - 5, z) + alturaBruta(x, z + 5) + alturaBruta(x, z - 5) + h) / 5;
    h = misturar(h, media - 0.12, wc * 0.85);
    if (h < 0.45) h = misturar(h, 0.45, Math.min(1, wc * 1.5));
  }
  for (const zn of zonas) {
    const d = Math.hypot(x - zn.x, z - zn.z);
    if (d < zn.r + zn.borda) {
      const t = 1 - suave(zn.r, zn.r + zn.borda, d);
      h = misturar(h, zn.alvo, t);
    }
  }
  return { h, wc };
}

function idx(i, j) {
  return j * N + i;
}

export function altura(x, z) {
  const fx = limitar((x + MUNDO.metade) / PASSO, 0, N - 1.0001);
  const fz = limitar((z + MUNDO.metade) / PASSO, 0, N - 1.0001);
  const i = Math.floor(fx);
  const j = Math.floor(fz);
  const u = fx - i;
  const v = fz - j;
  const h00 = alturas[idx(i, j)];
  const h10 = alturas[idx(i + 1, j)];
  const h01 = alturas[idx(i, j + 1)];
  const h11 = alturas[idx(i + 1, j + 1)];
  if (u + v <= 1) return h00 + (h10 - h00) * u + (h01 - h00) * v;
  return h11 + (h01 - h11) * (1 - u) + (h10 - h11) * (1 - v);
}

function amostraGrelha(arr, x, z) {
  const fx = limitar((x + MUNDO.metade) / PASSO, 0, N - 1.0001);
  const fz = limitar((z + MUNDO.metade) / PASSO, 0, N - 1.0001);
  const i = Math.floor(fx);
  const j = Math.floor(fz);
  const u = fx - i;
  const v = fz - j;
  return (arr[idx(i, j)] * (1 - u) + arr[idx(i + 1, j)] * u) * (1 - v) + (arr[idx(i, j + 1)] * (1 - u) + arr[idx(i + 1, j + 1)] * u) * v;
}

export const pesoCaminho = (x, z) => amostraGrelha(pesoCaminhoV, x, z);
export const pesoPantano = (x, z) => amostraGrelha(pesoPantanoV, x, z);
const decliveRapido = (x, z) => amostraGrelha(decliveV, x, z);
const secoRapido = (x, z) => amostraGrelha(secoV, x, z);

export function declive(x, z) {
  const e = 1.5;
  const dx = altura(x + e, z) - altura(x - e, z);
  const dz = altura(x, z + e) - altura(x, z - e);
  return 1 - (2 * e) / Math.sqrt(dx * dx + 4 * e * e + dz * dz);
}

export function regiaoEm(x, z) {
  let melhor = null;
  let md = Infinity;
  for (const r of REGIOES) {
    const d = Math.hypot(x - r.x, z - r.z) / r.r;
    if (d < 1 && d < md) {
      md = d;
      melhor = r;
    }
  }
  return melhor;
}

// ---------------------------------------------------------------- colisões

export class Colisoes {
  constructor() {
    this.celula = 16;
    this.grelha = new Map();
    this.todos = [];
  }

  chave(i, j) {
    return i * 100000 + j;
  }

  inserir(c, minX, minZ, maxX, maxZ) {
    const C = this.celula;
    for (let i = Math.floor(minX / C); i <= Math.floor(maxX / C); i++) {
      for (let j = Math.floor(minZ / C); j <= Math.floor(maxZ / C); j++) {
        const k = this.chave(i, j);
        if (!this.grelha.has(k)) this.grelha.set(k, []);
        this.grelha.get(k).push(c);
      }
    }
    this.todos.push(c);
    return c;
  }

  circulo(x, z, r, topo = 99) {
    return this.inserir({ tipo: 0, x, z, r, topo, ativo: true }, x - r, z - r, x + r, z + r);
  }

  caixa(x, z, hx, hz, ang, topo = 99) {
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    const ext = Math.abs(hx * c) + Math.abs(hz * s);
    const ext2 = Math.abs(hx * s) + Math.abs(hz * c);
    return this.inserir({ tipo: 1, x, z, hx, hz, c, s, topo, ativo: true }, x - ext, z - ext2, x + ext, z + ext2);
  }

  perto(x, z) {
    return this.grelha.get(this.chave(Math.floor(x / this.celula), Math.floor(z / this.celula))) || [];
  }

  // Empurra a posição p (Vector3) para fora dos obstáculos. Devolve true se houve contacto.
  resolver(p, raio) {
    let tocou = false;
    for (let iter = 0; iter < 2; iter++) {
      const lista = this.perto(p.x, p.z);
      for (const o of lista) {
        if (!o.ativo) continue;
        if (o.tipo === 0) {
          const dx = p.x - o.x;
          const dz = p.z - o.z;
          const d = Math.hypot(dx, dz);
          const m = o.r + raio;
          if (d < m && d > 1e-5) {
            p.x = o.x + (dx / d) * m;
            p.z = o.z + (dz / d) * m;
            tocou = true;
          }
        } else {
          const rx = p.x - o.x;
          const rz = p.z - o.z;
          const lx = rx * o.c + rz * o.s;
          const lz = -rx * o.s + rz * o.c;
          const cx = limitar(lx, -o.hx, o.hx);
          const cz = limitar(lz, -o.hz, o.hz);
          let dx = lx - cx;
          let dz = lz - cz;
          const d = Math.hypot(dx, dz);
          let nx, nz;
          if (d > 1e-5) {
            if (d >= raio) continue;
            nx = cx + (dx / d) * raio;
            nz = cz + (dz / d) * raio;
          } else {
            // dentro da caixa: sai pelo lado mais próximo
            const px = o.hx - Math.abs(lx);
            const pz = o.hz - Math.abs(lz);
            if (px < pz) {
              nx = Math.sign(lx || 1) * (o.hx + raio);
              nz = lz;
            } else {
              nx = lx;
              nz = Math.sign(lz || 1) * (o.hz + raio);
            }
          }
          p.x = o.x + nx * o.c - nz * o.s;
          p.z = o.z + nx * o.s + nz * o.c;
          tocou = true;
        }
      }
    }
    return tocou;
  }

  // Verifica se um ponto 3D está dentro de algum obstáculo (usado pela câmara).
  pontoDentro(x, y, z, margem = 0.25) {
    for (const o of this.perto(x, z)) {
      if (!o.ativo || o.semCamara || y > o.topo) continue;
      if (o.tipo === 0) {
        if (Math.hypot(x - o.x, z - o.z) < o.r + margem) return true;
      } else {
        const rx = x - o.x;
        const rz = z - o.z;
        const lx = rx * o.c + rz * o.s;
        const lz = -rx * o.s + rz * o.c;
        if (Math.abs(lx) < o.hx + margem && Math.abs(lz) < o.hz + margem) return true;
      }
    }
    return false;
  }
}

// ---------------------------------------------------------------- utilitários de geometria

function naoIndexada(g) {
  const r = g.index ? g.toNonIndexed() : g;
  if (!r.attributes.uv) r.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(r.attributes.position.count * 2), 2));
  return r;
}

// UVs por projeção em caixa, em coordenadas do mundo (a textura não estica com o tamanho das peças).
function uvCaixa(g, escala) {
  const p = g.attributes.position;
  const n = g.attributes.normal;
  const uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i));
    const ay = Math.abs(n.getY(i));
    const az = Math.abs(n.getZ(i));
    let u, v;
    if (ax >= ay && ax >= az) {
      u = p.getZ(i); v = p.getY(i);
    } else if (ay >= az) {
      u = p.getX(i); v = p.getZ(i);
    } else {
      u = p.getX(i); v = p.getY(i);
    }
    uv.setXY(i, u * escala, v * escala);
  }
  uv.needsUpdate = true;
}

function blob(raio, detalhe, semente, irregular = 0.25, achatar = 1) {
  const rs = criarSimplex(semente);
  let g = new THREE.IcosahedronGeometry(raio, detalhe);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVerticesSimples(g);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const d = v.clone().normalize();
    const n = rs(d.x * 1.7 + d.z * 0.3, d.y * 1.7 + d.x * 0.5) * 0.6 + rs(d.z * 4, d.y * 4 + d.x) * 0.4;
    v.multiplyScalar(1 + n * irregular);
    v.y *= achatar;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

// Funde vértices com a mesma posição (versão simples, só para posição).
function mergeVerticesSimples(g) {
  const p = g.attributes.position;
  const mapa = new Map();
  const novas = [];
  const indices = [];
  for (let i = 0; i < p.count; i++) {
    const k = `${p.getX(i).toFixed(4)},${p.getY(i).toFixed(4)},${p.getZ(i).toFixed(4)}`;
    let id = mapa.get(k);
    if (id === undefined) {
      id = novas.length / 3;
      novas.push(p.getX(i), p.getY(i), p.getZ(i));
      mapa.set(k, id);
    }
    indices.push(id);
  }
  const r = new THREE.BufferGeometry();
  r.setAttribute('position', new THREE.Float32BufferAttribute(novas, 3));
  r.setIndex(indices);
  return r;
}

// ---------------------------------------------------------------- classe principal

export class Mundo {
  constructor(cena, renderer, tex, qualidade) {
    this.cena = cena;
    this.renderer = renderer;
    this.tex = tex;
    this.qualidade = qualidade;
    this.colisoes = new Colisoes();
    this.fogueiras = [];
    this.tempo = 0;
    this.lotes = {};
    this.excluir = []; // zonas onde não nasce vegetação
    this.portaNevoeiro = null;
    this.distDetalhe = 1; // multiplicador da distância de detalhe (Opções)
  }

  // Quanto maior, mais longe se mantém a qualidade alta (árvores detalhadas, vegetação, sombras).
  definirDistanciaDetalhe(mult) {
    this.distDetalhe = mult;
    if (this.uPerto) {
      this.raioArvores = this.raioArvoresBase * mult;
      this.uPerto.value.z = this.raioArvores;
      this.centroArvores.set(1e9, 1e9); // força nova escolha das árvores detalhadas
    }
  }

  // ---------- terreno ----------
  gerarTerreno() {
    prepararZonas();
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const x = -MUNDO.metade + i * PASSO;
        const z = -MUNDO.metade + j * PASSO;
        const { h, wc } = alturaFinal(x, z);
        alturas[idx(i, j)] = h;
        pesoCaminhoV[idx(i, j)] = wc;
        pesoPantanoV[idx(i, j)] = fatorPantano(x, z);
      }
    }

    const pos = new Float32Array(N * N * 3);
    const peso = new Float32Array(N * N * 2);
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const k = idx(i, j);
        pos[k * 3] = -MUNDO.metade + i * PASSO;
        pos[k * 3 + 1] = alturas[k];
        pos[k * 3 + 2] = -MUNDO.metade + j * PASSO;
        peso[k * 2] = pesoCaminhoV[k];
        peso[k * 2 + 1] = pesoPantanoV[k];
      }
    }
    const ind = new Uint32Array((N - 1) * (N - 1) * 6);
    let t = 0;
    for (let j = 0; j < N - 1; j++) {
      for (let i = 0; i < N - 1; i++) {
        const a = idx(i, j), b = idx(i, j + 1), c = idx(i + 1, j), d = idx(i + 1, j + 1);
        ind[t++] = a; ind[t++] = b; ind[t++] = c;
        ind[t++] = c; ind[t++] = b; ind[t++] = d;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aPeso', new THREE.BufferAttribute(peso, 2));
    g.setIndex(new THREE.BufferAttribute(ind, 1));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    const nrm = g.attributes.normal;
    for (let k = 0; k < N * N; k++) {
      decliveV[k] = 1 - nrm.getY(k);
      secoV[k] = fbm(s4, pos[k * 3] * 0.02, pos[k * 3 + 2] * 0.02, 2);
    }

    const tex = this.tex;
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0 });
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, {
        tRelva: { value: tex.relva }, tTerra: { value: tex.terra }, tRocha: { value: tex.rocha }, tLama: { value: tex.lama },
        tRelvaN: { value: tex.relvaN }, tTerraN: { value: tex.terraN }, tRochaN: { value: tex.rochaN },
      });
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
          attribute vec2 aPeso; varying vec2 vPeso; varying vec3 vPosM; varying vec3 vNorM;`)
        .replace('#include <fog_vertex>', `#include <fog_vertex>
          vPeso = aPeso; vPosM = (modelMatrix * vec4(position, 1.0)).xyz; vNorM = normalize(mat3(modelMatrix) * normal);`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          uniform sampler2D tRelva, tTerra, tRocha, tLama, tRelvaN, tTerraN, tRochaN;
          varying vec2 vPeso; varying vec3 vPosM; varying vec3 vNorM;
          float wR, wT, wL, wN;
          vec3 triRocha(vec3 p, vec3 n, float esc) {
            vec3 b = pow(abs(n), vec3(4.0)); b /= (b.x + b.y + b.z);
            return texture2D(tRocha, p.zy * esc).rgb * b.x + texture2D(tRocha, p.xz * esc).rgb * b.y + texture2D(tRocha, p.xy * esc).rgb * b.z;
          }`)
        .replace('#include <map_fragment>', `
          vec3 nM = normalize(vNorM);
          vec2 uvA = vPosM.xz * 0.28;
          // um único mapa de variação grande (antes eram dois)
          vec4 macroT = texture2D(tRocha, vPosM.xz * 0.0045);
          float macro = macroT.r;
          float macro2 = texture2D(tRelva, vPosM.xz * 0.011).g;
          vec3 cRelva = texture2D(tRelva, uvA).rgb * (0.65 + 1.4 * texture2D(tRelva, vPosM.xz * 0.037).g) * (0.75 + 0.6 * macro);
          vec3 seca = vec3(0.32, 0.27, 0.16);
          cRelva = mix(cRelva, cRelva * seca * 4.0, smoothstep(0.35, 0.55, macro2) * 0.6);
          float decl = 1.0 - nM.y;
          wR = smoothstep(0.2, 0.36, decl + (macro - 0.5) * 0.12);
          wT = smoothstep(0.1, 0.8, vPeso.x + (macro2 - 0.5) * 0.3);
          wL = vPeso.y * smoothstep(3.5, 0.5, vPosM.y);
          vec3 c = cRelva;
          // só se lê a textura quando o peso é relevante (poupa leituras na maior parte do ecrã)
          if (wL > 0.01) c = mix(c, texture2D(tLama, uvA * 0.7).rgb, wL);
          if (wT > 0.01) c = mix(c, texture2D(tTerra, uvA * 0.8).rgb * (0.85 + 0.3 * macro), wT);
          if (wR > 0.01) {
          #ifdef TERRENO_ALTA
            vec3 cRocha = triRocha(vPosM, nM, 0.12);
          #else
            vec3 cRocha = texture2D(tRocha, (abs(nM.x) > abs(nM.z) ? vPosM.zy : vPosM.xy) * 0.12).rgb;
          #endif
            // estratos da rocha e tons quentes/frios; o alto das montanhas é mais escuro e frio
            float estrato = sin(vPosM.y * 0.32 + macro * 14.0 + vPosM.x * 0.013 + vPosM.z * 0.009) * 0.5 + 0.5;
            cRocha *= mix(vec3(0.84, 0.8, 0.75), vec3(1.0, 0.96, 0.9), estrato);
            cRocha *= mix(vec3(1.0), vec3(0.74, 0.76, 0.8), smoothstep(30.0, 130.0, vPosM.y));
            cRocha *= 0.62 + 0.5 * macro;
            c = mix(c, cRocha, wR);
          }
          float neve = smoothstep(85.0, 125.0, vPosM.y + macro * 30.0) * smoothstep(0.55, 0.82, nM.y + macro * 0.15);
          c = mix(c, vec3(0.82, 0.84, 0.88) * (0.9 + 0.15 * macro), neve);
          float molhado = smoothstep(0.6, -0.2, vPosM.y);
          c *= 1.0 - molhado * 0.45;
          diffuseColor.rgb *= c;
          wN = 1.0 - wR;`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
          roughnessFactor = mix(roughnessFactor, 0.35, molhado * 0.8);`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          #ifdef TERRENO_NORMAIS
          {
            vec3 tn;
            if (wR > 0.5) tn = texture2D(tRochaN, (abs(nM.x) > abs(nM.z) ? vPosM.zy : vPosM.xy) * 0.12).xyz * 2.0 - 1.0;
            else if (wT > 0.5) tn = texture2D(tTerraN, uvA * 0.8).xyz * 2.0 - 1.0;
            else tn = texture2D(tRelvaN, uvA).xyz * 2.0 - 1.0;
            tn.xy *= 0.9;
            vec3 T = normalize(vec3(1.0, 0.0, 0.0) - nM * nM.x);
            vec3 B = normalize(vec3(0.0, 0.0, 1.0) - nM * nM.z);
            vec3 nW = normalize(T * tn.x + B * tn.y + nM * tn.z);
            normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);
          }
          #endif`);
    };
    if (this.qualidade === 'alta') mat.defines = { TERRENO_ALTA: '', TERRENO_NORMAIS: '' };
    else if (this.qualidade === 'media') mat.defines = { TERRENO_NORMAIS: '' };
    const terreno = new THREE.Mesh(g, mat);
    terreno.receiveShadow = true;
    this.cena.add(terreno);
    this.terreno = terreno;
  }

  // ---------- céu, luz e nevoeiro ----------
  gerarCeu() {
    const { Sky } = THREE;
    const ceu = new Sky();
    ceu.scale.setScalar(20000);
    const u = ceu.material.uniforms;
    u.turbidity.value = 5;
    u.rayleigh.value = 1.5;
    u.mieCoefficient.value = 0.0045;
    u.mieDirectionalG.value = 0.82;
    // comprime os realces do céu para o sol não ofuscar o ecrã inteiro
    const suavizarCeu = (m) => {
      m.fragmentShader = m.fragmentShader.replace('gl_FragColor = vec4( texColor, 1.0 );',
        'float lumC = max(max(texColor.r, texColor.g), texColor.b); gl_FragColor = vec4( texColor / (1.0 + lumC * 0.12), 1.0 );');
    };
    suavizarCeu(ceu.material);
    const elev = THREE.MathUtils.degToRad(15);
    const azim = THREE.MathUtils.degToRad(-42);
    this.dirSol = new THREE.Vector3().setFromSphericalCoords(1, Math.PI / 2 - elev, azim);
    u.sunPosition.value.copy(this.dirSol);
    // o céu não é desenhado diretamente: é pré-renderizado abaixo para um cubo (muito mais barato)

    // Mapa de ambiente a partir do céu (reflexos e luz indireta realistas).
    const pm = new THREE.PMREMGenerator(this.renderer);
    const cenaCeu = new THREE.Scene();
    const ceu2 = new Sky();
    suavizarCeu(ceu2.material);
    ceu2.scale.setScalar(1000);
    Object.assign(ceu2.material.uniforms.sunPosition.value, this.dirSol);
    for (const k of ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG']) ceu2.material.uniforms[k].value = u[k].value;
    cenaCeu.add(ceu2);
    const env = pm.fromScene(cenaCeu, 0.02).texture;
    this.envMapa = env;
    // a iluminação indireta por mapa de ambiente é cara em cada píxel: só na qualidade alta.
    // Nas outras, uma luz hemisférica mais forte faz esse papel e só os metais usam o mapa (ver principal.js).
    if (this.qualidade === 'alta') {
      this.cena.environment = env;
      this.cena.environmentIntensity = 0.55;
    }
    pm.dispose();
    const rtCeu = new THREE.WebGLCubeRenderTarget(this.qualidade === 'alta' ? 1024 : 512, { type: THREE.HalfFloatType, generateMipmaps: false });
    const camCubo = new THREE.CubeCamera(1, 5000, rtCeu);
    camCubo.update(this.renderer, cenaCeu);
    this.cena.background = rtCeu.texture;

    this.cena.fog = new THREE.FogExp2(0x8b8478, 0.0029);
    this.corNevoeiroBase = new THREE.Color(0x8b8478);

    const sol = new THREE.DirectionalLight(0xffd2a0, 3.2);
    sol.position.copy(this.dirSol).multiplyScalar(200);
    const sombras = this.qualidade !== 'baixa';
    sol.castShadow = sombras;
    if (sombras) {
      const tam = this.qualidade === 'alta' ? 2048 : 1024;
      sol.shadow.mapSize.set(tam, tam);
      const c = sol.shadow.camera;
      const ext = this.qualidade === 'alta' ? 55 : 42;
      c.left = -ext; c.right = ext; c.top = ext; c.bottom = -ext; c.near = 10; c.far = 420;
      sol.shadow.bias = -0.0004;
      sol.shadow.normalBias = 0.04;
    }
    this.cena.add(sol);
    this.cena.add(sol.target);
    this.sol = sol;

    const hemi = new THREE.HemisphereLight(0x9aa6b8, 0x40362a, this.qualidade === 'alta' ? 0.35 : 1.25);
    this.cena.add(hemi);

    // A Árvore Áurea: marco gigante no horizonte, a norte.
    const arv = new THREE.Group();
    const matTronco = new THREE.MeshBasicMaterial({ color: 0x7a6034, fog: false, transparent: true, opacity: 0.45, depthWrite: false });
    const matCopa = new THREE.MeshBasicMaterial({ color: 0xb88a3a, fog: false, transparent: true, opacity: 0.42, depthWrite: false });
    const cima = new THREE.Vector3(0, 1, 0);
    const rr = aleatorio(9);
    const tronco = new THREE.Mesh(new THREE.CylinderGeometry(22, 60, 950, 10, 1, true), matTronco);
    tronco.position.y = 380;
    arv.add(tronco);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + rr();
      const dir = new THREE.Vector3(Math.cos(a) * 0.8, 0.7 + rr() * 0.3, Math.sin(a) * 0.35).normalize();
      const len = 380 + rr() * 220;
      const g = new THREE.CylinderGeometry(5, 16, len, 6, 1, true);
      g.translate(0, len / 2, 0);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(cima, dir));
      g.translate(0, 700 + rr() * 150, 0);
      arv.add(new THREE.Mesh(g, matTronco));
    }
    for (let i = 0; i < 34; i++) {
      const m = new THREE.Mesh(blob(110 + rr() * 120, 1, 900 + i, 0.35, 0.55), matCopa);
      const a = rr() * Math.PI * 2;
      const d = Math.sqrt(rr()) * 520;
      m.position.set(Math.cos(a) * d, 1000 + rr() * 300 - d * 0.45, Math.sin(a) * d * 0.4);
      arv.add(m);
    }
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex.brilho, color: 0xffb040, fog: false, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.set(2600, 1700, 1);
    halo.position.y = 1000;
    arv.add(halo);
    arv.position.set(-260, -80, -3600);
    arv.traverse((o) => { o.renderOrder = -1; });
    this.cena.add(arv);
    this.arvoreAurea = arv;
  }

  atualizarSombras(foco) {
    if (!this.sol.castShadow) return;
    const c = this.sol.shadow.camera;
    const texel = (c.right - c.left) / this.sol.shadow.mapSize.x;
    const x = Math.round(foco.x / texel) * texel;
    const z = Math.round(foco.z / texel) * texel;
    this.sol.target.position.set(x, foco.y, z);
    this.sol.position.set(x, foco.y, z).addScaledVector(this.dirSol, 200);
  }

  // ---------- água ----------
  gerarAgua() {
    const g = new THREE.PlaneGeometry(MUNDO.tam, MUNDO.tam, 1, 1);
    g.rotateX(-Math.PI / 2);
    const nm = this.tex.aguaN;
    nm.repeat.set(110, 110);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x1f2a22, roughness: 0.06, metalness: 0.15, normalMap: nm, normalScale: new THREE.Vector2(0.35, 0.35),
      transparent: true, opacity: 0.86,
    });
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vXZ;')
        .replace('#include <fog_vertex>', '#include <fog_vertex>\nvXZ = (modelMatrix * vec4(position, 1.0)).xz;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vXZ;')
        .replace('#include <color_fragment>', `#include <color_fragment>
          float pant = smoothstep(1.0, 0.65, distance(vXZ, vec2(${PANTANO.x.toFixed(1)}, ${PANTANO.z.toFixed(1)})) / ${PANTANO.r.toFixed(1)});
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.10, 0.11, 0.05), pant);
          diffuseColor.a = mix(diffuseColor.a, 0.97, pant);`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
          roughnessFactor = mix(roughnessFactor, 0.6, pant);`)
        .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
          metalnessFactor = mix(metalnessFactor, 0.0, pant);`);
    };
    const agua = new THREE.Mesh(g, mat);
    agua.position.set(0, 0, 0);
    agua.receiveShadow = true;
    this.cena.add(agua);
    this.agua = agua;
  }

  // ---------- lotes de geometria estática ----------
  lote(nome) {
    if (!this.lotes[nome]) this.lotes[nome] = [];
    return this.lotes[nome];
  }

  caixa(lote, x, y, z, sx, sy, sz, ry = 0, rx = 0, rz = 0) {
    const g = naoIndexada(new THREE.BoxGeometry(sx, sy, sz));
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')),
      new THREE.Vector3(1, 1, 1),
    );
    g.applyMatrix4(m);
    this.lote(lote).push(g);
  }

  cilindro(lote, x, y, z, rt, rb, h, seg = 10, ry = 0, rx = 0, rz = 0) {
    const g = naoIndexada(new THREE.CylinderGeometry(rt, rb, h, seg, 1));
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')),
      new THREE.Vector3(1, 1, 1),
    );
    g.applyMatrix4(m);
    this.lote(lote).push(g);
  }

  // Muro de pedra entre dois pontos; "ruina" dá alturas irregulares e falhas.
  muro(x1, z1, x2, z2, alt, esp, { ruina = 0, ameias = false, semente = 1, colidir = true } = {}) {
    const rnd = aleatorio(semente);
    const dx = x2 - x1, dz = z2 - z1;
    const L = Math.hypot(dx, dz);
    const ang = Math.atan2(dx, dz);
    const n = Math.max(1, Math.round(L / 2.2));
    const larg = L / n;
    let colIni = null;
    const fecharColisor = (fim) => {
      if (colIni === null || !colidir) return;
      const t0 = colIni / n, t1 = fim / n;
      const cx = x1 + dx * (t0 + t1) / 2;
      const cz = z1 + dz * (t0 + t1) / 2;
      const hz = (L * (t1 - t0)) / 2;
      this.colisoes.caixa(cx, cz, esp / 2, hz, -ang, altura(cx, cz) + alt);
      colIni = null;
    };
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const x = x1 + dx * t;
      const z = z1 + dz * t;
      const base = altura(x, z) - 1.2;
      let a = alt;
      if (ruina > 0) {
        const r = s5(x * 0.15, z * 0.15) * 0.5 + 0.5;
        a = alt * (1 - ruina * (0.25 + 0.75 * r * r)) + rnd() * 0.6;
        if (r > 0.82 && ruina > 0.5) {
          fecharColisor(i);
          continue; // falha no muro
        }
      }
      if (colIni === null) colIni = i;
      this.caixa('pedra', x, base + (a + 1.2) / 2, z, esp, a + 1.2, larg + 0.04, ang);
      if (ameias && i % 2 === 0) this.caixa('pedra', x, base + a + 1.2 + 0.55, z, esp * 1.02, 1.1, larg * 0.6, ang);
      // pedras caídas junto à base
      if (ruina > 0 && rnd() < 0.3) {
        const lado = rnd() < 0.5 ? -1 : 1;
        this.caixa('pedra', x + Math.cos(ang) * lado * (esp + 0.6), altura(x, z) + 0.2, z - Math.sin(ang) * lado * (esp + 0.6),
          0.6 + rnd() * 0.6, 0.5, 0.7 + rnd() * 0.5, rnd() * 3, rnd() * 0.4, rnd() * 0.4);
      }
    }
    fecharColisor(n);
  }

  pilar(x, z, r, alt, partido = false, semente = 1) {
    const rnd = aleatorio(semente);
    const base = altura(x, z);
    const a = partido ? alt * (0.3 + rnd() * 0.6) : alt;
    this.caixa('pedra', x, base + 0.3, z, r * 2.6, 0.6, r * 2.6);
    this.cilindro('pedra', x, base + 0.6 + a / 2, z, r * 0.92, r, a, 12);
    if (!partido) this.caixa('pedra', x, base + 0.6 + a + 0.25, z, r * 2.5, 0.5, r * 2.5);
    else if (rnd() < 0.7) {
      // tambor caído
      const ang = rnd() * Math.PI * 2;
      const d = 1.5 + rnd() * 2;
      this.cilindro('pedra', x + Math.cos(ang) * d, base + r * 0.9, z + Math.sin(ang) * d, r * 0.9, r * 0.9, 1.6 + rnd(), 12, ang, 0, Math.PI / 2);
    }
    this.colisoes.circulo(x, z, r * 1.1, base + 0.6 + a);
  }

  casaRuina(x, z, larg, comp, ang, semente) {
    const c = Math.cos(ang), s = Math.sin(ang);
    const P = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
    const hl = larg / 2, hc = comp / 2;
    const cantos = [P(-hl, -hc), P(hl, -hc), P(hl, hc), P(-hl, hc)];
    const alt = 4.5;
    // parede da frente com porta
    const porta = 1.4;
    const pf1 = P(-hl, hc), pf2 = P(-porta, hc), pf3 = P(porta, hc), pf4 = P(hl, hc);
    this.muro(pf1[0], pf1[1], pf2[0], pf2[1], alt, 0.7, { ruina: 0.5, semente });
    this.muro(pf3[0], pf3[1], pf4[0], pf4[1], alt, 0.7, { ruina: 0.5, semente: semente + 1 });
    this.muro(cantos[0][0], cantos[0][1], cantos[1][0], cantos[1][1], alt, 0.7, { ruina: 0.6, semente: semente + 2 });
    this.muro(cantos[1][0], cantos[1][1], cantos[2][0], cantos[2][1], alt, 0.7, { ruina: 0.7, semente: semente + 3 });
    this.muro(cantos[3][0], cantos[3][1], cantos[0][0], cantos[0][1], alt, 0.7, { ruina: 0.7, semente: semente + 4 });
    // vigas caídas
    const rnd = aleatorio(semente * 7);
    for (let i = 0; i < 3; i++) {
      const [vx, vz] = P((rnd() - 0.5) * larg * 0.7, (rnd() - 0.5) * comp * 0.7);
      this.caixa('madeira', vx, altura(vx, vz) + 0.5 + rnd() * 0.6, vz, 0.25, 0.25, 4 + rnd() * 2, ang + rnd() - 0.5, 0.2 + rnd() * 0.3, rnd() * 0.3);
    }
    this.excluir.push({ x, z, r: Math.max(larg, comp) * 0.75 });
  }

  torreRuina(x, z, r, alt, semente) {
    const n = 14;
    const rnd = aleatorio(semente);
    for (let i = 0; i < n; i++) {
      if (i === 0) continue; // entrada
      const a0 = (i / n) * Math.PI * 2;
      const a1 = ((i + 1) / n) * Math.PI * 2;
      const x0 = x + Math.cos(a0) * r, z0 = z + Math.sin(a0) * r;
      const x1 = x + Math.cos(a1) * r, z1 = z + Math.sin(a1) * r;
      const h = alt * (0.35 + 0.65 * Math.abs(Math.sin(i * 0.9 + semente))) + rnd();
      this.muro(x0, z0, x1, z1, h, 1.1, { semente: semente + i });
    }
    this.excluir.push({ x, z, r: r + 4 });
  }

  // ---------- locais ----------
  gerarEstruturas() {
    // Cemitério
    {
      const cx = -440, cz = 430;
      const rnd = aleatorio(77);
      for (let i = 0; i < 70; i++) {
        const x = cx - 26 + rnd() * 52;
        const z = cz - 24 + rnd() * 48;
        if (Math.hypot(x - (-418), z - 398) < 6) continue;
        if (x < -455 && z < 450 && z > 425) continue; // capela
        if (Math.hypot(x - (-445), z - 430) < 3.5) continue; // sítio onde o jogador desperta
        if (Math.hypot(x - (-452), z - 409) < 4) continue; // estátua
        const h = altura(x, z);
        const ang = (rnd() - 0.5) * 0.4;
        this.colisoes.circulo(x, z, 0.32, h + 1.2);
        if (rnd() < 0.25) {
          this.caixa('pedraEscura', x, h + 0.6, z, 0.16, 1.4, 0.16, ang, (rnd() - 0.5) * 0.3, (rnd() - 0.5) * 0.3);
          this.caixa('pedraEscura', x, h + 0.95, z, 0.7, 0.14, 0.15, ang, 0, 0);
        } else {
          this.caixa('pedraEscura', x, h + 0.35, z, 0.65, 0.9 + rnd() * 0.4, 0.18, ang, (rnd() - 0.5) * 0.35, (rnd() - 0.5) * 0.3);
        }
      }
      // capela em ruínas
      this.casaRuina(-468, 438, 10, 16, 0.2, 31);
      this.pilar(-462, 422, 0.5, 6, true, 5);
      this.pilar(-474, 424, 0.5, 6, true, 6);
      // muro baixo do cemitério
      this.muro(-475, 402, -431, 402, 1.6, 0.6, { ruina: 0.6, semente: 41 });
      this.muro(-475, 465, -405, 465, 1.6, 0.6, { ruina: 0.6, semente: 42 });
      this.muro(-405, 465, -405, 412, 1.6, 0.6, { ruina: 0.6, semente: 43 });
      this.excluir.push({ x: cx, z: cz, r: 40 });
    }

    // Torre de vigia da planície
    this.torreRuina(-40, 60, 5, 14, 3);
    this.pilar(-30, 75, 0.6, 7, true, 8);
    this.pilar(-55, 70, 0.6, 7, true, 9);
    // Arco da encruzilhada
    this.pilar(4, 96, 0.7, 7, false, 10);
    this.pilar(24, 96, 0.7, 7, false, 11);
    this.caixa('pedra', 14, altura(14, 96) + 8.2, 96, 22, 1.2, 1.6);

    // Ilhota do pântano
    this.muro(402, 293, 412, 290, 3.5, 0.8, { ruina: 0.4, semente: 51 });
    this.muro(412, 290, 416, 300, 3, 0.8, { ruina: 0.5, semente: 52 });
    this.pilar(404, 308, 0.5, 5, true, 12);

    // Ruínas de Aldermoor
    {
      const casas = [
        [-215, -265, 8, 10, 0.3], [-235, -245, 7, 9, -0.2], [-285, -265, 9, 12, 0.5], [-300, -300, 8, 8, 0.1],
        [-215, -305, 7, 10, 1.2], [-230, -365, 10, 8, 0.4], [-295, -350, 8, 10, -0.4], [-265, -240, 6, 8, 0.9],
      ];
      casas.forEach(([x, z, l, c, a], i) => this.casaRuina(x, z, l, c, a, 100 + i * 10));
      // praça (arena da fera)
      const { x: ax, z: az, r: ar } = ARENA_LOBO;
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        this.pilar(ax + Math.cos(a) * ar, az + Math.sin(a) * ar, 0.8, 9, i % 3 !== 0, 200 + i);
      }
      const chao = new THREE.CircleGeometry(ar - 2, 40);
      chao.rotateX(-Math.PI / 2);
      this.chaoPraca = { x: ax, z: az, geo: chao };
      this.excluir.push({ x: ax, z: az, r: ar + 3 });
      // muralha exterior partida
      const pts = [[-320, -230], [-300, -205], [-225, -200], [-170, -240], [-165, -330], [-200, -390], [-290, -395], [-330, -330], [-320, -230]];
      for (let i = 0; i < pts.length - 1; i++) {
        this.muro(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 6, 1.6, { ruina: 0.75, semente: 300 + i });
      }
    }

    // Fortaleza do Rei Caído
    {
      const { x: fx, z: fz, metade: m, alturaMuro: am } = FORTALEZA;
      const porta = 5;
      const o = { ameias: true, semente: 500 };
      this.muro(fx - m, fz - m, fx + m, fz - m, am, 2.6, { ...o, semente: 501 });
      this.muro(fx + m, fz - m, fx + m, fz + m, am, 2.6, { ...o, semente: 502 });
      this.muro(fx - m, fz + m, fx - m, fz - m, am, 2.6, { ...o, semente: 503 });
      this.muro(fx - m, fz + m, fx - porta, fz + m, am, 2.6, { ...o, semente: 504 });
      this.muro(fx + porta, fz + m, fx + m, fz + m, am, 2.6, { ...o, semente: 505 });
      // torres nos cantos
      for (const [tx, tz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const x = fx + tx * m, z = fz + tz * m;
        const b = altura(x, z) - 2;
        this.cilindro('pedra', x, b + 10, z, 5, 5.6, 20, 16);
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          this.caixa('pedra', x + Math.cos(a) * 4.6, b + 20.6, z + Math.sin(a) * 4.6, 1.6, 1.4, 1.2, -a);
        }
        this.colisoes.circulo(x, z, 5.6, b + 21);
      }
      // portal
      const gz = fz + m;
      const gb = altura(fx, gz);
      for (const lado of [-1, 1]) {
        this.caixa('pedra', fx + lado * (porta + 0.6), gb + 7, gz, 2.4, 16, 4);
        this.colisoes.caixa(fx + lado * (porta + 0.6), gz, 1.2, 2, 0, gb + 15);
      }
      this.caixa('pedra', fx, gb + 13.5, gz, porta * 2 + 4, 3, 4);
      // pilares do pátio e trono
      for (let i = 0; i < 6; i++) {
        const lado = i % 2 ? 1 : -1;
        this.pilar(fx + lado * 22, fz - 22 + Math.floor(i / 2) * 18, 1, 10, i === 3, 600 + i);
      }
      const tb = altura(fx, fz - m + 6);
      this.caixa('pedraEscura', fx, tb + 0.6, fz - m + 6, 12, 1.2, 6);
      this.caixa('pedraEscura', fx, tb + 1.5, fz - m + 4.5, 3, 1.2, 2);
      this.caixa('pedraEscura', fx, tb + 3.6, fz - m + 3.8, 3, 4.4, 0.6);
      this.colisoes.caixa(fx, fz - m + 6, 6, 3, 0, tb + 1.2);
      // estandartes
      for (const lado of [-1, 1]) {
        this.caixa('tecidoVermelho', fx + lado * 10, gb + 6, fz - m + 1.45, 2.2, 7, 0.08);
      }
      this.excluir.push({ x: fx, z: fz, r: m * 1.6 });
      this.excluir.push({ x: fx, z: fz + m + 12, r: 14 });

      // Porta de nevoeiro
      const geo = new THREE.PlaneGeometry(porta * 2, 10, 1, 1);
      const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
        uniforms: { uTempo: { value: 0 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: `uniform float uTempo; varying vec2 vUv;
          float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
          float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
            return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
          void main(){
            vec2 p = vUv * vec2(4.0, 5.0);
            float v = n(p + vec2(uTempo*0.3, -uTempo*0.5)) * 0.5 + n(p*2.1 - vec2(uTempo*0.2, uTempo*0.8)) * 0.35 + n(p*4.3 + uTempo) * 0.15;
            float borda = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x) * smoothstep(1.0, 0.75, vUv.y);
            gl_FragColor = vec4(vec3(0.9, 0.85, 0.7) * v * 0.9, 1.0) * borda;
          }`,
      });
      const nev = new THREE.Mesh(geo, mat);
      nev.position.set(fx, gb + 5, gz);
      this.cena.add(nev);
      const col = this.colisoes.caixa(fx, gz, porta, 0.6, 0, gb + 12);
      col.semCamara = true;
      this.portaNevoeiro = { mesh: nev, colisor: col, x: fx, z: gz, ativa: true };
    }

    this.gerarMarcos();
    this.construirLotes();
  }

  // Estátua de pedra a partir do modelo de uma personagem, numa pose fixa (uma só malha).
  estatua(estilo, x, z, escala, rot, { anim = null, t = 0, mat, base = 0, arma = 0 } = {}) {
    const todos = new Proxy({}, { get: () => mat });
    const rig = criarHumanoide(estilo, todos);
    if (rig.frasco) rig.frasco.parent.remove(rig.frasco);
    const a = new Animador(rig);
    if (anim) a.tocar(anim, 1.6, { manter: true });
    for (let i = 0; i < 40; i++) a.atualizar(t / 40 || 1 / 30, 0, {});
    if (arma) rig.arma.rotation.x = arma;
    rig.raiz.updateMatrixWorld(true);
    const geos = [];
    rig.raiz.traverse((o) => {
      if (!o.isMesh || !o.visible) return;
      let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      g.clearGroups();
      g.applyMatrix4(o.matrixWorld);
      geos.push(g);
    });
    const geo = THREE.mergeGeometries(geos, false);
    // UVs em caixa para a textura de pedra não ficar esticada
    uvCaixa(geo, 1.2);
    const m = new THREE.Mesh(geo, mat);
    const y = altura(x, z) + base;
    m.position.set(x, y, z);
    m.scale.setScalar(escala);
    m.rotation.y = rot;
    m.castShadow = true;
    m.receiveShadow = true;
    this.cena.add(m);
    return m;
  }

  // Marcos: estátuas, círculo de pedras, lanternas nos caminhos, carroças, forca, cripta, atalaia e torre de menagem.
  gerarMarcos() {
    const t = this.tex;
    const matEstatua = new THREE.MeshStandardMaterial({ map: t.rocha, normalMap: t.rochaN, color: 0x9c978c, roughness: 0.95 });
    const rnd = aleatorio(909);
    const plinto = (x, z, l, alt, rot = 0) => {
      const h = altura(x, z);
      this.caixa('pedra', x, h + alt / 2 - 0.4, z, l, alt + 0.8, l, rot);
      this.caixa('pedra', x, h + alt + 0.1, z, l * 0.86, 0.3, l * 0.86, rot);
      this.colisoes.caixa(x, z, l / 2, l / 2, -rot, h + alt);
      return h + alt + 0.25 - h;
    };

    // Cavaleiro ajoelhado gigante na planície, de espada cravada no chão, a olhar a encruzilhada
    {
      const x = -95, z = 15;
      const rot = Math.atan2(14 - x, 112 - z);
      const b = plinto(x, z, 12, 1.6, rot);
      this.estatua('cavaleiro', x, z, 9, rot, { anim: 'acender', t: 0.9, mat: matEstatua, base: b, arma: Math.PI * 0.5 });
      this.colisoes.circulo(x, z, 6.5, altura(x, z) + 14);
      this.excluir.push({ x, z, r: 11 });
    }
    // Peregrino a rezar no cemitério
    {
      const x = -452, z = 409;
      const b = plinto(x, z, 2.2, 0.8, 0.3);
      this.estatua('esvaziado', x, z, 1.9, 0.3 + Math.PI, { anim: 'sentado', t: 1, mat: matEstatua, base: b });
    }
    // Dois guardiões de pedra à entrada da fortaleza
    {
      const { x: fx, z: fz, metade: m } = FORTALEZA;
      for (const lado of [-1, 1]) {
        const x = fx + lado * 15, z = fz + m + 10;
        const b = plinto(x, z, 4, 2.2);
        this.estatua('cavaleiro', x, z, 4.2, 0, { mat: matEstatua, base: b });
      }
    }

    // Círculo de pedras numa colina, com altar ao centro
    {
      const cx = 60, cz = 300, r = 11;
      for (let i = 0; i < 11; i++) {
        const a = (i / 11) * Math.PI * 2;
        const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
        const h = altura(x, z);
        const alt = 3.5 + rnd() * 2.5;
        if (i === 4) {
          this.caixa('pedraEscura', x, h + 0.4, z, 1.2, 0.8, 3.6, -a, Math.PI / 2 - 0.2, 0.1); // pedra tombada
          continue;
        }
        this.caixa('pedraEscura', x, h + alt / 2 - 0.5, z, 1.3 + rnd() * 0.4, alt, 0.8 + rnd() * 0.3, -a + Math.PI / 2, (rnd() - 0.5) * 0.12, (rnd() - 0.5) * 0.12);
        if (i % 3 === 0) {
          // lintel por cima de duas pedras
          const a2 = ((i + 1) / 11) * Math.PI * 2;
          const x2 = cx + Math.cos((a + a2) / 2) * r, z2 = cz + Math.sin((a + a2) / 2) * r;
          this.caixa('pedraEscura', x2, h + alt - 0.3, z2, 1.0, 0.8, 7, -(a + a2) / 2);
        }
        this.colisoes.circulo(x, z, 0.8, h + alt);
      }
      const h = altura(cx, cz);
      this.caixa('pedraEscura', cx, h + 0.45, cz, 2.6, 0.9, 1.6, 0.4);
      this.colisoes.caixa(cx, cz, 1.3, 0.8, -0.4, h + 0.9);
      this.excluir.push({ x: cx, z: cz, r: r + 3 });
    }

    // Lanternas de ferro ao longo dos caminhos
    {
      const longeDe = (x, z) => FOGUEIRAS.every((f) => Math.hypot(f.x - x, f.z - z) > 9)
        && Math.hypot(x - FORTALEZA.x, z - FORTALEZA.z) > FORTALEZA.metade + 8 && Math.hypot(x - ARENA_LOBO.x, z - ARENA_LOBO.z) > ARENA_LOBO.r + 4;
      let n = 0;
      for (const cam of CAMINHOS) {
        let acum = 20;
        for (let i = 0; i < cam.length - 1; i++) {
          const [ax, az] = cam[i], [bx, bz] = cam[i + 1];
          const L = Math.hypot(bx - ax, bz - az);
          const dx = (bx - ax) / L, dz = (bz - az) / L;
          for (let d = acum; d < L; d += 42) {
            const lado = n++ % 2 ? 1 : -1;
            const x = ax + dx * d - dz * 3.4 * lado;
            const z = az + dz * d + dx * 3.4 * lado;
            acum = d + 42 - L;
            if (!longeDe(x, z)) continue;
            const h = altura(x, z);
            const ang = Math.atan2(-dz * lado, dx * lado);
            this.caixa('madeira', x, h + 1.6, z, 0.2, 3.6, 0.2, (rnd() - 0.5) * 0.3);
            const bx2 = x + dz * lado * 0.55, bz2 = z - dx * lado * 0.55;
            this.caixa('madeira', (x + bx2) / 2, h + 3.25, (z + bz2) / 2, 0.12, 0.12, 0.75, Math.atan2(dz * lado, -dx * lado));
            this.caixa('ferro', bx2, h + 3.0, bz2, 0.36, 0.06, 0.36, ang);
            this.caixa('ferro', bx2, h + 2.62, bz2, 0.3, 0.05, 0.3, ang);
            this.caixa('lanterna', bx2, h + 2.8, bz2, 0.24, 0.32, 0.24, ang);
            this.cilindro('ferro', bx2, h + 3.15, bz2, 0.02, 0.2, 0.22, 4, ang + Math.PI / 4);
            this.colisoes.circulo(x, z, 0.2, h + 3.4);
          }
        }
      }
    }

    // Carroças partidas junto aos caminhos, com caixotes e barris
    for (const [x, z, a] of [[-185, 212, 0.9], [118, -82, 2.6], [252, 196, 0.2], [-30, 52, 1.6]]) {
      const h = altura(x, z);
      const c = Math.cos(a), sn = Math.sin(a);
      const P = (lx, lz) => [x + lx * c + lz * sn, z - lx * sn + lz * c];
      this.caixa('madeira', x, h + 0.75, z, 1.6, 0.12, 3.0, a, 0, 0.18);
      for (const lx of [-0.8, 0.8]) {
        const [px, pz] = P(lx, 0);
        this.caixa('madeira', px, h + 1.0 + (lx > 0 ? 0.28 : -0.28), pz, 0.08, 0.5, 3.0, a, 0, 0.18);
      }
      const [r1x, r1z] = P(-0.9, 0.7);
      this.cilindro('madeira', r1x, h + 0.55, r1z, 0.55, 0.55, 0.1, 12, a, 0, Math.PI / 2);
      const [r2x, r2z] = P(1.6, -0.6);
      this.cilindro('madeira', r2x, h + 0.06, r2z, 0.55, 0.55, 0.1, 12, a + 0.7); // roda caída
      const [vx, vz] = P(0, 2.2);
      this.caixa('madeira', vx, h + 0.35, vz, 0.12, 0.12, 2.2, a + 0.15, -0.25);
      for (let k = 0; k < 3; k++) {
        const [cx, cz] = P(-1.4 - rnd() * 1.2, -1.5 + rnd() * 3);
        if (k === 2) this.cilindro('madeira', cx, h + 0.45, cz, 0.38, 0.42, 0.9, 10);
        else this.caixa('madeira', cx, h + 0.35, cz, 0.7, 0.7, 0.7, rnd() * 3);
      }
      this.colisoes.caixa(x, z, 0.9, 1.6, -a, h + 1.2);
      this.excluir.push({ x, z, r: 4 });
    }

    // Forca junto à encruzilhada, com uma gaiola pendurada
    {
      const x = 40, z = 130, a = 0.5;
      const h = altura(x, z);
      const c = Math.cos(a), sn = Math.sin(a);
      this.caixa('madeira', x, h + 0.25, z, 4.2, 0.5, 3.2, a);
      this.caixa('madeira', x - 1.4 * c, h + 3.2, z + 1.4 * sn, 0.3, 6, 0.3, a);
      this.caixa('madeira', x + 0.3 * c, h + 6.0, z - 0.3 * sn, 3.8, 0.28, 0.28, a);
      this.caixa('madeira', x - 0.9 * c, h + 5.3, z + 0.9 * sn, 0.18, 1.6, 0.18, a, 0, -0.8);
      const gx = x + 1.6 * c, gz = z - 1.6 * sn;
      this.cilindro('ferro', gx, h + 5.3, gz, 0.02, 0.02, 1.4, 4);
      for (let k = 0; k < 8; k++) {
        const ak = (k / 8) * Math.PI * 2;
        this.cilindro('ferro', gx + Math.cos(ak) * 0.45, h + 3.9, gz + Math.sin(ak) * 0.45, 0.025, 0.025, 1.6, 4);
      }
      this.cilindro('ferro', gx, h + 4.7, gz, 0.5, 0.5, 0.06, 10);
      this.cilindro('ferro', gx, h + 3.1, gz, 0.5, 0.5, 0.06, 10);
      this.colisoes.caixa(x, z, 2.1, 1.6, -a, h + 0.5);
    }

    // Placa da encruzilhada
    {
      const x = 22, z = 120;
      const h = altura(x, z);
      this.caixa('madeira', x, h + 1.4, z, 0.16, 2.8, 0.16);
      for (const [a, y] of [[0.4, 2.5], [2.2, 2.2], [-1.4, 1.9]]) {
        this.caixa('madeira', x + Math.sin(a) * 0.55, h + y, z + Math.cos(a) * 0.55, 0.06, 0.28, 1.1, a);
      }
      this.colisoes.circulo(x, z, 0.2, h + 2.8);
    }
    // Estandartes no arco da encruzilhada
    for (const lado of [-1, 1]) this.caixa('tecidoVermelho', 14 + lado * 5, altura(14, 96) + 6.2, 96.85, 1.6, 3.8, 0.05);

    // Cripta fora do muro do cemitério
    {
      const x = -392, z = 440, a = -0.15;
      const h = altura(x, z);
      const c = Math.cos(a), sn = Math.sin(a);
      const P = (lx, lz) => [x + lx * c + lz * sn, z - lx * sn + lz * c];
      this.caixa('pedraEscura', x, h + 0.2, z, 8.5, 1.2, 10.5, a);
      this.caixa('pedraEscura', x, h + 2.6, z - 0.5 * c, 6.5, 4.4, 7.5, a);
      // telhado de duas águas
      for (const lado of [-1, 1]) {
        const [tx, tz] = P(lado * 1.75, -0.5);
        this.caixa('pedraEscura', tx, h + 5.6, tz, 3.9, 0.35, 8.6, a, 0, lado * -0.5);
      }
      // pórtico com colunas
      for (const lx of [-2.6, 2.6]) {
        const [cx, cz] = P(lx, 4.2);
        this.cilindro('pedra', cx, h + 2.5, cz, 0.32, 0.36, 4.4, 10);
      }
      const [fx, fz] = P(0, 4.2);
      this.caixa('pedra', fx, h + 4.9, fz, 6.6, 0.6, 1.0, a);
      const [px, pz] = P(0, 3.3);
      this.caixa('ferro', px, h + 1.9, pz, 1.8, 2.8, 0.12, a);
      this.colisoes.caixa(x, z - 0.4, 3.4, 4.4, -a, h + 6);
      this.excluir.push({ x, z, r: 9 });
    }

    // Atalaia junto à Estrada dos Reis
    {
      const x = 140, z = -60;
      const h = altura(x, z);
      this.cilindro('pedra', x, h + 8, z, 3.6, 4.2, 17, 14);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        if (k === 5) continue;
        this.caixa('pedra', x + Math.cos(a) * 3.6, h + 17.1, z + Math.sin(a) * 3.6, 1.4, 1.4, 1.0, -a + Math.PI / 2);
      }
      this.caixa('madeira', x, h + 2, z + 4.15, 1.6, 2.8, 0.2);
      this.caixa('tecidoVermelho', x + 3.6, h + 12, z, 0.05, 4, 1.4);
      this.colisoes.circulo(x, z, 4.2, h + 17);
      this.excluir.push({ x, z, r: 8 });
    }

    // Torre de menagem atrás da fortaleza (vê-se de longe por cima dos muros)
    {
      const { x: fx, z: fz, metade: m } = FORTALEZA;
      const x = fx + 8, z = fz - m - 20;
      const h = altura(x, z) - 2;
      this.caixa('pedraEscura', x, h + 22, z, 15, 44, 15);
      this.caixa('pedraEscura', x, h + 44.4, z, 16.4, 1.2, 16.4);
      for (let k = 0; k < 16; k++) {
        const lado = Math.floor(k / 4), i = k % 4;
        const off = -6 + i * 4;
        const [ox, oz] = [[off, -7.6], [7.6, off], [off, 7.6], [-7.6, off]][lado];
        this.caixa('pedraEscura', x + ox, h + 45.6, z + oz, 1.8, 1.6, 1.8);
      }
      // janelas escuras
      for (const y of [18, 28, 36]) this.caixa('pedraEscura', x, h + y, z + 7.55, 1.4, 3.2, 0.2);
      this.cilindro('pedraEscura', x + 9, h + 30, z - 4, 3, 3.3, 60, 12);
      this.cilindro('pedraEscura', x + 9, h + 63, z - 4, 0.1, 4, 7, 12);
      this.caixa('tecidoVermelho', x, h + 40, z + 7.65, 3, 7, 0.05);
      this.colisoes.caixa(x, z, 7.5, 7.5, 0, h + 44);
      this.colisoes.circulo(x + 9, z - 4, 3.3, h + 60);
    }
    // estandartes ao longo do muro da fortaleza (do lado de fora)
    {
      const { x: fx, z: fz, metade: m, alturaMuro: am } = FORTALEZA;
      for (const ox of [-26, -14, 14, 26]) {
        const x = fx + ox, z = fz + m + 1.45;
        this.caixa('tecidoVermelho', x, altura(x, z) + am - 3.2, z, 2.2, 6, 0.05);
      }
    }
  }

  construirLotes() {
    const t = this.tex;
    const mats = {
      pedra: new THREE.MeshStandardMaterial({ map: t.pedra, normalMap: t.pedraN, roughness: 0.92, color: 0xb8b2a6 }),
      pedraEscura: new THREE.MeshStandardMaterial({ map: t.rocha, normalMap: t.rochaN, roughness: 0.9, color: 0x7d7a74 }),
      madeira: new THREE.MeshStandardMaterial({ map: t.casca, normalMap: t.cascaN, roughness: 0.95, color: 0x8a7560 }),
      tecidoVermelho: new THREE.MeshStandardMaterial({ map: t.tecido, color: 0x5a1612, roughness: 1, side: THREE.DoubleSide }),
      ferro: new THREE.MeshStandardMaterial({ color: 0x2a2826, metalness: 0.8, roughness: 0.6, roughnessMap: t.metalRug }),
      lanterna: new THREE.MeshStandardMaterial({ color: 0xffc070, emissive: 0xff9a30, emissiveIntensity: 2.2, roughness: 0.4 }),
    };
    for (const [nome, geos] of Object.entries(this.lotes)) {
      if (!geos.length) continue;
      const g = THREE.mergeGeometries(geos, false);
      uvCaixa(g, nome === 'madeira' ? 0.8 : 0.33);
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, mats[nome]);
      m.castShadow = true;
      m.receiveShadow = true;
      this.cena.add(m);
    }
    this.lotes = {};
    if (this.chaoPraca) {
      const { x, z, geo } = this.chaoPraca;
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: t.pedra, normalMap: t.pedraN, roughness: 0.9, color: 0x9a948a }));
      const pa = geo.attributes.position;
      const uv = geo.attributes.uv;
      for (let i = 0; i < pa.count; i++) {
        uv.setXY(i, pa.getX(i) * 0.25, pa.getZ(i) * 0.25);
        pa.setY(i, altura(x + pa.getX(i), z + pa.getZ(i)) + 0.06);
      }
      geo.computeVertexNormals();
      m.position.set(x, 0, z);
      m.receiveShadow = true;
      this.cena.add(m);
    }
  }

  // ---------- vegetação ----------
  geometriaPinheiro(semente) {
    const rnd = aleatorio(semente);
    const H = 9 + rnd() * 5;
    const tronco = naoIndexada(new THREE.CylinderGeometry(0.12, 0.34, H, 7, 1));
    tronco.translate(0, H / 2 - 0.3, 0);
    const folhas = [];
    const niveis = 6;
    for (let k = 0; k < niveis; k++) {
      const f = k / niveis;
      const r = 2.8 * (1 - f * 0.82) + rnd() * 0.3;
      const h = 3.2 * (1 - f * 0.4);
      const g = new THREE.ConeGeometry(r, h, 10, 3);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i);
        if (y < h / 2 - 0.01) {
          const j = 0.75 + rnd() * 0.5;
          p.setXYZ(i, p.getX(i) * j, y - (y < -h / 2 + 0.01 ? rnd() * 0.5 : 0), p.getZ(i) * j);
        }
      }
      g.computeVertexNormals();
      g.translate(0, H * 0.3 + f * H * 0.68 + h / 2, 0);
      folhas.push(naoIndexada(g));
    }
    const fol = THREE.mergeGeometries(folhas, false);
    return THREE.mergeGeometries([tronco, fol], true);
  }

  geometriaMorta(semente) {
    const rnd = aleatorio(semente);
    const partes = [];
    const cima = new THREE.Vector3(0, 1, 0);
    const ramo = (base, dir, len, raio, nivel) => {
      const g = naoIndexada(new THREE.CylinderGeometry(raio * 0.62, raio, len, nivel === 0 ? 7 : 5, 1));
      g.translate(0, len / 2, 0);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(cima, dir));
      g.translate(base.x, base.y, base.z);
      partes.push(g);
      if (nivel >= 3) return;
      const fim = base.clone().addScaledVector(dir, len);
      const filhos = nivel === 0 ? 3 : 2 + (rnd() < 0.4 ? 1 : 0);
      for (let i = 0; i < filhos; i++) {
        const nd = dir.clone();
        const eixo = new THREE.Vector3(rnd() - 0.5, 0, rnd() - 0.5).normalize();
        nd.applyAxisAngle(eixo, 0.45 + rnd() * 0.55).normalize();
        nd.y = Math.max(nd.y, -0.2);
        nd.normalize();
        const ini = nivel === 0 ? base.clone().addScaledVector(dir, len * (0.6 + rnd() * 0.4)) : fim;
        ramo(ini, nd, len * (0.55 + rnd() * 0.2), raio * 0.55, nivel + 1);
      }
    };
    ramo(new THREE.Vector3(0, -0.4, 0), new THREE.Vector3((rnd() - 0.5) * 0.2, 1, (rnd() - 0.5) * 0.2).normalize(), 4.5 + rnd() * 2.5, 0.32, 0);
    return THREE.mergeGeometries(partes, false);
  }

  geometriaDourada(semente) {
    const rnd = aleatorio(semente);
    const troncos = [];
    const copas = [];
    const H = 5 + rnd() * 2;
    const t1 = naoIndexada(new THREE.CylinderGeometry(0.28, 0.45, H, 8, 1));
    t1.translate(0, H / 2 - 0.3, 0);
    troncos.push(t1);
    const cima = new THREE.Vector3(0, 1, 0);
    const nRamos = 4 + Math.floor(rnd() * 2);
    for (let i = 0; i < nRamos; i++) {
      const a = (i / nRamos) * Math.PI * 2 + rnd();
      const dir = new THREE.Vector3(Math.cos(a) * 0.7, 0.8, Math.sin(a) * 0.7).normalize();
      const len = 3 + rnd() * 1.5;
      const g = naoIndexada(new THREE.CylinderGeometry(0.1, 0.2, len, 5, 1));
      g.translate(0, len / 2, 0);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(cima, dir));
      const by = H * (0.6 + rnd() * 0.3);
      g.translate(0, by, 0);
      troncos.push(g);
      const fim = dir.clone().multiplyScalar(len).add(new THREE.Vector3(0, by, 0));
      const b = naoIndexada(blob(1.9 + rnd() * 0.8, 1, semente * 10 + i, 0.3, 0.75));
      b.translate(fim.x, fim.y + 0.4, fim.z);
      copas.push(b);
    }
    const topo = naoIndexada(blob(2.6 + rnd(), 1, semente * 10 + 9, 0.3, 0.75));
    topo.translate(0, H + 1.8, 0);
    copas.push(topo);
    return THREE.mergeGeometries([THREE.mergeGeometries(troncos, false), THREE.mergeGeometries(copas, false)], true);
  }

  geometriaRocha(semente) {
    const g = naoIndexada(blob(1, 2, semente, 0.32, 0.65));
    const p = g.attributes.position;
    const uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + p.getZ(i)) * 0.6, p.getY(i) * 0.6);
    return g;
  }

  podeCrescer(x, z, margemCaminho = 5) {
    if (distCaminho(x, z) < margemCaminho) return false;
    for (const e of this.excluir) if (Math.hypot(x - e.x, z - e.z) < e.r) return false;
    for (const zn of zonas) if (Math.hypot(x - zn.x, z - zn.z) < zn.r + 2) return false;
    for (const f of FOGUEIRAS) if (Math.hypot(x - f.x, z - f.z) < 10) return false;
    return Math.abs(x) < MUNDO.metade - 5 && Math.abs(z) < MUNDO.metade - 5;
  }

  gerarVegetacao() {
    const t = this.tex;
    const matCasca = new THREE.MeshStandardMaterial({ map: t.casca, normalMap: t.cascaN, color: 0x9a8a78, roughness: 0.95 });
    const matCascaMorta = new THREE.MeshStandardMaterial({ map: t.casca, normalMap: t.cascaN, color: 0x6e6862, roughness: 0.95 });
    const matRocha = new THREE.MeshStandardMaterial({ map: t.rocha, normalMap: t.rochaN, color: 0xa09a90, roughness: 0.92 });
    const fol = criarTexturasFolhagem(this.qualidade);
    this.uFolhas = { value: 0 };
    const matAgulhas = materialFolhas(fol.agulhas, this.uFolhas, { color: 0xc8d0b8 });
    const matDourada = materialFolhas(fol.ouro, this.uFolhas, { emissive: 0x6a4400, emissiveMap: fol.ouro, emissiveIntensity: 0.55 });
    const matArbusto = materialFolhas(fol.verde, this.uFolhas, { color: 0xd0d8c0 });
    const matArbustoSeco = materialFolhas(fol.seco, this.uFolhas);
    const matFeto = materialFolhas(fol.feto, this.uFolhas);
    // árvores de longe (versão simples): as que estão perto do jogador são escondidas e desenhadas em detalhe
    this.raioArvoresBase = { baixa: 60, media: 85, alta: 110 }[this.qualidade];
    this.raioArvores = this.raioArvoresBase * this.distDetalhe;
    this.uPerto = { value: new THREE.Vector3(1e9, 1e9, this.raioArvores) };
    const matCascaLonge = materialLonge({ map: t.casca, normalMap: t.cascaN, color: 0x9a8a78, roughness: 0.95 }, this.uPerto);
    // de longe as copas são formas opacas e simples (muito mais baratas de desenhar que folhas recortadas)
    const matAgulhasLonge = materialLonge({ color: 0x26331f, roughness: 0.95 }, this.uPerto);
    const matDouradaLonge = materialLonge({ color: 0xb08028, roughness: 0.8, emissive: 0x3a2400, emissiveIntensity: 0.6 }, this.uPerto);
    const matJunco = new THREE.MeshStandardMaterial({ color: 0x6e6a3c, roughness: 0.9 });
    const matNenufar = new THREE.MeshStandardMaterial({ color: 0x3c5a2c, roughness: 0.6, side: THREE.DoubleSide });

    // perto: só se desenham a esta distância (vegetação rasteira)
    const tipos = [
      {
        geos: [pinheiro(1), pinheiro(2), pinheiro(4)], mat: [matCasca, matAgulhas], raio: 0.35,
        lod: [this.geometriaPinheiro(1), this.geometriaPinheiro(2), this.geometriaPinheiro(4)], matLonge: [matCascaLonge, matAgulhasLonge],
      },
      { geos: [this.geometriaMorta(3), this.geometriaMorta(5)], mat: matCascaMorta, raio: 0.32 },
      {
        geos: [arvoreDourada(6), arvoreDourada(7), arvoreDourada(9)], mat: [matCasca, matDourada], raio: 0.45,
        lod: [this.geometriaDourada(6), this.geometriaDourada(7), this.geometriaDourada(9)], matLonge: [matCascaLonge, matDouradaLonge],
      },
      { geos: [this.geometriaRocha(8), this.geometriaRocha(10)], mat: matRocha, raio: 0 },
      { geos: [arbusto(21), arbusto(22)], mat: matArbusto, raio: 0, perto: 170 },
      { geos: [arbusto(23)], mat: matArbustoSeco, raio: 0, perto: 170 },
      { geos: [feto(24), feto(25)], mat: matFeto, raio: 0, perto: 110 },
      { geos: [troncoCaido(26), troncoCaido(27)], mat: matCascaMorta, raio: 0, perto: 200 },
      { geos: [cepo(28)], mat: matCasca, raio: 0.5, perto: 160 },
      { geos: [juncos(29), juncos(30)], mat: matJunco, raio: 0, perto: 140 },
      { geos: [nenufar()], mat: matNenufar, raio: 0, perto: 120 },
    ];

    const BLOCO = 175;
    const nb = Math.ceil(MUNDO.tam / BLOCO);
    const blocos = new Map(); // chave -> [tipo][variante] -> matrizes
    const juntar = (tipo, variante, x, z, m) => {
      const bi = Math.floor((x + MUNDO.metade) / BLOCO);
      const bj = Math.floor((z + MUNDO.metade) / BLOCO);
      const k = bi * nb + bj;
      if (!blocos.has(k)) blocos.set(k, tipos.map((tp) => tp.geos.map(() => [])));
      blocos.get(k)[tipo][variante].push(m);
      // árvores com versão detalhada: guardadas numa grelha para se encontrarem as que estão perto
      if (tipos[tipo].lod) {
        const ck = `${Math.floor(x / 25)},${Math.floor(z / 25)}`;
        if (!grelha.has(ck)) grelha.set(ck, []);
        grelha.get(ck).push({ tipo, variante, x, z, m });
        contagem[tipo][variante]++;
      }
    };
    const grelha = new Map();
    const contagem = tipos.map((tp) => tp.geos.map(() => 0));

    const rnd = aleatorio(4242);
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const v = new THREE.Vector3();
    const sc = new THREE.Vector3();
    const densMult = this.qualidade === 'baixa' ? 0.55 : 1;
    const passo = 10;
    let arvores = 0;

    for (let gx = -MUNDO.metade; gx < MUNDO.metade; gx += passo) {
      for (let gz = -MUNDO.metade; gz < MUNDO.metade; gz += passo) {
        const x = gx + rnd() * passo;
        const z = gz + rnd() * passo;
        const h = altura(x, z);
        const dec = declive(x, z);
        const pant = pesoPantano(x, z);
        const mont = fatorMontanha(x, z);
        const flor = fbm(s2, x * 0.006 + 30, z * 0.006, 3);
        let dens = suave(-0.1, 0.35, flor) * 0.5 + 0.035;
        let tipo;
        const reg = regiaoEm(x, z);
        if (pant > 0.4) {
          dens = 0.14; tipo = 1;
          if (h < -0.9) dens = 0;
        } else if (reg && reg.id === 'cemiterio') {
          dens *= 0.5; tipo = 1;
        } else if (h > 40 || mont > 0.2) {
          tipo = 0;
          dens = (0.35 + 0.3 * flor) * (1 - suave(110, 150, h));
        } else {
          const tn = fbm(s4, x * 0.004, z * 0.004, 2);
          tipo = tn > 0.12 ? 0 : tn < -0.18 ? 1 : 2;
          if (rnd() < 0.18) tipo = 1;
        }
        if (dec > 0.42) dens = 0;
        if (h < 0.15 && pant < 0.4) dens = 0;
        if (rnd() < dens * densMult && this.podeCrescer(x, z)) {
          const vars = tipos[tipo].geos.length;
          const variante = Math.floor(rnd() * vars);
          const s = 0.8 + rnd() * 0.55;
          e.set((rnd() - 0.5) * 0.08, rnd() * Math.PI * 2, (rnd() - 0.5) * 0.08);
          q.setFromEuler(e);
          v.set(x, h, z);
          sc.set(s, s * (0.9 + rnd() * 0.25), s);
          juntar(tipo, variante, x, z, new THREE.Matrix4().compose(v, q, sc));
          this.colisoes.circulo(x, z, tipos[tipo].raio * s, h + 12);
          arvores++;
        }
        // rochas
        const pr = (0.06 + dec * 0.5 + mont * 0.3) * densMult;
        if (rnd() < pr) {
          const x2 = gx + rnd() * passo;
          const z2 = gz + rnd() * passo;
          if (this.podeCrescer(x2, z2, 3.5)) {
            const grande = rnd() < 0.18;
            const s = grande ? 1.8 + rnd() * 2.5 : 0.3 + rnd() * 0.7;
            const h2 = altura(x2, z2);
            e.set(rnd() * 0.5, rnd() * Math.PI * 2, rnd() * 0.5);
            q.setFromEuler(e);
            v.set(x2, h2 - s * 0.2, z2);
            sc.set(s * (0.8 + rnd() * 0.6), s, s * (0.8 + rnd() * 0.6));
            juntar(3, Math.floor(rnd() * 2), x2, z2, new THREE.Matrix4().compose(v, q, sc));
            if (s > 1.2) this.colisoes.circulo(x2, z2, s * 0.85, h2 + s * 0.6);
          }
        }
        // vegetação rasteira: arbustos, fetos, troncos caídos, cepos; juncos e nenúfares no pântano
        const ponha = (ti, x3, z3, s, y = null, deitado = false) => {
          const h3 = y ?? altura(x3, z3);
          e.set(deitado ? 0 : (rnd() - 0.5) * 0.15, rnd() * Math.PI * 2, deitado ? 0 : (rnd() - 0.5) * 0.15);
          q.setFromEuler(e);
          v.set(x3, h3, z3);
          sc.set(s, s * (0.85 + rnd() * 0.3), s);
          juntar(ti, Math.floor(rnd() * tipos[ti].geos.length), x3, z3, new THREE.Matrix4().compose(v, q, sc));
        };
        const montanha = h > 60 || mont > 0.3;
        if (!montanha && dec < 0.35) {
          const floresta = flor > 0.05;
          const nArb = (pant > 0.4 ? 0.15 : floresta ? 1.1 : 0.35) * densMult;
          for (let k = 0; k < 3; k++) {
            if (rnd() > nArb / 3) continue;
            const x3 = gx + rnd() * passo, z3 = gz + rnd() * passo;
            if (altura(x3, z3) < 0.3 || !this.podeCrescer(x3, z3, 3)) continue;
            ponha(secoRapido(x3, z3) > 0.15 || reg?.id === 'cemiterio' ? 5 : 4, x3, z3, 0.8 + rnd() * 0.9);
          }
          const nFeto = (floresta ? 1.6 : 0.25) * densMult * (pant > 0.4 ? 0.3 : 1);
          for (let k = 0; k < 4; k++) {
            if (rnd() > nFeto / 4) continue;
            const x3 = gx + rnd() * passo, z3 = gz + rnd() * passo;
            if (altura(x3, z3) < 0.3 || !this.podeCrescer(x3, z3, 2.5)) continue;
            ponha(6, x3, z3, 0.7 + rnd() * 0.6);
          }
          if (rnd() < (floresta ? 0.06 : 0.015) && this.podeCrescer(x, z, 4)) {
            const x3 = gx + rnd() * passo, z3 = gz + rnd() * passo;
            if (altura(x3, z3) > 0.3) {
              if (rnd() < 0.55) {
                ponha(7, x3, z3, 0.8 + rnd() * 0.4, altura(x3, z3) - 0.1, true);
                this.colisoes.circulo(x3, z3, 0.6, altura(x3, z3) + 0.6);
              } else {
                ponha(8, x3, z3, 0.8 + rnd() * 0.5);
                this.colisoes.circulo(x3, z3, 0.5, altura(x3, z3) + 0.8);
              }
            }
          }
        }
        if (pant > 0.3) {
          for (let k = 0; k < 6; k++) {
            const x3 = gx + rnd() * passo, z3 = gz + rnd() * passo;
            const h3 = altura(x3, z3);
            if (!this.podeCrescer(x3, z3, 2)) continue;
            if (h3 > -0.7 && h3 < 0.5 && rnd() < 0.6) ponha(9, x3, z3, 0.8 + rnd() * 0.6, Math.min(h3, 0.1));
            else if (h3 < -0.25 && rnd() < 0.35) ponha(10, x3, z3, 0.6 + rnd() * 0.7, 0.03, true);
          }
        }
      }
    }

    this.blocosVeg = [];
    for (const [k, porTipo] of blocos) {
      porTipo.forEach((porVar, ti) => {
        porVar.forEach((mats, vi) => {
          if (!mats.length) return;
          const tp = tipos[ti];
          const im = new THREE.InstancedMesh(tp.lod ? tp.lod[vi] : tp.geos[vi], tp.lod ? tp.matLonge : tp.mat, mats.length);
          mats.forEach((m, i) => im.setMatrixAt(i, m));
          im.userData.perto = tp.perto || 0;
          im.userData.semSombra = !!tp.lod || (tp.perto && ti !== 7 && ti !== 8);
          im.receiveShadow = true;
          im.computeBoundingSphere();
          this.cena.add(im);
          this.blocosVeg.push(im);
        });
      });
    }
    this.numArvores = arvores;

    // árvores detalhadas à volta do jogador (atualizadas quando ele se desloca)
    this.grelhaArvores = grelha;
    this.arvoresPerto = [];
    tipos.forEach((tp, ti) => {
      if (!tp.lod) return;
      tp.geos.forEach((geo, vi) => {
        const cap = Math.max(1, Math.min(contagem[ti][vi], 1200));
        const im = new THREE.InstancedMesh(geo, tp.mat, cap);
        im.count = 0;
        im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        im.castShadow = true;
        im.receiveShadow = true;
        this.cena.add(im);
        this.arvoresPerto.push({ ti, vi, im, cap });
      });
    });
    this.centroArvores = new THREE.Vector2(1e9, 1e9);
  }

  atualizarArvoresPerto(foco) {
    if (!this.arvoresPerto) return;
    if (Math.hypot(foco.x - this.centroArvores.x, foco.z - this.centroArvores.y) < 6) return;
    this.centroArvores.set(foco.x, foco.z);
    const R = this.raioArvores;
    const porChave = new Map();
    for (const a of this.arvoresPerto) {
      a.im.count = 0;
      porChave.set(`${a.ti},${a.vi}`, a);
    }
    const c0 = Math.floor((foco.x - R) / 25), c1 = Math.floor((foco.x + R) / 25);
    const r0 = Math.floor((foco.z - R) / 25), r1 = Math.floor((foco.z + R) / 25);
    for (let i = c0; i <= c1; i++) {
      for (let j = r0; j <= r1; j++) {
        const l = this.grelhaArvores.get(`${i},${j}`);
        if (!l) continue;
        for (const t of l) {
          if (Math.hypot(t.x - foco.x, t.z - foco.z) >= R) continue;
          const a = porChave.get(`${t.tipo},${t.variante}`);
          if (a.im.count >= a.cap) continue;
          a.im.setMatrixAt(a.im.count++, t.m);
        }
      }
    }
    for (const a of this.arvoresPerto) {
      a.im.instanceMatrix.needsUpdate = true;
      a.im.computeBoundingSphere();
    }
    this.uPerto.value.set(foco.x, foco.z, R);
  }

  // ---------- relva junto ao jogador ----------
  gerarRelva() {
    const qtd = { baixa: 3500, media: 9000, alta: 20000 }[this.qualidade];
    const raio = { baixa: 28, media: 36, alta: 48 }[this.qualidade];
    this.raioRelva = raio;
    // tufo com várias lâminas
    const pos = [];
    const uvs = [];
    const nor = [];
    const rnd = aleatorio(17);
    const laminas = this.qualidade === 'alta' ? 9 : 7;
    for (let b = 0; b < laminas; b++) {
      const a = rnd() * Math.PI * 2;
      const ox = (rnd() - 0.5) * 0.5;
      const oz = (rnd() - 0.5) * 0.5;
      const h = 0.22 + rnd() * 0.3;
      const w = 0.025 + rnd() * 0.02;
      const inc = (rnd() - 0.5) * 0.4;
      const cx = Math.cos(a), cz = Math.sin(a);
      const pts = [
        [-w, 0, 0], [w, 0, 0], [-w * 0.6, h * 0.55, inc * 0.3], [w * 0.6, h * 0.55, inc * 0.3], [0, h, inc],
      ];
      const tri = [[0, 1, 2], [2, 1, 3], [2, 3, 4]];
      for (const t of tri) {
        for (const id of t) {
          const [px, py, pz] = pts[id];
          pos.push(ox + px * cx - pz * cz, py, oz + px * cz + pz * cx);
          uvs.push(0, py / h);
          nor.push(0, 1, 0);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, side: THREE.DoubleSide });
    this.uRelva = { uTempo: { value: 0 }, uCentro: { value: new THREE.Vector2() }, uRaio: { value: raio } };
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, this.uRelva);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTempo; uniform vec2 uCentro; uniform float uRaio; varying float vAlt;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vAlt = uv.y;
          vec3 wp = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          float d = distance(wp.xz, uCentro);
          transformed *= smoothstep(uRaio, uRaio * 0.7, d);
          float vento = sin(uTempo * 1.6 + wp.x * 0.12 + wp.z * 0.09) * 0.6 + sin(uTempo * 3.3 + wp.x * 0.5 + wp.z * 0.3) * 0.25;
          vec3 W = vec3(0.8, 0.0, 0.5) * vento * uv.y * uv.y * 0.3;
          mat3 M = mat3(instanceMatrix);
          transformed += transpose(M) * W / max(dot(M[0], M[0]), 0.0001);`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vAlt;')
        .replace('#include <map_fragment>', `#include <map_fragment>
          diffuseColor.rgb *= mix(vec3(0.07, 0.09, 0.035), vec3(0.24, 0.27, 0.11), vAlt);`);
    };
    const im = new THREE.InstancedMesh(g, mat, qtd);
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    im.frustumCulled = false;
    im.receiveShadow = true;
    this.cena.add(im);
    this.relva = im;
    // A relva vive em ladrilhos fixos de 8 m: o mesmo ladrilho do mundo tem sempre as mesmas lâminas.
    const T = 8;
    this.ladrilho = T;
    this.ladrilhos = [];
    const nt = Math.ceil(raio / T) + 1;
    for (let i = -nt; i <= nt; i++) {
      for (let j = -nt; j <= nt; j++) {
        if (Math.hypot(i + 0.5, j + 0.5) * T < raio + T) this.ladrilhos.push([i, j]);
      }
    }
    const K = Math.floor(qtd / this.ladrilhos.length);
    this.padraoRelva = [];
    for (let k = 0; k < K; k++) this.padraoRelva.push([rnd(), rnd(), 0.6 + rnd() * 0.6, rnd()]);
    this.centroRelva = new THREE.Vector2(1e9, 1e9);
  }

  reposicionarRelva(x, z) {
    const T = this.ladrilho;
    const cx = Math.floor(x / T);
    const cz = Math.floor(z / T);
    if (cx === this.centroRelva.x && cz === this.centroRelva.y) return;
    this.centroRelva.set(cx, cz);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const v = new THREE.Vector3();
    const s = new THREE.Vector3();
    const eixo = new THREE.Vector3(0, 1, 0);
    const cor = new THREE.Color();
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    const im = this.relva;
    const K = this.padraoRelva.length;
    // só as zonas de exclusão perto deste centro (antes testava todas para cada lâmina)
    const alcanceZ = this.raioRelva + T * 2;
    const zonasPerto = this.excluirRelva.filter((zn) => Math.hypot(zn.x - (cx + 0.5) * T, zn.z - (cz + 0.5) * T) < alcanceZ + zn.r);
    let i = 0;
    for (const [di, dj] of this.ladrilhos) {
      const ti = cx + di;
      const tj = cz + dj;
      const h1 = Math.abs(Math.sin(ti * 12.9898 + tj * 78.233) * 43758.5453) % 1;
      const h2 = Math.abs(Math.sin(ti * 39.3468 + tj * 11.135) * 24634.6345) % 1;
      for (let k = 0; k < K; k++, i++) {
        const [u, w, esc, rr] = this.padraoRelva[k];
        const wx = (ti + ((u + h1) % 1)) * T;
        const wz = (tj + ((w + h2) % 1)) * T;
        const h = altura(wx, wz);
        const pc = pesoCaminho(wx, wz);
        const pp = pesoPantano(wx, wz);
        let ok = h > 0.25 && pc < 0.35 && h < 75 && decliveRapido(wx, wz) < 0.3;
        if (ok) {
          for (const zn of zonasPerto) {
            if (Math.abs(wx - zn.x) < zn.r && Math.abs(wz - zn.z) < zn.r && Math.hypot(wx - zn.x, wz - zn.z) < zn.r) { ok = false; break; }
          }
        }
        if (!ok) {
          im.setMatrixAt(i, zero);
          continue;
        }
        const seco = secoRapido(wx, wz);
        q.setFromAxisAngle(eixo, ((rr + h1) % 1) * 6.283);
        const e = esc * (1 - pc) * (pp > 0.3 ? 1.3 : 1) * (0.8 + 0.4 * (seco + 0.5));
        m.compose(v.set(wx, h - 0.03, wz), q, s.set(e, e * (0.8 + rr * 0.6), e));
        im.setMatrixAt(i, m);
        cor.setRGB(0.85 + seco * 0.5, 0.9 + seco * 0.2, 0.7 - seco * 0.2);
        if (pp > 0.3) cor.setRGB(0.6, 0.75, 0.55);
        im.setColorAt(i, cor);
      }
    }
    for (; i < im.count; i++) im.setMatrixAt(i, zero);
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  }

  // ---------- fogueiras ----------
  gerarFogueiras() {
    const t = this.tex;
    const matCinza = new THREE.MeshStandardMaterial({ color: 0x2e2a26, roughness: 1 });
    const matPedra = new THREE.MeshStandardMaterial({ map: t.rocha, color: 0x77726a, roughness: 0.95 });
    const matLenha = new THREE.MeshStandardMaterial({ map: t.casca, color: 0x3a2a1e, roughness: 1, emissive: 0x401000, emissiveIntensity: 0.4 });
    const matEspada = new THREE.MeshStandardMaterial({ color: 0x6d6a66, metalness: 0.9, roughness: 0.45, roughnessMap: t.metalRug });
    for (const f of FOGUEIRAS) {
      const g = new THREE.Group();
      const h = altura(f.x, f.z);
      g.position.set(f.x, h, f.z);
      const cinza = new THREE.Mesh(new THREE.SphereGeometry(0.85, 14, 6), matCinza);
      cinza.scale.y = 0.22;
      g.add(cinza);
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        const p = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2 + (i % 3) * 0.04), matPedra);
        p.position.set(Math.cos(a) * 0.95, 0.08, Math.sin(a) * 0.95);
        p.rotation.set(i, i * 2, 0);
        p.castShadow = true;
        g.add(p);
      }
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const l = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.1, 6), matLenha);
        l.position.set(Math.cos(a) * 0.3, 0.3, Math.sin(a) * 0.3);
        l.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9);
        g.add(l);
      }
      const espada = new THREE.Group();
      const lam = new THREE.Mesh(new THREE.BoxGeometry(0.075, 1.15, 0.018), matEspada);
      lam.position.y = 0.35;
      const guarda = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.06), matEspada);
      guarda.position.y = 0.95;
      const punho = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.24, 6), matLenha);
      punho.position.y = 1.1;
      espada.add(lam, guarda, punho);
      espada.rotation.set(0.12, 0.6, 0.08);
      espada.traverse((o) => { o.castShadow = true; });
      g.add(espada);

      const chamas = [];
      for (let i = 0; i < 14; i++) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({
          map: t.chama, color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
        }));
        sp.userData = { fase: Math.random(), vel: 0.8 + Math.random() * 0.7, ox: (Math.random() - 0.5) * 0.5, oz: (Math.random() - 0.5) * 0.5 };
        g.add(sp);
        chamas.push(sp);
      }
      const brasa = new THREE.Sprite(new THREE.SpriteMaterial({ map: t.brilho, color: 0xff5010, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.6 }));
      brasa.scale.set(1.4, 0.7, 1);
      brasa.position.y = 0.2;
      g.add(brasa);

      this.cena.add(g);
      this.colisoes.circulo(f.x, f.z, 0.9, h + 1);
      this.fogueiras.push({ dados: f, grupo: g, chamas, brasa, acesa: false, h });
    }
    // luzes partilhadas pelas fogueiras mais próximas
    this.luzesFogo = [0, 1].map(() => {
      const l = new THREE.PointLight(0xff8a3a, 0, 22, 1.6);
      this.cena.add(l);
      return l;
    });
  }

  // ---------- poeira e cinzas no ar ----------
  gerarParticulas() {
    const n = { baixa: 80, media: 180, alta: 350 }[this.qualidade];
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      p[i * 3] = (Math.random() - 0.5) * 60;
      p[i * 3 + 1] = Math.random() * 20;
      p[i * 3 + 2] = (Math.random() - 0.5) * 60;
    }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const m = new THREE.PointsMaterial({
      map: this.tex.brilho, size: 0.13, color: 0xffd9a0, transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const pts = new THREE.Points(g, m);
    pts.frustumCulled = false;
    this.cena.add(pts);
    this.poeira = pts;
  }

  prepararExclusaoRelva() {
    this.excluirRelva = [
      ...this.excluir.map((e) => ({ x: e.x, z: e.z, r: e.r * 0.6 })),
      ...FOGUEIRAS.map((f) => ({ x: f.x, z: f.z, r: 2.2 })),
      { x: ARENA_LOBO.x, z: ARENA_LOBO.z, r: ARENA_LOBO.r - 1 },
      { x: FORTALEZA.x, z: FORTALEZA.z, r: FORTALEZA.metade * 1.45 },
    ];
  }

  // ---------- atualização por fotograma ----------
  atualizar(dt, foco, camara) {
    this.tempo += dt;
    if (this.relva) {
      this.uRelva.uTempo.value = this.tempo;
      this.reposicionarRelva(foco.x, foco.z);
      this.uRelva.uCentro.value.set(foco.x, foco.z);
    }
    if (this.agua) {
      this.agua.material.normalMap.offset.set(this.tempo * 0.004, this.tempo * 0.0025);
    }
    if (this.portaNevoeiro) this.portaNevoeiro.mesh.material.uniforms.uTempo.value = this.tempo;
    this.atualizarSombras(foco);
    this.atualizarArvoresPerto(foco);

    // vegetação: blocos distantes ficam escondidos (o nevoeiro já os apaga) e só os próximos fazem sombra
    if (this.blocosVeg) {
      const cp = camara.position;
      const k = this.distDetalhe;
      const alcance = { baixa: 250, media: 330, alta: 470 }[this.qualidade] * Math.min(1.25, 0.6 + 0.4 * k);
      this.uFolhas.value = this.tempo;
      for (const b of this.blocosVeg) {
        const bs = b.boundingSphere;
        const d = Math.hypot(bs.center.x - cp.x, bs.center.z - cp.z) - bs.radius;
        b.visible = d < (b.userData.perto ? Math.min(alcance, b.userData.perto * k) : alcance);
        b.castShadow = !b.userData.semSombra && Math.hypot(bs.center.x - foco.x, bs.center.z - foco.z) - bs.radius < 70 * k;
      }
    }

    // chamas das fogueiras e luzes
    const ordenadas = this.fogueiras
      .map((f) => ({ f, d: Math.hypot(f.dados.x - foco.x, f.dados.z - foco.z) }))
      .sort((a, b) => a.d - b.d);
    ordenadas.forEach(({ f, d }, i) => {
      const perto = d < 120;
      for (const sp of f.chamas) {
        sp.visible = f.acesa && perto;
        if (!sp.visible) continue;
        const u = sp.userData;
        const t = (this.tempo * u.vel + u.fase) % 1;
        sp.position.set(u.ox * (1 - t), 0.15 + t * 1.5, u.oz * (1 - t));
        const s = (1 - t) * 0.9 + 0.2;
        sp.scale.set(s, s * 1.4, 1);
        sp.material.opacity = Math.min(1, (1 - t) * 1.6) * 0.9;
      }
      f.brasa.material.opacity = (f.acesa ? 0.8 : 0.35) + Math.sin(this.tempo * 3 + i) * 0.1;
      if (i < this.luzesFogo.length) {
        const l = this.luzesFogo[i];
        l.position.set(f.dados.x, f.h + 1.2, f.dados.z);
        l.intensity = f.acesa && d < 60 ? 9 + Math.sin(this.tempo * 13) * 1.2 + Math.sin(this.tempo * 7.3) * 1.5 : (d < 60 ? 2 : 0);
      }
    });

    // partículas de cinza em torno da câmara
    if (this.poeira) {
      const p = this.poeira.geometry.attributes.position;
      const c = camara.position;
      for (let i = 0; i < p.count; i++) {
        let x = p.getX(i) + Math.sin(this.tempo * 0.5 + i) * dt * 0.3 + dt * 0.4;
        let y = p.getY(i) + dt * (0.1 + (i % 5) * 0.05);
        let z = p.getZ(i) + Math.cos(this.tempo * 0.4 + i) * dt * 0.3;
        if (x - c.x > 30) x -= 60; if (x - c.x < -30) x += 60;
        if (z - c.z > 30) z -= 60; if (z - c.z < -30) z += 60;
        // referência pela câmara (antes calculava a altura do terreno para cada partícula em cada fotograma)
        if (y > c.y + 14 || y < c.y - 10) y = c.y - 8 + Math.random() * 4;
        p.setXYZ(i, x, y, z);
      }
      p.needsUpdate = true;
    }
  }

  // ---------- mapa (vista de cima) ----------
  gerarMapa(tam = 512) {
    const c = document.createElement('canvas');
    c.width = c.height = tam;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(tam, tam);
    const luz = new THREE.Vector3(-0.6, 0.7, -0.4).normalize();
    for (let j = 0; j < tam; j++) {
      for (let i = 0; i < tam; i++) {
        const x = -MUNDO.metade + ((i + 0.5) / tam) * MUNDO.tam;
        const z = -MUNDO.metade + ((j + 0.5) / tam) * MUNDO.tam;
        const h = altura(x, z);
        const e = MUNDO.tam / tam;
        const nx = altura(x - e, z) - altura(x + e, z);
        const nz = altura(x, z - e) - altura(x, z + e);
        const n = new THREE.Vector3(nx, 2 * e, nz).normalize();
        const sombra = 0.55 + 0.6 * Math.max(0, n.dot(luz));
        let r = 120, g = 118, b = 82;
        const dec = 1 - n.y;
        if (h < 0) { r = 52; g = 66; b = 64; } else {
          if (pesoPantano(x, z) > 0.5) { r = 92; g = 92; b = 66; }
          if (dec > 0.3) { r = 118; g = 112; b = 102; }
          if (h > 110) { r = 170; g = 168; b = 160; }
          if (pesoCaminho(x, z) > 0.4) { r = 160; g = 136; b = 96; }
        }
        const k = (j * tam + i) * 4;
        img.data[k] = r * sombra;
        img.data[k + 1] = g * sombra;
        img.data[k + 2] = b * sombra;
        img.data[k + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    // tom envelhecido de pergaminho
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = '#d8c8a0';
    ctx.fillRect(0, 0, tam, tam);
    ctx.globalCompositeOperation = 'source-over';
    return c;
  }
}
