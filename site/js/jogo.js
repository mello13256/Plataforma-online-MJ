import { bd, collection, doc, getDoc, getDocs, increment, query, updateDoc, where } from './firebase.js';
import {
  capa, carregarAutores, cartaoJogo, definirTitulo, el, formatarData, formatarNumero, icone, iniciais,
  jogavelNoBrowser, mensagem, obterPerfil, ordenarPorData, paginaErro, paragrafos, pode, preencher, selos,
  traduzirErro, urlJogo, utilizadorAtual,
} from './comum.js';

const conteudo = document.getElementById('conteudo');
const slug = decodeURIComponent(location.pathname.replace(/^\/jogo\//, '').replace(/\/$/, ''));

function naoEncontrado() {
  definirTitulo('Jogo não encontrado');
  preencher(conteudo, paginaErro(404, 'Este jogo não existe.'));
}

function contarJogada(jogo, ref) {
  if (jogo.publicado) updateDoc(ref, { jogadas: increment(1) }).catch(() => {});
}

function leitor(jogo, ref) {
  const caixa = el('div', { class: 'leitor', id: 'leitor' });
  if (!jogavelNoBrowser(jogo)) {
    caixa.append(el('div', { class: 'leitor-capa' }, capa(jogo, 'leitor-fundo'), selos(jogo)));
    return { caixa, barra: null, jogar: null };
  }
  const externo = jogo.tipo === 'ligacao';
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
    contarJogada(jogo, ref);
  };
  caixa.append(
    el('div', { class: 'leitor-capa' },
      capa(jogo, 'leitor-fundo'),
      el('div', { class: 'leitor-centro' },
        el('button', { type: 'button', class: 'botao grande botao-jogar', onclick: jogar }, icone('jogar'), 'Jogar'),
        el('small', {}, 'Sem conta, sem instalações: estás a jogar como convidado.'),
      ),
    ),
  );
  const barra = el('div', { class: 'barra-leitor' },
    el('button', {
      type: 'button',
      class: 'botao secundario pequeno',
      onclick: () => {
        jogar();
        caixa.requestFullscreen?.();
      },
    }, icone('ecra'), 'Ecrã inteiro'),
    el('a', { class: 'botao secundario pequeno', href: urlJogo(jogo), target: '_blank', rel: 'noopener' }, icone('externo'), 'Abrir numa nova janela'),
  );
  return { caixa, barra, jogar };
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
      const [autores, outros, perfil] = await Promise.all([
        carregarAutores(),
        getDocs(query(collection(bd, 'jogos'), where('autor_uid', '==', jogo.autor_uid), where('publicado', '==', true))),
        obterPerfil().catch(() => null),
      ]);
      const autor = autores.get(jogo.autor_uid);
      const podeEditar = perfil && ((perfil.uid === jogo.autor_uid && pode(perfil, 'publicar')) || pode(perfil, 'editar_todos'));
      const maisDoAutor = ordenarPorData(outros.docs.map((d) => ({ id: d.id, ...d.data() })).filter((j) => j.id !== jogo.id)).slice(0, 4);
      const { caixa, barra, jogar } = leitor(jogo, ref);
      const transferencias = jogo.transferencias || [];

      definirTitulo(jogo.titulo);
      preencher(conteudo,
        jogo.publicado ? null : mensagem('aviso', 'Este jogo é um rascunho: só os autores o conseguem ver.'),
        el('div', { class: 'pagina-jogo' },
          el('div', { class: 'bloco-texto' },
            el('div', {}, caixa, barra),
            el('h1', {}, jogo.titulo),
            el('div', { class: 'meta' },
              el('a', { class: 'etiqueta', href: `/?categoria=${encodeURIComponent(jogo.categoria)}` }, jogo.categoria),
              el('span', {}, `Publicado a ${formatarData(jogo.criado_em)}`),
            ),
            jogo.descricao ? el('div', { class: 'texto' }, paragrafos(jogo.descricao)) : null,
          ),
          el('aside', { class: 'painel-lateral' },
            el('div', { class: 'caixa' },
              jogar ? el('button', { type: 'button', class: 'botao grande', onclick: () => { jogar(); caixa.scrollIntoView({ behavior: 'smooth', block: 'center' }); } }, icone('jogar'), 'Jogar no browser') : null,
              transferencias.map((t) => el('a', {
                class: `botao ${jogar ? 'secundario' : 'verde grande'}`,
                href: t.url,
                target: '_blank',
                rel: 'noopener',
                onclick: () => contarJogada(jogo, ref),
              }, icone('transferir'), `Transferir · ${t.rotulo}`)),
              transferencias.length ? el('p', { class: 'ajuda' }, 'A transferência abre noutra página. Ficheiros .exe podem mostrar um aviso do Windows; confirma que vem de um autor em quem confias.') : null,
              podeEditar ? el('a', { class: 'botao secundario', href: `/editar?id=${jogo.id}` }, icone('editar'), 'Editar jogo') : null,
            ),
            el('div', { class: 'caixa' },
              el('div', { class: 'estatisticas' },
                el('div', { class: 'estatistica' }, el('strong', {}, formatarNumero(jogo.jogadas)), el('span', {}, jogo.jogadas === 1 ? 'jogada' : 'jogadas')),
                el('div', { class: 'estatistica' }, el('strong', {}, jogo.categoria), el('span', {}, 'categoria')),
              ),
              autor
                ? el('a', { class: 'autor-linha', href: `/autor/${encodeURIComponent(autor.utilizador)}` },
                    el('span', { class: 'avatar' }, iniciais(autor.nome)),
                    el('span', {}, el('strong', {}, autor.nome), el('small', {}, `@${autor.utilizador}`)))
                : null,
            ),
            jogo.instrucoes
              ? el('div', { class: 'caixa' }, el('h2', {}, 'Como jogar'), el('div', { class: 'texto' }, paragrafos(jogo.instrucoes)))
              : null,
          ),
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
