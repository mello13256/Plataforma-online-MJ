import { bd, collection, getDocs, query, where } from './firebase.js';
import {
  CATEGORIAS, capa, carregarAutores, definirTitulo, el, grelha, icone, jogavelNoBrowser, mensagem, normalizar,
  ordenarPorData, preencher, traduzirErro,
} from './comum.js';

const conteudo = document.getElementById('conteudo');
const parametros = new URLSearchParams(location.search);
const q = (parametros.get('q') || '').trim().slice(0, 100);
const categoria = (parametros.get('categoria') || '').trim().slice(0, 40);
const ordem = parametros.get('ordem') === 'populares' ? 'populares' : 'recentes';
const filtros = Boolean(q || categoria);

function ligacao({ c = categoria, o = ordem } = {}) {
  const p = new URLSearchParams();
  if (q) p.set('q', q);
  if (c) p.set('categoria', c);
  if (o === 'populares') p.set('ordem', 'populares');
  const s = p.toString();
  return s ? `/?${s}` : '/';
}

function destaque(jogo, autores) {
  const autor = autores.get(jogo.autor_uid);
  return el('section', { class: 'destaque-principal' },
    el('div', {},
      el('span', { class: 'etiqueta-topo' }, icone('estrela'), 'Novidade'),
      el('h1', {}, jogo.titulo),
      el('p', {}, (jogo.descricao || 'Um jogo novo acabado de sair.').split('\n')[0].slice(0, 180)),
      el('div', { class: 'acoes' },
        el('a', { class: 'botao grande', href: `/jogo/${jogo.id}` },
          icone(jogavelNoBrowser(jogo) ? 'jogar' : 'transferir'), jogavelNoBrowser(jogo) ? 'Jogar agora' : 'Ver e transferir'),
        el('span', { class: 'meta' }, autor ? `${jogo.categoria} · por ${autor.nome}` : jogo.categoria),
      ),
    ),
    el('a', { class: 'imagem', href: `/jogo/${jogo.id}`, 'aria-label': jogo.titulo }, capa(jogo)),
  );
}

function boasVindas() {
  return el('section', { class: 'destaque-principal' },
    el('div', {},
      el('span', { class: 'etiqueta-topo' }, icone('comando'), 'Bem-vindo'),
      el('h1', {}, 'Jogos feitos por nós, prontos a jogar'),
      el('p', {}, 'Joga diretamente no browser ou transfere para o computador. Não precisas de conta: entras como convidado.'),
    ),
  );
}

definirTitulo(q ? `Pesquisa: ${q}` : categoria || null);
document.getElementById('pesquisa-topo').value = q;

try {
  const [resultado, autores] = await Promise.all([
    getDocs(query(collection(bd, 'jogos'), where('publicado', '==', true))),
    carregarAutores(),
  ]);
  const todos = ordenarPorData(resultado.docs.map((d) => ({ id: d.id, ...d.data() })));

  // Categorias: as sugeridas que estão em uso + as personalizadas.
  const usadas = new Set(todos.map((j) => j.categoria));
  const categorias = [...CATEGORIAS.filter((c) => usadas.has(c)), ...[...usadas].filter((c) => !CATEGORIAS.includes(c)).sort()];

  let jogos = todos;
  if (categoria) jogos = jogos.filter((j) => normalizar(j.categoria) === normalizar(categoria));
  if (q) {
    const termo = normalizar(q);
    jogos = jogos.filter((j) => normalizar(`${j.titulo} ${j.descricao} ${j.categoria}`).includes(termo));
  }
  if (ordem === 'populares') jogos = [...jogos].sort((a, b) => (b.jogadas || 0) - (a.jogadas || 0));

  preencher(conteudo,
    filtros ? null : todos.length ? destaque(todos[0], autores) : boasVindas(),
    el('section', { class: 'barra-filtros' },
      el('div', { class: 'cabecalho-seccao' },
        el('div', {},
          el('h2', {}, q ? `Resultados para «${q}»` : categoria || 'Todos os jogos'),
          el('p', {}, jogos.length === 1 ? '1 jogo' : `${jogos.length} jogos`),
        ),
        el('div', { class: 'alternador', role: 'group', 'aria-label': 'Ordenar' },
          el('a', { href: ligacao({ o: 'recentes' }), class: ordem === 'recentes' ? 'ativo' : null }, 'Mais recentes'),
          el('a', { href: ligacao({ o: 'populares' }), class: ordem === 'populares' ? 'ativo' : null }, 'Mais jogados'),
        ),
      ),
      categorias.length
        ? el('nav', { class: 'categorias', 'aria-label': 'Categorias' },
            el('a', { href: ligacao({ c: '' }), class: categoria ? 'etiqueta' : 'etiqueta ativa' }, 'Todas'),
            categorias.map((c) => el('a', {
              href: ligacao({ c }),
              class: normalizar(c) === normalizar(categoria) ? 'etiqueta ativa' : 'etiqueta',
            }, c)))
        : null,
    ),
    el('section', {},
      grelha(jogos, autores, filtros ? 'Não foram encontrados jogos com esses critérios.' : 'Ainda não há jogos publicados. Volta em breve!'),
    ),
  );
} catch (erro) {
  preencher(conteudo, mensagem('erro-form', traduzirErro(erro)));
}
