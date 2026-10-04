// Primeira pessoa: braços com manoplas articuladas, armas, escudo e frasco em alta qualidade,
// desenhados numa camada própria (nunca atravessam paredes) e animados para cada ação do jogador.
import * as THREE from '../vendor/three.js';
import { criarTexturasDetalhe } from './texturas-detalhe.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const suave = (t) => {
  t = Math.min(1, Math.max(0, t));
  return t * t * (3 - 2 * t);
};

// ------------------------------------------------------------------ materiais

function materiais(t, env) {
  const metal = (cor, rug) => new THREE.MeshStandardMaterial({
    color: cor, map: t.aco, normalMap: t.acoN, normalScale: new THREE.Vector2(0.6, 0.6), roughnessMap: t.acoRug,
    metalness: 1, roughness: rug, envMap: env, envMapIntensity: 1.1,
  });
  return {
    aco: metal(0xc8c4bc, 0.85),
    acoEscuro: metal(0x77736d, 1),
    lamina: metal(0xcfccc6, 0.85),
    gume: new THREE.MeshStandardMaterial({ color: 0xe8eaec, metalness: 1, roughness: 0.32, envMap: env, envMapIntensity: 1.0 }),
    sulco: metal(0x6a6a6c, 0.9),
    latao: new THREE.MeshStandardMaterial({ color: 0xc9a050, metalness: 1, roughness: 0.38, roughnessMap: t.acoRug, envMap: env, envMapIntensity: 1.2 }),
    couro: new THREE.MeshStandardMaterial({ map: t.couro, normalMap: t.couroN, roughness: 0.78, metalness: 0, envMap: env, envMapIntensity: 0.4 }),
    couroEscuro: new THREE.MeshStandardMaterial({ map: t.couro, normalMap: t.couroN, color: 0x6a5a50, roughness: 0.82, envMap: env, envMapIntensity: 0.3 }),
    pega: new THREE.MeshStandardMaterial({ map: t.pega, normalMap: t.pegaN, roughness: 0.7, envMap: env, envMapIntensity: 0.3 }),
    malha: new THREE.MeshStandardMaterial({ map: t.malha, normalMap: t.malhaN, metalness: 0.9, roughness: 0.55, envMap: env, envMapIntensity: 0.8 }),
    tecido: new THREE.MeshStandardMaterial({ map: t.tecido, roughness: 1, envMap: env, envMapIntensity: 0.2 }),
    madeira: new THREE.MeshStandardMaterial({ map: t.madeira, normalMap: t.madeiraN, roughness: 0.75, envMap: env, envMapIntensity: 0.3 }),
    escudo: new THREE.MeshStandardMaterial({ map: t.escudo, normalMap: t.escudoN, roughness: 0.62, metalness: 0.05, envMap: env, envMapIntensity: 0.5 }),
    vidro: new THREE.MeshStandardMaterial({ color: 0xffe8c8, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.16, envMap: env, envMapIntensity: 1.2, depthWrite: false }),
    liquido: new THREE.MeshStandardMaterial({ color: 0xff6a10, emissive: 0xff5a00, emissiveIntensity: 1.1, roughness: 0.2 }),
    rolha: new THREE.MeshStandardMaterial({ color: 0x8a6a48, roughness: 1 }),
  };
}

function malha(g, m) {
  const o = new THREE.Mesh(g, m);
  o.frustumCulled = false;
  return o;
}

function placa(l, a, e, raio, m) {
  return malha(new THREE.RoundedBoxGeometry(l, a, e, 3, Math.min(raio, Math.min(l, a, e) / 2 - 1e-4)), m);
}

// Junta todas as peças com o mesmo material numa só malha (menos chamadas de desenho).
function fundir(raiz) {
  raiz.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(raiz.matrixWorld).invert();
  const porMat = new Map();
  raiz.traverse((o) => {
    if (!o.isMesh || Array.isArray(o.material) || o.userData.manter) return;
    let l = porMat.get(o.material);
    if (!l) porMat.set(o.material, (l = []));
    l.push(o);
  });
  for (const [mat, lista] of porMat) {
    if (lista.length < 2) continue;
    const geos = lista.map((o) => {
      let g = o.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
      if (g.index) g = g.toNonIndexed();
      for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
      g.clearGroups();
      return g;
    });
    const unida = THREE.mergeGeometries(geos, false);
    if (!unida) continue;
    for (const o of lista) o.parent.remove(o);
    raiz.add(malha(unida, mat));
  }
  return raiz;
}

// coloca um objeto entre dois pontos (o eixo Y do objeto fica alinhado com o segmento)
function entre(o, a, b) {
  const d = b.clone().sub(a);
  o.position.copy(a).addScaledVector(d, 0.5);
  o.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize());
  return o;
}

// ------------------------------------------------------------------ braço e manopla

// Referencial da mão: origem no centro da pega; +Y = eixo da pega (lâmina para cima);
// +Z = para trás, para o antebraço; +X = costas da mão. Os dedos saem dos nós (lado +X),
// dão a volta à pega pela frente (-Z) e acabam do lado de dentro (-X), como num punho fechado.
const RAIO_PEGA = 0.014;

