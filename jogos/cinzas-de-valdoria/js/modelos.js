// Modelos das personagens (construídos com primitivas) e animação procedural por poses-chave.
import * as THREE from '../vendor/three.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

function malha(geo, mat, sombra = true) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = sombra;
  m.receiveShadow = true;
  return m;
}

function capsula(r, comp, mat, seg = 8) {
  return malha(new THREE.CapsuleGeometry(r, comp, 4, seg), mat);
}

function junta(nome, pai, x = 0, y = 0, z = 0) {
  const j = new THREE.Group();
  j.name = nome;
  j.position.set(x, y, z);
  pai.add(j);
  return j;
}

// Funde as peças de cada articulação que partilham material (menos chamadas de desenho).
function fundirPecas(raiz) {
  const grupos = [];
  raiz.traverse((o) => { if (!o.isMesh) grupos.push(o); });
  for (const g of grupos) {
    const porMat = new Map();
    for (const c of g.children) {
      if (!c.isMesh || c.userData.naoFundir) continue;
      if (!porMat.has(c.material)) porMat.set(c.material, []);
      porMat.get(c.material).push(c);
    }
    for (const [mat, lista] of porMat) {
      if (lista.length < 2) continue;
      const geos = lista.map((m) => {
        m.updateMatrix();
        let geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
        for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k);
        if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
        geo.clearGroups();
        geo.applyMatrix4(m.matrix);
        return geo;
      });
      const fundida = THREE.mergeGeometries(geos, false);
      if (!fundida) continue;
      for (const m of lista) g.remove(m);
      g.add(malha(fundida, mat, lista[0].castShadow));
    }
  }
}

// ------------------------------------------------------------------ materiais

const V2 = (x, y) => new THREE.Vector2(x, y);

// tex: texturas do mundo; det: texturas de detalhe (aço, couro, malha, pele, pelo, tecido rasgado, brasões)
export function criarMateriais(tex, det) {
  const metal = (cor, rug = 0.7, met = 0.9, extra = {}) => new THREE.MeshStandardMaterial({
    color: cor, metalness: met, roughness: rug, map: det.aco, normalMap: det.acoN, normalScale: V2(0.55, 0.55), roughnessMap: det.acoRug,
    side: THREE.DoubleSide, ...extra,
  });
  const pano = (cor, rasgado = false, extra = {}) => new THREE.MeshStandardMaterial({
    color: cor, roughness: 1, map: tex.tecido, side: THREE.DoubleSide,
    ...(rasgado ? { alphaMap: det.rasgado, alphaTest: 0.5 } : {}), ...extra,
  });
  return {
    armadura: metal(0x9a968e, 0.62),
    armaduraEscura: metal(0x5c5a57, 0.7),
    armaduraRei: metal(0xb8924c, 0.5),
    latao: new THREE.MeshStandardMaterial({ color: 0xc9a050, metalness: 1, roughness: 0.4, roughnessMap: det.acoRug }),
    ouro: new THREE.MeshStandardMaterial({ color: 0xe0b450, metalness: 1, roughness: 0.3, roughnessMap: det.acoRug }),
    prata: metal(0xc0c4c8, 0.45),
    malha: new THREE.MeshStandardMaterial({ color: 0x9a9894, map: det.malha, normalMap: det.malhaN, metalness: 0.85, roughness: 0.6 }),
    lamina: metal(0xd0cdc6, 0.45, 1, { side: THREE.FrontSide }),
    laminaEscura: metal(0x7a7570, 0.65, 0.95, { side: THREE.FrontSide }),
    laminaRei: new THREE.MeshStandardMaterial({
      color: 0x5a544c, metalness: 0.9, roughness: 0.45, map: det.aco, roughnessMap: det.acoRug, emissive: 0xff4a10, emissiveIntensity: 0,
    }),
    // fendas incandescentes na armadura do rei (acendem na segunda fase)
    fendasRei: new THREE.MeshStandardMaterial({ color: 0x1a0c06, emissive: 0xff5a14, emissiveIntensity: 0, roughness: 1 }),
    couro: new THREE.MeshStandardMaterial({ color: 0x8a7462, map: det.couro, normalMap: det.couroN, roughness: 0.8 }),
    couroEscuro: new THREE.MeshStandardMaterial({ color: 0x5a4a40, map: det.couro, normalMap: det.couroN, roughness: 0.85 }),
    pega: new THREE.MeshStandardMaterial({ map: det.pega, normalMap: det.pegaN, roughness: 0.75 }),
    tecido: pano(0x7a3226),
    tecidoAzul: pano(0x34425a),
    tabardo: pano(0x7a3226, true),
    tabardoAzul: pano(0x2e3c54, true),
    tabardoRei: pano(0x6a1a14, true),
    trapos: pano(0x7a6e5c, true),
    ligadura: pano(0x8a7e68),
    corda: new THREE.MeshStandardMaterial({ color: 0x6a5838, map: det.pega, roughness: 1 }),
    capa: pano(0x4a221c, true),
    capaRei: pano(0x5a1612, true),
    pele: new THREE.MeshStandardMaterial({ color: 0x9c9488, map: det.pele, normalMap: det.peleN, roughness: 0.92 }),
    osso: new THREE.MeshStandardMaterial({ color: 0xcfc4a8, map: det.pele, roughness: 0.75 }),
    madeira: new THREE.MeshStandardMaterial({ color: 0x8a7058, map: det.madeira, normalMap: det.madeiraN, roughness: 0.85 }),
    escuro: new THREE.MeshBasicMaterial({ color: 0x050403 }),
    crina: new THREE.MeshStandardMaterial({ color: 0x14181e, roughness: 1, map: tex.tecido }),
    pluma: new THREE.MeshStandardMaterial({ color: 0x8a2018, roughness: 1, map: tex.tecido }),
    olhoBrilho: new THREE.MeshBasicMaterial({ color: 0xffb040 }),
    olhoVermelho: new THREE.MeshBasicMaterial({ color: 0xff3010 }),
    pelo: new THREE.MeshStandardMaterial({ color: 0x6a625a, map: det.pelo, normalMap: det.peloN, normalScale: V2(1.2, 1.2), roughness: 1 }),
    peloClaro: new THREE.MeshStandardMaterial({ color: 0x9a9088, map: det.pelo, normalMap: det.peloN, roughness: 1 }),
    peloAncestral: new THREE.MeshStandardMaterial({
      color: 0xc8ccd4, map: det.pelo, normalMap: det.peloN, normalScale: V2(1.2, 1.2), roughness: 1, emissive: 0x141a24, emissiveIntensity: 1,
    }),
    peloAncestralClaro: new THREE.MeshStandardMaterial({ color: 0xe4e4e8, map: det.pelo, normalMap: det.peloN, roughness: 1, emissive: 0x141a24, emissiveIntensity: 1 }),
    focinho: new THREE.MeshStandardMaterial({ color: 0x1a1614, roughness: 0.45 }),
    dentes: new THREE.MeshStandardMaterial({ color: 0xe0d8c0, roughness: 0.5 }),
    garras: new THREE.MeshStandardMaterial({ color: 0x2a2420, roughness: 0.4 }),
    escudoFace: new THREE.MeshStandardMaterial({ map: det.escudo, normalMap: det.escudoN, roughness: 0.65 }),
    escudoCav: new THREE.MeshStandardMaterial({ map: det.escudoCav, normalMap: det.escudoCavN, roughness: 0.6, metalness: 0.1 }),
    frasco: new THREE.MeshStandardMaterial({ color: 0xffa040, emissive: 0xff7a10, emissiveIntensity: 2.2, roughness: 0.2, transparent: true, opacity: 0.9 }),
  };
}

// ------------------------------------------------------------------ peças

function torno(pts, mat, segs = 14, phi0 = 0, phiL = Math.PI * 2) {
  return malha(new THREE.LatheGeometry(pts.map(([r, y]) => V2(r, y)), segs, phi0, phiL), mat);
}
function caixa(l, a, p, mat, raio = 0.012) {
  return malha(new THREE.RoundedBoxGeometry(l, a, p, 2, Math.min(raio, l / 2 - 1e-4, a / 2 - 1e-4, p / 2 - 1e-4)), mat);
}
function esfera(r, mat, w = 12, h = 8) {
  return malha(new THREE.SphereGeometry(r, w, h), mat);
}
function anel(r, t, mat, segs = 20) {
  const m = malha(new THREE.TorusGeometry(r, t, 6, segs), mat);
  m.rotation.x = Math.PI / 2;
  return m;
}
function cone(r, h, mat, segs = 5) {
  return malha(new THREE.ConeGeometry(r, h, segs), mat);
}
function entre(o, a, b) {
  const d = b.clone().sub(a);
  o.position.copy(a).addScaledVector(d, 0.5);
  o.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize());
  return o;
}
// tira de pano pendurada (o topo fica na origem)
function tira(larg, comp, mat, segs = 4) {
  const g = new THREE.PlaneGeometry(larg, comp, 2, segs);
  g.translate(0, -comp / 2, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    p.setZ(i, Math.sin(p.getX(i) * 14 + y * 6) * 0.012 - y * y * 0.05);
  }
  g.computeVertexNormals();
  return malha(g, mat);
}

// ------------------------------------------------------------------ armas

function formaLamina(comp, larg, ponta = 0.18, partida = false) {
  const s = new THREE.Shape();
  s.moveTo(-larg / 2, 0);
  s.lineTo(larg / 2, 0);
  if (partida) {
    // ponta partida e dentada
    s.lineTo(larg / 2 * 0.95, comp * 0.86);
    s.lineTo(larg * 0.2, comp * 0.93);
    s.lineTo(larg * 0.05, comp);
    s.lineTo(-larg * 0.15, comp * 0.9);
    s.lineTo(-larg / 2 * 0.95, comp * 0.96);
  } else {
    s.lineTo(larg / 2 * 0.85, comp * (1 - ponta));
    s.lineTo(0, comp);
    s.lineTo(-larg / 2 * 0.85, comp * (1 - ponta));
  }
  s.closePath();
  return s;
}

