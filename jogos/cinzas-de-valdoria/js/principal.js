// Cinzas de Valdoria — ciclo principal: arranque, câmara, interações, fogueiras, morte, chefes, menus e gravação.
import * as THREE from '../vendor/three.js';
import { criarTexturas } from './texturas.js';
import { Mundo, altura, regiaoEm, pesoCaminho } from './mundo.js';
import { criarMateriais } from './modelos.js';
import { criarTexturasDetalhe } from './texturas-detalhe.js';
import { Jogador, Inimigo } from './atores.js';
import { Efeitos } from './efeitos.js';
import { Audio } from './audio.js';
import { Entrada } from './entrada.js';
import { Hud } from './hud.js';
import { PrimeiraPessoa } from './primeira-pessoa.js';
import {
  FOGUEIRAS, INIMIGOS, ITENS, MENSAGENS, ARMAS, NOMES_ATRIBUTOS, custoNivel, FORTALEZA, ARENA_LOBO, MUNDO, REGIOES,
} from './dados.js';

const $ = (id) => document.getElementById(id);
const CHAVE = 'cinzas-de-valdoria-v1';
const CHAVE_OP = 'cinzas-de-valdoria-opcoes';
const INICIO = { x: -445, z: 430, rot: 2.44 };

function ler(chave) {
  try {
    return JSON.parse(localStorage.getItem(chave));
  } catch {
    return null;
  }
}
function escrever(chave, v) {
  try {
    localStorage.setItem(chave, JSON.stringify(v));
  } catch {
    /* sem armazenamento disponível */
  }
}

// ------------------------------------------------------------------ opções e renderizador
const toque = matchMedia('(pointer: coarse)').matches;
const opcoes = Object.assign({ qualidade: toque ? 'baixa' : 'media', sens: 1, volume: 0.8, inverter: false, fps: false, camara: 'primeira', detalhe: 1 }, ler(CHAVE_OP) || {});
const emPrimeiraPessoa = () => opcoes.camara === 'primeira';
const Q = opcoes.qualidade;

const canvas = $('ecra');
// Resolução máxima por qualidade; a resolução dinâmica baixa-a sozinha quando os FPS caem.
const RES_MAX = Math.min(devicePixelRatio, { baixa: 0.85, media: 1, alta: 1.5 }[Q]);
const RES_MIN = { baixa: 0.45, media: 0.5, alta: 0.6 }[Q];
let escalaRes = RES_MAX;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: Q === 'media', powerPreference: 'high-performance', stencil: false });
renderer.setPixelRatio(escalaRes);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = Q !== 'baixa';
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = false; // a sombra só é recalculada de 2 em 2 fotogramas (ver desenhar)
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.62;

const cena = new THREE.Scene();
const camara = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 6000);

