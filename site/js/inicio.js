import { bd, collection, getDocs, query, where } from './firebase.js';
import {
  CATEGORIAS, NOME_SITE, carregarAutores, definirTitulo, el, grelha, mensagem, ordenarPorData, traduzirErro, preencher,
} from './comum.js';

const conteudo = document.getElementById('conteudo');
const parametros = new URLSearchParams(location.search);
const q = (parametros.get('q') || '').trim().slice(0, 100);
const categoria = CATEGORIAS.includes(parametros.get('categoria')) ? parametros.get('categoria') : '';
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

function normalizar(texto) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

definirTitulo(q ? `Pesquisa: ${q}` : categoria || null);
document.getElementById('pesquisa-topo').value = q;

try {
  const [resultado, autores] = await Promise.all([
    getDocs(query(collection(bd, 'jogos'), where('publicado', '==', true))),
    carregarAutores(),
  ]);
  let jogos = resultado.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (categoria) jogos = jogos.filter((j) => j.categoria === categoria);
  if (q) {
    const termo = normalizar(q);
    jogos = jogos.filter((j) => normalizar(`${j.titulo} ${j.descricao}`).includes(termo));
  }
  ordenarPorData(jogos);
  if (ordem === 'populares') jogos.sort((a, b) => (b.jogadas || 0) - (a.jogadas || 0));

  preencher(conteudo, 
    filtros
      ? null
      : el('section', { class: 'destaque' },
          el('h1', {}, `Bem-vindo ao ${NOME_SITE}`),
          el('p', {},
            'Jogos feitos por nós, prontos a jogar no browser. Sem instalações, sem complicações: escolhe um e carrega em ',
            el('strong', {}, 'Jogar'), '.'),
        ),
    el('section', { class: 'filtros' },
      el('form', { action: '/', method: 'get', class: 'pesquisa', role: 'search' },
        el('label', { class: 'oculto', for: 'q' }, 'Pesquisar jogos'),
        el('input', { id: 'q', type: 'search', name: 'q', value: q, placeholder: 'Pesquisar por nome ou descrição…' }),
        categoria ? el('input', { type: 'hidden', name: 'categoria', value: categoria }) : null,
        el('button', { type: 'submit', class: 'botao' }, 'Pesquisar'),
      ),
      el('nav', { class: 'categorias', 'aria-label': 'Categorias' },
        el('a', { href: ligacao({ c: '' }), class: categoria ? 'etiqueta' : 'etiqueta ativa' }, 'Todas'),
        CATEGORIAS.map((c) => el('a', { href: ligacao({ c }), class: c === categoria ? 'etiqueta ativa' : 'etiqueta' }, c)),
      ),
    ),
    el('section', {},
      el('div', { class: 'cabecalho-seccao' },
        el('h2', {}, filtros ? `Resultados (${jogos.length})` : 'Todos os jogos'),
        el('div', { class: 'ordenar' },
          el('a', { href: ligacao({ o: 'recentes' }), class: ordem === 'recentes' ? 'ativo' : '' }, 'Mais recentes'),
          el('a', { href: ligacao({ o: 'populares' }), class: ordem === 'populares' ? 'ativo' : '' }, 'Mais jogados'),
        ),
      ),
      grelha(jogos, autores,
        filtros ? 'Não foram encontrados jogos com esses critérios.' : 'Ainda não há jogos publicados. Volta em breve!'),
    ),
  );
} catch (erro) {
  preencher(conteudo, mensagem('erro-form', traduzirErro(erro)));
}
