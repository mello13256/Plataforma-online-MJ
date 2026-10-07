import { bd, collection, getDocs, query, where } from './firebase.js';
import {
  CATEGORIAS, capa, carregarAutores, cartaoJogo, definirTitulo, el, formatarNumero, grelha, icone, jogavelNoBrowser,
  lerLista, mensagem, normalizar, obterPerfil, ordenarPorData, pode, preencher, traduzirErro,
} from './comum.js';

const conteudo = document.getElementById('conteudo');
const parametros = new URLSearchParams(location.search);
const ORDENS = { recentes: 'Mais recentes', populares: 'Mais jogados', gostados: 'Mais gostados' };
const estado = {
  q: (parametros.get('q') || '').trim().slice(0, 100),
  categoria: (parametros.get('categoria') || '').trim().slice(0, 40),
  ordem: ORDENS[parametros.get('ordem')] ? parametros.get('ordem') : 'recentes',
};

function atualizarEndereco() {
  const p = new URLSearchParams();
  if (estado.q) p.set('q', estado.q);
  if (estado.categoria) p.set('categoria', estado.categoria);
  if (estado.ordem !== 'recentes') p.set('ordem', estado.ordem);
  const s = p.toString();
  history.replaceState(null, '', s ? `/?${s}` : '/');
  definirTitulo(estado.q ? `Pesquisa: ${estado.q}` : estado.categoria || null);
}