// Pós-processamento (bloom e correção de cor) só na qualidade alta; nas outras a vinheta é feita em CSS.
let composer = null;
let passoCor = null;
let passoBracos = null;
if (Q === 'alta') {
  const rt = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: 2 });
  composer = new THREE.EffectComposer(renderer, rt);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.addPass(new THREE.RenderPass(cena, camara));
  // os braços da primeira pessoa são desenhados por cima do mundo, antes do bloom (ver arrancar)
  passoBracos = new THREE.RenderPass(new THREE.Scene(), camara);
  passoBracos.clear = false;
  passoBracos.clearDepth = true;
  passoBracos.enabled = false;
  composer.addPass(passoBracos);
  const bloom = new THREE.UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.28, 0.5, 1.6);
  composer.addPass(bloom);
  passoCor = new THREE.ShaderPass({
    uniforms: { tDiffuse: { value: null }, uVinheta: { value: 0.55 }, uSat: { value: 0.86 }, uTom: { value: new THREE.Vector3(1.04, 1.0, 0.94) }, uVermelho: { value: 0 }, uEscuro: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uVinheta, uSat, uVermelho, uEscuro; uniform vec3 uTom; varying vec2 vUv;
      void main(){
        vec4 c = texture2D(tDiffuse, vUv);
        float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
        c.rgb = mix(vec3(l), c.rgb, uSat) * uTom;
        float d = distance(vUv, vec2(0.5));
        c.rgb *= 1.0 - smoothstep(0.4, 0.95, d) * uVinheta;
        c.rgb = mix(c.rgb, vec3(l * 1.3, l * 0.12, l * 0.08), uVermelho * smoothstep(0.25, 0.8, d));
        c.rgb *= 1.0 - uEscuro;
        gl_FragColor = c;
      }`,
  });
  composer.addPass(passoCor);
  composer.addPass(new THREE.OutputPass());
} else {
  document.body.classList.add('vinheta-css');
}

function aplicarResolucao() {
  renderer.setPixelRatio(escalaRes);
  renderer.setSize(innerWidth, innerHeight);
  if (composer) {
    composer.setPixelRatio(escalaRes);
    composer.setSize(innerWidth, innerHeight);
  }
}

addEventListener('resize', () => {
  camara.aspect = innerWidth / innerHeight;
  camara.updateProjectionMatrix();
  if (pp) pp.redimensionar();
  aplicarResolucao();
});

// Resolução dinâmica: mede o tempo médio dos fotogramas e ajusta a escala para manter ~55+ FPS.
const resDin = { soma: 0, n: 0, t: 0 };
function ajustarResolucao(dt) {
  resDin.soma += dt;
  resDin.n++;
  resDin.t += dt;
  if (resDin.t < 1) return;
  const fps = resDin.n / resDin.soma;
  resDin.soma = 0;
  resDin.n = 0;
  resDin.t = 0;
  let nova = escalaRes;
  if (fps < 48) nova = Math.max(RES_MIN, escalaRes * (fps < 30 ? 0.8 : 0.9));
  else if (fps > 58 && escalaRes < RES_MAX) nova = Math.min(RES_MAX, escalaRes * 1.06);
  if (Math.abs(nova - escalaRes) > 0.01) {
    escalaRes = nova;
    aplicarResolucao();
  }
}

// ------------------------------------------------------------------ estado do jogo
const audio = new Audio();
audio.definirVolume(opcoes.volume);
const entrada = new Entrada(canvas);
entrada.sensibilidade = opcoes.sens;
entrada.inverterY = opcoes.inverter;
const hud = new Hud();
const pontoMira = $('ponto');

let tex;
let mundo;
let pp = null; // braços e armas da primeira pessoa
let efeitos;
let M;
let jogador;
const inimigos = [];
const itens = [];
const mensagens = [];
let mapaCanvas;

let modo = 'carregar'; // carregar | titulo | jogo | morte
let menu = null;
let voltarMenu = null;
let tMorte = 0;
let trauma = 0;
let paragem = 0;
let chefeAtivo = null;
let regiaoAtual = null;
let tRegiao = 0;
let tGravar = 0;
let interacaoAtual = null;
let pendenteDescanso = null;
let fogueiraAtual = null;
let manchaObj = null;
let ondasDano = [];
const relogio = new THREE.Clock();

const progresso = {
  nivel: 1, atrib: { vitalidade: 10, resistencia: 10, forca: 10 }, almas: 0, frascosMax: 3, armas: ['espada'], arma: 'espada',
  fogueiras: [], ultimaFogueira: null, itens: [], chefes: [], mancha: null, tempo: 0, visitou: [],
};

const cam = {
  yaw: Math.PI, pitch: 0.28, dist: 4.6, distAtual: 4.6, foco: new THREE.Vector3(), pos: new THREE.Vector3(),
  // primeira pessoa: altura dos olhos e desvios suavizados (rolar, cair, sentar…)
  olhos: 1.62, baixar: 0, inclinar: 0, rolo: 0, fov: 72,
};

// contexto partilhado com o jogador e os inimigos
const ctx = {
  cena, audio, hud, inimigos,
  get mundo() { return mundo; },
  get efeitos() { return efeitos; },
  get jogador() { return jogador; },
  get primeiraPessoa() { return emPrimeiraPessoa(); },
  tremer(i) { trauma = Math.min(1, trauma + i); },
  pararTempo(s) { paragem = Math.max(paragem, s); },
  aoMorrerJogador,
  aoMatarInimigo,
  aoAtravessarNevoeiro,
  ondaDano(anel, fonte, mult, tipo, fogo) { ondasDano.push({ anel, fonte, mult, tipo, fogo, atingiu: false }); },
  superficie(p) {
    if (Math.hypot(p.x - ARENA_LOBO.x, p.z - ARENA_LOBO.z) < ARENA_LOBO.r) return 'pedra';
    if (Math.abs(p.x - FORTALEZA.x) < FORTALEZA.metade && Math.abs(p.z - FORTALEZA.z) < FORTALEZA.metade) return 'pedra';
    return 'terra';
  },
};

// ------------------------------------------------------------------ arranque
const quadro = () => new Promise((r) => setTimeout(r, 20));
function carregar(p, texto) {
  $('prog').style.width = `${Math.round(p * 100)}%`;
  if (texto) $('dica').textContent = texto;
}

async function arrancar() {
  carregar(0.03, 'A forjar as texturas…');
  await quadro();
  tex = criarTexturas(Q);
  mundo = new Mundo(cena, renderer, tex, Q);
  carregar(0.14, 'A erguer as montanhas…');
  await quadro();
  mundo.gerarTerreno();
  carregar(0.3, 'A pintar o céu do crepúsculo…');
  await quadro();
  mundo.gerarCeu();
  mundo.gerarAgua();
  carregar(0.4, 'A levantar as ruínas…');
  await quadro();
  mundo.gerarEstruturas();
  carregar(0.52, 'A plantar as florestas…');
  await quadro();
  mundo.gerarVegetacao();
  mundo.prepararExclusaoRelva();
  carregar(0.66, 'A semear a relva…');
  await quadro();
  mundo.gerarRelva();
  mundo.gerarFogueiras();
  mundo.gerarParticulas();
  carregar(0.76, 'A despertar os mortos…');
  await quadro();
  efeitos = new Efeitos(cena, tex);
  M = criarMateriais(tex, criarTexturasDetalhe(Q));
  if (Q !== 'alta') {
    // sem iluminação de ambiente global: os metais recebem o mapa de reflexos diretamente
    for (const m of Object.values(M)) {
      if (m.metalness > 0.5) {
        m.envMap = mundo.envMapa;
        m.envMapIntensity = 0.7;
      }
    }
  }
  jogador = new Jogador(ctx, M);
  carregar(0.8, 'A forjar as manoplas…');
  await quadro();
  mundo.definirDistanciaDetalhe(opcoes.detalhe);
  pp = new PrimeiraPessoa(mundo, Q);
  pp.definirArma(jogador.arma);
  if (passoBracos) {
    passoBracos.scene = pp.cena;
    passoBracos.camera = pp.cam;
  }
  for (const d of INIMIGOS) inimigos.push(new Inimigo(ctx, d, M));
  criarItens();
  criarMensagens();
  carregar(0.86, 'A desenhar o mapa…');
  await quadro();
  mapaCanvas = mundo.gerarMapa(900);
  carregar(0.95, 'A preparar a luz…');
  await quadro();
  posicionarCamaraTitulo(0);
  mundo.atualizar(0.016, jogador.pos, camara);
  renderer.compile(cena, camara);
  renderer.compile(pp.cena, pp.cam);
  carregar(1, 'Pronto.');
  await quadro();
  mostrarTitulo();
  relogio.start();
  requestAnimationFrame(ciclo);
}

// ------------------------------------------------------------------ itens, mensagens, mancha
function criarItens() {
  for (const d of ITENS) {
    const g = new THREE.Group();
    g.position.set(d.x, altura(d.x, d.z) + 0.5, d.z);
    const cor = d.tipo === 'arma' ? 0xfff0d0 : d.tipo === 'frasco' ? 0xffb060 : 0xd0e0ff;
    const a = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.brilho, color: cor, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    a.scale.setScalar(0.9);
    const b = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.brilho, color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    b.scale.setScalar(0.3);
    g.add(a, b);
    cena.add(g);
    itens.push({ dados: d, grupo: g, apanhado: false });
  }
}

function texturaRunas(semente) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const x = c.getContext('2d');
  x.strokeStyle = '#ffb060';
  x.lineWidth = 5;
  x.shadowColor = '#ff7010';
  x.shadowBlur = 10;
  let s = semente;
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 7; i++) {
    const cx = 24 + i * 34;
    x.beginPath();
    for (let k = 0; k < 4; k++) {
      const px = cx + (r() - 0.5) * 22;
      const py = 30 + r() * 70;
      if (k === 0) x.moveTo(px, py);
      else x.lineTo(px, py);
    }
    x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function criarMensagens() {
  MENSAGENS.forEach((d, i) => {
    const g = new THREE.PlaneGeometry(1.4, 0.7);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
      map: texturaRunas(i * 31 + 7), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: 0xffffff,
      polygonOffset: true, polygonOffsetFactor: -4,
    }));
    m.position.set(d.x, altura(d.x, d.z) + 0.06, d.z);
    m.rotation.y = i * 1.3;
    cena.add(m);
    mensagens.push({ dados: d, mesh: m });
  });
}

function atualizarMancha() {
  if (manchaObj) {
    cena.remove(manchaObj);
    manchaObj = null;
  }
  const m = progresso.mancha;
  if (!m) return;
  const g = new THREE.Group();
  g.position.set(m.x, altura(m.x, m.z) + 0.4, m.z);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.brilho, color: 0x9adf8a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  s.scale.setScalar(1.1);
  const s2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.brilho, color: 0xe0ffe0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  s2.scale.setScalar(0.35);
  g.add(s, s2);
  cena.add(g);
  manchaObj = g;
}

// ------------------------------------------------------------------ gravação
function gravar() {
  if (!jogador) return;
  Object.assign(progresso, {
    nivel: jogador.nivel, atrib: { ...jogador.atrib }, almas: jogador.almas, frascosMax: jogador.frascosMax,
    armas: [...jogador.armas], arma: jogador.arma,
  });
  escrever(CHAVE, progresso);
}

function aplicarProgresso(p) {
  Object.assign(progresso, structuredClone(p));
  jogador.nivel = p.nivel;
  jogador.atrib = { ...p.atrib };
  jogador.almas = p.almas;
  jogador.frascosMax = p.frascosMax;
  jogador.armas = [...p.armas];
  jogador.equiparArma(p.arma);
  hud.almasMostradas = jogador.almas;
  for (const f of mundo.fogueiras) f.acesa = progresso.fogueiras.includes(f.dados.id);
  for (const it of itens) {
    it.apanhado = progresso.itens.includes(it.dados.id);
    it.grupo.visible = !it.apanhado;
  }
  for (const ini of inimigos) {
    ini.repor();
    if (ini.chefe && progresso.chefes.includes(ini.dados.tipo)) {
      ini.vivo = false;
      ini.ativo = false;
      ini.rig.raiz.visible = false;
    }
  }
  const pn = mundo.portaNevoeiro;
  const reiMorto = progresso.chefes.includes('reiCaido');
  pn.mesh.visible = !reiMorto;
  pn.colisor.ativo = !reiMorto;
  pn.ativa = !reiMorto;
  atualizarMancha();
}

// ------------------------------------------------------------------ título e início
function mostrarTitulo() {
  modo = 'titulo';
  menu = null;
  $('carregamento').style.opacity = 0;
  setTimeout(() => $('carregamento').classList.add('oculto'), 1200);
  $('titulo').classList.remove('oculto');
  $('titulo').style.opacity = 1;
  hud.mostrar(false);
  entrada.ativo = false;
  $('toque-ui').classList.remove('ativo');
  $('bt-continuar').disabled = !ler(CHAVE);
  fecharPaineis();
  if (!toque) $('titulo').querySelector('button:not(:disabled)')?.focus({ preventScroll: true });
  audio.pararMusica(1);
  if (document.pointerLockElement) document.exitPointerLock();
}

function comecar(novo) {
  audio.iniciar();
  audio.menu();
  if (novo) {
    const existente = ler(CHAVE);
    if (existente && !confirm('Começar um novo jogo apaga o progresso guardado. Continuar?')) return;
    const p = {
      nivel: 1, atrib: { vitalidade: 10, resistencia: 10, forca: 10 }, almas: 0, frascosMax: 3, armas: ['espada'], arma: 'espada',
      fogueiras: [], ultimaFogueira: null, itens: [], chefes: [], mancha: null, tempo: 0, visitou: [],
    };
    aplicarProgresso(p);
    jogador.colocar(INICIO.x, INICIO.z, INICIO.rot);
    gravar();
  } else {
    aplicarProgresso(ler(CHAVE));
    const f = FOGUEIRAS.find((x) => x.id === progresso.ultimaFogueira);
    if (f) colocarJuntoFogueira(f);
    else jogador.colocar(INICIO.x, INICIO.z, INICIO.rot);
  }
  jogador.restaurar();
  if (novo) {
    jogador.estado = 'acender';
    jogador.t = 0;
    jogador.anim.tocar('levantar', 1.6);
  }
  cam.yaw = jogador.rot;
  cam.pitch = emPrimeiraPessoa() ? 0.05 : 0.25;
  chefeAtivo = null;
  regiaoAtual = null;
  $('titulo').style.opacity = 0;
  setTimeout(() => $('titulo').classList.add('oculto'), 1000);
  hud.mostrar(true);
  if (toque) $('toque-ui').classList.add('ativo');
  modo = 'jogo';
  entrada.ativo = true;
  entrada.limpar();
  fade(1, 0);
  setTimeout(() => fade(0), 50);
  if (novo) setTimeout(() => hud.aviso('Desperta, Cinzento. A Fogueira chama por ti.', 5), 1500);
  entrada.pedirBloqueio();
}

function colocarJuntoFogueira(f) {
  const ang = 0.6;
  const x = f.x + Math.sin(ang) * 1.7;
  const z = f.z + Math.cos(ang) * 1.7;
  jogador.colocar(x, z, Math.atan2(f.x - x, f.z - z));
  mundo.reposicionarRelva(x, z);
}

// ------------------------------------------------------------------ fogueiras
function acenderFogueira(f) {
  f.acesa = true;
  if (!progresso.fogueiras.includes(f.dados.id)) progresso.fogueiras.push(f.dados.id);
  jogador.mudarEstado('acender');
  jogador.anim.tocar('acender', 1.6);
  jogador.rot = Math.atan2(f.dados.x - jogador.pos.x, f.dados.z - jogador.pos.z);
  if (emPrimeiraPessoa()) {
    cam.yaw = jogador.rot;
    cam.pitch = 0.45;
  }
  audio.acenderFogueira();
  $('fogueira-nome').textContent = f.dados.nome;
  $('ecra-fogueira').style.opacity = 1;
  setTimeout(() => { $('ecra-fogueira').style.opacity = 0; }, 2600);
  pendenteDescanso = { f, t: 1.5 };
}

function descansar(f) {
  fogueiraAtual = f;
  jogador.alvo = null;
  jogador.restaurar();
  jogador.mudarEstado('sentado');
  jogador.anim.tocar('sentado', 2, { manter: true });
  jogador.rot = Math.atan2(f.dados.x - jogador.pos.x, f.dados.z - jogador.pos.z);
  progresso.ultimaFogueira = f.dados.id;
  reporInimigos();
  chefeAtivo = null;
  audio.pararMusica(1);
  gravar();
  $('fogueira-titulo').textContent = f.dados.nome;
  abrirMenu('menu-fogueira');
}

function partirFogueira() {
  fecharPaineis();
  menu = null;
  jogador.mudarEstado('acender');
  jogador.t = 0.5;
  jogador.anim.tocar('levantar', 1.1);
  fogueiraAtual = null;
  entrada.pedirBloqueio();
}

function reporInimigos() {
  for (const ini of inimigos) {
    if (ini.chefe && progresso.chefes.includes(ini.dados.tipo)) continue;
    ini.repor();
  }
  ondasDano = [];
}

function viajarPara(f) {
  fecharPaineis();
  fade(1);
  setTimeout(() => {
    colocarJuntoFogueira(f.dados);
    reporInimigos();
    descansar(f);
    cam.yaw = emPrimeiraPessoa() ? jogador.rot : jogador.rot + Math.PI * 0.8;
    setTimeout(() => fade(0), 400);
  }, 1000);
}

// ------------------------------------------------------------------ morte e almas
function aoMorrerJogador() {
  modo = 'morte';
  tMorte = 0;
  jogador.alvo = null;
  audio.morteJogador();
  audio.pararMusica(1.5);
}

function renascer() {
  progresso.mancha = jogador.almas > 0 ? { x: jogador.pos.x, z: jogador.pos.z, almas: jogador.almas } : null;
  jogador.almas = 0;
  hud.almasMostradas = 0;
  atualizarMancha();
  const f = mundo.fogueiras.find((x) => x.dados.id === progresso.ultimaFogueira);
  if (f) colocarJuntoFogueira(f.dados);
  else jogador.colocar(INICIO.x, INICIO.z, INICIO.rot);
  jogador.restaurar();
  jogador.mudarEstado('acender');
  jogador.anim.tocar('levantar', 1.6);
  reporInimigos();
  chefeAtivo = null;
  const pn = mundo.portaNevoeiro;
  if (pn.ativa) pn.colisor.ativo = true;
  cam.yaw = jogador.rot;
  gravar();
  modo = 'jogo';
  $('ecra-morte').style.opacity = 0;
  fade(0);
}

function aoMatarInimigo(ini) {
  const ganho = ini.cfg.almas;
  jogador.almas += ganho;
  hud.ganhoAlmas(ganho);
  efeitos.almas(new THREE.Vector3(ini.pos.x, ini.pos.y + 1, ini.pos.z), jogador.pos);
  setTimeout(() => audio.almas(), 500);
  if (jogador.alvo === ini) jogador.alvo = null;
  if (ini.chefe) {
    if (!progresso.chefes.includes(ini.dados.tipo)) progresso.chefes.push(ini.dados.tipo);
    chefeAtivo = null;
    audio.pararMusica(3);
    const rei = ini.dados.tipo === 'reiCaido';
    $('vitoria-titulo').textContent = rei ? 'O REI CAIU' : 'GRANDE INIMIGO ABATIDO';
    $('vitoria-sub').textContent = rei ? 'O trono de Valdoria está vazio. As cinzas assentam… por agora.' : ini.nome;
    setTimeout(() => { $('ecra-vitoria').style.opacity = 1; }, 1200);
    setTimeout(() => { $('ecra-vitoria').style.opacity = 0; }, rei ? 9000 : 5500);
    if (rei) {
      const pn = mundo.portaNevoeiro;
      pn.ativa = false;
      pn.colisor.ativo = false;
      pn.mesh.visible = false;
      setTimeout(() => hud.aviso('Obrigado por jogares. O mundo continua aberto para explorares.', 6), 9500);
    }
    if (ini.dados.tipo === 'loboAncestral') {
      setTimeout(() => {
        if (!jogador.armas.includes('espadao')) hud.aviso('Dizem que um espadão repousa na ilhota do pântano…', 5);
      }, 6500);
    }
    gravar();
  }
}

function aoAtravessarNevoeiro() {
  const pn = mundo.portaNevoeiro;
  pn.colisor.ativo = true;
  const rei = inimigos.find((i) => i.dados.tipo === 'reiCaido');
  if (rei && rei.vivo) {
    chefeAtivo = rei;
    rei.despertar();
    audio.iniciarMusica(1);
  }
}

// ------------------------------------------------------------------ interações
function procurarInteracao() {
  if (!jogador || jogador.estado !== 'livre') return null;
  const p = jogador.pos;
  let melhor = null;
  let md = Infinity;
  const considerar = (d, obj) => {
    if (d < md) {
      md = d;
      melhor = obj;
    }
  };
  for (const f of mundo.fogueiras) {
    const d = Math.hypot(p.x - f.dados.x, p.z - f.dados.z);
    if (d < 2.7) considerar(d, { texto: f.acesa ? 'Descansar' : 'Acender a fogueira', fn: () => (f.acesa ? descansar(f) : acenderFogueira(f)) });
  }
  for (const it of itens) {
    if (it.apanhado) continue;
    const d = Math.hypot(p.x - it.dados.x, p.z - it.dados.z);
    if (d < 1.9) considerar(d, { texto: 'Apanhar', fn: () => apanhar(it) });
  }
  for (const m of mensagens) {
    const d = Math.hypot(p.x - m.dados.x, p.z - m.dados.z);
    if (d < 1.7) considerar(d + 0.3, { texto: 'Ler a mensagem', fn: () => lerMensagem(m) });
  }
  if (progresso.mancha) {
    const m = progresso.mancha;
    const d = Math.hypot(p.x - m.x, p.z - m.z);
    if (d < 2) considerar(d - 1, { texto: 'Recuperar as almas', fn: recuperarAlmas });
  }
  const pn = mundo.portaNevoeiro;
  if (pn.ativa && pn.colisor.ativo) {
    const d = Math.hypot(p.x - pn.x, p.z - pn.z);
    if (d < 3.2 && p.z > pn.z) considerar(d, { texto: 'Atravessar o nevoeiro', fn: atravessarNevoeiro });
  }
  return melhor;
}

function apanhar(it) {
  it.apanhado = true;
  it.grupo.visible = false;
  progresso.itens.push(it.dados.id);
  audio.item();
  const d = it.dados;
  if (d.tipo === 'almas') {
    jogador.almas += d.qtd;
    hud.ganhoAlmas(d.qtd);
    hud.aviso(`Obtiveste: Alma perdida (${d.qtd} almas)`);
  } else if (d.tipo === 'frasco') {
    jogador.frascosMax++;
    jogador.frascos++;
    hud.aviso(`Obtiveste: Fragmento de Cinza — o frasco tem agora ${jogador.frascosMax} cargas`, 4);
  } else if (d.tipo === 'arma') {
    if (!jogador.armas.includes(d.arma)) jogador.armas.push(d.arma);
    jogador.equiparArma(d.arma);
    hud.aviso(`Obtiveste: ${ARMAS[d.arma].nome} (X para trocar de arma)`, 4);
  }
  jogador.anim.tocar('acender', 0.9);
  jogador.mudarEstado('acender');
  jogador.t = 0.7;
  gravar();
}

function recuperarAlmas() {
  const m = progresso.mancha;
  jogador.almas += m.almas;
  hud.ganhoAlmas(m.almas);
  efeitos.almas(new THREE.Vector3(m.x, altura(m.x, m.z) + 0.5, m.z), jogador.pos);
  audio.almas();
  progresso.mancha = null;
  atualizarMancha();
  hud.aviso('Recuperaste as tuas almas');
  gravar();
}

function lerMensagem(m) {
  $('mensagem-texto').textContent = `«${m.dados.texto}»`;
  abrirMenu('mensagem-ler');
}

function atravessarNevoeiro() {
  const pn = mundo.portaNevoeiro;
  pn.colisor.ativo = false;
  jogador.alvo = null;
  jogador.pos.x = pn.x;
  jogador.rot = Math.PI;
  jogador.mudarEstado('nevoeiro');
  audio.nevoeiro();
}

// ------------------------------------------------------------------ alvo fixo
function candidatosAlvo() {
  const fx = Math.sin(cam.yaw);
  const fz = Math.cos(cam.yaw);
  return inimigos.filter((i) => i.vivo && i.ativo && i.rig.raiz.visible && i.estado !== 'aguardar')
    .map((i) => {
      const dx = i.pos.x - jogador.pos.x;
      const dz = i.pos.z - jogador.pos.z;
      const d = Math.hypot(dx, dz);
      const ang = Math.acos(Math.max(-1, Math.min(1, (dx * fx + dz * fz) / (d || 1))));
      return { i, d, ang, lado: dx * -fz + dz * fx };
    })
    .filter((c) => c.d < 26 && c.ang < 1.1);
}

function fixarAlvo() {
  if (jogador.alvo) {
    jogador.alvo = null;
    return;
  }
  const c = candidatosAlvo().sort((a, b) => a.ang * 8 + a.d * 0.15 - (b.ang * 8 + b.d * 0.15));
  if (c.length) {
    jogador.alvo = c[0].i;
    audio.menu();
  } else {
    cam.yaw = jogador.rot; // sem alvo: centra a câmara atrás do jogador
  }
}

function trocarAlvo(dir) {
  if (!jogador.alvo) return;
  const atual = jogador.alvo;
  const c = candidatosAlvo().filter((x) => x.i !== atual);
  // lado relativo ao ecrã: positivo = esquerda
  const lAtual = (() => {
    const dx = atual.pos.x - jogador.pos.x;
    const dz = atual.pos.z - jogador.pos.z;
    return dx * -Math.cos(cam.yaw) + dz * Math.sin(cam.yaw);
  })();
  const op = c.map((x) => ({ ...x, l: -(x.lado) })).filter((x) => (dir > 0 ? x.l > -lAtual : x.l < -lAtual));
  op.sort((a, b) => Math.abs(a.l + lAtual) - Math.abs(b.l + lAtual));
  if (op.length) jogador.alvo = op[0].i;
}

// ------------------------------------------------------------------ câmara
function atualizarCamara(dt, rato) {
  const J = jogador;
  const alvo = J.alvo && J.alvo.vivo ? J.alvo : null;
  if (J.alvo && (!J.alvo.vivo || J.alvo.pos.distanceTo(J.pos) > 32)) J.alvo = null;
  if (alvo) {
    const dx = alvo.pos.x - J.pos.x;
    const dz = alvo.pos.z - J.pos.z;
    const d = Math.hypot(dx, dz);
    const yAlvo = Math.atan2(dx, dz);
    let dif = yAlvo - cam.yaw;
    while (dif > Math.PI) dif -= Math.PI * 2;
    while (dif < -Math.PI) dif += Math.PI * 2;
    cam.yaw += dif * Math.min(1, dt * 7);
    const pAlvo = Math.max(0.12, Math.min(0.55, 0.32 - (alvo.altura - 1.8) * 0.05 + (d < 3 ? 0.15 : 0)));
    cam.pitch += (pAlvo - cam.pitch) * Math.min(1, dt * 4);
    if (Math.abs(rato.dx) > 40) trocarAlvo(-Math.sign(rato.dx));
    if (rato.roda) trocarAlvo(rato.roda);
    if (entrada.direitoX && Math.abs(entrada.direitoX) > 0.8 && !cam.trocou) {
      trocarAlvo(-Math.sign(entrada.direitoX));
      cam.trocou = true;
    }
    if (!entrada.direitoX || Math.abs(entrada.direitoX) < 0.3) cam.trocou = false;
  } else {
    cam.yaw -= rato.dx * 0.0023;
    cam.pitch += rato.dy * 0.0023;
  }
  cam.pitch = Math.max(-0.55, Math.min(1.25, cam.pitch));
  const distBase = alvo ? 5.4 + Math.max(0, alvo.altura - 2) * 0.9 : 4.6;
  const foco = cam.foco;
  const fy = J.pos.y + 1.55;
  foco.x += (J.pos.x - foco.x) * Math.min(1, dt * 14);
  foco.z += (J.pos.z - foco.z) * Math.min(1, dt * 14);
  foco.y += (fy - foco.y) * Math.min(1, dt * 10);
  // afasta-se até encontrar obstáculo
  const cx = Math.sin(cam.yaw) * Math.cos(cam.pitch);
  const cy = -Math.sin(cam.pitch);
  const cz = Math.cos(cam.yaw) * Math.cos(cam.pitch);
  let dist = distBase;
  for (let s = 0.6; s <= distBase; s += 0.3) {
    const px = foco.x - cx * s;
    const py = foco.y - cy * s;
    const pz = foco.z - cz * s;
    if (mundo.colisoes.pontoDentro(px, py, pz, 0.25) || py < altura(px, pz) + 0.25) {
      dist = Math.max(0.6, s - 0.3);
      break;
    }
  }
  cam.distAtual += (dist - cam.distAtual) * Math.min(1, dt * (dist < cam.distAtual ? 20 : 4));
  const px = foco.x - cx * cam.distAtual;
  const pz = foco.z - cz * cam.distAtual;
  let py = foco.y - cy * cam.distAtual;
  py = Math.max(py, altura(px, pz) + 0.3);
  camara.position.set(px, py, pz);
  if (alvo) {
    const ly = Math.min(foco.y, alvo.pos.y + alvo.altura * 0.6);
    camara.lookAt(foco.x * 0.72 + alvo.pos.x * 0.28, (foco.y - 0.15) * 0.75 + ly * 0.25, foco.z * 0.72 + alvo.pos.z * 0.28);
  } else camara.lookAt(foco.x, foco.y, foco.z);
  // tremor
  trauma = Math.max(0, trauma - dt * 1.6);
  if (trauma > 0) {
    const k = trauma * trauma;
    const t = performance.now() / 1000;
    camara.rotation.z += Math.sin(t * 47) * 0.03 * k;
    camara.position.x += Math.sin(t * 61) * 0.12 * k;
    camara.position.y += Math.sin(t * 53 + 1) * 0.1 * k;
  }
}

// Primeira pessoa: a câmara fica nos olhos do Cinzento. Rolar, cair, morrer e sentar movem-na como
// moveriam a cabeça; os passos dão-lhe um balanço leve.
function atualizarCamaraFP(dt, rato) {
  const J = jogador;
  const alvo = J.alvo && J.alvo.vivo ? J.alvo : null;
  if (J.alvo && (!J.alvo.vivo || J.alvo.pos.distanceTo(J.pos) > 32)) J.alvo = null;
  const e = J.estado;
  const olharRot = e === 'sentado' || e === 'nevoeiro';
  if (alvo && !olharRot) {
    const dx = alvo.pos.x - J.pos.x;
    const dz = alvo.pos.z - J.pos.z;
    const d = Math.hypot(dx, dz);
    let dif = Math.atan2(dx, dz) - cam.yaw;
    while (dif > Math.PI) dif -= Math.PI * 2;
    while (dif < -Math.PI) dif += Math.PI * 2;
    cam.yaw += dif * Math.min(1, dt * 9);
    const pAlvo = Math.atan2(J.pos.y + cam.olhos - (alvo.pos.y + alvo.altura * 0.62), Math.max(0.5, d));
    cam.pitch += (pAlvo - cam.pitch) * Math.min(1, dt * 6);
    if (Math.abs(rato.dx) > 40) trocarAlvo(-Math.sign(rato.dx));
    if (rato.roda) trocarAlvo(rato.roda);
    if (entrada.direitoX && Math.abs(entrada.direitoX) > 0.8 && !cam.trocou) {
      trocarAlvo(-Math.sign(entrada.direitoX));
      cam.trocou = true;
    }
    if (!entrada.direitoX || Math.abs(entrada.direitoX) < 0.3) cam.trocou = false;
  } else if (olharRot) {
    // sentado à fogueira ou a atravessar o nevoeiro: a cabeça vira-se para onde o corpo está virado
    let dif = J.rot - cam.yaw;
    while (dif > Math.PI) dif -= Math.PI * 2;
    while (dif < -Math.PI) dif += Math.PI * 2;
    cam.yaw += dif * Math.min(1, dt * 4);
    cam.pitch += ((e === 'sentado' ? 0.3 : 0.05) - cam.pitch) * Math.min(1, dt * 3);
  } else if (e !== 'morto') {
    cam.yaw -= rato.dx * 0.0023;
    cam.pitch += rato.dy * 0.0023;
  }
  cam.pitch = Math.max(-1.35, Math.min(1.35, cam.pitch));

  // desvios da cabeça para cada estado
  let baixar = 0;
  let inclinar = 0;
  let rolo = 0;
  const t = J.t;
  if (e === 'rolar') {
    const k = Math.min(1, t / 0.66);
    baixar = Math.sin(k * Math.PI) * 0.85;
    inclinar = J.rolTras ? -Math.sin(k * Math.PI) * 0.5 : Math.sin(Math.min(1, k * 1.25) * Math.PI) * 0.9;
  } else if (e === 'derrubado') {
    const k = t < 0.45 ? t / 0.45 : t < 1.15 ? 1 : 1 - (t - 1.15) / 0.55;
    baixar = suave01(k) * 1.25;
    inclinar = -suave01(k) * 0.75;
    rolo = suave01(k) * 0.25;
  } else if (e === 'morto') {
    const k = suave01(Math.min(1, t / 1.3));
    baixar = k * 1.38;
    inclinar = -k * 0.35;
    rolo = k * 1.25;
  } else if (e === 'sentado') {
    baixar = 0.72;
  } else if (e === 'acender') {
    baixar = Math.sin(Math.min(1, t / 1.6) * Math.PI) * 0.55;
    inclinar = Math.sin(Math.min(1, t / 1.6) * Math.PI) * 0.25;
  } else if (e === 'atordoado') {
    const k = Math.max(0, 1 - t / Math.max(0.3, J.durAtordoado || 0.4));
    inclinar = -0.18 * k;
    rolo = Math.sin(t * 22) * 0.05 * k;
  } else if (e === 'ataque' && J.ataque) {
    // o tronco acompanha o golpe
    const d = J.ataque.def;
    const k = t < d.ini ? t / d.ini : Math.max(0, 1 - (t - d.ini) / Math.max(0.1, d.dur - d.ini));
    const lado = J.ataque.anim === 'leve2' ? 1 : J.ataque.anim === 'forte' ? 0 : -1;
    rolo = lado * Math.sin(k * Math.PI * 0.5) * 0.035;
    inclinar = (J.ataque.forte ? (t < d.ini ? -0.05 : 0.08) : 0.02) * Math.sin(k * Math.PI * 0.5);
    baixar = J.ataque.forte && t > d.ini ? 0.08 * k : 0;
  } else if (e === 'beber') {
    inclinar = -Math.sin(Math.min(1, t / 1.0) * Math.PI) * 0.12;
  }
  const kS = Math.min(1, dt * (e === 'rolar' || e === 'derrubado' ? 18 : 8));
  cam.baixar += (baixar - cam.baixar) * kS;
  cam.inclinar += (inclinar - cam.inclinar) * kS;
  cam.rolo += (rolo - cam.rolo) * kS;

  // passos: a cabeça desce em cada pé que pousa e oscila de lado
  const v = J.velAtual || 0;
  const kv = Math.min(1.4, v / 4.3);
  const f = J.anim.fase;
  const bobY = -(1 - Math.abs(Math.sin(f))) * 0.038 * kv;
  const bobX = Math.cos(f) * 0.028 * kv;
  const fx = Math.sin(cam.yaw), fz = Math.cos(cam.yaw);
  const px = J.pos.x + fx * 0.12 - fz * bobX;
  const pz = J.pos.z + fz * 0.12 + fx * bobX;
  let py = J.pos.y + cam.olhos - cam.baixar + bobY;
  py = Math.max(py, altura(px, pz) + 0.22);
  camara.position.set(px, py, pz);
  camara.rotation.order = 'YXZ';
  camara.rotation.set(-(cam.pitch + cam.inclinar), cam.yaw + Math.PI, cam.rolo + Math.sin(f) * 0.006 * kv);
  // campo de visão: abre ao correr
  const fovAlvo = v > 6 ? 80 : 72;
  cam.fov += (fovAlvo - cam.fov) * Math.min(1, dt * 4);
  if (Math.abs(camara.fov - cam.fov) > 0.01) {
    camara.fov = cam.fov;
    camara.updateProjectionMatrix();
  }
  // tremor
  trauma = Math.max(0, trauma - dt * 1.6);
  if (trauma > 0) {
    const k = trauma * trauma;
    const tt = performance.now() / 1000;
    camara.rotation.z += Math.sin(tt * 47) * 0.035 * k;
    camara.rotation.x += Math.sin(tt * 41 + 2) * 0.03 * k;
    camara.rotation.y += Math.sin(tt * 37 + 4) * 0.02 * k;
    camara.position.y += Math.sin(tt * 53 + 1) * 0.04 * k;
  }
}

const suave01 = (k) => {
  k = Math.min(1, Math.max(0, k));
  return k * k * (3 - 2 * k);
};

// Na primeira pessoa o corpo do jogador não é desenhado mas continua a projetar sombra.
const materiaisSombra = new Map();
function materialSoSombra(m) {
  let s = materiaisSombra.get(m);
  if (!s) {
    s = m.clone();
    s.colorWrite = false;
    s.depthWrite = false;
    materiaisSombra.set(m, s);
  }
  return s;
}
function corpoSoSombra(sim) {
  jogador.rig.raiz.traverse((o) => {
    if (!o.isMesh) return;
    const u = o.userData;
    if (sim && !u.matOriginal) {
      u.matOriginal = o.material;
      o.material = Array.isArray(o.material) ? o.material.map(materialSoSombra) : materialSoSombra(o.material);
    } else if (!sim && u.matOriginal) {
      o.material = u.matOriginal;
      u.matOriginal = null;
    }
  });
}

function posicionarCamaraTitulo(t) {
  if (camara.fov !== 58) {
    camara.fov = 58;
    camara.updateProjectionMatrix();
  }
  const f = FOGUEIRAS[0];
  const a = 2.6 + Math.sin(t * 0.03) * 0.25;
  const x = f.x + Math.sin(a) * 9;
  const z = f.z + Math.cos(a) * 9;
  camara.position.set(x, altura(x, z) + 3.2, z);
  camara.lookAt(f.x + 10, altura(f.x, f.z) + 7, f.z - 40);
}

// ------------------------------------------------------------------ menus
const PAINEIS = ['menu-fogueira', 'menu-viajar', 'menu-nivel', 'mensagem-ler', 'menu-mapa', 'menu-pausa', 'controlos', 'opcoes'];

function fecharPaineis() {
  for (const p of PAINEIS) $(p).classList.add('oculto');
}

function abrirMenu(id, voltar = null) {
  fecharPaineis();
  $(id).classList.remove('oculto');
  menu = id;
  voltarMenu = voltar;
  audio.menu();
  if (document.pointerLockElement) document.exitPointerLock();
  if (id === 'menu-nivel') desenharNivel();
  if (id === 'menu-viajar') desenharViajar();
  if (id === 'menu-mapa') desenharMapa();
  if (id === 'opcoes') prepararOpcoes();
  const b = $(id).querySelector('button:not(:disabled)');
  if (b && !toque) b.focus({ preventScroll: true });
}

function fecharMenu() {
  const v = voltarMenu;
  fecharPaineis();
  menu = null;
  voltarMenu = null;
  if (v) {
    if (v === 'titulo') {
      $('titulo').classList.remove('oculto');
      return;
    }
    abrirMenu(v);
    return;
  }
  if (modo === 'jogo') entrada.pedirBloqueio();
}

function desenharNivel() {
  const J = jogador;
  const custo = custoNivel(J.nivel);
  $('nv-nivel').textContent = J.nivel;
  $('nv-almas').textContent = J.almas.toLocaleString('pt-PT');
  $('nv-custo').textContent = custo.toLocaleString('pt-PT');
  $('nv-custo').style.color = J.almas >= custo ? '#fff' : '#c05040';
  $('nv-hp').textContent = J.hpMax;
  $('nv-en').textContent = J.energiaMax;
  $('nv-dano').textContent = Math.round(ARMAS[J.arma].dano * J.multDano);
  const lista = $('lista-atrib');
  lista.innerHTML = '';
  for (const [k, nome] of Object.entries(NOMES_ATRIBUTOS)) {
    const chave = k === 'vigor' ? 'vitalidade' : k;
    const l = document.createElement('div');
    l.className = 'linha-atrib';
    l.innerHTML = `<span>${nome}</span><span class="val">${J.atrib[chave]}</span>`;
    const b = document.createElement('button');
    b.textContent = '+';
    b.disabled = J.almas < custo || J.atrib[chave] >= 60;
    b.title = `Subir ${nome}`;
    b.onclick = () => {
      if (J.almas < custo) return;
      J.almas -= custo;
      hud.almasMostradas = J.almas;
      J.nivel++;
      J.atrib[chave]++;
      J.hp = J.hpMax;
      J.hpVisivel = J.hp;
      J.energia = J.energiaMax;
      audio.subirNivel();
      gravar();
      desenharNivel();
    };
    l.appendChild(b);
    lista.appendChild(l);
  }
  const descr = document.createElement('p');
  descr.className = 'nota';
  descr.textContent = 'Vitalidade aumenta a vida. Resistência aumenta a energia. Força aumenta o dano das armas.';
  lista.appendChild(descr);
}

function desenharViajar() {
  const l = $('lista-viajar');
  l.innerHTML = '';
  const acesas = mundo.fogueiras.filter((f) => f.acesa);
  for (const f of acesas) {
    const b = document.createElement('button');
    b.textContent = f.dados.nome + (f === fogueiraAtual ? ' (aqui)' : '');
    b.disabled = f === fogueiraAtual;
    b.onclick = () => viajarPara(f);
    l.appendChild(b);
  }
}

function desenharMapa() {
  const cv = $('mapa-cv');
  const c = cv.getContext('2d');
  const T = cv.width;
  c.drawImage(mapaCanvas, 0, 0, T, T);
  const P = (x, z) => [((x + MUNDO.metade) / MUNDO.tam) * T, ((z + MUNDO.metade) / MUNDO.tam) * T];
  // nomes das regiões
  c.font = '600 20px Cinzel, Georgia, serif';
  c.textAlign = 'center';
  for (const r of REGIOES) {
    const [x, y] = P(r.x, r.z);
    c.fillStyle = 'rgba(40, 28, 14, 0.75)';
    c.fillText(r.nome, x + 1, y + 1 - 30);
    c.fillStyle = '#f2e6c8';
    c.fillText(r.nome, x, y - 30);
  }
  const ponto = (x, z, cor, r = 7, brilho = true) => {
    const [px, py] = P(x, z);
    c.beginPath();
    c.arc(px, py, r, 0, Math.PI * 2);
    c.fillStyle = cor;
    if (brilho) {
      c.shadowColor = cor;
      c.shadowBlur = 12;
    }
    c.fill();
    c.shadowBlur = 0;
    c.strokeStyle = 'rgba(0,0,0,0.7)';
    c.stroke();
  };
  for (const f of mundo.fogueiras) {
    ponto(f.dados.x, f.dados.z, f.acesa ? '#ff9a3a' : '#6a5a4a', 7, f.acesa);
    if (f.acesa) {
      const [px, py] = P(f.dados.x, f.dados.z);
      c.font = '15px "EB Garamond", Georgia, serif';
      c.fillStyle = '#fff2d8';
      c.fillText(f.dados.nome, px, py + 22);
    }
  }
  for (const i of inimigos) if (i.chefe && i.vivo) ponto(i.dados.x, i.dados.z, '#c02818', 8);
  if (progresso.mancha) ponto(progresso.mancha.x, progresso.mancha.z, '#9adf8a', 7);
  // jogador com seta
  const [jx, jy] = P(jogador.pos.x, jogador.pos.z);
  c.save();
  c.translate(jx, jy);
  c.rotate(-jogador.rot + Math.PI);
  c.beginPath();
  c.moveTo(0, -12);
  c.lineTo(8, 9);
  c.lineTo(0, 4);
  c.lineTo(-8, 9);
  c.closePath();
  c.fillStyle = '#fff';
  c.shadowColor = '#fff';
  c.shadowBlur = 12;
  c.fill();
  c.restore();
  // rosa dos ventos
  c.font = '700 24px Cinzel, Georgia, serif';
  c.fillStyle = '#3a2a14';
  c.fillText('N', T - 50, 52);
  c.beginPath();
  c.moveTo(T - 50, 58);
  c.lineTo(T - 56, 84);
  c.lineTo(T - 44, 84);
  c.closePath();
  c.fill();
}

function prepararOpcoes() {
  $('op-qualidade').value = opcoes.qualidade;
  $('op-sens').value = opcoes.sens;
  $('op-volume').value = opcoes.volume;
  $('op-inverter').checked = opcoes.inverter;
  $('op-fps').checked = opcoes.fps;
  $('op-camara').value = opcoes.camara;
  $('op-detalhe').value = opcoes.detalhe;
  $('val-detalhe').textContent = rotuloDetalhe(opcoes.detalhe);
}
function rotuloDetalhe(k) {
  return k < 0.75 ? 'Curta (mais FPS)' : k < 1.05 ? 'Normal' : k < 1.35 ? 'Longa' : 'Muito longa';
}

function ligarMenus() {
  $('bt-continuar').onclick = () => comecar(false);
  $('bt-novo').onclick = () => comecar(true);
  $('bt-controlos-t').onclick = () => {
    $('titulo').classList.add('oculto');
    abrirMenu('controlos', 'titulo');
  };
  $('bt-opcoes-t').onclick = () => {
    $('titulo').classList.add('oculto');
    abrirMenu('opcoes', 'titulo');
  };
  $('bt-nivel').onclick = () => abrirMenu('menu-nivel', 'menu-fogueira');
  $('bt-viajar').onclick = () => abrirMenu('menu-viajar', 'menu-fogueira');
  $('bt-sair-fogueira').onclick = partirFogueira;
  $('bt-fechar-nivel').onclick = fecharMenu;
  $('bt-fechar-viajar').onclick = fecharMenu;
  $('bt-fechar-msg').onclick = fecharMenu;
  $('bt-fechar-mapa').onclick = fecharMenu;
  $('bt-fechar-controlos').onclick = fecharMenu;
  $('bt-fechar-opcoes').onclick = fecharMenu;
  $('bt-retomar').onclick = fecharMenu;
  $('bt-mapa-p').onclick = () => abrirMenu('menu-mapa', 'menu-pausa');
  $('bt-controlos-p').onclick = () => abrirMenu('controlos', 'menu-pausa');
  $('bt-opcoes-p').onclick = () => abrirMenu('opcoes', 'menu-pausa');
  $('bt-sair-titulo').onclick = () => {
    gravar();
    mostrarTitulo();
  };
  $('botao-menu-toque').onclick = () => {
    if (modo === 'jogo' && !menu) abrirMenu('menu-pausa');
  };
  $('clique').onclick = () => entrada.pedirBloqueio();

  $('op-qualidade').onchange = (e) => {
    opcoes.qualidade = e.target.value;
    escrever(CHAVE_OP, opcoes);
    gravar();
    location.reload();
  };
  $('op-sens').oninput = (e) => {
    opcoes.sens = +e.target.value;
    entrada.sensibilidade = opcoes.sens;
    escrever(CHAVE_OP, opcoes);
  };
  $('op-volume').oninput = (e) => {
    opcoes.volume = +e.target.value;
    audio.definirVolume(opcoes.volume);
    escrever(CHAVE_OP, opcoes);
  };
  $('op-inverter').onchange = (e) => {
    opcoes.inverter = e.target.checked;
    entrada.inverterY = opcoes.inverter;
    escrever(CHAVE_OP, opcoes);
  };
  $('op-detalhe').oninput = (e) => {
    opcoes.detalhe = +e.target.value;
    $('val-detalhe').textContent = rotuloDetalhe(opcoes.detalhe);
    if (mundo) mundo.definirDistanciaDetalhe(opcoes.detalhe);
    escrever(CHAVE_OP, opcoes);
  };
  $('op-camara').onchange = (e) => {
    opcoes.camara = e.target.value;
    escrever(CHAVE_OP, opcoes);
    if (jogador) {
      cam.yaw = jogador.rot;
      cam.pitch = emPrimeiraPessoa() ? 0.05 : 0.25;
    }
  };
  $('op-fps').onchange = (e) => {
    opcoes.fps = e.target.checked;
    $('fps').style.display = opcoes.fps ? 'block' : 'none';
    escrever(CHAVE_OP, opcoes);
  };
  $('fps').style.display = opcoes.fps ? 'block' : 'none';

  let tPausaAuto = 0;
  document.addEventListener('pointerlockchange', () => {
    if (!document.pointerLockElement && modo === 'jogo' && !menu && !toque) {
      abrirMenu('menu-pausa');
      tPausaAuto = performance.now();
    }
  });
  addEventListener('keydown', (e) => {
    if (e.code !== 'Escape' || performance.now() - tPausaAuto < 400) return;
    if (menu) {
      if (menu === 'menu-fogueira') partirFogueira();
      else fecharMenu();
    } else if (modo === 'jogo') abrirMenu('menu-pausa');
  });
}

function fade(v, dur) {
  const f = $('fade');
  if (dur !== undefined) {
    f.style.transition = 'none';
    f.style.opacity = v;
    void f.offsetWidth;
    f.style.transition = '';
    return;
  }
  f.style.opacity = v;
}

// navegação dos menus com comando: cima/baixo e A
let navT = 0;
function navegarMenuComando(dt) {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const gp = [...pads].find((p) => p);
  if (!gp || !menu && modo !== 'titulo') return;
  navT -= dt;
  const painel = menu ? $(menu) : $('titulo');
  const botoes = [...painel.querySelectorAll('button:not(:disabled)')].filter((b) => b.offsetParent !== null);
  if (!botoes.length) return;
  const y = gp.axes[1] || 0;
  const cima = gp.buttons[12]?.pressed || y < -0.5;
  const baixo = gp.buttons[13]?.pressed || y > 0.5;
  let i = botoes.indexOf(document.activeElement);
  if (navT <= 0 && (cima || baixo)) {
    i = i < 0 ? 0 : (i + (baixo ? 1 : -1) + botoes.length) % botoes.length;
    botoes[i].focus();
    audio.menu();
    navT = 0.22;
  }
  const a = gp.buttons[0]?.pressed;
  const b = gp.buttons[1]?.pressed;
  if (a && !navegarMenuComando.a && document.activeElement && botoes.includes(document.activeElement)) document.activeElement.click();
  if (b && !navegarMenuComando.b && menu) {
    if (menu === 'menu-fogueira') partirFogueira();
    else fecharMenu();
  }
  navegarMenuComando.a = a;
  navegarMenuComando.b = b;
}

// ------------------------------------------------------------------ ciclo principal
let fpsAcum = 0;
let hudT = 0;
let bussolaT = 0;
let fpsN = 0;
let tempoTitulo = 0;

function ciclo() {
  requestAnimationFrame(ciclo);
  if (window.__parado) return; // usado pelos testes automáticos
  const dtReal = relogio.getDelta();
  const dt = Math.min(0.05, dtReal);
  passo(dt);
  desenhar();
  if (modo === 'jogo' && !document.hidden) ajustarResolucao(Math.min(0.2, dtReal));
}

function passo(dt) {
  fpsAcum += dt;
  fpsN++;
  if (fpsAcum > 0.5) {
    $('fps').textContent = `${Math.round(fpsN / fpsAcum)} FPS`;
    fpsAcum = 0;
    fpsN = 0;
  }
  navegarMenuComando(dt);

  if (modo === 'titulo') {
    tempoTitulo += dt;
    posicionarCamaraTitulo(tempoTitulo);
    mundo.atualizar(dt, camara.position, camara);
    if (Math.random() < dt * 8) audio.crepitar();
    return;
  }
  if (modo === 'carregar') return;

  entrada.preparar();
  const pausado = menu === 'menu-pausa' || menu === 'menu-mapa' || menu === 'controlos' || menu === 'opcoes';
  const rato = entrada.consumirRato();
  $('clique').classList.toggle('oculto', !(modo === 'jogo' && !menu && !toque && !entrada.bloqueado && entrada.comando === null));

  // ações globais
  if (entrada.premido('pausa')) {
    if (menu === 'menu-pausa') fecharMenu();
    else if (!menu && modo === 'jogo') abrirMenu('menu-pausa');
  }
  if (entrada.premido('mapa')) {
    if (menu === 'menu-mapa') fecharMenu();
    else if (!menu && modo === 'jogo') abrirMenu('menu-mapa');
  }

  if (pausado) {
    entrada.limpar();
    return;
  }

  // paragem no impacto (dá peso aos golpes)
  let dtSim = dt;
  if (paragem > 0) {
    paragem -= dt;
    dtSim = dt * 0.08;
  }
  progresso.tempo += dt;

  if (modo === 'jogo' && !menu) {
    if (entrada.premido('alvo')) fixarAlvo();
    if (entrada.premido('arma') && jogador.estado === 'livre' && jogador.armas.length > 1) {
      const i = jogador.armas.indexOf(jogador.arma);
      jogador.equiparArma(jogador.armas[(i + 1) % jogador.armas.length]);
      hud.aviso(ARMAS[jogador.arma].nome, 1.4);
      audio.item();
    }
    interacaoAtual = procurarInteracao();
    hud.interacao(interacaoAtual ? interacaoAtual.texto : null, entrada.comando !== null ? 'A' : toque ? 'Usar' : 'E');
    if (entrada.premido('interagir') && interacaoAtual) {
      interacaoAtual.fn();
      hud.interacao(null);
    }
  } else {
    hud.interacao(null);
    if (menu) {
      entrada.premido('interagir');
      if (menu === 'mensagem-ler' && (entrada.premido('ataque') || entrada.premido('rolar'))) fecharMenu();
    }
  }

  // jogador
  const bloquearEntrada = modo !== 'jogo' || !!menu;
  if (bloquearEntrada) entrada.limpar();
  jogador.atualizar(dtSim, bloquearEntrada ? { premido: () => false, movimento: () => ({ x: 0, y: 0 }), ativoAcao: () => false } : entrada, cam.yaw);

  if (pendenteDescanso) {
    pendenteDescanso.t -= dt;
    if (pendenteDescanso.t <= 0) {
      const f = pendenteDescanso.f;
      pendenteDescanso = null;
      descansar(f);
    }
  }

  // inimigos (os distantes ficam adormecidos e invisíveis)
  for (const ini of inimigos) {
    if (!ini.ativo) continue;
    const d = Math.hypot(ini.pos.x - jogador.pos.x, ini.pos.z - jogador.pos.z);
    const kd = opcoes.detalhe;
    const visivel = d < (ini.chefe ? 220 : 110 * Math.min(1.3, kd));
    ini.rig.raiz.visible = visivel;
    const sombra = d < 45 * kd;
    if (ini.comSombra !== sombra) {
      ini.comSombra = sombra;
      for (const m of ini.materiais) m.castShadow = sombra;
    }
    if (d < 170 || ini.alerta || ini.chefe) ini.atualizar(dtSim);
  }

  // ondas de choque com dano
  for (let i = ondasDano.length - 1; i >= 0; i--) {
    const o = ondasDano[i];
    if (!efeitos.aneis.includes(o.anel)) {
      ondasDano.splice(i, 1);
      continue;
    }
    if (o.atingiu || jogador.estado === 'morto') continue;
    const d = Math.hypot(jogador.pos.x - o.anel.centro.x, jogador.pos.z - o.anel.centro.z);
    if (Math.abs(d - o.anel.raio) < 0.9 && o.anel.raio > 1) {
      o.atingiu = true;
      jogador.receberDano(o.fonte.cfg.dano * o.mult, { equil: 40, tipo: o.tipo, origem: o.anel.centro.clone(), fogo: o.fogo });
    }
  }

  // chefes: a fera desperta quando o jogador entra na praça
  const lobo = inimigos.find((i) => i.dados.tipo === 'loboAncestral');
  if (lobo && lobo.vivo && modo === 'jogo') {
    const dA = Math.hypot(jogador.pos.x - ARENA_LOBO.x, jogador.pos.z - ARENA_LOBO.z);
    if (lobo.estado === 'aguardar' && dA < ARENA_LOBO.r - 4 && jogador.estado !== 'morto') {
      lobo.despertar();
      chefeAtivo = lobo;
      audio.iniciarMusica(1);
    }
    if (chefeAtivo === lobo && dA > 80) {
      lobo.repor();
      chefeAtivo = null;
      audio.pararMusica();
    }
  }

  // morte
  if (modo === 'morte') {
    tMorte += dt;
    if (tMorte > 1.2) $('ecra-morte').style.opacity = 1;
    if (tMorte > 5) fade(1);
    if (tMorte > 6.3) renascer();
  }

  // áreas
  tRegiao -= dt;
  if (tRegiao <= 0 && modo === 'jogo') {
    tRegiao = 0.5;
    const r = regiaoEm(jogador.pos.x, jogador.pos.z);
    if (r && r.id !== regiaoAtual) {
      hud.area(r.nome);
      if (!progresso.visitou.includes(r.id)) progresso.visitou.push(r.id);
    }
    if (r) regiaoAtual = r.id;
  }

  // gravação periódica
  tGravar -= dt;
  if (tGravar <= 0 && modo === 'jogo') {
    tGravar = 20;
    gravar();
  }

  // itens a flutuar e mancha
  const t = performance.now() / 1000;
  for (const it of itens) {
    if (it.apanhado) continue;
    it.grupo.position.y = altura(it.dados.x, it.dados.z) + 0.45 + Math.sin(t * 2 + it.dados.x) * 0.08;
    it.grupo.children[0].material.opacity = 0.7 + Math.sin(t * 3 + it.dados.z) * 0.3;
  }
  if (manchaObj) manchaObj.children[0].scale.setScalar(1 + Math.sin(t * 2.5) * 0.15);
  for (const m of mensagens) m.mesh.material.opacity = 0.65 + Math.sin(t * 1.5 + m.dados.x) * 0.25;

  // som das fogueiras próximas
  for (const f of mundo.fogueiras) {
    if (f.acesa && Math.hypot(f.dados.x - jogador.pos.x, f.dados.z - jogador.pos.z) < 12 && Math.random() < dt * 10) audio.crepitar();
  }

  const fp = emPrimeiraPessoa();
  if (fp) atualizarCamaraFP(dt, rato);
  else {
    if (camara.fov !== 58) {
      camara.fov = 58;
      camara.updateProjectionMatrix();
    }
    atualizarCamara(dt, rato);
  }
  corpoSoSombra(fp);
  if (fp) {
    const lf = mundo.luzesFogo[0];
    pp.atualizar(dt, jogador, camara, cam.yaw, cam.pitch, lf.intensity > 0 ? { pos: lf.position, intensidade: lf.intensity } : null);
  }
  pontoMira.classList.toggle('visivel', fp && !jogador.alvo && jogador.estado !== 'morto' && jogador.estado !== 'sentado');
  mundo.atualizar(dt, jogador.pos, camara);
  efeitos.atualizar(dtSim, jogador.pos);
  // a interface é atualizada a 30 Hz e a bússola a 12 Hz (chega e poupa trabalho ao browser)
  hudT += dt;
  bussolaT += dt;
  if (hudT >= 1 / 30) {
    hud.atualizar(hudT, jogador, inimigos, camara, chefeAtivo);
    hudT = 0;
  }
  const extras = mundo.fogueiras.filter((f) => f.acesa).map((f) => ({ ang: (Math.atan2(f.dados.x - jogador.pos.x, -(f.dados.z - jogador.pos.z)) * 180) / Math.PI, cor: '#ffa040' }));
  if (progresso.mancha) extras.push({ ang: (Math.atan2(progresso.mancha.x - jogador.pos.x, -(progresso.mancha.z - jogador.pos.z)) * 180) / Math.PI, cor: '#9adf8a' });
  if (bussolaT >= 1 / 12) {
    hud.atualizarBussola(cam.yaw, extras);
    bussolaT = 0;
  }
  const perigo = jogador.hp / jogador.hpMax < 0.25 && jogador.estado !== 'morto' ? 0.5 + Math.sin(t * 4) * 0.15 : 0;
  if (passoCor) {
    passoCor.uniforms.uVermelho.value += (perigo - passoCor.uniforms.uVermelho.value) * Math.min(1, dt * 3);
  } else if (Math.abs(perigo - (hud.perigoCss || 0)) > 0.04) {
    hud.perigoCss = perigo;
    $('perigo').style.opacity = perigo.toFixed(2);
  }
  entrada.limpar();
}

let quadroN = 0;
function desenhar() {
  quadroN++;
  if (renderer.shadowMap.enabled && (quadroN % 2 === 1 || modo === 'titulo')) renderer.shadowMap.needsUpdate = true;
  const bracos = pp && emPrimeiraPessoa() && (modo === 'jogo' || modo === 'morte');
  if (composer) {
    passoBracos.enabled = bracos;
    composer.render();
  } else {
    renderer.render(cena, camara);
    if (bracos) {
      // segunda camada: só se limpa a profundidade, para os braços nunca entrarem nas paredes
      renderer.autoClear = false;
      renderer.clearDepth();
      renderer.render(pp.cena, pp.cam);
      renderer.autoClear = true;
    }
  }
}

ligarMenus();
arrancar().catch((e) => {
  console.error(e);
  $('dica').textContent = `Não foi possível iniciar o jogo: ${e.message}`;
});

// acesso para depuração na consola do browser
window.valdoria = {
  get jogador() { return jogador; }, get mundo() { return mundo; }, get modo() { return modo; }, get menu() { return menu; }, inimigos, cam, camara, progresso, hud,
  desenharSo: () => desenhar(), renderer, cena, comecar, opcoes, get pp() { return pp; }, descansar, ir(x, z) { jogador.colocar(x, z, jogador.rot); },
  // avança a simulação sem depender do relógio (testes automáticos)
  simular(seg, dt = 1 / 30, antes, semDesenho) {
    for (let t = 0; t < seg; t += dt) {
      if (antes) antes(t);
      passo(dt);
    }
    if (!semDesenho) desenhar();
  },
  entrada,
};
