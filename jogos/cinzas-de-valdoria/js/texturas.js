// Texturas geradas por código (sem ficheiros de imagem): relva, terra, rocha, lama, pedra, casca, metal.
import * as THREE from '../vendor/three.js';
import { ruidoPeriodico, aleatorio } from './ruido.js';

export function fbmP(ruido, x, y, oitavas, periodoBase) {
  // fbm periódico: cada oitava usa um período múltiplo do anterior para continuar sem costuras
  let soma = 0;
  let amp = 1;
  let norma = 0;
  let f = 1;
  for (let o = 0; o < oitavas; o++) {
    soma += amp * ruido(x * f, y * f);
    norma += amp;
    amp *= 0.5;
    f *= 2;
  }
  return soma / norma;
}

export function criarCanvas(tam) {
  const c = document.createElement('canvas');
  c.width = c.height = tam;
  return c;
}

export function paraTextura(canvas, srgb = true, anisotropia = 8) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = anisotropia;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.needsUpdate = true;
  return t;
}

// Gera cor e altura ao mesmo tempo; a altura dá origem ao mapa de normais.
export function gerar(tam, fn) {
  const cor = criarCanvas(tam);
  const ctx = cor.getContext('2d');
  const img = ctx.createImageData(tam, tam);
  const alt = new Float32Array(tam * tam);
  const px = [0, 0, 0, 0];
  for (let y = 0; y < tam; y++) {
    for (let x = 0; x < tam; x++) {
      fn(x, y, px);
      const i = (y * tam + x) * 4;
      img.data[i] = px[0];
      img.data[i + 1] = px[1];
      img.data[i + 2] = px[2];
      img.data[i + 3] = 255;
      alt[y * tam + x] = px[3];
    }
  }
  ctx.putImageData(img, 0, 0);
  return { cor, alt };
}