// anel parcial à volta da pega (ângulo a: 0 = +X, cresce para a frente -Z)
function arco(raio, tubo, a0, a1, m, segs = 10) {
  const g = new THREE.TorusGeometry(raio, tubo, 10, segs, a1 - a0);
  g.rotateX(-Math.PI / 2);
  g.rotateY(a0);
  return malha(g, m);
}
// casca curva (parte de um cilindro) com o eixo ao longo de Z
function casca(raio, comp, ang, m) {
  const g = new THREE.CylinderGeometry(raio, raio * 0.97, comp, 14, 1, true, Math.PI / 2 - ang / 2, ang);
  g.rotateX(Math.PI / 2);
  const o = malha(g, m);
  m.side = THREE.DoubleSide;
  return o;
}

function criarBraco(M) {
  const g = new THREE.Group();
  const Rf = RAIO_PEGA + 0.0092;
  // palma e corpo da mão em couro
  const palma = placa(0.032, 0.088, 0.062, 0.013, M.couroEscuro);
  palma.position.set(0.02, 0, 0.034);
  g.add(palma);
  // costas da mão: duas lâminas de aço sobrepostas e uma guarda curva sobre os nós dos dedos
  const l1 = casca(0.07, 0.036, 1.25, M.aco);
  l1.position.set(0.037 - 0.07, 0, 0.05);
  g.add(l1);
  const l2 = casca(0.068, 0.036, 1.2, M.acoEscuro);
  l2.position.set(0.034 - 0.068, 0, 0.02);
  g.add(l2);
  const guardaNos = new THREE.Group();
  const gn = malha(new THREE.CylinderGeometry(Rf + 0.014, Rf + 0.014, 0.088, 16, 1, true, Math.PI / 2 - 0.62, 0.8), M.aco);
  gn.material.side = THREE.DoubleSide;
  guardaNos.add(gn);
  for (const y of [-0.044, 0.044]) {
    const orla = arco(Rf + 0.014, 0.0022, -0.62, 0.18, M.latao, 6);
    orla.position.y = y;
    guardaNos.add(orla);
  }
  g.add(guardaNos);
  const geoReb = new THREE.SphereGeometry(0.0032, 8, 6);
  for (const y of [-0.03, 0, 0.03]) {
    const r = malha(geoReb, M.latao);
    r.position.set(Math.cos(-0.25) * (Rf + 0.016), y, -Math.sin(-0.25) * (Rf + 0.016));
    g.add(r);
  }
  // dedos: couro por baixo e três falanges de aço articuladas por cima
  const niveis = [0.031, 0.0105, -0.0095, -0.0285];
  const falanges = [[-0.3, 0.95], [1.03, 2.2], [2.28, 3.35]];
  niveis.forEach((y, d) => {
    const e = [1, 1, 0.95, 0.86][d];
    const dedo = arco(Rf, 0.0082 * e, -0.3, 3.5, M.couroEscuro, 18);
    dedo.position.y = y;
    g.add(dedo);
    falanges.forEach(([a0, a1], f) => {
      const lam = arco(Rf + 0.0012, 0.0094 * e, a0, a1, f === 0 ? M.aco : M.acoEscuro, 6);
      lam.position.y = y;
      lam.scale.y = 0.92;
      g.add(lam);
    });
    const ponta = malha(new THREE.SphereGeometry(0.0085 * e, 10, 8), M.couroEscuro);
    ponta.position.set(Math.cos(3.5) * Rf, y, -Math.sin(3.5) * Rf);
    g.add(ponta);
    const no = malha(new THREE.SphereGeometry(0.0105 * e, 12, 8), M.aco);
    no.position.set(Math.cos(-0.3) * Rf, y, -Math.sin(-0.3) * Rf);
    g.add(no);
  });
  // polegar: sai da base da palma e fecha por cima da pega, junto à guarda
  const curva = new THREE.CatmullRomCurve3([V(0.022, 0.012, 0.05), V(0.012, 0.03, 0.03), V(-0.012, 0.043, 0.02), V(-0.028, 0.044, 0.002), V(-0.033, 0.04, -0.012)]);
  g.add(malha(new THREE.TubeGeometry(curva, 16, 0.0105, 10, false), M.couroEscuro));
  const pts = curva.getSpacedPoints(16);
  const geoPol = (a, b, r) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.slice(a, b + 1)), 6, r, 10, false);
  g.add(malha(geoPol(1, 8, 0.0122), M.aco));
  g.add(malha(geoPol(9, 13, 0.0118), M.acoEscuro));
  const pontaPol = malha(new THREE.SphereGeometry(0.0102, 10, 8), M.couroEscuro);
  pontaPol.position.copy(pts[16]);
  g.add(pontaPol);

  // antebraço: eixo do pulso para o cotovelo
  const ante = new THREE.Group();
  ante.position.set(0.02, -0.004, 0.066);
  ante.quaternion.setFromUnitVectors(V(0, 1, 0), V(0.05, -0.9, 1).normalize());
  g.add(ante);
  // punho em sino da manopla
  const sino = malha(new THREE.LatheGeometry([
    V(0.034, -0.012, 0), V(0.041, 0.004, 0), V(0.05, 0.034, 0), V(0.054, 0.05, 0), V(0.052, 0.056, 0), V(0.044, 0.058, 0),
  ].map((p) => new THREE.Vector2(p.x, p.y)), 32), M.aco);
  ante.add(sino);
  const orlaSino = malha(new THREE.TorusGeometry(0.053, 0.0028, 8, 40), M.latao);
  orlaSino.rotation.x = Math.PI / 2;
  orlaSino.position.y = 0.054;
  ante.add(orlaSino);
  // malha de aço no pulso
  const malhaPulso = malha(new THREE.CylinderGeometry(0.041, 0.039, 0.09, 24, 1, true), M.malha);
  malhaPulso.position.y = 0.09;
  ante.add(malhaPulso);
  // braçal de placas
  const perfil = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    let raio = 0.044 + t * 0.012 + Math.sin(t * Math.PI) * 0.004;
    if (i === 0 || i === 16) raio -= 0.003;
    if (i === 1 || i === 15) raio += 0.004;
    perfil.push(new THREE.Vector2(raio, 0.1 + t * 0.26));
  }
  const bracal = malha(new THREE.LatheGeometry(perfil, 40), M.aco);
  ante.add(bracal);
  for (const y of [0.1, 0.36]) {
    const aro = malha(new THREE.TorusGeometry(y < 0.2 ? 0.045 : 0.057, 0.003, 8, 48), M.latao);
    aro.rotation.x = Math.PI / 2;
    aro.position.y = y;
    ante.add(aro);
  }
  // correias de couro com fivelas
  for (const y of [0.16, 0.29]) {
    const r = 0.048 + (y - 0.1) * 0.046;
    const correia = malha(new THREE.CylinderGeometry(r + 0.003, r + 0.003, 0.022, 40, 1, true), M.couro);
    correia.position.y = y;
    ante.add(correia);
    const fivela = placa(0.006, 0.026, 0.02, 0.002, M.latao);
    fivela.position.set(r + 0.006, y, 0);
    ante.add(fivela);
  }
  // rebites ao longo do braçal
  const geoRebite = new THREE.SphereGeometry(0.0035, 8, 6);
  for (let i = 0; i < 9; i++) {
    const y = 0.12 + i * 0.028;
    const r = 0.045 + (y - 0.1) * 0.046;
    for (const a of [-0.55, 0.55]) {
      const reb = malha(geoRebite, M.latao);
      reb.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
      ante.add(reb);
    }
  }
  // manga de tecido a sair do braçal
  const manga = malha(new THREE.CylinderGeometry(0.062, 0.055, 0.4, 24, 1, true), M.tecido);
  manga.position.y = 0.56;
  ante.add(manga);
  return fundir(g);
}