function lamina(comp, larg, esp, mat, partida = false) {
  const g = new THREE.ExtrudeGeometry(formaLamina(comp, larg, 0.18, partida), {
    depth: esp, bevelEnabled: true, bevelThickness: esp * 0.4, bevelSize: larg * 0.18, bevelSegments: 1,
  });
  g.translate(0, 0, -esp / 2);
  g.rotateX(Math.PI / 2); // comprimento passa para +Z
  g.rotateZ(Math.PI / 2); // gume na horizontal quando o braço está em baixo
  return malha(g, mat);
}

export function criarArma(tipo, M) {
  const g = new THREE.Group();
  const punho = (comp, r = 0.02) => {
    const p = malha(new THREE.CylinderGeometry(r, r * 1.08, comp, 10), M.pega);
    p.rotation.x = Math.PI / 2;
    return p;
  };
  const pomo = (z, r, mat) => {
    const p = torno([[0.001, -r], [r * 0.8, -r * 0.7], [r, 0], [r * 0.7, r * 0.6], [r * 0.3, r]], mat, 12);
    p.rotation.x = Math.PI / 2;
    p.position.z = z;
    return p;
  };
  const guarda = (z, larg, mat, r = 0.016) => {
    const curva = new THREE.CatmullRomCurve3([V(-larg / 2, 0, 0.03), V(-larg / 4, 0, 0.005), V(0, 0, 0), V(larg / 4, 0, 0.005), V(larg / 2, 0, 0.03)]);
    const t = malha(new THREE.TubeGeometry(curva, 12, r, 6, false), mat);
    t.position.z = z;
    const c = caixa(0.05, 0.05, 0.05, mat, 0.01);
    c.position.z = z;
    return [t, c];
  };
  if (tipo === 'espada' || tipo === 'espadao' || tipo === 'espadaRei' || tipo === 'espadaCavaleiro') {
    const cfg = {
      espada: [1.0, 0.07, 0.24, M.lamina, M.latao],
      espadaCavaleiro: [1.0, 0.075, 0.26, M.laminaEscura, M.prata],
      espadao: [1.6, 0.12, 0.46, M.lamina, M.armaduraEscura],
      espadaRei: [1.9, 0.17, 0.6, M.laminaRei, M.ouro],
    }[tipo];
    const [comp, larg, gl, mat, metalG] = cfg;
    const curto = tipo === 'espada' || tipo === 'espadaCavaleiro';
    const zg = curto ? 0.12 : 0.19;
    g.add(punho(curto ? 0.22 : 0.36));
    g.add(...guarda(zg, gl, metalG, tipo === 'espadaRei' ? 0.026 : 0.011));
    g.add(pomo(-zg + 0.01, tipo === 'espadaRei' ? 0.06 : 0.035, metalG));
    const l = lamina(comp, larg, 0.012 * (comp > 1.2 ? 1.6 : 1), mat);
    l.position.z = zg + 0.02;
    g.add(l);
    // sulco ao centro da lâmina, dos dois lados
    for (const lado of [-1, 1]) {
      const s = malha(new THREE.BoxGeometry(0.004, larg * 0.22, comp * 0.62), M.laminaEscura);
      s.position.set(lado * 0.0075 * (comp > 1.2 ? 1.6 : 1), 0, zg + 0.04 + comp * 0.31);
      g.add(s);
    }
    if (tipo === 'espadaRei') {
      for (const lado of [-1, 1]) {
        const espinho = cone(0.025, 0.14, M.ouro);
        espinho.rotation.z = -lado * Math.PI / 2;
        espinho.position.set(0, lado * 0.33, zg + 0.04);
        g.add(espinho);
      }
    }
    g.userData.ponta = zg + comp;
  } else if (tipo === 'machado') {
    const cabo = malha(new THREE.CylinderGeometry(0.022, 0.028, 0.95, 8), M.madeira);
    cabo.rotation.x = Math.PI / 2;
    cabo.position.z = 0.3;
    g.add(cabo);
    for (const z of [0.0, 0.62, 0.78]) {
      const a = malha(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 10), M.armaduraEscura);
      a.rotation.x = Math.PI / 2;
      a.position.z = z;
      g.add(a);
    }
    const s = new THREE.Shape();
    s.moveTo(0, -0.06);
    s.quadraticCurveTo(0.18, -0.1, 0.26, -0.2);
    s.quadraticCurveTo(0.33, 0, 0.26, 0.2);
    s.quadraticCurveTo(0.18, 0.1, 0, 0.06);
    s.closePath();
    const cab = new THREE.ExtrudeGeometry(s, { depth: 0.024, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.014, bevelSegments: 2, curveSegments: 10 });
    cab.translate(0, 0, -0.012);
    const m = malha(cab, M.laminaEscura);
    m.rotation.set(0, Math.PI / 2, Math.PI / 2);
    m.position.set(0, 0, 0.7);
    g.add(m);
    const esp = cone(0.025, 0.12, M.armaduraEscura, 6);
    esp.rotation.x = Math.PI;
    esp.position.set(0, 0.08, 0.7);
    g.add(esp);
    g.userData.ponta = 0.8;
  } else if (tipo === 'espadaPartida') {
    g.add(punho(0.18, 0.018));
    const corda = malha(new THREE.CylinderGeometry(0.021, 0.021, 0.08, 8), M.ligadura);
    corda.rotation.x = Math.PI / 2;
    corda.position.z = -0.02;
    g.add(corda);
    const gu = caixa(0.2, 0.03, 0.035, M.laminaEscura, 0.008);
    gu.position.z = 0.1;
    g.add(gu);
    const l = lamina(0.58, 0.06, 0.01, M.laminaEscura, true);
    l.position.z = 0.11;
    g.add(l);
    g.userData.ponta = 0.68;
  }
  return g;
}

function criarEscudo(M, escuro = false) {
  const s = new THREE.Shape();
  s.moveTo(-0.26, 0.3);
  s.quadraticCurveTo(0, 0.34, 0.26, 0.3);
  s.lineTo(0.26, -0.02);
  s.quadraticCurveTo(0.22, -0.3, 0, -0.44);
  s.quadraticCurveTo(-0.22, -0.3, -0.26, -0.02);
  s.closePath();
  const esc = new THREE.Group();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.012, bevelSegments: 2, curveSegments: 12 });
  g.translate(0, 0, -0.02);
  esc.add(malha(g, M.madeira));
  // face pintada
  const f = new THREE.ShapeGeometry(s, 12);
  const uv = f.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) + 0.26) / 0.52, (uv.getY(i) + 0.44) / 0.78);
  f.translate(0, 0, 0.0205);
  esc.add(malha(f, escuro ? M.escudoCav : M.escudoFace));
  // aro de metal, umbo e rebites
  const pts = s.getSpacedPoints(48).map((p) => V(p.x, p.y, 0.005));
  esc.add(malha(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 64, 0.02, 6, true), escuro ? M.armaduraEscura : M.armadura));
  const bossa = torno([[0.07, 0], [0.06, 0.015], [0.035, 0.035], [0.001, 0.042]], escuro ? M.prata : M.latao, 14);
  bossa.rotation.x = Math.PI / 2;
  bossa.position.set(0, 0.0, 0.022);
  esc.add(bossa);
  const geoReb = new THREE.SphereGeometry(0.009, 6, 4);
  for (const p of s.getSpacedPoints(14)) {
    const r = malha(geoReb, escuro ? M.prata : M.latao);
    r.position.set(p.x * 0.88, p.y * 0.88 - 0.01, 0.024);
    esc.add(r);
  }
  return esc;
}

// ------------------------------------------------------------------ humanoide