export function normalDeAltura(alt, tam, forca) {
  const c = criarCanvas(tam);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(tam, tam);
  const a = (x, y) => alt[((y + tam) % tam) * tam + ((x + tam) % tam)];
  for (let y = 0; y < tam; y++) {
    for (let x = 0; x < tam; x++) {
      const dx = (a(x + 1, y) - a(x - 1, y)) * forca;
      const dy = (a(x, y + 1) - a(x, y - 1)) * forca;
      let nx = -dx, ny = -dy, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l; ny /= l; nz /= l;
      const i = (y * tam + x) * 4;
      img.data[i] = (nx * 0.5 + 0.5) * 255;
      img.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      img.data[i + 2] = (nz * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

const cl = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

export function criarTexturas(qualidade = 'alta') {
  const T = qualidade === 'baixa' ? 256 : 512;
  const aniso = qualidade === 'baixa' ? 2 : 8;
  const tex = {};

  // ---------- Relva ----------
  {
    const n1 = ruidoPeriodico(11, 8);
    const n2 = ruidoPeriodico(12, 64);
    const n3 = ruidoPeriodico(13, 128);
    const { cor, alt } = gerar(T, (x, y, p) => {
      const u = x / T, v = y / T;
      const grande = fbmP(n1, u * 8, v * 8, 3);
      const fino = n2(u * 64, v * 64);
      const lamina = n3(u * 128, v * 128 * 0.35);
      const h = 0.5 * fino + 0.5 * lamina;
      const seco = Math.max(0, grande - 0.45) * 2.2;
      p[0] = cl((52 + 40 * seco + 30 * h) * (0.7 + 0.5 * grande));
      p[1] = cl((66 + 22 * seco + 38 * h) * (0.7 + 0.5 * grande));
      p[2] = cl((28 + 6 * seco + 12 * h) * (0.7 + 0.4 * grande));
      p[3] = h;
    });
    tex.relva = paraTextura(cor, true, aniso);
    tex.relvaN = paraTextura(normalDeAltura(alt, T, 2.5), false, aniso);
  }

  // ---------- Terra / caminho ----------
  {
    const n1 = ruidoPeriodico(21, 16);
    const n2 = ruidoPeriodico(22, 96);
    const rnd = aleatorio(23);
    const pedras = [];
    for (let i = 0; i < 160; i++) pedras.push([rnd(), rnd(), 0.004 + rnd() * 0.012, 0.6 + rnd() * 0.5]);
    const { cor, alt } = gerar(T, (x, y, p) => {
      const u = x / T, v = y / T;
      const g = fbmP(n1, u * 16, v * 16, 4);
      const f = n2(u * 96, v * 96);
      let h = g * 0.6 + f * 0.4;
      let pd = 0;
      for (const [px, py, r, c] of pedras) {
        let dx = Math.abs(u - px); dx = Math.min(dx, 1 - dx);
        let dy = Math.abs(v - py); dy = Math.min(dy, 1 - dy);
        const d = Math.hypot(dx, dy);
        if (d < r) { pd = Math.max(pd, (1 - d / r) * c); }
      }
      h += pd * 0.8;
      const k = 0.65 + 0.55 * g;
      p[0] = cl((92 + 40 * f + 70 * pd) * k);
      p[1] = cl((74 + 32 * f + 66 * pd) * k);
      p[2] = cl((54 + 22 * f + 60 * pd) * k);
      p[3] = h;
    });
    tex.terra = paraTextura(cor, true, aniso);
    tex.terraN = paraTextura(normalDeAltura(alt, T, 3), false, aniso);
  }

  // ---------- Rocha ----------
  {
    const n1 = ruidoPeriodico(31, 8);
    const n2 = ruidoPeriodico(32, 32);
    const n3 = ruidoPeriodico(33, 128);
    const { cor, alt } = gerar(T, (x, y, p) => {
      const u = x / T, v = y / T;
      const g = fbmP(n1, u * 8, v * 8, 5);
      const camadas = Math.sin((v * 22 + g * 5) * Math.PI) * 0.5 + 0.5;
      const fenda = 1 - Math.abs(n2(u * 32, v * 32) * 2 - 1);
      const racha = Math.pow(fenda, 14);
      const grao = n3(u * 128, v * 128);
      const h = g * 0.6 + camadas * 0.2 + grao * 0.2 - racha * 0.6;
      const b = (88 + 55 * g + 20 * camadas + 22 * grao) * (1 - racha * 0.6);
      p[0] = cl(b * 1.0);
      p[1] = cl(b * 0.97);
      p[2] = cl(b * 0.92);
      p[3] = h;
    });
    tex.rocha = paraTextura(cor, true, aniso);
    tex.rochaN = paraTextura(normalDeAltura(alt, T, 4), false, aniso);
  }

  // ---------- Lama ----------
  {
    const n1 = ruidoPeriodico(41, 8);
    const n2 = ruidoPeriodico(42, 64);
    const { cor } = gerar(T / 2, (x, y, p) => {
      const u = x / (T / 2), v = y / (T / 2);
      const g = fbmP(n1, u * 8, v * 8, 4);
      const f = n2(u * 64, v * 64);
      p[0] = cl(48 + 30 * g + 10 * f);
      p[1] = cl(46 + 28 * g + 10 * f);
      p[2] = cl(30 + 14 * g + 6 * f);
      p[3] = g;
    });
    tex.lama = paraTextura(cor, true, aniso);
  }

  // ---------- Pedra aparelhada (muros) ----------
  {
    const n1 = ruidoPeriodico(51, 16);
    const n2 = ruidoPeriodico(52, 128);
    const rnd = aleatorio(53);
    const linhas = 8;
    const tons = [];
    for (let i = 0; i < 200; i++) tons.push(0.75 + rnd() * 0.4);
    const { cor, alt } = gerar(T, (x, y, p) => {
      const u = x / T, v = y / T;
      const linha = Math.floor(v * linhas);
      const desvio = (linha % 2) * 0.5;
      const colunas = 4;
      const cu = u * colunas + desvio;
      const col = Math.floor(cu);
      const fu = cu - col;
      const fv = v * linhas - linha;
      const juntaU = Math.min(fu, 1 - fu) * 4;
      const juntaV = Math.min(fv, 1 - fv) * 2;
      const junta = Math.min(juntaU, juntaV);
      const argamassa = junta < 0.06 ? 1 : 0;
      const borda = Math.min(1, junta / 0.18);
      const tom = tons[(linha * 13 + ((col % colunas) + colunas) % colunas * 7) % tons.length];
      const g = fbmP(n1, u * 16, v * 16, 4);
      const grao = n2(u * 128, v * 128);
      const h = argamassa ? 0 : 0.5 + 0.3 * borda + 0.2 * g;
      let b = (95 + 45 * g + 18 * grao) * tom;
      if (argamassa) b = 52 + 20 * grao;
      const musgo = Math.max(0, g - 0.6) * (1 - v) * 3;
      p[0] = cl(b * (1 - musgo * 0.25));
      p[1] = cl(b * 0.96 + musgo * 18);
      p[2] = cl(b * 0.88 * (1 - musgo * 0.3));
      p[3] = h;
    });
    tex.pedra = paraTextura(cor, true, aniso);
    tex.pedraN = paraTextura(normalDeAltura(alt, T, 5), false, aniso);
  }

  // ---------- Casca de árvore ----------
  {
    const n1 = ruidoPeriodico(61, 16);
    const n2 = ruidoPeriodico(62, 64);
    const { cor, alt } = gerar(256, (x, y, p) => {
      const u = x / 256, v = y / 256;
      const fibra = n1(u * 16, v * 2);
      const fenda = Math.pow(1 - Math.abs(n2(u * 64, v * 6) * 2 - 1), 6);
      const h = fibra * 0.7 - fenda * 0.5;
      const b = 52 + 40 * fibra - 30 * fenda;
      p[0] = cl(b * 1.05);
      p[1] = cl(b * 0.9);
      p[2] = cl(b * 0.75);
      p[3] = h;
    });
    tex.casca = paraTextura(cor, true, aniso);
    tex.cascaN = paraTextura(normalDeAltura(alt, 256, 4), false, aniso);
  }

  // ---------- Metal gasto (rugosidade) ----------
  {
    const n1 = ruidoPeriodico(71, 32);
    const n2 = ruidoPeriodico(72, 256);
    const { cor } = gerar(256, (x, y, p) => {
      const u = x / 256, v = y / 256;
      const g = fbmP(n1, u * 32, v * 32, 3);
      const risco = Math.pow(n2(u * 256, v * 12), 8);
      const r = cl(110 + 90 * g - 80 * risco);
      p[0] = r; p[1] = r; p[2] = r; p[3] = 0;
    });
    tex.metalRug = paraTextura(cor, false, aniso);
  }

  // ---------- Tecido ----------
  {
    const n1 = ruidoPeriodico(81, 16);
    const { cor } = gerar(128, (x, y, p) => {
      const u = x / 128, v = y / 128;
      const trama = (Math.sin(u * 128 * Math.PI) * Math.sin(v * 128 * Math.PI)) * 0.5 + 0.5;
      const g = fbmP(n1, u * 16, v * 16, 3);
      const b = 150 + 60 * g + 30 * trama;
      p[0] = cl(b); p[1] = cl(b); p[2] = cl(b); p[3] = 0;
    });
    tex.tecido = paraTextura(cor, true, aniso);
  }

  // ---------- Ondulação da água (normais) ----------
  {
    const n1 = ruidoPeriodico(91, 16);
    const n2 = ruidoPeriodico(92, 32);
    const tam = 256;
    const alt = new Float32Array(tam * tam);
    for (let y = 0; y < tam; y++) {
      for (let x = 0; x < tam; x++) {
        const u = x / tam, v = y / tam;
        alt[y * tam + x] = fbmP(n1, u * 16, v * 16, 3) * 0.7 + n2(u * 32, v * 32) * 0.3;
      }
    }
    tex.aguaN = paraTextura(normalDeAltura(alt, tam, 6), false, aniso);
  }

  // ---------- Brilho suave (partículas) ----------
  {
    const c = criarCanvas(64);
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.6)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    tex.brilho = new THREE.CanvasTexture(c);
    tex.brilho.colorSpace = THREE.SRGBColorSpace;
  }

  // ---------- Chama ----------
  {
    const c = criarCanvas(64);
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 40, 2, 32, 34, 30);
    g.addColorStop(0, 'rgba(255,240,200,1)');
    g.addColorStop(0.3, 'rgba(255,160,50,0.8)');
    g.addColorStop(0.7, 'rgba(200,60,10,0.25)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    tex.chama = new THREE.CanvasTexture(c);
    tex.chama.colorSpace = THREE.SRGBColorSpace;
  }

  return tex;
}
