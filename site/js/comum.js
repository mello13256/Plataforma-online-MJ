// Funções partilhadas por todas as páginas: topo, rodapé, formatação e cartões de jogos.
import { auth, bd, collection, doc, getDoc, getDocs, onAuthStateChanged, signOut } from './firebase.js';

export const NOME_SITE = 'Jogos MJ';
export const REPOSITORIO = 'https://github.com/mello13256/Plataforma-online-MJ';

export const CATEGORIAS = [
  'Ação', 'Aventura', 'Arcada', 'Corrida', 'Desporto', 'Estratégia',
  'Multijogador', 'Plataformas', 'Puzzle', 'Terror', 'Outro',
];

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
  for (const filho of filhos.flat()) {
    if (filho == null || filho === false) continue;
    elemento.append(filho instanceof Node ? filho : String(filho));
  }
  return elemento;
}

// Substitui o conteúdo de um elemento, ignorando partes vazias (null/false).
export function preencher(contentor, ...filhos) {
  contentor.replaceChildren(...filhos.flat().filter((f) => f != null && f !== false));
}

export function definirTitulo(titulo) {
  document.title = titulo ? `${titulo} · ${NOME_SITE}` : NOME_SITE;
}

const formatoData = new Intl.DateTimeFormat('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' });
const formatoNumero = new Intl.NumberFormat('pt-PT');

export function formatarData(timestamp) {
  return timestamp?.toDate ? formatoData.format(timestamp.toDate()) : '';
}

export function formatarNumero(n) {
  return formatoNumero.format(n || 0);
}

export function formatarJogadas(n) {
  return n === 1 ? '1 jogada' : `${formatarNumero(n)} jogadas`;
}

function caminhoParaUrl(caminho) {
  return '/' + caminho.split('/').map(encodeURIComponent).join('/');
}

export function urlJogo(jogo) {
  return jogo.tipo === 'ligacao' ? jogo.url_externo : caminhoParaUrl(jogo.caminho);
}

export function urlCapa(jogo) {
  return jogo.capa ? caminhoParaUrl(jogo.capa) : null;
}

export function capa(jogo, classe = 'capa') {
  const url = urlCapa(jogo);
  if (url) return el('img', { class: classe, src: url, alt: '', loading: 'lazy' });
  return el('div', { class: `${classe} capa-vazia`, 'aria-hidden': 'true' }, jogo.titulo.slice(0, 1).toUpperCase());
}

export function paragrafos(texto) {
  return texto
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => el('p', {}, p.split('\n').flatMap((linha, i) => (i ? [el('br'), linha] : [linha]))));
}

export function cartaoJogo(jogo, autores) {
  const autor = autores.get(jogo.autor_uid);
  return el('article', { class: 'cartao' },
    el('a', { href: `/jogo/${jogo.id}`, class: 'cartao-ligacao' },
      capa(jogo),
      el('div', { class: 'cartao-corpo' },
        el('h3', {}, jogo.titulo),
        el('p', { class: 'meta' }, autor ? `${jogo.categoria} · ${autor.nome}` : jogo.categoria),
      ),
    ),
  );
}

export function grelha(jogos, autores, textoVazio) {
  if (!jogos.length) return el('p', { class: 'vazio' }, textoVazio);
  return el('div', { class: 'grelha' }, jogos.map((j) => cartaoJogo(j, autores)));
}

export function mensagem(tipo, texto) {
  return el('p', { class: tipo, role: tipo === 'erro-form' ? 'alert' : 'status' }, texto);
}

export function paginaErro(codigo, texto) {
  return el('section', { class: 'erro' },
    el('p', { class: 'erro-codigo' }, codigo),
    el('h1', {}, texto),
    el('p', {}, el('a', { class: 'botao', href: '/' }, 'Voltar à página inicial')),
  );
}

export async function carregarAutores() {
  const resultado = await getDocs(collection(bd, 'autores'));
  return new Map(resultado.docs.map((d) => [d.id, { uid: d.id, ...d.data() }]));
}

export function criarSlug(texto) {
  const slug = texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
  return slug || 'jogo';
}

