// Texturas de detalhe (aço martelado, couro, malha de aço, tecido, madeira, brasões, pele, pelo e
// tecido rasgado), partilhadas pelos braços da primeira pessoa e pelos modelos das personagens.
import * as THREE from '../vendor/three.js';
import { gerar, normalDeAltura, paraTextura, fbmP, criarCanvas } from './texturas.js';
import { ruidoPeriodico } from './ruido.js';

const cl = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);
const cache = new Map();

export function criarTexturasDetalhe(qualidade) {
  if (!cache.has(qualidade)) cache.set(qualidade, gerarTexturas(qualidade));
  return cache.get(qualidade);
}

function gerarTexturas(qualidade) {
  const T = qualidade === 'alta' ? 512 : 256;
  const r = {};
  // aço martelado e riscado
  {
    const n1 = ruidoPeriodico(301, 4);
    const n2 = ruidoPeriodico(302, 24);
    const n3 = ruidoPeriodico(303, 128);
    const n4 = ruidoPeriodico(304, 64);
    const altura = new Float32Array(T * T);
    const { cor } = gerar(T, (x, y, p) => {
      const u = x / T, v = y / T;
      const sujo = fbmP(n1, u * 4, v * 4, 3);
      const martelo = fbmP(n2, u * 24, v * 24, 2);
      const risco = Math.pow(n3(u * 128, v * 9 + u * 3), 12) + Math.pow(n4(u * 7 + v * 2, v * 64), 14) * 0.7;
      const b = 168 + martelo * 30 - sujo * 55 + risco * 60;
      p[0] = cl(b * 0.98);
      p[1] = cl(b * 0.97);
      p[2] = cl(b * 0.95);
      p[3] = 0;
      altura[y * T + x] = martelo * 0.8 - risco * 0.5;
    });
    r.aco = paraTextura(cor, true);
    r.acoN = paraTextura(normalDeAltura(altura, T, 3), false);
    const { cor: rug } = gerar(T, (x, y, p) => {
      const u = x / T, v = y / T;
      const sujo = fbmP(n1, u * 4, v * 4, 3);
      const risco = Math.pow(n3(u * 128, v * 9 + u * 3), 12);
      const g = cl(70 + sujo * 120 + risco * 90);
      p[0] = g; p[1] = g; p[2] = g; p[3] = 0;
    });
    r.acoRug = paraTextura(rug, false);
  }
  // couro com grão e costuras
  {
    const n1 = ruidoPeriodico(311, 64);
    const n2 = ruidoPeriodico(312, 8);
    const { cor, alt } = gerar(T / 2, (x, y, p) => {
      const u = x / (T / 2), v = y / (T / 2);
      const grao = n1(u * 64, v * 64);
      const manchas = fbmP(n2, u * 8, v * 8, 3);
      const costura = (Math.abs(((v * 8) % 1) - 0.5) < 0.04 && ((u * 24) % 1) < 0.55) ? 1 : 0;
      const b = 0.75 + manchas * 0.35 + grao * 0.15 - costura * 0.25;
      p[0] = cl(98 * b + costura * 40);
      p[1] = cl(66 * b + costura * 34);
      p[2] = cl(42 * b + costura * 24);
      p[3] = grao * 0.6 - costura * 0.6;
    });
    r.couro = paraTextura(cor, true);
    r.couroN = paraTextura(normalDeAltura(alt, T / 2, 3), false);
  }
  // malha de aço (anéis entrelaçados)
  {
    const Tm = 256;
    const aneis = 16;
    const { cor, alt } = gerar(Tm, (x, y, p) => {
      const cu = (x / Tm) * aneis;
      const cv = (y / Tm) * aneis * 1.6;
      const linha = Math.floor(cv);
      const fu = cu + (linha % 2) * 0.5;
      const dx = (fu % 1) - 0.5;
      const dy = (cv % 1) - 0.5;
      const d = Math.hypot(dx, dy * 0.8);
      const anel = Math.max(0, 1 - Math.abs(d - 0.32) / 0.12);
      const b = 52 + anel * 120;
      p[0] = cl(b); p[1] = cl(b * 0.98); p[2] = cl(b * 0.95);
      p[3] = anel;
    });
    r.malha = paraTextura(cor, true);
    r.malhaN = paraTextura(normalDeAltura(alt, Tm, 6), false);
    r.malha.repeat.set(2.5, 1.6);
    r.malhaN.repeat.set(2.5, 1.6);
  }
  // tecido da manga
  {
    const n1 = ruidoPeriodico(321, 16);
    const { cor } = gerar(128, (x, y, p) => {
      const u = x / 128, v = y / 128;
      const trama = (Math.sin(u * 128 * Math.PI) * Math.sin(v * 128 * Math.PI)) * 0.5 + 0.5;
      const g = fbmP(n1, u * 16, v * 16, 3);
      const b = 0.7 + g * 0.35 + trama * 0.12;
      p[0] = cl(64 * b); p[1] = cl(30 * b); p[2] = cl(26 * b); p[3] = 0;
    });
    r.tecido = paraTextura(cor, true);
  }
  // pega enrolada em couro (espiral)
  {
    const { cor, alt } = gerar(128, (x, y, p) => {
      const u = x / 128, v = y / 128;
      const espiral = ((v * 10 + u) % 1);
      const sulco = Math.min(espiral, 1 - espiral) < 0.08 ? 1 : 0;
      const b = 0.8 + Math.sin(u * 60) * 0.05 - sulco * 0.45;
      p[0] = cl(70 * b); p[1] = cl(46 * b); p[2] = cl(30 * b);
      p[3] = 1 - sulco;
    });
    r.pega = paraTextura(cor, true);
    r.pegaN = paraTextura(normalDeAltura(alt, 128, 4), false);
  }
  // madeira em tábuas com veio fino (cabo do machado, costas do escudo)
  {
    const n1 = ruidoPeriodico(331, 8);
    const n2 = ruidoPeriodico(332, 64);
    const n3 = ruidoPeriodico(333, 16);
    const tabuas = 4;
    const { cor, alt } = gerar(256, (x, y, p) => {
      const u = x / 256, v = y / 256;
      const t = Math.floor(u * tabuas);
      const fu = u * tabuas - t;
      const tom = 0.82 + ((t * 7919) % 5) * 0.05;
      const ondula = fbmP(n1, u * 8, v * 8, 3) * 0.6;
      const veio = Math.pow(Math.abs(Math.sin((fu * 9 + ondula * 3 + t * 1.7) * Math.PI)), 0.35);
      const fibra = n2(u * 64, v * 4) * 0.25;
      const no = Math.max(0, 1 - Math.hypot((fu - 0.5) * 3, ((v + t * 0.37) % 1 - 0.5) * 6)) * fbmP(n3, u * 16, v * 16, 2);
      const junta = Math.min(fu, 1 - fu) < 0.025 ? 1 : 0;
      const b = (0.55 + veio * 0.3 + fibra - no * 0.5) * tom * (1 - junta * 0.65);
      p[0] = cl(128 * b); p[1] = cl(88 * b); p[2] = cl(54 * b);
      p[3] = veio * 0.3 + fibra - junta * 1.2;
    });
    r.madeira = paraTextura(cor, true);
    r.madeiraN = paraTextura(normalDeAltura(alt, 256, 3), false);
  }
  // escudos pintados: o do Cinzento (Árvore Áurea) e o dos cavaleiros caídos (espada partida)
  const Te = qualidade === 'alta' ? 1024 : 512;
  [r.escudo, r.escudoN] = pintarEscudo(Te, 341, (x) => {
    const grad = x.createLinearGradient(0, 0, 0, Te);
    grad.addColorStop(0, '#6e1712');
    grad.addColorStop(1, '#3e0c0a');
    x.fillStyle = grad;
    x.fillRect(0, 0, Te, Te);
    x.strokeStyle = '#b8902e';
    x.lineWidth = Te * 0.035;
    x.strokeRect(Te * 0.08, Te * 0.06, Te * 0.84, Te * 0.88);
    x.save();
    x.translate(Te / 2, Te * 0.52);
    x.fillStyle = '#d6aa45';
    x.strokeStyle = '#d6aa45';
    x.lineCap = 'round';
    x.lineWidth = Te * 0.04;
    x.beginPath();
    x.moveTo(0, Te * 0.28);
    x.lineTo(0, -Te * 0.05);
    x.stroke();
    const ramo = (comp, ang, larg, nivel) => {
      x.save();
      x.rotate(ang);
      x.lineWidth = larg;
      x.beginPath();
      x.moveTo(0, 0);
      x.lineTo(0, -comp);
      x.stroke();
      x.translate(0, -comp);
      if (nivel > 0) {
        ramo(comp * 0.7, -0.45, larg * 0.65, nivel - 1);
        ramo(comp * 0.7, 0.45, larg * 0.65, nivel - 1);
      } else {
        x.beginPath();
        x.arc(0, 0, larg * 1.6, 0, Math.PI * 2);
        x.fill();
      }
      x.restore();
    };
    x.translate(0, -Te * 0.05);
    ramo(Te * 0.13, -0.5, Te * 0.03, 3);
    ramo(Te * 0.13, 0.5, Te * 0.03, 3);
    ramo(Te * 0.15, 0, Te * 0.03, 3);
    x.restore();
    x.beginPath();
    x.arc(Te / 2, Te * 0.32, Te * 0.27, 0, Math.PI * 2);
    x.strokeStyle = 'rgba(214, 170, 69, 0.85)';
    x.lineWidth = Te * 0.012;
    x.stroke();
  });
  const Tc = Te / 2;
  [r.escudoCav, r.escudoCavN] = pintarEscudo(Tc, 351, (x) => {
    const grad = x.createLinearGradient(0, 0, 0, Tc);
    grad.addColorStop(0, '#1d2a3c');
    grad.addColorStop(1, '#0e1520');
    x.fillStyle = grad;
    x.fillRect(0, 0, Tc, Tc);
    // asna prateada
    x.fillStyle = '#9aa0a6';
    x.beginPath();
    x.moveTo(Tc * 0.05, Tc * 0.62);
    x.lineTo(Tc * 0.5, Tc * 0.3);
    x.lineTo(Tc * 0.95, Tc * 0.62);
    x.lineTo(Tc * 0.95, Tc * 0.74);
    x.lineTo(Tc * 0.5, Tc * 0.42);
    x.lineTo(Tc * 0.05, Tc * 0.74);
    x.closePath();
    x.fill();
    // espada partida a apontar para baixo
    x.fillStyle = '#c4c8cc';
    x.fillRect(Tc * 0.485, Tc * 0.08, Tc * 0.03, Tc * 0.1);
    x.fillRect(Tc * 0.41, Tc * 0.17, Tc * 0.18, Tc * 0.025);
    x.beginPath();
    x.moveTo(Tc * 0.47, Tc * 0.2);
    x.lineTo(Tc * 0.53, Tc * 0.2);
    x.lineTo(Tc * 0.525, Tc * 0.3);
    x.lineTo(Tc * 0.49, Tc * 0.27);
    x.lineTo(Tc * 0.475, Tc * 0.33);
    x.closePath();
    x.fill();
    x.strokeStyle = '#7d848a';
    x.lineWidth = Tc * 0.03;
    x.strokeRect(Tc * 0.06, Tc * 0.05, Tc * 0.88, Tc * 0.9);
  });

  // pele seca e gretada dos esvaziados
  {
    const n1 = ruidoPeriodico(361, 8);
    const n2 = ruidoPeriodico(362, 32);
    const n3 = ruidoPeriodico(363, 16);
    const { cor, alt } = gerar(256, (x, y, p) => {
      const u = x / 256, v = y / 256;
      const manchas = fbmP(n1, u * 8, v * 8, 3);
      const greta = Math.pow(1 - Math.abs(n3(u * 16, v * 16) * 2 - 1), 24) * 0.8 + Math.pow(1 - Math.abs(n2(u * 32, v * 32) * 2 - 1), 30) * 0.5;
      const veia = Math.pow(1 - Math.abs(fbmP(n3, u * 6 + 3, v * 16, 2) * 2 - 1), 30) * 0.5;
      const b = 0.78 + manchas * 0.3 - greta * 0.22;
      p[0] = cl(158 * b - veia * 25); p[1] = cl(148 * b - veia * 18); p[2] = cl(136 * b + veia * 6);
      p[3] = manchas * 0.4 - greta * 0.5;
    });
    r.pele = paraTextura(cor, true);
    r.peleN = paraTextura(normalDeAltura(alt, 256, 1.4), false);
    r.pele.repeat.set(3, 2);
    r.peleN.repeat.set(3, 2);
  }
  // pelo de lobo: fios ao longo de v, em tufos, com pontas mais claras
  {
    const n1 = ruidoPeriodico(371, 64);
    const n2 = ruidoPeriodico(372, 8);
    const n3 = ruidoPeriodico(373, 16);
    const { cor, alt } = gerar(256, (x, y, p) => {
      const u = x / 256, v = y / 256;
      const tufo = fbmP(n2, u * 8, v * 8, 3);
      const fio = n1(u * 64 + tufo * 6, v * 5);
      const fio2 = n1(u * 64 * 1.7 + 13, v * 9 + tufo * 3);
      const f = fio * 0.6 + fio2 * 0.4;
      const ponta = Math.max(0, f - 0.55) * 2;
      const b = 0.45 + f * 0.6 + fbmP(n3, u * 16, v * 16, 2) * 0.15;
      p[0] = cl(110 * b + ponta * 40); p[1] = cl(102 * b + ponta * 38); p[2] = cl(94 * b + ponta * 36);
      p[3] = f;
    });
    r.pelo = paraTextura(cor, true);
    r.peloN = paraTextura(normalDeAltura(alt, 256, 6), false);
    r.pelo.repeat.set(4, 3);
    r.peloN.repeat.set(4, 3);
  }
  // máscara de tecido rasgado (orla de baixo esfarrapada e buracos)
  {
    const n1 = ruidoPeriodico(381, 32);
    const n2 = ruidoPeriodico(382, 8);
    const { cor } = gerar(256, (x, y, p) => {
      const u = x / 256, v = 1 - y / 256; // v = 0 em baixo
      const corte = 0.04 + fbmP(n1, u * 32, 0.5, 2) * 0.22 + Math.abs(Math.sin(u * Math.PI * 7)) * 0.08;
      const buraco = fbmP(n2, u * 8, v * 8, 4) > 0.7 && v < 0.75;
      const g = v < corte || buraco ? 0 : 255;
      p[0] = g; p[1] = g; p[2] = g; p[3] = 0;
    });
    r.rasgado = paraTextura(cor, false);
  }
  return r;
}


