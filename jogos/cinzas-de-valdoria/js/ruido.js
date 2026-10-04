// Ruído procedural (simplex 2D com semente) e gerador de números aleatórios reprodutível.

export function aleatorio(semente) {
  let a = semente >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;
const GRAD = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];

export function criarSimplex(semente) {
  const rnd = aleatorio(semente);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

  return function ruido(x, y) {
    const s = (x + y) * F2;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);
    const t = (i + j) * G2;
    const x0 = x - (i - t);
    const y0 = y - (j - t);
    const i1 = x0 > y0 ? 1 : 0;
    const j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;
    const ii = i & 255;
    const jj = j & 255;
    let n = 0;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 > 0) {
      const g = GRAD[perm[ii + perm[jj]] & 7];
      t0 *= t0;
      n += t0 * t0 * (g[0] * x0 + g[1] * y0);
    }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 > 0) {
      const g = GRAD[perm[ii + i1 + perm[jj + j1]] & 7];
      t1 *= t1;
      n += t1 * t1 * (g[0] * x1 + g[1] * y1);
    }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 > 0) {
      const g = GRAD[perm[ii + 1 + perm[jj + 1]] & 7];
      t2 *= t2;
      n += t2 * t2 * (g[0] * x2 + g[1] * y2);
    }
    return 70 * n; // aproximadamente [-1, 1]
  };
}

export function fbm(ruido, x, y, oitavas = 5, lacunaridade = 2, ganho = 0.5) {
  let soma = 0;
  let amp = 1;
  let freq = 1;
  let norma = 0;
  for (let o = 0; o < oitavas; o++) {
    soma += amp * ruido(x * freq, y * freq);
    norma += amp;
    amp *= ganho;
    freq *= lacunaridade;
  }
  return soma / norma;
}

export function cristas(ruido, x, y, oitavas = 5) {
  let soma = 0;
  let amp = 0.5;
  let freq = 1;
  let peso = 1;
  for (let o = 0; o < oitavas; o++) {
    let n = 1 - Math.abs(ruido(x * freq, y * freq));
    n *= n * peso;
    peso = Math.min(1, n * 2);
    soma += n * amp;
    amp *= 0.5;
    freq *= 2.1;
  }
  return soma;
}

export const suave = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export const misturar = (a, b, t) => a + (b - a) * t;
export const limitar = (x, a, b) => Math.min(b, Math.max(a, x));

// Ruído de valor periódico (para texturas que se repetem sem costuras).
export function ruidoPeriodico(semente, periodo) {
  const rnd = aleatorio(semente);
  const grelha = new Float32Array(periodo * periodo);
  for (let i = 0; i < grelha.length; i++) grelha[i] = rnd();
  return function (x, y) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = x - xi;
    const fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const m = (v) => ((v % periodo) + periodo) % periodo;
    const a = grelha[m(yi) * periodo + m(xi)];
    const b = grelha[m(yi) * periodo + m(xi + 1)];
    const c = grelha[m(yi + 1) * periodo + m(xi)];
    const d = grelha[m(yi + 1) * periodo + m(xi + 1)];
    return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
  };
}