// ------------------------------------------------------------------ armas

function criarEspada(M, comp, larg, guardaLarg, pegaComp) {
  const g = new THREE.Group();
  // lâmina com bisel, gume polido e sulco central
  const s = new THREE.Shape();
  s.moveTo(-larg / 2, 0);
  s.lineTo(larg / 2, 0);
  s.lineTo(larg * 0.42, comp * 0.82);
  s.quadraticCurveTo(larg * 0.25, comp * 0.95, 0, comp);
  s.quadraticCurveTo(-larg * 0.25, comp * 0.95, -larg * 0.42, comp * 0.82);
  s.closePath();
  const geoL = new THREE.ExtrudeGeometry(s, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.0028, bevelSize: larg * 0.16, bevelSegments: 2, curveSegments: 10 });
  geoL.translate(0, 0, -0.002);
  geoL.rotateY(Math.PI / 2);
  const lam = malha(geoL, [M.lamina, M.gume]);
  lam.position.y = 0.012;
  g.add(lam);
  for (const lado of [-1, 1]) {
    const sulco = placa(0.0016, comp * 0.6, larg * 0.22, 0.0007, M.sulco);
    sulco.position.set(lado * 0.0034, comp * 0.34, 0);
    g.add(sulco);
  }
  // guarda curva com remates
  const curva = new THREE.CatmullRomCurve3([V(0, 0.018, -guardaLarg / 2), V(0, 0.002, -guardaLarg / 4), V(0, -0.002, 0), V(0, 0.002, guardaLarg / 4), V(0, 0.018, guardaLarg / 2)]);
  const guarda = malha(new THREE.TubeGeometry(curva, 24, 0.0075, 10, false), M.acoEscuro);
  g.add(guarda);
  for (const lado of [-1, 1]) {
    const remate = malha(new THREE.SphereGeometry(0.012, 14, 10), M.latao);
    remate.position.set(0, 0.02, lado * guardaLarg / 2);
    g.add(remate);
  }
  const centro = placa(0.024, 0.026, 0.03, 0.006, M.acoEscuro);
  centro.position.y = 0.002;
  g.add(centro);
  // pega enrolada, virolas e pomo
  const pega = malha(new THREE.CylinderGeometry(0.0135, 0.0145, pegaComp, 20), M.pega);
  pega.position.y = -pegaComp / 2 + 0.005;
  g.add(pega);
  for (const y of [-0.004, -pegaComp + 0.012]) {
    const virola = malha(new THREE.CylinderGeometry(0.016, 0.016, 0.01, 20), M.latao);
    virola.position.y = y;
    g.add(virola);
  }
  const pomo = malha(new THREE.LatheGeometry([
    new THREE.Vector2(0.001, -0.026), new THREE.Vector2(0.02, -0.022), new THREE.Vector2(0.026, -0.008), new THREE.Vector2(0.022, 0.006), new THREE.Vector2(0.01, 0.012),
  ], 24), M.latao);
  pomo.position.y = -pegaComp - 0.01;
  g.add(pomo);
  const ponta = new THREE.Object3D();
  ponta.position.y = comp;
  g.add(ponta);
  const base = new THREE.Object3D();
  base.position.y = 0.05;
  g.add(base);
  g.userData = { ponta, base };
  return g;
}