// Armadura de placas (Cinzento em terceira pessoa, cavaleiros caídos e o rei).
function vestirArmadura(J, estilo, M) {
  const rei = estilo === 'rei';
  const cav = estilo === 'cavaleiro';
  const placa = rei ? M.armaduraRei : cav ? M.armaduraEscura : M.armadura;
  const orla = rei ? M.ouro : cav ? M.prata : M.latao;
  const tab = rei ? M.tabardoRei : cav ? M.tabardoAzul : M.tabardo;

  // cintura: saia de malha, lâminas da fralda, cinto e tabardo
  const Q = J.quadris;
  const saiaMalha = malha(new THREE.CylinderGeometry(0.17, 0.24, 0.32, 14, 1, true), M.malha);
  saiaMalha.position.y = -0.14;
  Q.add(saiaMalha);
  for (let i = 0; i < 3; i++) {
    const r0 = 0.168 + i * 0.016;
    const l = malha(new THREE.CylinderGeometry(r0, r0 + 0.022, 0.075, 16, 1, true), placa);
    l.position.y = 0.0 - i * 0.062;
    Q.add(l);
  }
  const cinto = anel(0.182, 0.02, M.couro, 22);
  cinto.position.y = 0.06;
  Q.add(cinto);
  const fivela = caixa(0.06, 0.05, 0.02, orla, 0.006);
  fivela.position.set(0, 0.06, 0.2);
  Q.add(fivela);
  for (const [z, rx] of [[0.215, -0.12], [-0.205, 0.12]]) {
    const t = tira(0.24, 0.5, tab, 5);
    t.position.set(0, 0.03, z);
    t.rotation.x = rx;
    if (z < 0) t.rotation.y = Math.PI;
    Q.add(t);
  }

  // tronco: malha na barriga e placa da frente
  const abd = malha(new THREE.CylinderGeometry(0.15, 0.165, 0.24, 14), M.malha);
  abd.position.y = 0.1;
  J.tronco.add(abd);
  const plac = torno([[0.165, 0.0], [0.178, 0.09], [0.172, 0.2]], placa, 14, -1.3, 2.6);
  J.tronco.add(plac);

  // peito: couraça com aresta central, gola e rebites
  const P = J.peito;
  const peito = malha(new THREE.SphereGeometry(0.22, 18, 12), placa);
  peito.scale.set(1.05, 0.95, 0.74);
  peito.position.y = 0.1;
  P.add(peito);
  const aresta = malha(new THREE.CylinderGeometry(0.008, 0.008, 0.28, 6), placa);
  aresta.scale.z = 1.8;
  aresta.position.set(0, 0.08, 0.158);
  aresta.rotation.x = 0.12;
  P.add(aresta);
  const gola = torno([[0.13, 0.22], [0.12, 0.27], [0.1, 0.31], [0.095, 0.33]], placa, 16);
  P.add(gola);
  const orlaGola = anel(0.115, 0.009, orla, 20);
  orlaGola.position.y = 0.3;
  P.add(orlaGola);
  const orlaBaixo = anel(0.2, 0.008, orla, 24);
  orlaBaixo.scale.set(1.05, 0.74, 1);
  orlaBaixo.position.y = -0.02;
  P.add(orlaBaixo);
  const geoReb = new THREE.SphereGeometry(0.008, 6, 4);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const r = malha(geoReb, orla);
    r.position.set(Math.sin(a) * 0.205 * 1.05, 0.0, Math.cos(a) * 0.205 * 0.74);
    P.add(r);
  }
  if (rei) {
    // fendas a brilhar no peito e gola de pele
    for (let i = 0; i < 5; i++) {
      const f = malha(new THREE.BoxGeometry(0.006, 0.09 + (i % 2) * 0.05, 0.01), M.fendasRei, false);
      f.position.set(-0.1 + i * 0.05, 0.1 + (i % 3) * 0.03, 0.155 - Math.abs(i - 2) * 0.012);
      f.rotation.z = (i - 2) * 0.25;
      P.add(f);
    }
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const t = cone(0.04, 0.12, M.capaRei);
      t.position.set(Math.sin(a) * 0.17, 0.27, Math.cos(a) * 0.14);
      t.rotation.set(Math.cos(a) * 1.4, 0, -Math.sin(a) * 1.4);
      P.add(t);
    }
  }

  // braços
  for (const [lado, sx] of [['D', -1], ['E', 1]]) {
    const O = J['ombro' + lado];
    // ombreira em lâminas sobrepostas
    for (let k = 0; k < 3; k++) {
      const r = (rei ? 0.15 : 0.125) - k * 0.012;
      const l = malha(new THREE.SphereGeometry(r, 14, 6, 0, Math.PI * 2, 0, Math.PI * (k === 0 ? 0.5 : 0.32)), placa);
      l.position.set(sx * (0.025 + k * 0.022), 0.03 - k * 0.05, 0);
      l.rotation.z = -sx * (0.35 + k * 0.28);
      O.add(l);
      if (k === 0) {
        const o = malha(new THREE.TorusGeometry(r, 0.007, 5, 22), orla);
        o.position.copy(l.position);
        o.rotation.copy(l.rotation);
        o.rotateX(Math.PI / 2);
        O.add(o);
      }
    }
    if (rei) {
      for (let k = 0; k < 3; k++) {
        const e = cone(0.03, 0.16, M.ouro);
        e.position.set(sx * (0.06 + k * 0.03), 0.12, -0.04 + k * 0.04);
        e.rotation.z = -sx * 0.5;
        O.add(e);
      }
    }
    const sup = capsula(0.055, 0.2, M.malha);
    sup.position.y = -0.15;
    O.add(sup);
    const braco = malha(new THREE.CylinderGeometry(0.064, 0.06, 0.15, 12, 1, true), placa);
    braco.position.y = -0.17;
    O.add(braco);
    const C = J['cotovelo' + lado];
    const cot = esfera(0.058, placa, 10, 8);
    C.add(cot);
    const asa = malha(new THREE.CylinderGeometry(0.065, 0.065, 0.012, 12), placa);
    asa.rotation.z = Math.PI / 2;
    asa.position.x = sx * 0.045;
    C.add(asa);
    const ante = torno([[0.05, -0.25], [0.062, -0.16], [0.058, -0.03]], placa, 12);
    C.add(ante);
    for (const y of [-0.08, -0.2]) {
      const c = anel(0.06 - (y + 0.03) * 0.03, 0.007, M.couro, 14);
      c.position.y = y;
      C.add(c);
    }
    const Mo = J['mao' + lado];
    const punho = torno([[0.055, 0.04], [0.05, 0.0], [0.042, -0.02]], placa, 12);
    Mo.add(punho);
    const luva = caixa(0.07, 0.1, 0.085, M.couroEscuro, 0.025);
    luva.position.y = -0.04;
    Mo.add(luva);
    const costas = caixa(0.016, 0.075, 0.07, placa, 0.006);
    costas.position.set(sx * 0.035, -0.035, 0);
    Mo.add(costas);
  }

  // pernas
  for (const [lado, sx] of [['D', -1], ['E', 1]]) {
    const Cx = J['coxa' + lado];
    const coxa = capsula(0.075, 0.28, M.malha);
    coxa.position.y = -0.2;
    Cx.add(coxa);
    const cox = torno([[0.084, -0.38], [0.092, -0.22], [0.088, -0.04]], placa, 12, -1.5, 3.0);
    Cx.add(cox);
    const Jo = J['joelho' + lado];
    const joe = esfera(0.064, placa, 10, 8);
    joe.position.z = 0.035;
    Jo.add(joe);
    const asaJ = malha(new THREE.CylinderGeometry(0.055, 0.055, 0.01, 12), placa);
    asaJ.rotation.z = Math.PI / 2;
    asaJ.position.set(sx * 0.05, 0, 0.02);
    Jo.add(asaJ);
    const grev = torno([[0.05, -0.39], [0.069, -0.22], [0.064, -0.05]], placa, 14);
    Jo.add(grev);
    const orlaG = anel(0.065, 0.006, orla, 16);
    orlaG.position.y = -0.06;
    Jo.add(orlaG);
    const Pe = J['pe' + lado];
    const calc = caixa(0.105, 0.08, 0.13, placa, 0.03);
    calc.position.set(0, 0, 0.0);
    Pe.add(calc);
    for (let k = 0; k < 3; k++) {
      const l = caixa(0.1 - k * 0.004, 0.06 - k * 0.006, 0.05, placa, 0.018);
      l.position.set(0, -0.006 - k * 0.004, 0.075 + k * 0.035);
      Pe.add(l);
    }
    const sola = caixa(0.1, 0.02, 0.25, M.couroEscuro, 0.008);
    sola.position.set(0, -0.04, 0.05);
    Pe.add(sola);
  }

  // elmo
  const H = J.cabeca;
  if (cav) {
    // elmo de topo chato com reforço em cruz e crina
    H.add(torno([[0.112, -0.03], [0.12, 0.05], [0.123, 0.19], [0.116, 0.235], [0.08, 0.252], [0.001, 0.258]], placa, 18));
    const tira1 = caixa(0.026, 0.25, 0.012, M.prata, 0.004);
    tira1.position.set(0, 0.11, 0.124);
    H.add(tira1);
    const tira2 = malha(new THREE.TorusGeometry(0.124, 0.008, 5, 24), M.prata);
    tira2.rotation.x = Math.PI / 2;
    tira2.position.y = 0.155;
    H.add(tira2);
    for (const sx of [-1, 1]) {
      const f = caixa(0.07, 0.016, 0.03, M.escuro, 0.004);
      f.position.set(sx * 0.05, 0.14, 0.112);
      f.rotation.y = sx * 0.4;
      H.add(f);
    }
    for (let i = 0; i < 6; i++) {
      const b = esfera(0.006, M.escuro, 4, 3);
      b.position.set(0.035 + (i % 2) * 0.02, 0.05 + Math.floor(i / 2) * 0.022, 0.118);
      H.add(b);
    }
    for (let i = 0; i < 9; i++) {
      const c = cone(0.03, 0.2, M.crina, 4);
      c.position.set(0, 0.28 - Math.abs(i - 4) * 0.004, 0.08 - i * 0.03);
      c.rotation.x = -0.9 - i * 0.12;
      H.add(c);
    }
  } else {
    // elmo arredondado com viseira e fendas
    H.add(torno([[0.1, -0.03], [0.118, 0.02], [0.126, 0.1], [0.122, 0.17], [0.1, 0.23], [0.06, 0.265], [0.001, 0.275]], placa, 18));
    const visor = torno([[0.12, 0.03], [0.134, 0.1], [0.13, 0.18]], placa, 12, -1.0, 2.0);
    H.add(visor);
    for (const y of [0.13, 0.155]) {
      const f = caixa(0.15, 0.011, 0.04, M.escuro, 0.004);
      f.position.set(0, y, 0.122);
      H.add(f);
    }
    const crista = malha(new THREE.CylinderGeometry(0.01, 0.01, 0.2, 6, 1, false, 0, Math.PI), placa);
    crista.rotation.set(Math.PI / 2, 0, 0);
    crista.scale.set(1, 1, 2.5);
    crista.position.set(0, 0.255, 0.0);
    H.add(crista);
    const orlaE = anel(0.103, 0.007, orla, 20);
    orlaE.position.y = -0.025;
    H.add(orlaE);
    if (rei) {
      // coroa de espigões e olhar em brasa
      const aro = anel(0.118, 0.016, M.ouro, 24);
      aro.position.y = 0.21;
      H.add(aro);
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        const p = cone(0.022, 0.15 + (i % 2) * 0.09, M.ouro, 5);
        p.position.set(Math.sin(a) * 0.112, 0.29 + (i % 2) * 0.045, Math.cos(a) * 0.112);
        p.rotation.set(Math.cos(a) * 0.25, 0, -Math.sin(a) * 0.25);
        H.add(p);
      }
      const olho = malha(new THREE.BoxGeometry(0.13, 0.012, 0.01), M.olhoVermelho, false);
      olho.position.set(0, 0.142, 0.131);
      H.add(olho);
    } else {
      for (let i = 0; i < 5; i++) {
        const c = cone(0.03, 0.28, M.pluma, 4);
        c.position.set((i - 2) * 0.012, 0.32, -0.04 - i * 0.012);
        c.rotation.x = -0.55 - i * 0.12;
        H.add(c);
      }
    }
  }
}