export function ordenarPorData(jogos) {
  return jogos.sort((a, b) => (b.criado_em?.toMillis() || 0) - (a.criado_em?.toMillis() || 0));
}

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

export function traduzirErro(erro) {
  const codigo = erro?.code || '';
  if (codigo === 'permission-denied') return 'Não tens permissão para fazer isto.';
  if (codigo === 'unavailable') return 'Sem ligação ao servidor. Verifica a tua ligação à Internet.';
  if (codigo.startsWith('auth/')) {
    return {
      'auth/invalid-credential': 'Email ou palavra-passe incorretos.',
      'auth/wrong-password': 'Email ou palavra-passe incorretos.',
      'auth/user-not-found': 'Email ou palavra-passe incorretos.',
      'auth/invalid-email': 'O email não é válido.',
      'auth/too-many-requests': 'Demasiadas tentativas. Tenta novamente daqui a alguns minutos.',
      'auth/weak-password': 'A palavra-passe é demasiado fraca (mínimo 6 caracteres).',
      'auth/requires-recent-login': 'Por segurança, termina a sessão e volta a entrar antes de fazer esta alteração.',
      'auth/network-request-failed': 'Sem ligação ao servidor. Verifica a tua ligação à Internet.',
    }[codigo] || 'Ocorreu um erro ao comunicar com o servidor.';
  }
  console.error(erro);
  return 'Ocorreu um erro inesperado. Tenta novamente.';
}

// Devolve o perfil de autor, ou mostra instruções caso a conta ainda não tenha sido autorizada.
export async function obterAutor(utilizador, conteudo) {
  const perfil = await getDoc(doc(bd, 'autores', utilizador.uid));
  if (perfil.exists()) return { uid: utilizador.uid, ...perfil.data() };
  conteudo.replaceChildren(
    el('section', { class: 'formulario-estreito' },
      el('h1', {}, 'Conta ainda não autorizada'),
      el('p', {}, 'Entraste com sucesso, mas esta conta ainda não está registada como autor.'),
      el('p', {}, 'Na consola do Firebase, cria no Firestore a coleção ', el('code', {}, 'autores'),
        ' com um documento cujo ID é:'),
      el('p', {}, el('code', { class: 'copiavel' }, utilizador.uid)),
      el('p', {}, 'e os campos ', el('code', {}, 'nome'), ' e ', el('code', {}, 'utilizador'),
        ' (texto). Depois recarrega esta página.'),
    ),
  );
  return null;
}

// Topo e rodapé comuns.
function montarEstrutura() {
  const menu = el('nav', { class: 'menu', 'aria-label': 'Menu principal' }, el('a', { href: '/' }, 'Jogos'));
  const topo = el('header', { class: 'topo' },
    el('div', { class: 'contentor topo-interior' },
      el('a', { class: 'marca', href: '/' }, el('span', { class: 'marca-icone', 'aria-hidden': 'true' }, '🎮'), NOME_SITE),
      el('form', { class: 'pesquisa-topo', action: '/', method: 'get', role: 'search' },
        el('label', { class: 'oculto', for: 'pesquisa-topo' }, 'Pesquisar jogos'),
        el('input', { id: 'pesquisa-topo', type: 'search', name: 'q', placeholder: 'Pesquisar jogos…' }),
      ),
      menu,
    ),
  );
  const rodape = el('footer', { class: 'rodape' },
    el('div', { class: 'contentor' }, `© ${new Date().getFullYear()} ${NOME_SITE} · Feito em Portugal 🇵🇹`),
  );
  document.body.prepend(el('a', { class: 'saltar', href: '#conteudo' }, 'Saltar para o conteúdo'), topo);
  document.body.append(rodape);

  utilizadorAtual.then((utilizador) => {
    if (utilizador) {
      menu.append(
        el('a', { href: '/painel' }, 'Painel'),
        el('button', {
          class: 'ligacao',
          type: 'button',
          onclick: async () => {
            await signOut(auth);
            location.href = '/';
          },
        }, 'Terminar sessão'),
      );
    } else {
      menu.append(el('a', { href: '/entrar' }, 'Entrar'));
    }
  });
}

montarEstrutura();
