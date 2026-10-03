import { auth, bd, collection, doc, getDoc, getDocs, increment, query, updateDoc, where } from './firebase.js';
import {
  capa, carregarAutores, cartaoJogo, definirTitulo, el, formatarData, formatarJogadas, mensagem,
  ordenarPorData, paginaErro, paragrafos, traduzirErro, urlJogo, utilizadorAtual, preencher,
} from './comum.js';

const conteudo = document.getElementById('conteudo');
const slug = decodeURIComponent(location.pathname.replace(/^\/jogo\//, '').replace(/\/$/, ''));

function naoEncontrado() {
  definirTitulo('Jogo não encontrado');
  preencher(conteudo, paginaErro(404, 'Este jogo não existe.'));
}

function leitor(jogo, ref) {
  const externo = jogo.tipo === 'ligacao';
  const caixa = el('div', { class: 'leitor', id: 'leitor' });
  const jogar = () => {
    if (caixa.querySelector('iframe')) return;
    const iframe = el('iframe', {
      src: urlJogo(jogo),
      title: jogo.titulo,
      allow: 'fullscreen; autoplay; gamepad; clipboard-write',
      allowfullscreen: true,
      sandbox: externo ? 'allow-scripts allow-same-origin allow-pointer-lock allow-forms allow-popups' : null,
    });
    caixa.replaceChildren(iframe);
    iframe.focus();
    if (jogo.publicado) updateDoc(ref, { jogadas: increment(1) }).catch(() => {});
  };
  caixa.append(
    el('div', { class: 'leitor-capa' },
      capa(jogo, 'leitor-fundo'),
      el('button', { type: 'button', class: 'botao botao-jogar', onclick: jogar }, '▶ Jogar'),
    ),
  );
  const acoes = el('div', { class: 'leitor-acoes' },
    el('button', {
      type: 'button',
      class: 'botao secundario',
      onclick: () => {
        jogar();
        caixa.requestFullscreen?.();
      },
    }, '⛶ Ecrã inteiro'),
    el('a', { class: 'botao secundario', href: urlJogo(jogo), target: '_blank', rel: 'noopener' }, 'Abrir numa nova janela'),
  );
  return { caixa, acoes };
}

try {
  if (!/^[a-z0-9-]{1,70}$/.test(slug)) {
    naoEncontrado();
  } else {
    await utilizadorAtual;
    const ref = doc(bd, 'jogos', slug);
    let documento;
    try {
      documento = await getDoc(ref);
    } catch (erro) {
      if (erro.code !== 'permission-denied') throw erro;
    }
    if (!documento?.exists()) {
      naoEncontrado();
    } else {
      const jogo = { id: documento.id, ...documento.data() };
      const eDono = auth.currentUser?.uid === jogo.autor_uid;
      const [autores, outros] = await Promise.all([
        carregarAutores(),
        getDocs(query(collection(bd, 'jogos'), where('autor_uid', '==', jogo.autor_uid), where('publicado', '==', true))),
      ]);
      const autor = autores.get(jogo.autor_uid);
      const maisDoAutor = ordenarPorData(outros.docs.map((d) => ({ id: d.id, ...d.data() })).filter((j) => j.id !== jogo.id)).slice(0, 4);
      const { caixa, acoes } = leitor(jogo, ref);
      if (eDono) acoes.append(el('a', { class: 'botao secundario', href: `/editar?id=${jogo.id}` }, 'Editar jogo'));

      definirTitulo(jogo.titulo);
      preencher(conteudo, 
        jogo.publicado ? null : mensagem('aviso', 'Este jogo é um rascunho: só os autores o conseguem ver.'),
        el('section', { class: 'jogo' }, caixa, acoes),
        el('section', { class: 'info-jogo' },
          el('div', {},
            el('h1', {}, jogo.titulo),
            el('p', { class: 'meta' },
              el('a', { class: 'etiqueta', href: `/?categoria=${encodeURIComponent(jogo.categoria)}` }, jogo.categoria),
              autor ? ['por ', el('a', { href: `/autor/${encodeURIComponent(autor.utilizador)}` }, autor.nome)] : null,
              ` · publicado a ${formatarData(jogo.criado_em)} · ${formatarJogadas(jogo.jogadas)}`,
            ),
            jogo.descricao ? el('div', { class: 'texto' }, paragrafos(jogo.descricao)) : null,
          ),
          jogo.instrucoes
            ? el('aside', { class: 'caixa' }, el('h2', {}, 'Como jogar'), el('div', { class: 'texto' }, paragrafos(jogo.instrucoes)))
            : null,
        ),
        maisDoAutor.length && autor
          ? el('section', {},
              el('h2', {}, `Mais jogos de ${autor.nome}`),
              el('div', { class: 'grelha' }, maisDoAutor.map((j) => cartaoJogo(j, autores))))
          : null,
      );
    }
  }
} catch (erro) {
  preencher(conteudo, mensagem('erro-form', traduzirErro(erro)));
}