// Esvaziado: morto-vivo esquelético, pele seca e trapos rasgados.
function vestirEsvaziado(J, M) {
  const Q = J.quadris;
  const tanga = malha(new THREE.CylinderGeometry(0.16, 0.25, 0.42, 12, 1, true), M.trapos);
  tanga.position.y = -0.17;
  Q.add(tanga);
  const corda = anel(0.165, 0.014, M.corda, 16);
  corda.position.y = 0.03;
  Q.add(corda);
  const no = esfera(0.025, M.corda, 6, 4);
  no.position.set(0.08, 0.02, 0.15);
  Q.add(no);
  for (const [x, c] of [[0.08, 0.26], [0.11, 0.2]]) {
    const t = tira(0.04, c, M.corda, 2);
    t.position.set(x, 0.02, 0.152);
    Q.add(t);
  }
  const ossoA = caixa(0.26, 0.09, 0.16, M.pele, 0.04);
  ossoA.position.y = -0.02;
  Q.add(ossoA);

  const T = J.tronco;
  const abd = malha(new THREE.CylinderGeometry(0.105, 0.12, 0.26, 12), M.pele);
  abd.position.y = 0.1;
  T.add(abd);
  for (let i = 0; i < 4; i++) {
    const v = esfera(0.022, M.pele, 6, 4);
    v.position.set(0, 0.02 + i * 0.06, -0.1);
    T.add(v);
  }

  const P = J.peito;
  const peito = malha(new THREE.SphereGeometry(0.2, 14, 10), M.pele);
  peito.scale.set(0.95, 0.95, 0.62);
  peito.position.y = 0.1;
  P.add(peito);
  for (let i = 0; i < 4; i++) {
    const c = malha(new THREE.TorusGeometry(0.16 - i * 0.012, 0.011, 4, 12, Math.PI * 0.8), M.osso);
    c.position.set(0, -0.0 + i * 0.055, 0.035);
    c.scale.set(1, 1, 0.65);
    c.rotation.set(Math.PI / 2 + 0.25, 0, Math.PI * 0.1 + Math.PI);
    P.add(c);
  }
  for (const sx of [-1, 1]) {
    const clav = capsula(0.013, 0.1, M.pele, 5);
    clav.rotation.z = Math.PI / 2 + sx * 0.3;
    clav.position.set(sx * 0.085, 0.235, 0.06);
    P.add(clav);
  }
  // faixa de trapo em diagonal pelo peito e farrapo num ombro
  const faixa = malha(new THREE.CylinderGeometry(0.205, 0.205, 0.1, 16, 1, true), M.trapos);
  faixa.scale.set(1, 1, 0.68);
  faixa.position.y = 0.1;
  faixa.rotation.z = 0.7;
  P.add(faixa);
  const farrapo = tira(0.2, 0.3, M.trapos, 3);
  farrapo.position.set(0.12, 0.25, -0.06);
  farrapo.rotation.set(0.2, 0.4, -0.3);
  P.add(farrapo);

  // cabeça: crânio de pele esticada, órbitas fundas, maxilar descaído, capuz roto
  const H = J.cabeca;
  const cr = malha(new THREE.SphereGeometry(0.105, 14, 12), M.pele);
  cr.scale.set(0.9, 1.06, 1.05);
  cr.position.y = 0.13;
  H.add(cr);
  const testa = capsula(0.022, 0.1, M.pele, 6);
  testa.rotation.z = Math.PI / 2;
  testa.position.set(0, 0.148, 0.075);
  H.add(testa);
  for (const sx of [-1, 1]) {
    const orb = esfera(0.022, M.escuro, 8, 6);
    orb.position.set(sx * 0.037, 0.12, 0.08);
    H.add(orb);
    const pup = esfera(0.005, M.olhoBrilho, 4, 4);
    pup.position.set(sx * 0.037, 0.12, 0.098);
    H.add(pup);
    const mac = esfera(0.026, M.pele, 6, 5);
    mac.position.set(sx * 0.06, 0.085, 0.065);
    H.add(mac);
  }
  const nariz = cone(0.014, 0.03, M.escuro, 3);
  nariz.rotation.x = Math.PI;
  nariz.position.set(0, 0.085, 0.098);
  H.add(nariz);
  const maxilar = caixa(0.08, 0.035, 0.07, M.pele, 0.014);
  maxilar.position.set(0, 0.035, 0.05);
  maxilar.rotation.x = 0.25;
  H.add(maxilar);
  for (let i = 0; i < 6; i++) {
    const d = caixa(0.008, 0.012, 0.008, M.osso, 0.002);
    d.position.set(-0.025 + i * 0.01, 0.058, 0.086);
    H.add(d);
  }
  const capuz = malha(new THREE.SphereGeometry(0.14, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.6), M.trapos);
  capuz.position.set(0, 0.13, -0.012);
  capuz.rotation.x = -0.45;
  H.add(capuz);
  const manto = malha(new THREE.CylinderGeometry(0.13, 0.2, 0.22, 14, 1, true, Math.PI * 0.35, Math.PI * 1.3), M.trapos);
  manto.position.set(0, -0.02, -0.02);
  H.add(manto);

  // braços magros com ligaduras e mãos ossudas
  for (const [lado, sx] of [['D', -1], ['E', 1]]) {
    const O = J['ombro' + lado];
    const omb = esfera(0.05, M.pele, 8, 6);
    O.add(omb);
    const sup = capsula(0.038, 0.22, M.pele, 6);
    sup.position.y = -0.15;
    O.add(sup);
    const C = J['cotovelo' + lado];
    C.add(esfera(0.04, M.pele, 8, 6));
    const ant = capsula(0.032, 0.2, M.pele, 6);
    ant.position.y = -0.13;
    C.add(ant);
    for (let k = 0; k < 4; k++) {
      const l = malha(new THREE.TorusGeometry(0.036, 0.011, 4, 10), M.ligadura);
      l.rotation.set(Math.PI / 2 + (k % 2 ? 0.25 : -0.2), 0, 0);
      l.position.y = -0.1 - k * 0.035;
      C.add(l);
    }
    const Mo = J['mao' + lado];
    const palma = caixa(0.05, 0.06, 0.06, M.pele, 0.015);
    palma.position.y = -0.02;
    Mo.add(palma);
    for (let k = 0; k < 4; k++) {
      const d = capsula(0.008, 0.05, M.pele, 4);
      d.position.set(-0.018 + k * 0.012, -0.065, 0.015);
      d.rotation.x = 0.5;
      Mo.add(d);
    }
  }
  // pernas
  for (const [lado] of [['D'], ['E']]) {
    const Cx = J['coxa' + lado];
    const coxa = capsula(0.05, 0.3, M.pele, 6);
    coxa.position.y = -0.2;
    Cx.add(coxa);
    const Jo = J['joelho' + lado];
    const jo = esfera(0.05, M.pele, 8, 6);
    jo.position.z = 0.015;
    Jo.add(jo);
    const can = capsula(0.04, 0.3, M.pele, 6);
    can.position.y = -0.2;
    Jo.add(can);
    for (let k = 0; k < 3; k++) {
      const l = malha(new THREE.TorusGeometry(0.045, 0.012, 4, 10), M.ligadura);
      l.rotation.x = Math.PI / 2 + (k % 2 ? 0.2 : -0.2);
      l.position.y = -0.3 - k * 0.035;
      Jo.add(l);
    }
    const Pe = J['pe' + lado];
    const pe = caixa(0.085, 0.06, 0.2, M.ligadura, 0.025);
    pe.position.set(0, -0.01, 0.05);
    Pe.add(pe);
  }
}

// estilo: 'jogador' | 'esvaziado' | 'cavaleiro' | 'rei'
export function criarHumanoide(estilo, M) {
  const raiz = new THREE.Group();
  const pivo = junta('pivo', raiz, 0, 0.6, 0);
  const J = { pivo };
  J.quadris = junta('quadris', pivo, 0, 0.38, 0);
  J.tronco = junta('tronco', J.quadris, 0, 0.1, 0);
  J.peito = junta('peito', J.tronco, 0, 0.22, 0);
  J.cabeca = junta('cabeca', J.peito, 0, 0.32, 0);
  for (const [lado, sx] of [['D', -1], ['E', 1]]) {
    J['ombro' + lado] = junta('ombro' + lado, J.peito, sx * 0.25, 0.2, 0);
    J['cotovelo' + lado] = junta('cotovelo' + lado, J['ombro' + lado], 0, -0.3, 0);
    J['mao' + lado] = junta('mao' + lado, J['cotovelo' + lado], 0, -0.28, 0);
    J['coxa' + lado] = junta('coxa' + lado, J.quadris, sx * 0.11, -0.06, 0);
    J['joelho' + lado] = junta('joelho' + lado, J['coxa' + lado], 0, -0.42, 0);
    J['pe' + lado] = junta('pe' + lado, J['joelho' + lado], 0, -0.42, 0);
  }
  if (estilo === 'esvaziado') vestirEsvaziado(J, M);
  else vestirArmadura(J, estilo, M);

  // capa rasgada
  if (estilo === 'jogador' || estilo === 'rei' || estilo === 'cavaleiro') {
    const comp = estilo === 'cavaleiro' ? 0.7 : 0.95;
    const capaG = new THREE.PlaneGeometry(0.42, comp, 6, 8);
    capaG.translate(0, -comp / 2, 0);
    const pa = capaG.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      const y = pa.getY(i);
      const x = pa.getX(i);
      pa.setZ(i, -Math.abs(x) * 0.18 + Math.sin(x * 14) * 0.02 * (-y) - y * y * 0.04);
      pa.setX(i, x * (1 - y * 0.55));
    }
    capaG.computeVertexNormals();
    J.capa = junta('capa', J.peito, 0, 0.25, -0.15);
    const capa = malha(capaG, estilo === 'rei' ? M.capaRei : estilo === 'cavaleiro' ? M.tabardoAzul : M.capa);
    J.capa.add(capa);
  }

  // armas
  const tipoArma = { jogador: 'espada', esvaziado: 'espadaPartida', cavaleiro: 'espadaCavaleiro', rei: 'espadaRei' }[estilo];
  const arma = criarArma(tipoArma, M);
  J.maoD.add(arma);
  arma.position.set(0, -0.03, 0);
  let escudo = null;
  if (estilo === 'jogador' || estilo === 'cavaleiro') {
    escudo = criarEscudo(M, estilo === 'cavaleiro');
    J.escudo = junta('escudo', J.cotoveloE, 0.07, -0.15, 0);
    escudo.rotation.y = Math.PI / 2;
    J.escudo.add(escudo);
  }
  const frasco = malha(new THREE.SphereGeometry(0.05, 10, 8), M.frasco, false);
  frasco.scale.set(1, 1.3, 1);
  frasco.position.set(0, -0.05, 0.03);
  frasco.visible = false;
  frasco.userData.naoFundir = true;
  J.maoE.add(frasco);
  fundirPecas(raiz);

  raiz.traverse((o) => { if (o.isMesh) o.frustumCulled = true; });
  return { raiz, J, arma, escudo, frasco, tipo: 'humano' };
}

