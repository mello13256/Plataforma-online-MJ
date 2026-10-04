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

export function criarMateriais(tex) {
  const metal = (cor, rug = 0.42, met = 0.9) => new THREE.MeshStandardMaterial({
    color: cor, metalness: met, roughness: rug, roughnessMap: tex.metalRug,
  });
  return {
    armadura: metal(0x6a665f, 0.5),
    armaduraEscura: metal(0x4a4844, 0.5),
    armaduraRei: metal(0x7a6234, 0.38),
    malha: metal(0x3b3a38, 0.65, 0.8),
    lamina: metal(0xb9b6b0, 0.28, 1),
    laminaEscura: metal(0x6a6460, 0.5, 0.9),
    laminaRei: new THREE.MeshStandardMaterial({
      color: 0x55504a, metalness: 0.9, roughness: 0.4, roughnessMap: tex.metalRug, emissive: 0xff4a10, emissiveIntensity: 0,
    }),
    couro: new THREE.MeshStandardMaterial({ color: 0x4a3626, roughness: 0.85 }),
    tecido: new THREE.MeshStandardMaterial({ color: 0x5e2a1e, roughness: 1, map: tex.tecido }),
    tecidoAzul: new THREE.MeshStandardMaterial({ color: 0x2c3442, roughness: 1, map: tex.tecido }),
    trapos: new THREE.MeshStandardMaterial({ color: 0x5a5244, roughness: 1, map: tex.tecido }),
    capa: new THREE.MeshStandardMaterial({ color: 0x3a1d18, roughness: 1, map: tex.tecido, side: THREE.DoubleSide }),
    capaRei: new THREE.MeshStandardMaterial({ color: 0x4a1410, roughness: 1, map: tex.tecido, side: THREE.DoubleSide }),
    pele: new THREE.MeshStandardMaterial({ color: 0x7b6a58, roughness: 0.9 }),
    madeira: new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.9, map: tex.casca }),
    escuro: new THREE.MeshBasicMaterial({ color: 0x050403 }),
    olhoBrilho: new THREE.MeshBasicMaterial({ color: 0xffb040 }),
    olhoVermelho: new THREE.MeshBasicMaterial({ color: 0xff3010 }),
    pelo: new THREE.MeshStandardMaterial({ color: 0x3d3833, roughness: 1 }),
    peloAncestral: new THREE.MeshStandardMaterial({ color: 0x8c8a86, roughness: 1, emissive: 0x101418, emissiveIntensity: 1 }),
    dentes: new THREE.MeshStandardMaterial({ color: 0xd8d0b8, roughness: 0.6 }),
    frasco: new THREE.MeshStandardMaterial({ color: 0xffa040, emissive: 0xff7a10, emissiveIntensity: 2.2, roughness: 0.2, transparent: true, opacity: 0.9 }),
  };
}

// ------------------------------------------------------------------ armas

function formaLamina(comp, larg, ponta = 0.18) {
  const s = new THREE.Shape();
  s.moveTo(-larg / 2, 0);
  s.lineTo(larg / 2, 0);
  s.lineTo(larg / 2 * 0.85, comp * (1 - ponta));
  s.lineTo(0, comp);
  s.lineTo(-larg / 2 * 0.85, comp * (1 - ponta));
  s.closePath();
  return s;
}

function lamina(comp, larg, esp, mat) {
  const g = new THREE.ExtrudeGeometry(formaLamina(comp, larg), { depth: esp, bevelEnabled: true, bevelThickness: esp * 0.4, bevelSize: esp * 0.5, bevelSegments: 1 });
  g.translate(0, 0, -esp / 2);
  g.rotateX(Math.PI / 2); // comprimento passa para +Z
  g.rotateZ(Math.PI / 2); // gume na horizontal quando o braço está em baixo
  return malha(g, mat);
}

