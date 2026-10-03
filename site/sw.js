// Service worker da plataforma: serve os jogos e as transferências carregados no site.
//
//   /jogar/<pacote>/<caminho>      ficheiro dentro do .zip do jogo
//   /transferir/<pacote>/<nome>    ficheiro para transferir (ex.: .exe)
//
// Os ficheiros estão guardados no Firestore em blocos (/pacotes/<id>/partes/000…).
// Depois de transferido, cada pacote fica em cache no browser.
importScripts('/vendor/fflate.js');

const CACHE = 'pacotes-v1';
const local = ['localhost', '127.0.0.1'].includes(location.hostname);

const TIPOS = {
  html: 'text/html; charset=utf-8', htm: 'text/html; charset=utf-8', js: 'text/javascript', mjs: 'text/javascript',
  css: 'text/css', json: 'application/json', wasm: 'application/wasm', txt: 'text/plain; charset=utf-8',
  xml: 'application/xml', svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  gif: 'image/gif', webp: 'image/webp', ico: 'image/x-icon', bmp: 'image/bmp', mp3: 'audio/mpeg', ogg: 'audio/ogg',
  oga: 'audio/ogg', wav: 'audio/wav', m4a: 'audio/mp4', aac: 'audio/aac', mp4: 'video/mp4', webm: 'video/webm',
  ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2',
};

function tipoDe(caminho) {
  const extensao = caminho.split('.').pop().toLowerCase();
  return TIPOS[extensao] || 'application/octet-stream';
}

let baseFirestore;
async function obterBase() {
  if (!baseFirestore) {
    let projeto = 'demo-jogos-mj';
    let origem = 'http://127.0.0.1:8080';
    if (!local) {
      projeto = (await (await fetch('/__/firebase/init.json')).json()).projectId;
      origem = 'https://firestore.googleapis.com';
    }
    baseFirestore = `${origem}/v1/projects/${projeto}/databases/(default)/documents`;
  }
  return baseFirestore;
}

function base64ParaBytes(texto) {
  const binario = atob(texto);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

// Junta as partes de um pacote (com cache no browser).
async function obterBytes(id) {
  const cache = await caches.open(CACHE);
  const chave = `/__pacotes/${id}`;
  const guardado = await cache.match(chave);
  if (guardado) return new Uint8Array(await guardado.arrayBuffer());

  const base = await obterBase();
  const partes = [];
  let pagina = '';
  do {
    const resposta = await fetch(`${base}/pacotes/${id}/partes?pageSize=10${pagina ? `&pageToken=${encodeURIComponent(pagina)}` : ''}`);
    if (!resposta.ok) throw new Error(`Pacote ${id} indisponível (${resposta.status}).`);
    const dados = await resposta.json();
    for (const documento of dados.documents || []) {
      partes.push({ nome: documento.name.split('/').pop(), bytes: base64ParaBytes(documento.fields.dados.bytesValue) });
    }
    pagina = dados.nextPageToken || '';
  } while (pagina);
  if (!partes.length) throw new Error(`Pacote ${id} não encontrado.`);

  partes.sort((a, b) => a.nome.localeCompare(b.nome));
  const total = partes.reduce((soma, p) => soma + p.bytes.length, 0);
  const bytes = new Uint8Array(total);
  let posicao = 0;
  for (const parte of partes) {
    bytes.set(parte.bytes, posicao);
    posicao += parte.bytes.length;
  }
  await cache.put(chave, new Response(bytes));
  return bytes;
}

// Pacotes de jogos já descomprimidos (em memória enquanto o service worker estiver ativo).
const jogos = new Map();

function descomprimir(bytes) {
  const ficheiros = new Map();
  for (const [caminho, conteudo] of Object.entries(fflate.unzipSync(bytes))) {
    if (caminho.endsWith('/') || caminho.startsWith('__MACOSX/')) continue;
    ficheiros.set(caminho.replace(/\\/g, '/'), conteudo);
  }
  return ficheiros;
}

function obterJogo(id) {
  if (!jogos.has(id)) {
    const promessa = id.startsWith('previa-')
      ? Promise.reject(new Error('A pré-visualização expirou. Volta a escolher o ficheiro do jogo.'))
      : obterBytes(id).then(descomprimir);
    promessa.catch(() => jogos.delete(id));
    jogos.set(id, promessa);
  }
  return jogos.get(id);
}

function paginaErro(mensagem, estado = 404) {
  return new Response(
    `<!doctype html><meta charset="utf-8"><body style="font-family:system-ui;display:grid;place-items:center;height:100vh;margin:0;background:#0d0d0d;color:#f2f2f2;text-align:center"><p>${mensagem.replace(/</g, '&lt;')}</p>`,
    { status: estado, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

async function servirJogo(id, caminho) {
  try {
    const ficheiros = await obterJogo(id);
    let conteudo = ficheiros.get(caminho);
    if (!conteudo && (caminho === '' || caminho.endsWith('/'))) conteudo = ficheiros.get(`${caminho}index.html`);
    if (!conteudo) return new Response('Ficheiro não encontrado no jogo.', { status: 404 });

    // Builds com ficheiros .gz (ex.: Unity com compressão Gzip): descomprimir aqui.
    if (caminho.endsWith('.gz')) {
      const descomprimido = new Response(new Blob([conteudo]).stream().pipeThrough(new DecompressionStream('gzip')));
      return new Response(descomprimido.body, { headers: { 'Content-Type': tipoDe(caminho.slice(0, -3)) } });
    }
    return new Response(conteudo, { headers: { 'Content-Type': tipoDe(caminho), 'Cache-Control': 'no-cache' } });
  } catch (erro) {
    return paginaErro(erro.message);
  }
}

async function servirTransferencia(id, nome) {
  try {
    const bytes = await obterBytes(id);
    return new Response(bytes, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(bytes.length),
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(nome)}`,
      },
    });
  } catch (erro) {
    return paginaErro(erro.message);
  }
}

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (evento) => evento.waitUntil(self.clients.claim()));

// A página de publicação envia o jogo para testar antes de o carregar.
self.addEventListener('message', (evento) => {
  const { tipo, id, ficheiros } = evento.data || {};
  if (tipo === 'previa' && /^previa-[A-Za-z0-9_-]+$/.test(id)) {
    jogos.set(id, Promise.resolve(new Map(Object.entries(ficheiros))));
    evento.ports[0]?.postMessage('pronto');
  }
});

self.addEventListener('fetch', (evento) => {
  const url = new URL(evento.request.url);
  if (url.origin !== location.origin || evento.request.method !== 'GET') return;
  let partes = url.pathname.match(/^\/jogar\/([A-Za-z0-9_-]+)\/(.*)$/);
  if (partes) {
    evento.respondWith(servirJogo(partes[1], decodeURIComponent(partes[2])));
    return;
  }
  partes = url.pathname.match(/^\/transferir\/([A-Za-z0-9_-]+)\/([^/]+)$/);
  if (partes) evento.respondWith(servirTransferencia(partes[1], decodeURIComponent(partes[2])));
});