export function trocarArma(rig, tipo, M) {
  rig.J.maoD.remove(rig.arma);
  rig.arma = criarArma(tipo, M);
  fundirPecas(rig.arma);
  rig.arma.position.set(0, -0.03, 0);
  rig.J.maoD.add(rig.arma);
}

// ------------------------------------------------------------------ lobo

// tufos de pelo: cones espetados a apontar para trás
function tufos(pai, n, mat, fn) {
  const geo = new THREE.ConeGeometry(1, 1, 4);
  for (let i = 0; i < n; i++) {
    const [x, y, z, r, h, rx, ry, rz] = fn(i);
    const t = malha(geo, mat);
    t.scale.set(r, h, r);
    t.position.set(x, y, z);
    t.rotation.set(rx, ry, rz);
    pai.add(t);
  }
}

export function criarLobo(M, ancestral = false) {
  const raiz = new THREE.Group();
  const J = {};
  const pelo = ancestral ? M.peloAncestral : M.pelo;
  const claro = ancestral ? M.peloAncestralClaro : M.peloClaro;
  const rnd = (() => {
    let s = ancestral ? 77 : 33;
    return () => ((s = (s * 16807) % 2147483647) / 2147483647);
  })();
  J.pivo = junta('pivo', raiz, 0, 0, 0);
  J.corpo = junta('corpo', J.pivo, 0, 0.78, 0);
  const C = J.corpo;
  const tronco = malha(new THREE.SphereGeometry(0.3, 18, 12), pelo);
  tronco.scale.set(0.9, 0.95, 2.0);
  C.add(tronco);
  const barriga = malha(new THREE.SphereGeometry(0.25, 14, 8), claro);
  barriga.scale.set(0.85, 0.7, 1.7);
  barriga.position.set(0, -0.08, 0.05);
  C.add(barriga);
  // espáduas e ancas musculadas
  for (const sx of [-1, 1]) {
    const esp = esfera(0.2, pelo, 12, 8);
    esp.scale.set(0.8, 1.1, 1);
    esp.position.set(sx * 0.12, 0.04, 0.4);
    C.add(esp);
    const anca = esfera(0.2, pelo, 12, 8);
    anca.scale.set(0.75, 1, 1.15);
    anca.position.set(sx * 0.12, 0.02, -0.42);
    C.add(anca);
  }
  const peito = malha(new THREE.SphereGeometry(0.3, 14, 10), claro);
  peito.scale.set(0.95, 1.1, 1.0);
  peito.position.set(0, 0.0, 0.46);
  C.add(peito);
  // pelo eriçado no dorso e nos flancos
  tufos(C, ancestral ? 46 : 34, pelo, (i) => {
    const t = rnd();
    const lado = rnd() * 2 - 1;
    const z = 0.55 - t * 1.05;
    const a = lado * 1.1;
    return [Math.sin(a) * 0.26, Math.cos(a) * 0.27 + 0.02, z, 0.05 + rnd() * 0.03, 0.16 + rnd() * 0.1 + (ancestral ? 0.08 : 0), -1.35, 0, -a * 0.8];
  });
  if (ancestral) {
    // espinhos de osso ao longo da espinha
    for (let i = 0; i < 7; i++) {
      const e = cone(0.035, 0.16 + (3 - Math.abs(i - 3)) * 0.04, M.osso, 5);
      e.position.set(0, 0.3, 0.42 - i * 0.14);
      e.rotation.x = -0.6;
      C.add(e);
    }
  }

  // pescoço com juba
  J.pescoco = junta('pescoco', C, 0, 0.12, 0.6);
  const pes = malha(new THREE.CylinderGeometry(0.15, 0.22, 0.38, 12), pelo);
  pes.rotation.x = 1.0;
  pes.position.set(0, 0.06, 0.1);
  J.pescoco.add(pes);
  tufos(J.pescoco, ancestral ? 30 : 22, pelo, (i, n = ancestral ? 30 : 22) => {
    const a = (i / (ancestral ? 30 : 22)) * Math.PI * 2;
    const r = 0.2;
    return [Math.sin(a) * r, 0.04 + Math.cos(a) * r * 0.9, 0.0 + rnd() * 0.08, 0.06, (ancestral ? 0.32 : 0.22) + rnd() * 0.08, -1.9 + Math.cos(a) * 0.3, 0, -Math.sin(a) * 0.5];
  });

  // cabeça: crânio, arcada, focinho afunilado, orelhas, olhos a brilhar
  J.cabeca = junta('cabeca', J.pescoco, 0, 0.16, 0.26);
  const H = J.cabeca;
  const cr = malha(new THREE.SphereGeometry(0.16, 14, 10), pelo);
  cr.scale.set(1, 0.88, 1.05);
  H.add(cr);
  const arcada = capsula(0.035, 0.12, pelo, 6);
  arcada.rotation.z = Math.PI / 2;
  arcada.position.set(0, 0.06, 0.1);
  H.add(arcada);
  const foc = malha(new THREE.CylinderGeometry(0.055, 0.1, 0.27, 12), pelo);
  foc.rotation.x = Math.PI / 2;
  foc.scale.set(1, 1, 0.8);
  foc.position.set(0, -0.025, 0.2);
  H.add(foc);
  const narizP = esfera(0.035, M.focinho, 8, 6);
  narizP.scale.set(1.1, 0.8, 0.9);
  narizP.position.set(0, -0.005, 0.335);
  H.add(narizP);
  const labio = malha(new THREE.CylinderGeometry(0.058, 0.09, 0.22, 10, 1, true, Math.PI * 0.6, Math.PI * 0.8), M.focinho);
  labio.rotation.x = Math.PI / 2;
  labio.position.set(0, -0.045, 0.22);
  H.add(labio);
  for (const sx of [-1, 1]) {
    const orelha = cone(0.055, 0.16, pelo, 4);
    orelha.position.set(sx * 0.085, 0.15, -0.03);
    orelha.rotation.set(-0.25, 0, sx * -0.25);
    H.add(orelha);
    const dentro = cone(0.03, 0.1, M.focinho, 4);
    dentro.position.set(sx * 0.085, 0.14, -0.01);
    dentro.rotation.set(-0.25, 0, sx * -0.25);
    H.add(dentro);
    const orb = esfera(0.028, M.escuro, 6, 5);
    orb.position.set(sx * 0.07, 0.04, 0.12);
    H.add(orb);
    const olho = esfera(0.017, ancestral ? M.olhoBrilho : M.olhoVermelho, 6, 5);
    olho.position.set(sx * 0.072, 0.042, 0.135);
    H.add(olho);
  }
  tufos(H, 10, pelo, (i) => {
    const sx = i % 2 ? 1 : -1;
    return [sx * 0.13, -0.04 + rnd() * 0.06, -0.02 - rnd() * 0.06, 0.04, 0.14, -1.6, 0, sx * 0.6];
  });
  for (const sx of [-1, 1]) {
    for (let k = 0; k < 4; k++) {
      const d = cone(0.009, k === 0 ? 0.05 : 0.025, M.dentes, 4);
      d.rotation.x = Math.PI;
      d.position.set(sx * (0.04 - k * 0.003), -0.075, 0.3 - k * 0.04);
      H.add(d);
    }
  }
  J.mandibula = junta('mandibula', H, 0, -0.06, 0.06);
  const mand = malha(new THREE.CylinderGeometry(0.04, 0.07, 0.25, 10), pelo);
  mand.rotation.x = Math.PI / 2;
  mand.scale.set(1, 1, 0.5);
  mand.position.set(0, -0.025, 0.13);
  J.mandibula.add(mand);
  for (const sx of [-1, 1]) {
    for (let k = 0; k < 4; k++) {
      const d = cone(0.009, k === 0 ? 0.05 : 0.025, M.dentes, 4);
      d.position.set(sx * (0.035 - k * 0.003), 0.0, 0.23 - k * 0.04);
      J.mandibula.add(d);
    }
  }
  // patas
  const pernas = [['FE', 0.15, 0.48, 1], ['FD', -0.15, 0.48, 1], ['TE', 0.15, -0.5, 0], ['TD', -0.15, -0.5, 0]];
  for (const [n, x, z, frente] of pernas) {
    const c = (J['coxa' + n] = junta('coxa' + n, C, x, -0.05, z));
    const sup = malha(new THREE.SphereGeometry(0.1, 10, 8), pelo);
    sup.scale.set(0.8, frente ? 1.9 : 2.1, 1.05);
    sup.position.y = -0.17;
    c.add(sup);
    const j = (J['canela' + n] = junta('canela' + n, c, 0, -0.38, 0));
    const inf = malha(new THREE.CylinderGeometry(0.06, 0.045, 0.32, 10), pelo);
    inf.position.y = -0.17;
    j.add(inf);
    const tendao = esfera(0.06, pelo, 8, 6);
    tendao.scale.set(0.8, 1.4, 1);
    tendao.position.set(0, -0.05, frente ? 0.0 : -0.02);
    j.add(tendao);
    const pata = caixa(0.1, 0.055, 0.13, pelo, 0.025);
    pata.position.set(0, -0.34, 0.03);
    j.add(pata);
    for (let k = 0; k < 4; k++) {
      const dx = (k - 1.5) * 0.022;
      const dedo = esfera(0.022, pelo, 6, 4);
      dedo.position.set(dx, -0.355, 0.09);
      j.add(dedo);
      const garra = cone(0.008, 0.035, M.garras, 4);
      garra.rotation.x = Math.PI / 2 + 0.6;
      garra.position.set(dx, -0.37, 0.115);
      j.add(garra);
    }
  }
  // cauda farfalhuda
  J.cauda1 = junta('cauda1', C, 0, 0.1, -0.6);
  let pai = J.cauda1;
  for (let i = 0; i < 3; i++) {
    const s = malha(new THREE.SphereGeometry(0.09 - i * 0.012, 10, 8), pelo);
    s.scale.set(1, 1, 2.2);
    s.position.z = -0.12;
    pai.add(s);
    tufos(pai, 6, pelo, () => [(rnd() - 0.5) * 0.08, (rnd() - 0.5) * 0.08, -0.05 - rnd() * 0.15, 0.04, 0.14, -1.9, 0, (rnd() - 0.5) * 1.2]);
    if (i < 2) {
      const prox = junta('cauda' + (i + 2), pai, 0, 0, -0.24);
      J['cauda' + (i + 2)] = prox;
      pai = prox;
    }
  }
  fundirPecas(raiz);
  return { raiz, J, tipo: 'lobo' };
}