export function criarArma(tipo, M) {
  const g = new THREE.Group();
  const punho = (comp, r = 0.022) => {
    const p = malha(new THREE.CylinderGeometry(r, r, comp, 6), M.couro);
    p.rotation.x = Math.PI / 2;
    return p;
  };
  if (tipo === 'espada' || tipo === 'espadao' || tipo === 'espadaRei' || tipo === 'espadaCavaleiro') {
    const cfg = {
      espada: [1.0, 0.07, 0.34, M.lamina],
      espadaCavaleiro: [1.0, 0.075, 0.34, M.laminaEscura],
      espadao: [1.6, 0.12, 0.5, M.lamina],
      espadaRei: [1.9, 0.17, 0.62, M.laminaRei],
    }[tipo];
    const [comp, larg, guarda, mat] = cfg;
    const p = punho(tipo === 'espada' || tipo === 'espadaCavaleiro' ? 0.22 : 0.36);
    g.add(p);
    const gu = malha(new THREE.BoxGeometry(guarda, 0.045, 0.05), M.armaduraEscura);
    gu.position.z = (tipo === 'espada' || tipo === 'espadaCavaleiro' ? 0.12 : 0.19);
    g.add(gu);
    const pomo = malha(new THREE.SphereGeometry(0.04, 8, 6), M.armaduraEscura);
    pomo.position.z = -gu.position.z + 0.02;
    g.add(pomo);
    const l = lamina(comp, larg, 0.014 * (comp > 1.2 ? 1.6 : 1), mat);
    l.position.z = gu.position.z + 0.02;
    g.add(l);
    g.userData.ponta = gu.position.z + comp;
  } else if (tipo === 'machado') {
    const cabo = malha(new THREE.CylinderGeometry(0.025, 0.03, 0.95, 6), M.madeira);
    cabo.rotation.x = Math.PI / 2;
    cabo.position.z = 0.3;
    g.add(cabo);
    const s = new THREE.Shape();
    s.moveTo(0, -0.06);
    s.quadraticCurveTo(0.18, -0.1, 0.26, -0.2);
    s.quadraticCurveTo(0.33, 0, 0.26, 0.2);
    s.quadraticCurveTo(0.18, 0.1, 0, 0.06);
    s.closePath();
    const cab = new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.01, bevelSegments: 1 });
    cab.translate(0, 0, -0.015);
    const m = malha(cab, M.laminaEscura);
    m.rotation.set(0, Math.PI / 2, Math.PI / 2);
    m.position.set(0, 0, 0.7);
    g.add(m);
    g.userData.ponta = 0.8;
  } else if (tipo === 'espadaPartida') {
    g.add(punho(0.18));
    const gu = malha(new THREE.BoxGeometry(0.22, 0.03, 0.04), M.laminaEscura);
    gu.position.z = 0.1;
    g.add(gu);
    const l = lamina(0.55, 0.06, 0.012, M.laminaEscura);
    l.position.z = 0.11;
    g.add(l);
    g.userData.ponta = 0.66;
  }
  return g;
}

function criarEscudo(M, escuro = false) {
  const s = new THREE.Shape();
  s.moveTo(-0.26, 0.3);
  s.lineTo(0.26, 0.3);
  s.lineTo(0.26, -0.02);
  s.quadraticCurveTo(0.22, -0.3, 0, -0.44);
  s.quadraticCurveTo(-0.22, -0.3, -0.26, -0.02);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.018, bevelSegments: 2 });
  g.translate(0, 0, -0.02);
  const esc = new THREE.Group();
  const face = malha(g, escuro ? M.armaduraEscura : M.armadura);
  esc.add(face);
  const bossa = malha(new THREE.SphereGeometry(0.07, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.armaduraEscura);
  bossa.rotation.x = Math.PI / 2;
  bossa.position.z = 0.03;
  esc.add(bossa);
  const faixa = malha(new THREE.BoxGeometry(0.08, 0.72, 0.02), escuro ? M.tecidoAzul : M.tecido);
  faixa.position.set(0, -0.06, 0.034);
  esc.add(faixa);
  return esc;
}

// ------------------------------------------------------------------ humanoide