function criarMachado(M) {
  const g = new THREE.Group();
  const cabo = malha(new THREE.CylinderGeometry(0.016, 0.019, 0.82, 16), M.madeira);
  cabo.position.y = 0.2;
  g.add(cabo);
  const pega = malha(new THREE.CylinderGeometry(0.02, 0.02, 0.16, 18), M.pega);
  pega.position.y = -0.01;
  g.add(pega);
  for (const y of [0.08, 0.5, 0.6]) {
    const aro = malha(new THREE.CylinderGeometry(0.022, 0.022, 0.014, 18), M.acoEscuro);
    aro.position.y = y;
    g.add(aro);
  }
  const s = new THREE.Shape();
  s.moveTo(0, -0.03);
  s.quadraticCurveTo(0.08, -0.04, 0.13, -0.1);
  s.quadraticCurveTo(0.165, 0.0, 0.13, 0.1);
  s.quadraticCurveTo(0.08, 0.04, 0, 0.03);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.008, bevelSegments: 2, curveSegments: 14 });
  geo.translate(0, 0, -0.006);
  geo.rotateY(Math.PI / 2);
  const cabeca = malha(geo, [M.lamina, M.gume]);
  cabeca.position.y = 0.55;
  cabeca.rotation.y = Math.PI; // o gume aponta para a frente (-Z)
  g.add(cabeca);
  const espigao = malha(new THREE.ConeGeometry(0.014, 0.07, 10), M.acoEscuro);
  espigao.rotation.x = -Math.PI / 2;
  espigao.position.set(0, 0.55, 0.05);
  g.add(espigao);
  const ponta = new THREE.Object3D();
  ponta.position.set(0, 0.55, -0.15);
  g.add(ponta);
  const base = new THREE.Object3D();
  base.position.set(0, 0.45, -0.02);
  g.add(base);
  g.userData = { ponta, base };
  return g;
}

export function criarArmaFP(tipo, M) {
  return fundir(criarArmaSoltas(tipo, M));
}

function criarArmaSoltas(tipo, M) {
  if (tipo === 'machado') return criarMachado(M);
  if (tipo === 'espadao') {
    const e = criarEspada(M, 1.35, 0.072, 0.3, 0.26);
    const ricasso = malha(new THREE.CylinderGeometry(0.02, 0.02, 0.09, 16), M.couro);
    ricasso.position.y = 0.075;
    e.add(ricasso);
    return e;
  }
  return criarEspada(M, 0.94, 0.05, 0.22, 0.17);
}

function criarEscudo(M) {
  const g = new THREE.Group();
  const s = new THREE.Shape();
  const L = 0.27, A = 0.33;
  s.moveTo(-L, A);
  s.quadraticCurveTo(0, A + 0.05, L, A);
  s.lineTo(L, 0.02);
  s.quadraticCurveTo(L * 0.9, -0.3, 0, -0.44);
  s.quadraticCurveTo(-L * 0.9, -0.3, -L, 0.02);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.022, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.01, bevelSegments: 3, curveSegments: 24 });
  // madeira das costas: tábuas na vertical
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 1.6, uv.getY(i) * 0.6);
  geo.translate(0, 0, -0.011);
  geo.rotateY(-Math.PI / 2); // face voltada para -X (para fora do braço)
  const corpo = malha(geo, M.madeira);
  g.add(corpo);
  // face pintada (só do lado de fora)
  const geoF = new THREE.ShapeGeometry(s, 24);
  const uvF = geoF.attributes.uv;
  for (let i = 0; i < uvF.count; i++) uvF.setXY(i, (uvF.getX(i) + L) / (2 * L), (uvF.getY(i) + 0.44) / (A + 0.05 + 0.44));
  geoF.translate(0, 0, 0.0195);
  geoF.rotateY(-Math.PI / 2);
  g.add(malha(geoF, M.escudo));
  // aro metálico
  const pts = s.getSpacedPoints(80).map((p) => V(0, p.y, p.x));
  const aro = malha(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 160, 0.021, 10, true), M.acoEscuro);
  g.add(aro);
  // umbo central e rebites
  const umbo = malha(new THREE.LatheGeometry([
    new THREE.Vector2(0.075, 0), new THREE.Vector2(0.07, 0.012), new THREE.Vector2(0.055, 0.03), new THREE.Vector2(0.03, 0.042), new THREE.Vector2(0.001, 0.046),
  ], 32), M.aco);
  umbo.rotation.z = Math.PI / 2;
  umbo.position.set(-0.022, 0.02, 0);
  g.add(umbo);
  const geoRebite = new THREE.SphereGeometry(0.0065, 10, 8);
  s.getSpacedPoints(22).forEach((p) => {
    const reb = malha(geoRebite, M.latao);
    reb.position.set(-0.027, p.y * 0.9, -p.x * 0.9);
    g.add(reb);
  });
  // por trás: almofada de couro para o braço, correias com fivelas e as pontas dos rebites
  const almofada = placa(0.02, 0.2, 0.13, 0.008, M.couroEscuro);
  almofada.position.set(0.028, 0.0, 0.07);
  g.add(almofada);
  for (const y of [0.12, -0.1]) {
    const correia = placa(0.012, 0.034, 0.34, 0.004, M.couro);
    correia.position.set(0.03, y, 0.02);
    g.add(correia);
    const fivela = placa(0.008, 0.042, 0.028, 0.002, M.latao);
    fivela.position.set(0.038, y, 0.16);
    g.add(fivela);
  }
  const geoPonta = new THREE.SphereGeometry(0.0045, 8, 6);
  s.getSpacedPoints(22).forEach((p) => {
    const pt = malha(geoPonta, M.acoEscuro);
    pt.position.set(0.021, p.y * 0.9, p.x * 0.9);
    g.add(pt);
  });
  // travessa de madeira a reforçar as tábuas
  const trav = placa(0.012, 0.05, 0.46, 0.004, M.madeira);
  trav.position.set(0.024, 0.2, 0);
  g.add(trav);
  return fundir(g);
}