// ------------------------------------------------------------------ animação

// Postura de combate (ponto de partida de todas as poses humanas).
const POSTURA = {
  ombroD: [-0.35, 0, 0.1], cotoveloD: [-0.75, 0, 0], maoD: [0.15, 0, 0],
  ombroE: [-0.3, 0, -0.12], cotoveloE: [-1.0, 0, 0], maoE: [0, 0, 0],
  tronco: [0.06, 0, 0], peito: [0, 0, 0], cabeca: [-0.05, 0, 0],
  coxaD: [0, 0, 0], joelhoD: [0, 0, 0], peD: [0, 0, 0],
  coxaE: [0, 0, 0], joelhoE: [0, 0, 0], peE: [0, 0, 0],
  quadris: [0, 0, 0], escudo: [0, 0, 0],
};

const PERNA_AVANCO = { coxaD: [-0.55, 0, 0], joelhoD: [0.35, 0, 0], coxaE: [0.4, 0, 0], joelhoE: [0.4, 0, 0], peE: [-0.3, 0, 0] };

export const ANIM_HUMANO = {
  leve1: [
    [0, {}],
    [0.36, { ombroD: [-1.9, 0, -1.1], cotoveloD: [-1.6, 0, 0], maoD: [0.4, 0, 0], tronco: [0.05, -0.75, 0], peito: [0, -0.2, 0], coxaD: [-0.2, 0, 0], coxaE: [0.15, 0, 0] }],
    [0.5, { ombroD: [-1.35, 0.4, 0.65], cotoveloD: [-0.35, 0, 0], maoD: [-0.2, 0, 0], tronco: [0.25, 0.75, 0], peito: [0, 0.25, 0], ...PERNA_AVANCO }],
    [0.72, { ombroD: [-0.9, 0.2, 0.55], cotoveloD: [-0.5, 0, 0], tronco: [0.2, 0.5, 0], ...PERNA_AVANCO }],
    [1, {}],
  ],
  leve2: [
    [0, {}],
    [0.34, { ombroD: [-1.4, 0.3, 0.75], cotoveloD: [-1.5, 0, 0], maoD: [0.3, 0, 0], tronco: [0.1, 0.65, 0], peito: [0, 0.2, 0] }],
    [0.5, { ombroD: [-1.45, -0.2, -1.15], cotoveloD: [-0.25, 0, 0], maoD: [-0.1, 0, 0], tronco: [0.22, -0.7, 0], peito: [0, -0.2, 0], ...PERNA_AVANCO }],
    [0.72, { ombroD: [-1.0, 0, -0.9], cotoveloD: [-0.5, 0, 0], tronco: [0.18, -0.45, 0], ...PERNA_AVANCO }],
    [1, {}],
  ],
  forte: [
    [0, {}],
    [0.42, { ombroD: [-3.0, 0, -0.25], cotoveloD: [-1.2, 0, 0], maoD: [0.3, 0, 0], ombroE: [-2.6, 0, 0.3], cotoveloE: [-1.4, 0, 0], tronco: [-0.25, -0.25, 0], coxaD: [0.25, 0, 0], joelhoD: [0.3, 0, 0], quadris: [0, 0, 0], y: 0.02 }],
    [0.56, { ombroD: [-0.75, 0, 0.15], cotoveloD: [-0.15, 0, 0], maoD: [-0.3, 0, 0], ombroE: [-0.6, 0, -0.1], cotoveloE: [-0.4, 0, 0], tronco: [0.55, 0, 0], cabeca: [-0.35, 0, 0], coxaD: [-0.85, 0, 0], joelhoD: [0.7, 0, 0], coxaE: [0.5, 0, 0], joelhoE: [0.55, 0, 0], y: -0.16 }],
    [0.78, { ombroD: [-0.6, 0, 0.15], cotoveloD: [-0.2, 0, 0], tronco: [0.45, 0, 0], coxaD: [-0.8, 0, 0], joelhoD: [0.7, 0, 0], coxaE: [0.45, 0, 0], joelhoE: [0.5, 0, 0], y: -0.14 }],
    [1, {}],
  ],
  estocada: [
    [0, {}],
    [0.4, { ombroD: [-0.6, 0, -0.3], cotoveloD: [-1.9, 0, 0], maoD: [0.6, 0, 0], tronco: [-0.05, -0.5, 0], coxaE: [0.2, 0, 0] }],
    [0.52, { ombroD: [-1.55, 0, -0.05], cotoveloD: [-0.05, 0, 0], maoD: [0.05, 0, 0], tronco: [0.35, 0.25, 0], ...PERNA_AVANCO, y: -0.1 }],
    [0.75, { ombroD: [-1.45, 0, -0.05], cotoveloD: [-0.15, 0, 0], tronco: [0.3, 0.2, 0], ...PERNA_AVANCO, y: -0.08 }],
    [1, {}],
  ],
  rolar: [
    [0, {}],
    [0.15, { coxaD: [-1.7, 0, 0], joelhoD: [2.1, 0, 0], coxaE: [-1.7, 0, 0], joelhoE: [2.1, 0, 0], tronco: [0.9, 0, 0], cabeca: [0.5, 0, 0], ombroD: [-1.0, 0, 0.3], cotoveloD: [-1.6, 0, 0], ombroE: [-1.0, 0, -0.3], cotoveloE: [-1.6, 0, 0], y: -0.25 }],
    [0.7, { coxaD: [-1.7, 0, 0], joelhoD: [2.1, 0, 0], coxaE: [-1.7, 0, 0], joelhoE: [2.1, 0, 0], tronco: [0.9, 0, 0], cabeca: [0.5, 0, 0], ombroD: [-1.0, 0, 0.3], cotoveloD: [-1.6, 0, 0], ombroE: [-1.0, 0, -0.3], cotoveloE: [-1.6, 0, 0], y: -0.25 }],
    [0.88, { coxaD: [-0.6, 0, 0], joelhoD: [1.0, 0, 0], coxaE: [-0.2, 0, 0], joelhoE: [0.6, 0, 0], tronco: [0.4, 0, 0], y: -0.15 }],
    [1, {}],
  ],
  beber: [
    [0, {}],
    [0.3, { ombroE: [-2.1, 0.3, -0.55], cotoveloE: [-2.0, 0, 0], cabeca: [-0.45, 0, 0], tronco: [-0.1, 0, 0] }],
    [0.7, { ombroE: [-2.1, 0.3, -0.55], cotoveloE: [-2.0, 0, 0], cabeca: [-0.5, 0, 0], tronco: [-0.1, 0, 0] }],
    [1, {}],
  ],
  atordoado: [
    [0, {}],
    [0.2, { tronco: [-0.45, 0.2, 0], cabeca: [-0.35, 0, 0], ombroD: [-0.2, 0, -0.9], ombroE: [-0.2, 0, 0.9], cotoveloD: [-0.4, 0, 0], cotoveloE: [-0.4, 0, 0], coxaD: [0.35, 0, 0], joelhoE: [0.4, 0, 0], coxaE: [-0.2, 0, 0], y: -0.06 }],
    [0.6, { tronco: [-0.3, 0.1, 0], cabeca: [-0.2, 0, 0], ombroD: [-0.2, 0, -0.6], ombroE: [-0.2, 0, 0.6], coxaD: [0.3, 0, 0], joelhoE: [0.3, 0, 0], y: -0.04 }],
    [1, {}],
  ],
  golpeado: [
    [0, {}],
    [0.3, { tronco: [-0.3, -0.25, 0], cabeca: [-0.3, 0, 0], ombroE: [-0.5, 0, 0.4] }],
    [1, {}],
  ],
  derrubado: [
    [0, {}],
    [0.15, { tronco: [-0.5, 0, 0], cabeca: [-0.4, 0, 0], ombroD: [-1.8, 0, -0.5], ombroE: [-1.8, 0, 0.5], piv: -0.6, y: 0 }],
    [0.4, { tronco: [-0.2, 0, 0], ombroD: [-2.6, 0, -0.6], ombroE: [-2.6, 0, 0.6], coxaD: [-0.6, 0, 0], joelhoD: [0.8, 0, 0], coxaE: [-0.3, 0, 0], piv: -1.45, y: -0.45 }],
    [0.65, { tronco: [-0.1, 0, 0], ombroD: [-2.6, 0, -0.6], ombroE: [-2.6, 0, 0.6], coxaD: [-0.6, 0, 0], joelhoD: [0.8, 0, 0], piv: -1.45, y: -0.45 }],
    [0.85, { tronco: [0.6, 0, 0], coxaD: [-1.5, 0, 0], joelhoD: [2.0, 0, 0], coxaE: [-1.2, 0, 0], joelhoE: [1.8, 0, 0], piv: 0, y: -0.4 }],
    [1, {}],
  ],
  morrer: [
    [0, {}],
    [0.25, { tronco: [0.3, 0, 0.2], cabeca: [0.4, 0, 0], coxaD: [-0.8, 0, 0], joelhoD: [1.6, 0, 0], coxaE: [-0.6, 0, 0], joelhoE: [1.4, 0, 0], ombroD: [-0.2, 0, -0.3], ombroE: [-0.2, 0, 0.3], y: -0.35 }],
    [0.55, { tronco: [0.2, 0, 0.3], cabeca: [0.5, 0, 0.3], coxaD: [-1.2, 0, 0], joelhoD: [1.0, 0, 0], coxaE: [-0.5, 0, 0], joelhoE: [0.5, 0, 0], ombroD: [-1.0, 0, -1.2], ombroE: [-0.3, 0, 1.2], piv: 1.5, y: -0.48 }],
    [1, { tronco: [0.1, 0, 0.3], cabeca: [0.6, 0, 0.5], coxaD: [-0.4, 0, 0], joelhoD: [0.3, 0, 0], coxaE: [-0.2, 0, 0], joelhoE: [0.2, 0, 0], ombroD: [-1.6, 0, -1.3], ombroE: [-0.5, 0, 1.3], piv: 1.55, y: -0.5 }],
  ],
  sentado: [
    [0, { coxaD: [-1.45, 0, -0.15], joelhoD: [1.3, 0, 0], coxaE: [-1.45, 0, 0.15], joelhoE: [1.3, 0, 0], tronco: [0.5, 0, 0], cabeca: [0.6, 0, 0], ombroD: [-0.5, 0, 0.2], cotoveloD: [-0.6, 0, 0], ombroE: [-0.5, 0, -0.2], cotoveloE: [-0.6, 0, 0], y: -0.62 }],
    [1, { coxaD: [-1.45, 0, -0.15], joelhoD: [1.3, 0, 0], coxaE: [-1.45, 0, 0.15], joelhoE: [1.3, 0, 0], tronco: [0.55, 0, 0], cabeca: [0.65, 0, 0], ombroD: [-0.5, 0, 0.2], cotoveloD: [-0.6, 0, 0], ombroE: [-0.5, 0, -0.2], cotoveloE: [-0.6, 0, 0], y: -0.62 }],
  ],
  levantar: [
    [0, { coxaD: [-1.45, 0, -0.15], joelhoD: [1.3, 0, 0], coxaE: [-1.45, 0, 0.15], joelhoE: [1.3, 0, 0], tronco: [0.5, 0, 0], cabeca: [0.6, 0, 0], y: -0.62 }],
    [0.5, { coxaD: [-1.0, 0, 0], joelhoD: [1.6, 0, 0], coxaE: [-0.4, 0, 0], joelhoE: [0.8, 0, 0], tronco: [0.6, 0, 0], y: -0.35 }],
    [1, {}],
  ],
  acender: [
    [0, {}],
    [0.35, { coxaD: [-1.2, 0, 0], joelhoD: [1.9, 0, 0], coxaE: [0.4, 0, 0], joelhoE: [1.8, 0, 0], tronco: [0.5, 0, 0], ombroD: [-1.3, 0, 0.1], cotoveloD: [-0.2, 0, 0], y: -0.45 }],
    [0.75, { coxaD: [-1.2, 0, 0], joelhoD: [1.9, 0, 0], coxaE: [0.4, 0, 0], joelhoE: [1.8, 0, 0], tronco: [0.5, 0, 0], ombroD: [-1.3, 0, 0.1], cotoveloD: [-0.2, 0, 0], y: -0.45 }],
    [1, {}],
  ],
  // ataques extra dos chefes
  varrer: [
    [0, {}],
    [0.45, { ombroD: [-1.2, -0.2, -1.5], cotoveloD: [-0.5, 0, 0], maoD: [0.2, 0, 0], ombroE: [-1.0, 0, 0.6], tronco: [0.05, -1.0, 0], peito: [0, -0.3, 0], coxaE: [0.3, 0, 0] }],
    [0.6, { ombroD: [-1.4, 0.2, 1.2], cotoveloD: [-0.2, 0, 0], maoD: [-0.1, 0, 0], ombroE: [-0.4, 0, -0.3], tronco: [0.15, 1.0, 0], peito: [0, 0.35, 0], ...PERNA_AVANCO }],
    [0.8, { ombroD: [-1.0, 0, 0.9], cotoveloD: [-0.4, 0, 0], tronco: [0.12, 0.7, 0], ...PERNA_AVANCO }],
    [1, {}],
  ],
  salto: [
    [0, {}],
    [0.25, { coxaD: [-0.9, 0, 0], joelhoD: [1.5, 0, 0], coxaE: [-0.9, 0, 0], joelhoE: [1.5, 0, 0], tronco: [0.5, 0, 0], ombroD: [-0.5, 0, -0.3], y: -0.3 }],
    [0.5, { ombroD: [-3.1, 0, -0.2], cotoveloD: [-1.0, 0, 0], ombroE: [-2.8, 0, 0.3], cotoveloE: [-1.2, 0, 0], tronco: [-0.3, 0, 0], coxaD: [-0.5, 0, 0], joelhoD: [0.9, 0, 0], coxaE: [-0.3, 0, 0], joelhoE: [1.0, 0, 0] }],
    [0.64, { ombroD: [-0.6, 0, 0.1], cotoveloD: [-0.1, 0, 0], ombroE: [-0.6, 0, -0.1], tronco: [0.6, 0, 0], coxaD: [-1.0, 0, 0], joelhoD: [1.2, 0, 0], coxaE: [0.3, 0, 0], joelhoE: [0.9, 0, 0], y: -0.3 }],
    [0.85, { ombroD: [-0.6, 0, 0.1], tronco: [0.5, 0, 0], coxaD: [-1.0, 0, 0], joelhoD: [1.2, 0, 0], y: -0.25 }],
    [1, {}],
  ],
  rugido: [
    [0, {}],
    [0.3, { tronco: [-0.35, 0, 0], cabeca: [-0.4, 0, 0], ombroD: [-0.6, 0, -1.2], ombroE: [-0.6, 0, 1.2], cotoveloD: [-0.6, 0, 0], cotoveloE: [-0.6, 0, 0] }],
    [0.8, { tronco: [-0.35, 0, 0], cabeca: [-0.45, 0, 0], ombroD: [-0.6, 0, -1.3], ombroE: [-0.6, 0, 1.3], cotoveloD: [-0.6, 0, 0], cotoveloE: [-0.6, 0, 0] }],
    [1, {}],
  ],
};