// estilo: 'jogador' | 'esvaziado' | 'cavaleiro' | 'rei'
export function criarHumanoide(estilo, M) {
  const raiz = new THREE.Group();
  const pivo = junta('pivo', raiz, 0, 0.6, 0);
  const J = { pivo };
  const quadris = (J.quadris = junta('quadris', pivo, 0, 0.38, 0));
  const magro = estilo === 'esvaziado';
  const corpoMat = magro ? M.trapos : estilo === 'rei' ? M.armaduraRei : estilo === 'cavaleiro' ? M.armaduraEscura : M.armadura;
  const roupa = magro ? M.trapos : estilo === 'rei' ? M.capaRei : estilo === 'cavaleiro' ? M.tecidoAzul : M.tecido;
  const membro = magro ? M.pele : M.malha;

  const pelvis = malha(new THREE.BoxGeometry(0.34, 0.2, 0.22), magro ? M.trapos : M.couro);
  quadris.add(pelvis);
  // saia/tabardo
  const saia = malha(new THREE.CylinderGeometry(0.2, 0.3, 0.42, 10, 1, true), roupa);
  saia.position.y = -0.2;
  saia.material = roupa;
  quadris.add(saia);

  J.tronco = junta('tronco', quadris, 0, 0.1, 0);
  const abd = malha(new THREE.CylinderGeometry(0.15, 0.16, 0.24, 10), magro ? M.pele : membro);
  abd.position.y = 0.1;
  J.tronco.add(abd);
  J.peito = junta('peito', J.tronco, 0, 0.22, 0);
  const peito = malha(new THREE.SphereGeometry(0.22, 14, 10), corpoMat);
  peito.scale.set(1.05, 0.95, 0.72);
  peito.position.y = 0.1;
  J.peito.add(peito);
  if (!magro) {
    const gola = malha(new THREE.TorusGeometry(0.1, 0.035, 6, 12), corpoMat);
    gola.rotation.x = Math.PI / 2;
    gola.position.y = 0.27;
    J.peito.add(gola);
  } else {
    // costelas à vista sob os trapos
    for (let i = 0; i < 3; i++) {
      const c = malha(new THREE.TorusGeometry(0.15 - i * 0.01, 0.012, 4, 10, Math.PI), M.pele);
      c.position.set(0, 0.02 + i * 0.07, 0.05);
      c.rotation.set(0, 0, Math.PI);
      J.peito.add(c);
    }
  }

  // cabeça
  J.cabeca = junta('cabeca', J.peito, 0, 0.32, 0);
  if (magro) {
    const cr = malha(new THREE.SphereGeometry(0.11, 12, 10), M.pele);
    cr.scale.set(0.9, 1.08, 0.95);
    cr.position.y = 0.1;
    J.cabeca.add(cr);
    for (const lado of [-1, 1]) {
      const o = malha(new THREE.SphereGeometry(0.025, 6, 6), M.escuro, false);
      o.position.set(lado * 0.04, 0.12, 0.085);
      J.cabeca.add(o);
      const b = malha(new THREE.SphereGeometry(0.008, 4, 4), M.olhoBrilho, false);
      b.position.set(lado * 0.04, 0.12, 0.1);
      J.cabeca.add(b);
    }
    const capuz = malha(new THREE.SphereGeometry(0.135, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.62), M.trapos);
    capuz.position.y = 0.11;
    capuz.rotation.x = -0.35;
    J.cabeca.add(capuz);
  } else {
    const elmo = malha(new THREE.CylinderGeometry(0.115, 0.125, 0.25, 14), corpoMat);
    elmo.position.y = 0.11;
    J.cabeca.add(elmo);
    const topo = malha(new THREE.SphereGeometry(0.115, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), corpoMat);
    topo.position.y = 0.235;
    J.cabeca.add(topo);
    const fenda = malha(new THREE.BoxGeometry(0.17, 0.022, 0.03), M.escuro, false);
    fenda.position.set(0, 0.14, 0.115);
    J.cabeca.add(fenda);
    const nariz = malha(new THREE.BoxGeometry(0.02, 0.12, 0.03), corpoMat);
    nariz.position.set(0, 0.1, 0.122);
    J.cabeca.add(nariz);
    if (estilo === 'rei') {
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const p = malha(new THREE.ConeGeometry(0.025, 0.16 + (i % 2) * 0.06, 5), M.armaduraRei);
        p.position.set(Math.cos(a) * 0.1, 0.33, Math.sin(a) * 0.1);
        J.cabeca.add(p);
      }
      const olho = malha(new THREE.BoxGeometry(0.13, 0.012, 0.01), M.olhoVermelho, false);
      olho.position.set(0, 0.14, 0.132);
      J.cabeca.add(olho);
    } else if (estilo === 'cavaleiro') {
      const crista = malha(new THREE.BoxGeometry(0.03, 0.1, 0.26), M.tecidoAzul);
      crista.position.set(0, 0.32, -0.02);
      J.cabeca.add(crista);
    } else {
      const pluma = malha(new THREE.ConeGeometry(0.04, 0.3, 6), M.tecido);
      pluma.position.set(0, 0.36, -0.06);
      pluma.rotation.x = -0.5;
      J.cabeca.add(pluma);
    }
  }

  // braços
  for (const [lado, sx] of [['D', -1], ['E', 1]]) {
    const o = (J['ombro' + lado] = junta('ombro' + lado, J.peito, sx * 0.25, 0.2, 0));
    if (!magro) {
      const ombreira = malha(new THREE.SphereGeometry(0.11, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), corpoMat);
      ombreira.position.set(sx * 0.02, 0.02, 0);
      ombreira.rotation.z = -sx * 0.4;
      o.add(ombreira);
    }
    const sup = capsula(magro ? 0.04 : 0.055, 0.2, membro);
    sup.position.y = -0.15;
    o.add(sup);
    const c = (J['cotovelo' + lado] = junta('cotovelo' + lado, o, 0, -0.3, 0));
    const ant = capsula(magro ? 0.035 : 0.05, 0.18, magro ? M.pele : corpoMat);
    ant.position.y = -0.13;
    c.add(ant);
    const mao = (J['mao' + lado] = junta('mao' + lado, c, 0, -0.28, 0));
    const luva = malha(new THREE.BoxGeometry(0.07, 0.09, 0.08), magro ? M.pele : M.couro);
    mao.add(luva);
  }

  // pernas
  for (const [lado, sx] of [['D', -1], ['E', 1]]) {
    const cx = (J['coxa' + lado] = junta('coxa' + lado, quadris, sx * 0.11, -0.06, 0));
    const coxa = capsula(magro ? 0.055 : 0.075, 0.28, magro ? M.pele : membro);
    coxa.position.y = -0.2;
    cx.add(coxa);
    const jo = (J['joelho' + lado] = junta('joelho' + lado, cx, 0, -0.42, 0));
    if (!magro) {
      const joelheira = malha(new THREE.SphereGeometry(0.06, 8, 6), corpoMat);
      joelheira.position.z = 0.04;
      jo.add(joelheira);
    }
    const can = capsula(magro ? 0.045 : 0.065, 0.28, magro ? M.pele : corpoMat);
    can.position.y = -0.2;
    jo.add(can);
    const pe = (J['pe' + lado] = junta('pe' + lado, jo, 0, -0.42, 0));
    const bota = malha(new THREE.BoxGeometry(0.11, 0.08, 0.24), magro ? M.trapos : M.couro);
    bota.position.set(0, -0.0, 0.05);
    pe.add(bota);
  }

  // capa
  if (estilo === 'jogador' || estilo === 'rei') {
    const capaG = new THREE.PlaneGeometry(0.4, 0.92, 4, 6);
    capaG.translate(0, -0.46, 0);
    const pa = capaG.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      const y = pa.getY(i);
      pa.setZ(i, -Math.abs(pa.getX(i)) * 0.15 + Math.sin(pa.getX(i) * 9) * 0.015 * (-y));
      pa.setX(i, pa.getX(i) * (1 - y * 0.5));
    }
    capaG.computeVertexNormals();
    J.capa = junta('capa', J.peito, 0, 0.25, -0.15);
    const capa = malha(capaG, estilo === 'rei' ? M.capaRei : M.capa);
    J.capa.add(capa);
  }

  // armas
  let tipoArma = { jogador: 'espada', esvaziado: 'espadaPartida', cavaleiro: 'espadaCavaleiro', rei: 'espadaRei' }[estilo];
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