function criarFrasco(M) {
  const g = new THREE.Group();
  const perfil = [
    [0.001, -0.06], [0.03, -0.058], [0.04, -0.035], [0.04, -0.005], [0.03, 0.02], [0.012, 0.04], [0.011, 0.065], [0.014, 0.07],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const vidro = malha(new THREE.LatheGeometry(perfil, 28), M.vidro);
  vidro.renderOrder = 2;
  const liquido = malha(new THREE.LatheGeometry(perfil.slice(0, 5).map((p) => new THREE.Vector2(Math.max(0.001, p.x - 0.004), p.y)), 24), M.liquido);
  const rolha = malha(new THREE.CylinderGeometry(0.013, 0.011, 0.025, 12), M.rolha);
  rolha.position.y = 0.078;
  g.add(liquido, vidro, rolha);
  return g;
}

// ------------------------------------------------------------------ poses

const m4 = new THREE.Matrix4();
const ANTE = V(0.05, -0.9, 1).normalize(); // direção do antebraço no referencial da mão (igual ao modelo)
const COTOVELO_D = [0.38, -0.62, 0.02];
const COTOVELO_E = [-0.42, -0.6, 0.0];
// pose = posição da mão + direção da pega (Y, para onde aponta a lâmina) + posição do cotovelo.
// A rotação em torno da pega é escolhida para que o antebraço do modelo aponte para o cotovelo,
// assim o braço nunca atravessa a câmara e as costas da mão ficam viradas de forma natural.
function poseQuat(p, lamina, cotovelo, esquerda) {
  const y = V(...lamina).normalize();
  const f = V(...cotovelo).sub(p).normalize();
  const ax = esquerda ? -ANTE.x : ANTE.x;
  const fPerp = f.clone().addScaledVector(y, -f.dot(y));
  const x = fPerp.multiplyScalar(ax).add(new THREE.Vector3().crossVectors(y, f).multiplyScalar(ANTE.z));
  if (x.lengthSq() < 1e-6) x.set(1, 0, 0).addScaledVector(y, -y.x);
  x.normalize();
  const z = new THREE.Vector3().crossVectors(x, y);
  m4.makeBasis(x, y, z);
  return new THREE.Quaternion().setFromRotationMatrix(m4);
}
const P = (p, l, c = COTOVELO_D) => ({ p: V(...p), q: poseQuat(V(...p), l, c, false) });
const PE = (p, l, c = COTOVELO_E) => ({ p: V(...p), q: poseQuat(V(...p), l, c, true) });

export const POSES_D = {
  repouso: P([0.25, -0.22, -0.47], [-0.22, 0.8, -0.56]),
  correr: P([0.3, -0.34, -0.42], [-0.15, 0.45, -0.88]),
  bloqueio: P([0.33, -0.3, -0.44], [-0.05, 0.75, -0.66]),
  baixo: P([0.24, -0.72, -0.36], [-0.2, 0.6, -0.78]),
  acender: P([0.1, -0.3, -0.55], [0.05, -0.5, -0.86]),
};
export const POSES_E = {
  repouso: PE([-0.36, -0.4, -0.42], [0.1, 0.95, -0.2], [-0.52, -0.62, 0]),
  correr: PE([-0.38, -0.5, -0.38], [0.1, 0.9, -0.3], [-0.52, -0.7, 0]),
  bloqueio: PE([-0.1, -0.27, -0.4], [0.05, 1, 0.05], [-0.42, -0.36, -0.2]),
  baixo: PE([-0.32, -0.82, -0.34], [0.1, 0.9, -0.3]),
  // erguer o frasco à frente dos olhos e depois incliná-lo para beber
  beberA: PE([-0.07, -0.02, -0.36], [0.15, 0.95, 0.1], [-0.4, -0.5, 0]),
  beberB: PE([-0.03, 0.0, -0.25], [0.05, 0.4, 0.92], [-0.35, -0.45, 0]),
};
// golpes: preparação, início do golpe e fim do golpe
export const GOLPES = {
  // corte diagonal da direita para a esquerda
  leve1: [P([0.3, 0.06, -0.38], [0.35, 0.6, 0.7], [0.55, -0.25, -0.05]), P([0.32, 0.1, -0.48], [0.45, 0.85, 0.1], [0.55, -0.4, -0.05]), P([-0.24, -0.15, -0.5], [-0.92, -0.02, -0.4])],
  // revés a subir da esquerda para a direita
  leve2: [P([-0.16, -0.2, -0.42], [-0.75, -0.1, 0.65]), P([-0.22, -0.18, -0.5], [-0.95, 0.2, -0.2]), P([0.34, 0.04, -0.48], [0.7, 0.7, 0.1], [0.55, -0.4, -0.05])],
  // golpe vertical por cima da cabeça
  forte: [P([0.14, 0.12, -0.32], [0.15, 0.4, 0.9], [0.5, -0.2, -0.05]), P([0.12, 0.16, -0.44], [0.1, 0.95, 0.25], [0.5, -0.3, -0.05]), P([0.02, -0.3, -0.54], [-0.15, -0.7, -0.7])],
};
export { P, PE };

function misturarPose(a, b, k, saida) {
  saida.p.lerpVectors(a.p, b.p, k);
  saida.q.slerpQuaternions(a.q, b.q, k);
  return saida;
}

// ------------------------------------------------------------------ rasto da lâmina

class Rasto {
  constructor(pai) {
    this.n = 16;
    this.base = [];
    this.ponta = [];
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(this.n * 2 * 3);
    this.alfa = new Float32Array(this.n * 2);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alfa', new THREE.BufferAttribute(this.alfa, 1).setUsage(THREE.DynamicDrawUsage));
    const ind = [];
    for (let i = 0; i < this.n - 1; i++) {
      const a = i * 2, b = i * 2 + 1, c = i * 2 + 2, d = i * 2 + 3;
      ind.push(a, b, c, b, d, c);
    }
    g.setIndex(ind);
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      uniforms: { uCor: { value: new THREE.Color(0xdde8ff) } },
      vertexShader: 'attribute float alfa; varying float vA; void main(){ vA = alfa; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 uCor; varying float vA; void main(){ gl_FragColor = vec4(uCor * vA, vA); }',
    });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    pai.add(this.mesh);
  }

  atualizar(ativo, base, ponta, forca) {
    if (ativo) {
      this.base.unshift(base.clone());
      this.ponta.unshift(ponta.clone());
    } else if (this.base.length) {
      this.base.pop();
      this.ponta.pop();
    }
    while (this.base.length > this.n) {
      this.base.pop();
      this.ponta.pop();
    }
    const k = this.base.length;
    this.mesh.visible = k > 1;
    for (let i = 0; i < this.n; i++) {
      const j = Math.min(i, k - 1);
      if (j < 0) break;
      const b = this.base[j], p = this.ponta[j];
      // o rasto fica mais estreito e transparente para trás
      const pb = b.clone().lerp(p, 0.2);
      this.pos.set([pb.x, pb.y, pb.z], i * 6);
      this.pos.set([p.x, p.y, p.z], i * 6 + 3);
      const a = Math.pow(1 - i / this.n, 1.5) * 0.55 * forca * (i < k ? 1 : 0);
      this.alfa[i * 2] = a * 0.1;
      this.alfa[i * 2 + 1] = a;
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.attributes.alfa.needsUpdate = true;
  }
}