export const ANIM_LOBO = {
  morder: [
    [0, {}],
    [0.35, { corpo: [-0.15, 0, 0], pescoco: [-0.4, 0, 0], cabeca: [0.2, 0, 0], mandibula: [0.5, 0, 0], coxaTE: [0.4, 0, 0], coxaTD: [0.4, 0, 0], y: -0.08 }],
    [0.5, { corpo: [0.15, 0, 0], pescoco: [0.45, 0, 0], cabeca: [-0.15, 0, 0], mandibula: [0.05, 0, 0], coxaFE: [-0.7, 0, 0], coxaFD: [-0.6, 0, 0], coxaTE: [0.6, 0, 0], coxaTD: [0.5, 0, 0] }],
    [0.75, { pescoco: [0.2, 0, 0], mandibula: [0, 0, 0] }],
    [1, {}],
  ],
  salto: [
    [0, {}],
    [0.3, { corpo: [-0.25, 0, 0], pescoco: [-0.3, 0, 0], mandibula: [0.4, 0, 0], coxaTE: [0.7, 0, 0], coxaTD: [0.7, 0, 0], canelaTE: [-0.9, 0, 0], canelaTD: [-0.9, 0, 0], coxaFE: [0.4, 0, 0], coxaFD: [0.4, 0, 0], y: -0.2 }],
    [0.5, { corpo: [-0.2, 0, 0], pescoco: [0.3, 0, 0], mandibula: [0.6, 0, 0], coxaFE: [-1.2, 0, 0], coxaFD: [-1.2, 0, 0], coxaTE: [0.9, 0, 0], coxaTD: [0.9, 0, 0], y: 0.55 }],
    [0.65, { corpo: [0.2, 0, 0], pescoco: [0.4, 0, 0], mandibula: [0, 0, 0], coxaFE: [-0.3, 0, 0], coxaFD: [-0.3, 0, 0], y: 0.05 }],
    [1, {}],
  ],
  cauda: [
    [0, {}],
    [0.35, { corpo: [0, 0, 0.15], pescoco: [0, 0.4, 0], cauda1: [0, 0.8, 0] }],
    [0.55, { corpo: [0, 0, -0.1], pescoco: [0, -0.3, 0], cauda1: [0, -1.2, 0], cauda2: [0, -0.6, 0] }],
    [1, {}],
  ],
  uivar: [
    [0, {}],
    [0.3, { corpo: [-0.35, 0, 0], pescoco: [-0.9, 0, 0], cabeca: [-0.5, 0, 0], mandibula: [0.5, 0, 0], coxaTE: [0.3, 0, 0], coxaTD: [0.3, 0, 0], y: -0.1 }],
    [0.8, { corpo: [-0.35, 0, 0], pescoco: [-0.95, 0, 0], cabeca: [-0.55, 0, 0], mandibula: [0.55, 0, 0], coxaTE: [0.3, 0, 0], coxaTD: [0.3, 0, 0], y: -0.1 }],
    [1, {}],
  ],
  atordoado: [
    [0, {}],
    [0.25, { corpo: [0.1, 0, 0.3], pescoco: [0.4, 0.4, 0], mandibula: [0.3, 0, 0], y: -0.15 }],
    [1, {}],
  ],
  golpeado: [
    [0, {}],
    [0.3, { corpo: [0, 0, 0.15], pescoco: [0.2, 0.3, 0] }],
    [1, {}],
  ],
  morrer: [
    [0, {}],
    [0.4, { corpo: [0, 0, 0.8], pescoco: [0.4, 0, 0], mandibula: [0.4, 0, 0], y: -0.3 }],
    [1, { corpo: [0, 0, 1.45], pescoco: [0.3, 0.3, 0], mandibula: [0.5, 0, 0], coxaFE: [-0.5, 0, 0], coxaTE: [0.4, 0, 0], y: -0.55 }],
  ],
};