export function criarLobo(M, ancestral = false) {
  const raiz = new THREE.Group();
  const J = {};
  const pelo = ancestral ? M.peloAncestral : M.pelo;
  J.pivo = junta('pivo', raiz, 0, 0, 0);
  J.corpo = junta('corpo', J.pivo, 0, 0.78, 0);
  const tronco = malha(new THREE.SphereGeometry(0.3, 14, 10), pelo);
  tronco.scale.set(0.95, 1, 2.1);
  J.corpo.add(tronco);
  const peito = malha(new THREE.SphereGeometry(0.33, 12, 10), pelo);
  peito.scale.set(1, 1.1, 1.1);
  peito.position.set(0, 0.04, 0.42);
  J.corpo.add(peito);
  // pelo eriçado no dorso
  for (let i = 0; i < 7; i++) {
    const t = malha(new THREE.ConeGeometry(0.06, 0.2, 4), pelo);
    t.position.set(0, 0.28 - Math.abs(i - 3) * 0.015, 0.45 - i * 0.14);
    t.rotation.x = -1.1;
    J.corpo.add(t);
  }
  J.pescoco = junta('pescoco', J.corpo, 0, 0.12, 0.6);
  const pes = malha(new THREE.CylinderGeometry(0.14, 0.2, 0.36, 10), pelo);
  pes.rotation.x = 1.0;
  pes.position.set(0, 0.06, 0.1);
  J.pescoco.add(pes);
  J.cabeca = junta('cabeca', J.pescoco, 0, 0.16, 0.26);
  const cr = malha(new THREE.SphereGeometry(0.16, 12, 10), pelo);
  cr.scale.set(1, 0.9, 1.1);
  J.cabeca.add(cr);
  const focinho = malha(new THREE.BoxGeometry(0.13, 0.1, 0.26), pelo);
  focinho.position.set(0, -0.02, 0.2);
  J.cabeca.add(focinho);
  const nariz = malha(new THREE.SphereGeometry(0.03, 6, 6), M.escuro);
  nariz.position.set(0, 0.02, 0.33);
  J.cabeca.add(nariz);
  for (const lado of [-1, 1]) {
    const orelha = malha(new THREE.ConeGeometry(0.05, 0.14, 4), pelo);
    orelha.position.set(lado * 0.08, 0.15, -0.02);
    orelha.rotation.set(-0.3, 0, lado * -0.2);
    J.cabeca.add(orelha);
    const olho = malha(new THREE.SphereGeometry(0.022, 6, 6), ancestral ? M.olhoBrilho : M.olhoVermelho, false);
    olho.position.set(lado * 0.075, 0.04, 0.13);
    J.cabeca.add(olho);
  }
  J.mandibula = junta('mandibula', J.cabeca, 0, -0.06, 0.06);
  const mand = malha(new THREE.BoxGeometry(0.11, 0.04, 0.24), pelo);
  mand.position.set(0, -0.02, 0.12);
  J.mandibula.add(mand);
  for (const lado of [-1, 1]) {
    const d = malha(new THREE.ConeGeometry(0.012, 0.05, 4), M.dentes, false);
    d.position.set(lado * 0.04, 0.02, 0.22);
    J.mandibula.add(d);
    const d2 = malha(new THREE.ConeGeometry(0.012, 0.05, 4), M.dentes, false);
    d2.position.set(lado * 0.045, -0.07, 0.29);
    d2.rotation.x = Math.PI;
    J.cabeca.add(d2);
  }
  // patas
  const pernas = [['FE', 0.16, 0.5], ['FD', -0.16, 0.5], ['TE', 0.16, -0.5], ['TD', -0.16, -0.5]];
  for (const [n, x, z] of pernas) {
    const c = (J['coxa' + n] = junta('coxa' + n, J.corpo, x, -0.05, z));
    const sup = capsula(0.075, 0.28, pelo);
    sup.position.y = -0.18;
    c.add(sup);
    const j = (J['canela' + n] = junta('canela' + n, c, 0, -0.38, 0));
    const inf = capsula(0.045, 0.26, pelo);
    inf.position.y = -0.16;
    j.add(inf);
    const pata = malha(new THREE.BoxGeometry(0.09, 0.05, 0.13), pelo);
    pata.position.set(0, -0.35, 0.03);
    j.add(pata);
  }
  J.cauda1 = junta('cauda1', J.corpo, 0, 0.1, -0.6);
  let pai = J.cauda1;
  for (let i = 0; i < 3; i++) {
    const s = capsula(0.06 - i * 0.012, 0.18, pelo);
    s.rotation.x = Math.PI / 2;
    s.position.z = -0.12;
    pai.add(s);
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
