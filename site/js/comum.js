// Funções partilhadas por todas as páginas: topo, rodapé, tema, formatação, permissões e cartões.
import { auth, bd, collection, deleteDoc, doc, getDoc, getDocs, onAuthStateChanged, signOut } from './firebase.js';

export const NOME_SITE = 'Jogos MJ';
export const REPOSITORIO = 'https://github.com/mello13256/Plataforma-online-MJ';
export const UID_DONO = 'PIgsxFjHYDc32oIqh5yD4g7uDmF3';

// Sugestões de categoria (é possível escrever outra qualquer).
export const CATEGORIAS = [
  'Ação', 'Aventura', 'Arcada', 'Corrida', 'Desporto', 'Estratégia',
  'Multijogador', 'Plataformas', 'Puzzle', 'Terror', 'Outro',
];

export const PERMISSOES = [
  { chave: 'publicar', nome: 'Publicar jogos', descricao: 'Publicar jogos novos e editar ou eliminar os próprios.' },
  { chave: 'editar_todos', nome: 'Editar jogos de todos', descricao: 'Alterar jogos publicados por outros autores.' },
  { chave: 'eliminar_todos', nome: 'Eliminar jogos de todos', descricao: 'Remover jogos publicados por outros autores.' },
  { chave: 'admin', nome: 'Administrador', descricao: 'Tudo o que está acima, mais gerir utilizadores e permissões.' },
];

// ----------------------------------------------------------------- Ícones

const ICONES = {
  procurar: '<path d="M21 21l-4.3-4.3M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14z"/>',
  sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  lua: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  jogar: '<path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z" fill="currentColor" stroke="none"/>',
  transferir: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
  ecra: '<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>',
  externo: '<path d="M14 3h7v7M10 14L21 3M19 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5"/>',
  editar: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  lixo: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
  mais: '<path d="M12 5v14M5 12h14"/>',
  imagem: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/>',
  browser: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 9h20"/>',
  comando: '<path d="M6 11h4M8 9v4M15 12h.01M18 10h.01"/><rect x="2" y="6" width="20" height="12" rx="6"/>',
  escudo: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  utilizadores: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  sair: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  alerta: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
  certo: '<path d="M20 6L9 17l-5-5"/>',
  seta: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  estrela: '<path d="M12 2l3 6.9 7.5.7-5.7 5 1.7 7.4L12 18l-6.5 4 1.7-7.4-5.7-5 7.5-.7z"/>',
  coracao: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>',
  partilhar: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>',
  mensagem: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  relogio: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  grafico: '<path d="M3 3v18h18M7 15l4-4 3 3 5-6"/>',
};