function interp(a, b, t) {
  return a + (b - a) * t;
}
const ease = (t) => t * t * (3 - 2 * t);

// Avalia uma animação de poses-chave no tempo normalizado t.
function avaliar(chaves, t, base) {
  let i = 0;
  while (i < chaves.length - 2 && t > chaves[i + 1][0]) i++;
  const [t0, p0] = chaves[i];
  const [t1, p1] = chaves[Math.min(i + 1, chaves.length - 1)];
  const k = t1 > t0 ? ease(Math.min(1, Math.max(0, (t - t0) / (t1 - t0)))) : 1;
  const r = {};
  const nomes = new Set([...Object.keys(p0), ...Object.keys(p1)]);
  for (const n of nomes) {
    const a = p0[n] ?? base[n] ?? (n === 'y' || n === 'piv' ? 0 : [0, 0, 0]);
    const b = p1[n] ?? base[n] ?? (n === 'y' || n === 'piv' ? 0 : [0, 0, 0]);
    if (typeof a === 'number') r[n] = interp(a, b, k);
    else r[n] = [interp(a[0], b[0], k), interp(a[1], b[1], k), interp(a[2], b[2], k)];
  }
  return r;
}

export class Animador {
  constructor(rig) {
    this.rig = rig;
    this.J = rig.J;
    this.humano = rig.tipo === 'humano';
    this.anims = this.humano ? ANIM_HUMANO : ANIM_LOBO;
    this.fase = 0;
    this.acao = null;
    this.alvo = {};
    this.suavizar = 16;
    this.bloqueio = 0;
    this.rolo = 0;
    this.yQuadris = this.humano ? 0.38 : 0.78;
    this.juntasAcao = new Map();
    for (const [nome, chaves] of Object.entries(this.anims)) {
      const s = new Set();
      for (const [, p] of chaves) for (const k of Object.keys(p)) s.add(k);
      this.juntasAcao.set(nome, s);
    }
  }

  tocar(nome, dur, { manter = false, velocidade = 1 } = {}) {
    this.acao = { nome, t: 0, dur, manter, velocidade };
  }

  parar() {
    this.acao = null;
  }

  get progresso() {
    return this.acao ? Math.min(1, this.acao.t / this.acao.dur) : 1;
  }

  // vel: velocidade horizontal (m/s); corrida: 0..1; lateral: -1..1 (andar de lado com alvo fixo)
  atualizar(dt, vel, { corrida = 0, lateral = 0, atras = false } = {}) {
    const J = this.J;
    const A = {};
    let y = 0;
    let piv = 0;

    if (this.humano) {
      // ---- locomoção humana ----
      const k = Math.min(1.4, vel / 4);
      this.fase += dt * (vel > 0.1 ? 2.1 + vel * 1.05 : 0) * (atras ? -1 : 1);
      const f = this.fase;
      const s = Math.sin(f);
      const c = Math.cos(f);
      for (const [n, v] of Object.entries(POSTURA)) A[n] = [...v];
      const amp = 0.55 * k + corrida * 0.25;
      A.coxaE[0] = -s * amp;
      A.coxaD[0] = s * amp;
      A.joelhoE[0] = 0.08 + Math.max(0, c) * (0.9 * k + corrida * 0.5);
      A.joelhoD[0] = 0.08 + Math.max(0, -c) * (0.9 * k + corrida * 0.5);
      A.peE[0] = -A.coxaE[0] * 0.25;
      A.peD[0] = -A.coxaD[0] * 0.25;
      // passos laterais
      if (Math.abs(lateral) > 0.1) {
        A.coxaE[2] = Math.max(0, s) * 0.35 * lateral * k;
        A.coxaD[2] = Math.max(0, -s) * 0.35 * lateral * k;
        A.coxaE[0] *= 0.4;
        A.coxaD[0] *= 0.4;
      }
      A.tronco[0] += 0.05 * k + corrida * 0.28;
      A.tronco[1] = s * 0.08 * k;
      A.ombroE[0] += s * (0.12 * k + corrida * 0.6);
      A.ombroD[0] -= s * (0.12 * k + corrida * 0.6);
      if (corrida > 0.3) {
        A.cotoveloD[0] = -1.1;
        A.ombroD[0] -= 0.1;
      }
      y = -Math.abs(c) * 0.035 * k - (vel < 0.1 ? 0.01 + Math.sin(performance.now() / 900) * 0.008 : 0);
      if (vel < 0.1) A.peito[0] = Math.sin(performance.now() / 900) * 0.02;

      // bloqueio com escudo (sobreposição contínua)
      if (this.bloqueio > 0.01) {
        const b = this.bloqueio;
        const mix = (n, v) => { A[n] = A[n].map((x, i) => x + (v[i] - x) * b); };
        mix('ombroE', [-1.15, 0.5, 0.25]);
        mix('cotoveloE', [-1.25, 0, 0]);
        mix('tronco', [0.12, 0.15, 0]);
      }
    } else {
      // ---- locomoção do lobo ----
      const k = Math.min(1.6, vel / 5);
      this.fase += dt * (vel > 0.1 ? 3 + vel * 1.3 : 0);
      const f = this.fase;
      const galope = corrida;
      const pernas = ['FE', 'FD', 'TE', 'TD'];
      const desf = galope > 0.5 ? [0, 0.3, Math.PI, Math.PI + 0.3] : [0, Math.PI, Math.PI, 0];
      pernas.forEach((n, i) => {
        const s = Math.sin(f + desf[i]);
        const c = Math.cos(f + desf[i]);
        const frente = i < 2;
        A['coxa' + n] = [s * 0.55 * k, 0, 0];
        A['canela' + n] = [(frente ? -1 : 1) * Math.max(0, c) * 0.7 * k * (frente ? -1 : 1) * (frente ? 1 : -1), 0, 0];
      });
      A.corpo = [Math.sin(f * (galope > 0.5 ? 1 : 2)) * 0.05 * k * (galope > 0.5 ? 2 : 1), 0, 0];
      A.pescoco = [0.1 + (vel < 0.1 ? Math.sin(performance.now() / 700) * 0.05 : 0), 0, 0];
      A.cabeca = [0, 0, 0];
      A.mandibula = [vel < 0.1 ? 0.08 : 0.15 * k, 0, 0];
      A.cauda1 = [-0.3 + Math.sin(f) * 0.1, Math.sin(f * 0.5) * 0.3, 0];
      A.cauda2 = [0.2, Math.sin(f * 0.5 - 0.5) * 0.3, 0];
      A.cauda3 = [0.2, Math.sin(f * 0.5 - 1) * 0.3, 0];
      y = Math.abs(Math.sin(f)) * 0.04 * k;
    }

    // ---- ação (sobrepõe-se às juntas que define) ----
    if (this.acao) {
      const a = this.acao;
      a.t += dt * a.velocidade;
      let t = a.t / a.dur;
      if (t >= 1) {
        if (a.manter) t = 1;
        else {
          this.acao = null;
          t = -1;
        }
      }
      if (t >= 0) {
        const base = this.humano ? POSTURA : {};
        const pose = avaliar(this.anims[a.nome], t, base);
        for (const [n, v] of Object.entries(pose)) {
          if (n === 'y') y += v;
          else if (n === 'piv') piv = v;
          else A[n] = v;
        }
        if (a.nome === 'rolar') {
          const r = Math.min(1, Math.max(0, (t - 0.1) / 0.68));
          this.rolo = ease(r) * Math.PI * 2;
        }
      }
    }
    if (!this.acao || this.acao.nome !== 'rolar') this.rolo = 0;

    // ---- aplicar com suavização ----
    const kS = Math.min(1, dt * this.suavizar);
    for (const [n, v] of Object.entries(A)) {
      const j = J[n];
      if (!j) continue;
      j.rotation.x += (v[0] - j.rotation.x) * kS;
      j.rotation.y += (v[1] - j.rotation.y) * kS;
      j.rotation.z += (v[2] - j.rotation.z) * kS;
    }
    const alvoY = this.yQuadris + y;
    const corpoJ = this.humano ? J.quadris : J.corpo;
    corpoJ.position.y += (alvoY - corpoJ.position.y) * kS;
    J.pivo.rotation.x = this.rolo !== 0 ? this.rolo : J.pivo.rotation.x + (piv - J.pivo.rotation.x) * kS;

    // capa acompanha o movimento
    if (J.capa) {
      const alvo = 0.15 + Math.min(1, vel / 7) * 0.7;
      J.capa.rotation.x += (alvo - J.capa.rotation.x) * Math.min(1, dt * 6);
    }
  }
}