// Pinta um brasão (desenho em canvas) e lasca a tinta para mostrar a madeira.
function pintarEscudo(Te, semente, desenho) {
  const c = criarCanvas(Te);
  const x = c.getContext('2d');
  desenho(x);
  const img = x.getImageData(0, 0, Te, Te);
  const n1 = ruidoPeriodico(semente, 16);
  const n2 = ruidoPeriodico(semente + 1, 64);
  const n3 = ruidoPeriodico(semente + 2, 128);
  const alt = new Float32Array(Te * Te);
  for (let yy = 0; yy < Te; yy++) {
    for (let xx = 0; xx < Te; xx++) {
      const u = xx / Te, v = yy / Te;
      const i = (yy * Te + xx) * 4;
      const lasca = fbmP(n1, u * 16, v * 16, 4) + Math.hypot(u - 0.5, v - 0.5) * 0.35;
      const madeira = 0.75 + Math.sin((u * 40 + n2(u * 8, v * 64) * 4) * Math.PI) * 0.12;
      const risco = Math.pow(n3(u * 128 + v * 30, v * 10), 14);
      const sujo = fbmP(n2, u * 64, v * 64, 2);
      let rr = img.data[i], gg = img.data[i + 1], bb = img.data[i + 2];
      const semTinta = lasca > 0.72;
      if (semTinta) {
        rr = 120 * madeira; gg = 86 * madeira; bb = 56 * madeira;
      }
      const k = (0.78 + sujo * 0.3) * (1 - risco * 0.35);
      img.data[i] = cl(rr * k + risco * 60);
      img.data[i + 1] = cl(gg * k + risco * 55);
      img.data[i + 2] = cl(bb * k + risco * 50);
      alt[yy * Te + xx] = (semTinta ? 0.2 : 0.6) + sujo * 0.15 - risco * 0.4;
    }
  }
  x.putImageData(img, 0, 0);
  const t = paraTextura(c, true);
  const n = paraTextura(normalDeAltura(alt, Te, 4), false);
  t.wrapS = t.wrapT = n.wrapS = n.wrapT = THREE.ClampToEdgeWrapping;
  return [t, n];
}