export function icone(nome) {
  const span = document.createElement('span');
  span.className = 'icone';
  span.setAttribute('aria-hidden', 'true');
  // Conteúdo fixo (constantes acima), nunca vindo de dados.
  span.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONES[nome]}</svg>`;
  return span;
}

// ---------------------------------------------------------- Construção DOM

// Cria elementos de forma segura (o texto nunca é interpretado como HTML).
export function el(etiqueta, atributos = {}, ...filhos) {
  const elemento = document.createElement(etiqueta);
  for (const [nome, valor] of Object.entries(atributos)) {
    if (valor == null || valor === false) continue;
    if (nome === 'class') elemento.className = valor;
    else if (nome.startsWith('on')) elemento.addEventListener(nome.slice(2), valor);
    else if (valor === true) elemento.setAttribute(nome, '');
    else elemento.setAttribute(nome, valor);
  }
  for (const filho of filhos.flat(Infinity)) {
    if (filho == null || filho === false) continue;
    elemento.append(filho instanceof Node ? filho : String(filho));
  }
  return elemento;
}

// Substitui o conteúdo de um elemento, ignorando partes vazias (null/false).
export function preencher(contentor, ...filhos) {
  contentor.replaceChildren(...filhos.flat(Infinity).filter((f) => f != null && f !== false));
}

// Pequena notificação no canto do ecrã.
export function notificar(texto, tipo = 'sucesso') {
  let zona = document.querySelector('.notificacoes');
  if (!zona) {
    zona = el('div', { class: 'notificacoes', role: 'status', 'aria-live': 'polite' });
    document.body.append(zona);
  }
  const nota = el('div', { class: `notificacao ${tipo}` }, icone(tipo === 'sucesso' ? 'certo' : 'alerta'), texto);
  zona.append(nota);
  setTimeout(() => nota.classList.add('a-sair'), 2800);
  setTimeout(() => nota.remove(), 3200);
}

// Listas guardadas no browser de quem visita (favoritos, jogados recentemente…).
export function lerLista(chave) {
  try {
    const valor = JSON.parse(localStorage.getItem(chave) || '[]');
    return Array.isArray(valor) ? valor : [];
  } catch {
    return [];
  }
}

export function guardarLista(chave, lista) {
  try {
    localStorage.setItem(chave, JSON.stringify(lista));
  } catch {
    // sem armazenamento: não faz mal
  }
}

export function registarJogado(slug) {
  guardarLista('jogados', [slug, ...lerLista('jogados').filter((s) => s !== slug)].slice(0, 12));
}

export async function partilhar(titulo, url = location.href) {
  if (navigator.share) {
    try {
      await navigator.share({ title: titulo, url });
      return;
    } catch (erro) {
      if (erro.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    notificar('Ligação copiada! Já a podes colar onde quiseres.');
  } catch {
    prompt('Copia esta ligação:', url);
  }
}

export function definirTitulo(titulo) {
  document.title = titulo ? `${titulo} · ${NOME_SITE}` : `${NOME_SITE} · Jogos para jogar no browser`;
}

export function mensagem(tipo, texto) {
  const icones = { 'erro-form': 'alerta', sucesso: 'certo', aviso: 'alerta', info: 'alerta' };
  return el('div', { class: `mensagem ${tipo}`, role: tipo === 'erro-form' ? 'alert' : 'status' },
    icone(icones[tipo] || 'alerta'), el('div', {}, texto));
}

export function paginaErro(codigo, texto) {
  return el('section', { class: 'erro' },
    el('p', { class: 'erro-codigo' }, codigo),
    el('h1', {}, texto),
    el('a', { class: 'botao', href: '/' }, 'Voltar à página inicial'),
  );
}

export function vazio(texto, acao) {
  return el('div', { class: 'vazio' }, icone('comando'), el('p', {}, texto), acao);
}

// ----------------------------------------------------------------- Formatos

const formatoData = new Intl.DateTimeFormat('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' });
const formatoNumero = new Intl.NumberFormat('pt-PT');

export function formatarData(timestamp) {
  return timestamp?.toDate ? formatoData.format(timestamp.toDate()) : '';
}

export function formatarNumero(n) {
  return formatoNumero.format(n || 0);
}

export function iniciais(nome = '') {
  return nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?';
}

export function criarSlug(texto) {
  const slug = texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
  return slug || 'jogo';
}

export function normalizar(texto) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function paragrafos(texto) {
  return texto
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => el('p', {}, p.split('\n').flatMap((linha, i) => (i ? [el('br'), linha] : [linha]))));
}

export function ordenarPorData(jogos) {
  return jogos.sort((a, b) => (b.criado_em?.toMillis() || 0) - (a.criado_em?.toMillis() || 0));
}

// -------------------------------------------------------------------- Jogos

function caminhoParaUrl(caminho) {
  return '/' + caminho.split('/').map(encodeURIComponent).join('/');
}

export function jogavelNoBrowser(jogo) {
  return jogo.tipo === 'pacote' || jogo.tipo === 'repositorio' || jogo.tipo === 'ligacao';
}

export function urlJogo(jogo) {
  if (jogo.tipo === 'ligacao') return jogo.url_externo;
  if (jogo.tipo === 'pacote') return `/jogar/${jogo.pacote.id}/${jogo.pacote.entrada.split('/').map(encodeURIComponent).join('/')}`;
  // pasta com barra final: os ficheiros relativos do jogo (scripts, imagens…) resolvem-se dentro da pasta
  if (jogo.tipo === 'repositorio') return caminhoParaUrl(jogo.caminho.replace(/(^|\/)index\.html?$/i, '$1'));
  return null;
}

export function urlCapa(jogo) {
  if (jogo.capa_imagem) return jogo.capa_imagem;
  return jogo.capa ? caminhoParaUrl(jogo.capa) : null;
}

export function capa(jogo, classe = '') {
  const url = urlCapa(jogo);
  if (url) return el('img', { class: classe, src: url, alt: '', loading: 'lazy' });
  return el('div', { class: `${classe} capa-vazia`, 'aria-hidden': 'true' }, jogo.titulo.slice(0, 1).toUpperCase());
}

const DIA = 24 * 60 * 60 * 1000;

// «Novo» nos primeiros 7 dias; «Atualizado» se mudou nos últimos 7 dias.
export function novidade(jogo) {
  const criado = jogo.criado_em?.toMillis?.() || 0;
  const atualizado = jogo.atualizado_em?.toMillis?.() || 0;
  if (Date.now() - criado < 7 * DIA) return 'Novo';
  if (Date.now() - atualizado < 7 * DIA && atualizado - criado > DIA) return 'Atualizado';
  return null;
}

export function selos(jogo) {
  const etiqueta = novidade(jogo);
  return el('div', { class: 'selos' },
    etiqueta ? el('span', { class: `selo destaque-selo ${etiqueta === 'Novo' ? 'novo' : ''}` }, etiqueta) : null,
    jogavelNoBrowser(jogo) ? el('span', { class: 'selo' }, icone('browser'), 'Browser') : null,
    jogo.transferencias?.length ? el('span', { class: 'selo' }, icone('transferir'), 'Transferir') : null,
  );
}

export function cartaoJogo(jogo, autores) {
  const autor = autores.get(jogo.autor_uid);
  return el('article', { class: 'cartao' },
    el('a', { href: `/jogo/${jogo.id}`, class: 'cartao-ligacao' },
      el('div', { class: 'cartao-imagem' }, capa(jogo), selos(jogo)),
      el('div', { class: 'cartao-corpo' },
        el('div', { class: 'cartao-linha' },
          el('h3', {}, jogo.titulo),
          jogo.gostos ? el('span', { class: 'contador-gostos', title: 'Gostos' }, icone('coracao'), formatarNumero(jogo.gostos)) : null),
        el('p', { class: 'meta' }, autor ? `${jogo.categoria} · ${autor.nome}` : jogo.categoria),
      ),
    ),
  );
}

export function grelha(jogos, autores, textoVazio) {
  if (!jogos.length) return vazio(textoVazio);
  return el('div', { class: 'grelha' }, jogos.map((j) => cartaoJogo(j, autores)));
}

export function formatarTamanho(bytes) {
  if (bytes < 1024 * 1024) return `${formatarNumero(Math.max(1, Math.round(bytes / 1024)))} KB`;
  return `${new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 1 }).format(bytes / 1024 / 1024)} MB`;
}

// --------------------------------------------- Ficheiros carregados no site

// Instala o service worker que serve /jogar/… e /transferir/… e espera que fique ativo.
export async function prepararServiceWorker() {
  if (!('serviceWorker' in navigator)) throw new Error('Este browser não suporta jogos carregados no site.');
  await navigator.serviceWorker.register('/sw.js');
  return navigator.serviceWorker.ready;
}

// IDs dos pacotes usados por um jogo (o jogo em si e as transferências carregadas).
export function pacotesDoJogo(jogo) {
  const ids = new Set();
  if (jogo?.tipo === 'pacote' && jogo.pacote?.id) ids.add(jogo.pacote.id);
  for (const t of jogo?.transferencias || []) {
    const partes = t.url.match(/^\/transferir\/([A-Za-z0-9_-]+)\//);
    if (partes) ids.add(partes[1]);
  }
  return [...ids];
}

export async function apagarPacote(id) {
  const partes = await getDocs(collection(bd, 'pacotes', id, 'partes'));
  await Promise.all(partes.docs.map((d) => deleteDoc(d.ref)));
  await deleteDoc(doc(bd, 'pacotes', id));
}

// Junta as partes de um ficheiro carregado no site e entrega-o ao browser como transferência.
export async function transferirFicheiro(url, aoProgresso = () => {}) {
  const [, id, nome] = url.match(/^\/transferir\/([A-Za-z0-9_-]+)\/([^/]+)$/);
  const partes = (await getDocs(collection(bd, 'pacotes', id, 'partes'))).docs.sort((a, b) => a.id.localeCompare(b.id));
  if (!partes.length) throw new Error('Este ficheiro já não está disponível.');
  aoProgresso();
  const blob = new Blob(partes.map((p) => p.data().dados.toUint8Array()), { type: 'application/octet-stream' });
  const ligacao = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: decodeURIComponent(nome) });
  document.body.append(ligacao);
  ligacao.click();
  ligacao.remove();
  setTimeout(() => URL.revokeObjectURL(ligacao.href), 60_000);
}

// Elimina um jogo e os ficheiros que foram carregados para ele.
export async function eliminarJogo(jogo) {
  // A galeria e os comentários primeiro: as regras confirmam o autor através do jogo.
  await deleteDoc(doc(bd, 'galerias', jogo.id)).catch(() => {});
  const comentarios = await getDocs(collection(bd, 'jogos', jogo.id, 'comentarios')).catch(() => null);
  await Promise.all((comentarios?.docs || []).map((d) => deleteDoc(d.ref).catch(() => {})));
  await deleteDoc(doc(bd, 'jogos', jogo.id));
  await Promise.all(pacotesDoJogo(jogo).map((id) => apagarPacote(id).catch(() => {})));
}

export async function carregarAutores() {
  const resultado = await getDocs(collection(bd, 'autores'));
  return new Map(resultado.docs.map((d) => [d.id, { uid: d.id, ...d.data() }]));
}

// --------------------------------------------------- Sessão e permissões

// Devolve o utilizador com sessão iniciada (ou null) assim que o Firebase o souber.
export const utilizadorAtual = new Promise((resolver) => {
  const parar = onAuthStateChanged(auth, (utilizador) => {
    parar();
    resolver(utilizador);
  });
});

export function exigirSessao() {
  return utilizadorAtual.then((utilizador) => {
    if (!utilizador) {
      location.replace(`/entrar?seguinte=${encodeURIComponent(location.pathname + location.search)}`);
      return new Promise(() => {});
    }
    return utilizador;
  });
}

export function pode(perfil, permissao) {
  if (!perfil) return false;
  if (perfil.uid === UID_DONO) return true;
  const p = perfil.permissoes || { publicar: true };
  return p.admin === true || p[permissao] === true;
}

let perfilEmCache;

// Devolve o perfil de autor da sessão atual (ou null).
export function obterPerfil() {
  perfilEmCache ??= (async () => {
    const utilizador = await utilizadorAtual;
    if (!utilizador) return null;
    const existente = await getDoc(doc(bd, 'autores', utilizador.uid));
    return existente.exists() ? { uid: utilizador.uid, ...existente.data() } : null;
  })();
  return perfilEmCache;
}

// Para páginas reservadas: exige sessão e perfil; senão mostra o motivo.
export async function exigirPerfil(conteudo) {
  const utilizador = await exigirSessao();
  const perfil = await obterPerfil();
  if (perfil) return perfil;
  preencher(conteudo,
    el('section', { class: 'cartao-form estreito' },
      el('h1', {}, 'Conta sem acesso'),
      el('p', { class: 'ajuda' }, `Entraste como ${utilizador.email}, mas esta conta ainda não tem acesso à área de autores.`),
      el('p', {}, 'Pede ao administrador da plataforma para te adicionar em Administração → Utilizadores.'),
      el('p', {}, 'Para jogar não precisas de conta: ', el('a', { href: '/' }, 'vê os jogos como convidado'), '.'),
    ),
  );
  return null;
}

export function traduzirErro(erro) {
  const codigo = erro?.code || '';
  if (codigo === 'permission-denied') return 'Não tens permissão para fazer isto.';
  if (codigo === 'unavailable') return 'Sem ligação ao servidor. Verifica a tua ligação à Internet.';
  if (codigo === 'invalid-argument' && /longer|bytes/i.test(erro.message)) return 'A imagem de capa é demasiado grande.';
  if (codigo.startsWith('auth/')) {
    return {
      'auth/invalid-credential': 'Email ou palavra-passe incorretos.',
      'auth/wrong-password': 'Email ou palavra-passe incorretos.',
      'auth/user-not-found': 'Email ou palavra-passe incorretos.',
      'auth/invalid-email': 'O email não é válido.',
      'auth/too-many-requests': 'Demasiadas tentativas. Tenta novamente daqui a alguns minutos.',
      'auth/weak-password': 'A palavra-passe é demasiado fraca (mínimo 8 caracteres).',
      'auth/email-already-in-use': 'Já existe uma conta com este email.',
      'auth/operation-not-allowed': 'A criação de contas está desligada no Firebase.',
      'auth/admin-restricted-operation': 'A criação de contas está desligada no Firebase.',
      'auth/requires-recent-login': 'Por segurança, termina a sessão e volta a entrar antes de fazer esta alteração.',
      'auth/network-request-failed': 'Sem ligação ao servidor. Verifica a tua ligação à Internet.',
    }[codigo] || 'Ocorreu um erro ao comunicar com o servidor.';
  }
  console.error(erro);
  return 'Ocorreu um erro inesperado. Tenta novamente.';
}

// ---------------------------------------------------------- Topo e rodapé

function alternarTema(botao) {
  const escuro = document.documentElement.dataset.tema !== 'escuro';
  if (escuro) document.documentElement.dataset.tema = 'escuro';
  else delete document.documentElement.dataset.tema;
  try {
    localStorage.setItem('tema', escuro ? 'escuro' : 'claro');
  } catch {
    // sem armazenamento: o tema só dura nesta página
  }
  atualizarBotaoTema(botao);
}

function atualizarBotaoTema(botao) {
  const escuro = document.documentElement.dataset.tema === 'escuro';
  botao.replaceChildren(icone(escuro ? 'sol' : 'lua'));
  botao.title = escuro ? 'Mudar para tema claro' : 'Mudar para tema escuro';
  botao.setAttribute('aria-label', botao.title);
}

function montarEstrutura() {
  const botaoTema = el('button', { type: 'button', class: 'botao-tema' });
  botaoTema.addEventListener('click', () => alternarTema(botaoTema));
  atualizarBotaoTema(botaoTema);

  const pagina = location.pathname.replace(/\/$/, '') || '/';
  const ligacaoMenu = (href, texto, nomeIcone) =>
    el('a', { href, class: pagina === href ? 'ativo' : null }, nomeIcone ? icone(nomeIcone) : null, el('span', { class: 'texto-menu' }, texto));

  const zonaUtilizador = el('span', { class: 'chip-utilizador', title: 'Estás a navegar como convidado' },
    el('span', { class: 'avatar convidado' }, '👤'), el('span', { class: 'texto-menu' }, 'Convidado'));
  const entrar = el('a', { href: '/entrar' }, 'Entrar');
  const menu = el('nav', { class: 'menu', 'aria-label': 'Menu principal' }, ligacaoMenu('/', 'Jogos', 'comando'), botaoTema, zonaUtilizador, entrar);

  const topo = el('header', { class: 'topo' },
    el('div', { class: 'contentor topo-interior' },
      el('a', { class: 'marca', href: '/' }, el('span', { class: 'marca-logo' }, 'MJ'), NOME_SITE),
      el('form', { class: 'pesquisa-topo', action: '/', method: 'get', role: 'search' },
        icone('procurar'),
        el('label', { class: 'oculto', for: 'pesquisa-topo' }, 'Pesquisar jogos'),
        el('input', { id: 'pesquisa-topo', type: 'search', name: 'q', placeholder: 'Pesquisar jogos…' }),
      ),
      menu,
    ),
  );
  const rodape = el('footer', { class: 'rodape' },
    el('div', { class: 'contentor' },
      el('span', {}, `© ${new Date().getFullYear()} ${NOME_SITE} · Feito em Portugal 🇵🇹`),
      el('span', {}, 'Joga como convidado, sem criar conta.'),
    ),
  );
  document.body.prepend(el('a', { class: 'saltar', href: '#conteudo' }, 'Saltar para o conteúdo'), topo);
  document.body.append(rodape);

  // App instalável: o service worker regista-se em todas as páginas e o botão
  // «Instalar app» aparece quando o browser o permite.
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  window.addEventListener('beforeinstallprompt', (evento) => {
    evento.preventDefault();
    const botao = el('button', {
      type: 'button',
      class: 'botao pequeno secundario',
      onclick: async () => {
        evento.prompt();
        await evento.userChoice;
        botao.remove();
      },
    }, icone('transferir'), 'Instalar app');
    rodape.firstChild.append(botao);
  });

  utilizadorAtual.then(async (utilizador) => {
    if (!utilizador) return;
    const perfil = await obterPerfil().catch(() => null);
    const nome = perfil?.nome || utilizador.email;
    entrar.remove();
    const novos = [
      perfil ? ligacaoMenu('/painel', 'Painel', 'editar') : null,
      pode(perfil, 'admin') ? ligacaoMenu('/admin', 'Administração', 'escudo') : null,
      el('a', { href: perfil ? '/conta' : '/', class: 'chip-utilizador', title: nome },
        el('span', { class: 'avatar' }, iniciais(nome)), el('span', { class: 'texto-menu' }, nome.split(' ')[0])),
      el('button', {
        type: 'button',
        title: 'Terminar sessão',
        'aria-label': 'Terminar sessão',
        onclick: async () => {
          await signOut(auth);
          location.href = '/';
        },
      }, icone('sair')),
    ];
    zonaUtilizador.replaceWith(...novos.filter(Boolean));
  });
}

montarEstrutura();