// ------------------------------------------------------------------ classe principal

export class PrimeiraPessoa {
  constructor(mundo, qualidade) {
    this.cena = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(54, innerWidth / innerHeight, 0.01, 10);
    this.cena.add(this.cam);
    this.cena.environment = null;
    // luz igual à do mundo (a câmara deste "palco" roda como a câmara principal)
    this.sol = new THREE.DirectionalLight(0xffd8ae, 2.0);
    this.sol.position.copy(mundo.dirSol).multiplyScalar(10);
    this.cena.add(this.sol);
    this.hemi = new THREE.HemisphereLight(0xa8b4c8, 0x40362a, 0.9);
    this.cena.add(this.hemi);
    this.luzFogo = new THREE.PointLight(0xff8a3a, 0, 14, 1.4);
    this.cena.add(this.luzFogo);

    const t = criarTexturasDetalhe(qualidade);
    this.M = materiais(t, mundo.envMapa);
    this.raiz = new THREE.Group();
    this.cam.add(this.raiz);

    // mão direita (arma)
    this.maoD = new THREE.Group();
    this.maoD.add(criarBraco(this.M));
    this.raiz.add(this.maoD);
    this.encaixeArma = new THREE.Group();
    this.maoD.add(this.encaixeArma);

    // mão esquerda (escudo e frasco), espelhada
    this.maoE = new THREE.Group();
    const espelho = new THREE.Group();
    espelho.scale.x = -1;
    espelho.add(criarBraco(this.M));
    this.maoE.add(espelho);
    this.escudo = criarEscudo(this.M);
    this.escudo.scale.setScalar(0.82);
    this.escudo.position.set(-0.07, 0.0, 0.06);
    this.maoE.add(this.escudo);
    this.frasco = criarFrasco(this.M);
    this.frasco.position.y = -0.045; // segura-se pelo gargalo
    this.frasco.visible = false;
    this.maoE.add(this.frasco);
    // a luz do frasco fica sempre na cena (ligar e desligar luzes obrigaria a recompilar os materiais)
    this.luzFrasco = new THREE.PointLight(0xff8a3a, 0, 0.7, 2);
    this.luzFrasco.position.y = -0.06;
    this.maoE.add(this.luzFrasco);
    this.raiz.add(this.maoE);

    this.rasto = new Rasto(this.raiz);
    this.atualD = { p: POSES_D.repouso.p.clone(), q: POSES_D.repouso.q.clone() };
    this.atualE = { p: POSES_E.repouso.p.clone(), q: POSES_E.repouso.q.clone() };
    this.tmpA = { p: new THREE.Vector3(), q: new THREE.Quaternion() };
    this.tmpB = { p: new THREE.Vector3(), q: new THREE.Quaternion() };
    this.arma = null;
    this.yawAnt = null;
    this.pitchAnt = 0;
    this.balanco = new THREE.Vector2();
    this.tempo = 0;
    this.vB = new THREE.Vector3();
    this.vP = new THREE.Vector3();
  }