function destaque(jogo, autores, totais) {
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
      el('div', { class: 'numeros' },
        el('span', {}, el('strong', {}, formatarNumero(totais.jogos)), totais.jogos === 1 ? ' jogo' : ' jogos'),
        el('span', {}, el('strong', {}, formatarNumero(totais.jogadas)), ' jogadas'),
        el('span', {}, el('strong', {}, formatarNumero(totais.autores)), totais.autores === 1 ? ' autor' : ' autores'),
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

// Fila horizontal (Continuar a jogar, Favoritos).
function fila(titulo, nomeIcone, jogos, autores) {
  if (!jogos.length) return null;
  return el('section', { class: 'fila' },
    el('h2', {}, icone(nomeIcone), titulo),
    el('div', { class: 'fila-cartoes' }, jogos.map((j) => cartaoJogo(j, autores))),
  );
}

try {
  const [resultado, autores] = await Promise.all([
    getDocs(query(collection(bd, 'jogos'), where('publicado', '==', true))),
    carregarAutores(),
  ]);
  const todos = ordenarPorData(resultado.docs.map((d) => ({ id: d.id, ...d.data() })));

  // Administradores: jogos privados numa fila própria.
  const perfil = await obterPerfil().catch(() => null);
  const privados = pode(perfil, 'admin')
    ? ordenarPorData((await getDocs(query(collection(bd, 'jogos'), where('privado', '==', true))).catch(() => null))?.docs
        .map((d) => ({ id: d.id, ...d.data() })) || [])
    : [];
  const porId = new Map(todos.map((j) => [j.id, j]));
  const totais = {
    jogos: todos.length,
    jogadas: todos.reduce((s, j) => s + (j.jogadas || 0), 0),
    autores: new Set(todos.map((j) => j.autor_uid)).size,
  };

  // Categorias: as sugeridas que estão em uso + as personalizadas.
  const usadas = new Set(todos.map((j) => j.categoria));
  const categorias = [...CATEGORIAS.filter((c) => usadas.has(c)), ...[...usadas].filter((c) => !CATEGORIAS.includes(c)).sort()];

  const zonaDestaque = el('div');
  const zonaFilas = el('div', { class: 'filas' });
  const tituloLista = el('h2');
  const contagem = el('p');
  const zonaGrelha = el('div');
  const barraCategorias = el('nav', { class: 'categorias', 'aria-label': 'Categorias' });
  const alternador = el('div', { class: 'alternador', role: 'group', 'aria-label': 'Ordenar' });
  const pesquisa = el('input', { type: 'search', value: estado.q, placeholder: 'Pesquisar por nome, descrição ou categoria…', 'aria-label': 'Pesquisar jogos' });

  function desenhar() {
    const filtros = Boolean(estado.q || estado.categoria);
    let jogos = todos;
    if (estado.categoria) jogos = jogos.filter((j) => normalizar(j.categoria) === normalizar(estado.categoria));
    if (estado.q) {
      const termos = normalizar(estado.q).split(/\s+/).filter(Boolean);
      jogos = jogos.filter((j) => {
        const texto = normalizar(`${j.titulo} ${j.descricao} ${j.categoria} ${autores.get(j.autor_uid)?.nome || ''}`);
        return termos.every((t) => texto.includes(t));
      });
    }
    if (estado.ordem === 'populares') jogos = [...jogos].sort((a, b) => (b.jogadas || 0) - (a.jogadas || 0));
    if (estado.ordem === 'gostados') jogos = [...jogos].sort((a, b) => (b.gostos || 0) - (a.gostos || 0));

    preencher(zonaDestaque, filtros ? null : todos.length ? destaque(todos[0], autores, totais) : boasVindas());
    preencher(zonaFilas, filtros ? null : [
      privados.length
        ? el('section', { class: 'fila' },
            el('h2', {}, icone('cadeado'), 'Privados'),
            el('div', { class: 'fila-cartoes' }, privados.map((j) => cartaoJogo(j, autores))))
        : null,
      fila('Continuar a jogar', 'relogio', lerLista('jogados').map((s) => porId.get(s)).filter(Boolean).slice(0, 6), autores),
      fila('Os teus favoritos', 'coracao', lerLista('gostos').map((s) => porId.get(s)).filter(Boolean).slice(0, 6), autores),
    ]);
    tituloLista.textContent = estado.q ? `Resultados para «${estado.q}»` : estado.categoria || 'Todos os jogos';
    contagem.textContent = jogos.length === 1 ? '1 jogo' : `${jogos.length} jogos`;
    preencher(barraCategorias, categorias.length
      ? [
          el('button', { type: 'button', class: estado.categoria ? 'etiqueta' : 'etiqueta ativa', onclick: () => mudar({ categoria: '' }) }, 'Todas'),
          categorias.map((c) => el('button', {
            type: 'button',
            class: normalizar(c) === normalizar(estado.categoria) ? 'etiqueta ativa' : 'etiqueta',
            onclick: () => mudar({ categoria: normalizar(c) === normalizar(estado.categoria) ? '' : c }),
          }, c)),
        ]
      : null);
    preencher(alternador, Object.entries(ORDENS).map(([chave, nome]) =>
      el('button', { type: 'button', class: estado.ordem === chave ? 'ativo' : null, onclick: () => mudar({ ordem: chave }) }, nome)));
    preencher(zonaGrelha, grelha(jogos, autores, filtros ? 'Não foram encontrados jogos com esses critérios.' : 'Ainda não há jogos publicados. Volta em breve!'));
  }

  function mudar(alteracoes) {
    Object.assign(estado, alteracoes);
    atualizarEndereco();
    desenhar();
  }

  let espera;
  pesquisa.addEventListener('input', () => {
    clearTimeout(espera);
    espera = setTimeout(() => mudar({ q: pesquisa.value.trim().slice(0, 100) }), 150);
  });
  // A pesquisa do topo também filtra na hora, sem recarregar a página.
  const pesquisaTopo = document.getElementById('pesquisa-topo');
  pesquisaTopo.value = estado.q;
  pesquisaTopo.form.addEventListener('submit', (e) => {
    e.preventDefault();
    pesquisa.value = pesquisaTopo.value;
    mudar({ q: pesquisaTopo.value.trim().slice(0, 100) });
    pesquisa.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  atualizarEndereco();
  preencher(conteudo,
    zonaDestaque,
    zonaFilas,
    el('section', { class: 'barra-filtros' },
      el('div', { class: 'cabecalho-seccao' }, el('div', {}, tituloLista, contagem), alternador),
      el('div', { class: 'pesquisa-grande' }, icone('procurar'), pesquisa),
      barraCategorias,
    ),
    zonaGrelha,
  );
  desenhar();
} catch (erro) {
  preencher(conteudo, mensagem('erro-form', traduzirErro(erro)));
}