  definirArma(nome) {
    if (this.arma === nome) return;
    this.arma = nome;
    this.encaixeArma.clear();
    this.modeloArma = criarArmaFP(nome, this.M);
    this.encaixeArma.add(this.modeloArma);
  }

  redimensionar() {
    this.cam.aspect = innerWidth / innerHeight;
    this.cam.updateProjectionMatrix();
  }

  // pose da mão direita para o estado atual do jogador
  poseDireita(J, saida) {
    const e = J.estado;
    if (e === 'ataque' && J.ataque) {
      const d = J.ataque.def;
      const chaves = GOLPES[J.ataque.anim] || GOLPES.leve1;
      const t = J.t;
      const tPrep = Math.max(0.05, d.ini - 0.06);
      if (t < tPrep) return misturarPose(POSES_D.repouso, chaves[0], suave(t / tPrep), saida);
      if (t < d.ini) return misturarPose(chaves[0], chaves[1], suave((t - tPrep) / (d.ini - tPrep)), saida);
      if (t < d.fim) return misturarPose(chaves[1], chaves[2], (t - d.ini) / (d.fim - d.ini), saida);
      return misturarPose(chaves[2], POSES_D.repouso, suave((t - d.fim) / Math.max(0.05, d.dur - d.fim)), saida);
    }
    if (e === 'rolar' || e === 'derrubado' || e === 'morto') return misturarPose(POSES_D.repouso, POSES_D.baixo, e === 'rolar' ? Math.sin(Math.min(1, J.t / 0.66) * Math.PI) : 1, saida);
    if (e === 'acender') return misturarPose(POSES_D.repouso, POSES_D.acender, Math.sin(Math.min(1, J.t / 1.6) * Math.PI), saida);
    if (e === 'beber') return misturarPose(POSES_D.repouso, POSES_D.baixo, 0.35 * Math.sin(Math.min(1, J.t / 1.35) * Math.PI), saida);
    const corrida = Math.min(1, Math.max(0, (J.velAtual || 0) - 4.6) / 2.4);
    misturarPose(POSES_D.repouso, POSES_D.correr, corrida, saida);
    if (J.anim.bloqueio > 0.01) misturarPose(saida, POSES_D.bloqueio, J.anim.bloqueio, saida);
    return saida;
  }

  poseEsquerda(J, saida) {
    const e = J.estado;
    if (e === 'beber') {
      const t = J.t;
      if (t < 0.25) return misturarPose(POSES_E.repouso, POSES_E.beberA, suave(t / 0.25), saida);
      if (t < 0.5) return misturarPose(POSES_E.beberA, POSES_E.beberB, suave((t - 0.25) / 0.25), saida);
      if (t < 0.95) return misturarPose(POSES_E.beberB, POSES_E.beberB, 0, saida);
      // baixa a mão para fora do ecrã antes de voltar a pegar no escudo
      if (t < 1.15) return misturarPose(POSES_E.beberB, POSES_E.baixo, suave((t - 0.95) / 0.2), saida);
      return misturarPose(POSES_E.baixo, POSES_E.repouso, suave((t - 1.15) / 0.2), saida);
    }
    if (e === 'rolar' || e === 'derrubado' || e === 'morto') return misturarPose(POSES_E.repouso, POSES_E.baixo, e === 'rolar' ? Math.sin(Math.min(1, J.t / 0.66) * Math.PI) : 1, saida);
    if (e === 'ataque') return misturarPose(POSES_E.repouso, POSES_E.baixo, 0.25, saida);
    const corrida = Math.min(1, Math.max(0, (J.velAtual || 0) - 4.6) / 2.4);
    misturarPose(POSES_E.repouso, POSES_E.correr, corrida, saida);
    if (J.anim.bloqueio > 0.01) misturarPose(saida, POSES_E.bloqueio, J.anim.bloqueio, saida);
    return saida;
  }

  atualizar(dt, J, camara, yaw, pitch, fogueiraPerto) {
    this.tempo += dt;
    this.definirArma(J.arma);
    this.cam.quaternion.copy(camara.quaternion);
    this.cam.fov = Math.max(40, camara.fov - 14);
    this.cam.updateProjectionMatrix();

    // balanço com o movimento da câmara (os braços "atrasam-se" um pouco)
    if (this.yawAnt === null) this.yawAnt = yaw;
    let dy = yaw - this.yawAnt;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    const dp = pitch - this.pitchAnt;
    this.yawAnt = yaw;
    this.pitchAnt = pitch;
    this.balanco.x += (Math.max(-0.06, Math.min(0.06, dy * 0.9)) - this.balanco.x) * Math.min(1, dt * 10);
    this.balanco.y += (Math.max(-0.05, Math.min(0.05, -dp * 0.7)) - this.balanco.y) * Math.min(1, dt * 10);
    this.balanco.multiplyScalar(1 - Math.min(1, dt * 6));

    // poses alvo e suavização
    let alvoD = this.poseDireita(J, this.tmpA);
    let alvoE = this.poseEsquerda(J, this.tmpB);
    const rapido = J.estado === 'ataque' ? 40 : 14;
    let kD = 1 - Math.exp(-dt * rapido);
    let kE = 1 - Math.exp(-dt * 14);
    if (this.forcar) {
      // usado para afinar poses: salta diretamente para a pose pedida
      if (this.forcar.d) alvoD = this.forcar.d;
      if (this.forcar.e) alvoE = this.forcar.e;
      kD = kE = 1;
    }
    this.atualD.p.lerp(alvoD.p, kD);
    this.atualD.q.slerp(alvoD.q, kD);
    this.atualE.p.lerp(alvoE.p, kE);
    this.atualE.q.slerp(alvoE.q, kE);

    // passos, respiração e balanço
    const v = J.velAtual || 0;
    const kv = Math.min(1.5, v / 4.3);
    const f = J.anim.fase;
    const respira = Math.sin(this.tempo * 1.7) * 0.004;
    const passoX = Math.sin(f) * 0.012 * kv;
    const passoY = -Math.abs(Math.cos(f)) * 0.016 * kv;
    this.maoD.position.copy(this.atualD.p).add(this.vB.set(passoX + this.balanco.x, passoY + respira + this.balanco.y, 0));
    this.maoD.quaternion.copy(this.atualD.q);
    this.maoE.position.copy(this.atualE.p).add(this.vB.set(-passoX * 0.8 + this.balanco.x, passoY * 0.9 + respira + this.balanco.y, 0));
    this.maoE.quaternion.copy(this.atualE.q);

    // atordoado: sacudidela
    if (J.estado === 'atordoado') {
      const s = Math.max(0, 1 - J.t / 0.45);
      this.maoD.position.x += Math.sin(this.tempo * 60) * 0.015 * s;
      this.maoD.position.y -= 0.04 * s;
      this.maoE.position.y -= 0.05 * s;
    }

    // frasco no lugar do escudo quando se bebe
    const bebe = J.estado === 'beber' && J.t < 1.12;
    this.frasco.visible = bebe;
    this.escudo.visible = !bebe;
    this.luzFrasco.intensity = bebe ? 0.5 + Math.sin(this.tempo * 9) * 0.1 : 0;
    // ao morrer os braços caem para fora do ecrã
    // (sentado à fogueira ficam escondidos; mover em vez de ocultar não muda o número de luzes da cena)
    this.raiz.position.y = J.estado === 'morto' ? -Math.min(1, J.t / 0.9) * 0.7 : J.estado === 'sentado' ? -3 : 0;

    // rasto do golpe
    if (this.modeloArma) {
      const u = this.modeloArma.userData;
      const ativo = J.estado === 'ataque' && J.ataque && J.t > J.ataque.def.ini - 0.05 && J.t < J.ataque.def.fim + 0.04;
      this.cam.updateMatrixWorld(true);
      const b = this.raiz.worldToLocal(u.base.getWorldPosition(this.vB));
      const p = this.raiz.worldToLocal(u.ponta.getWorldPosition(this.vP));
      this.rasto.atualizar(ativo, b, p, J.ataque && J.ataque.forte ? 1.3 : 1);
    }

    // luz quente da fogueira próxima
    if (fogueiraPerto) {
      this.luzFogo.position.copy(fogueiraPerto.pos).sub(camara.position);
      this.luzFogo.intensity = fogueiraPerto.intensidade;
    } else this.luzFogo.intensity = 0;
  }
}
