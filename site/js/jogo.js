import {
  addDoc, bd, collection, deleteDoc, doc, getDoc, getDocs, increment, orderBy, query, serverTimestamp, updateDoc, where,
} from './firebase.js';
import {
  capa, carregarAutores, cartaoJogo, definirTitulo, estadoJogo, el, formatarData, formatarNumero, guardarLista, icone, iniciais,
  jogavelNoBrowser, lerLista, mensagem, normalizar, notificar, obterPerfil, ordenarPorData, paginaErro, paragrafos,
  partilhar, pode, preencher, prepararServiceWorker, registarJogado, selos, transferirFicheiro, traduzirErro, urlJogo,
  utilizadorAtual, vazio,
} from './comum.js';

const conteudo = document.getElementById('conteudo');
const slug = decodeURIComponent(location.pathname.replace(/^\/jogo\//, '').replace(/\/$/, ''));

function naoEncontrado() {
  definirTitulo('Jogo não encontrado');
  preencher(conteudo, paginaErro(404, 'Este jogo não existe.'));
}

// Números do painel lateral, atualizados na hora.
const numeros = { jogadas: el('strong'), gostos: el('strong'), rotuloJogadas: el('span'), rotuloGostos: el('span') };
function mostrarNumeros(jogo) {
  numeros.jogadas.textContent = formatarNumero(jogo.jogadas || 0);
  numeros.rotuloJogadas.textContent = jogo.jogadas === 1 ? 'jogada' : 'jogadas';
  numeros.gostos.textContent = formatarNumero(jogo.gostos || 0);
  numeros.rotuloGostos.textContent = jogo.gostos === 1 ? 'gosto' : 'gostos';
}

let jogadaContada = false;
function contarJogada(jogo, ref) {
  registarJogado(jogo.id);
  if (!jogo.publicado || jogadaContada) return;
  jogadaContada = true;
  jogo.jogadas = (jogo.jogadas || 0) + 1;
  mostrarNumeros(jogo);
  updateDoc(ref, { jogadas: increment(1) }).catch(() => {});
}

// ------------------------------------------------------------------ Leitor

function leitor(jogo, ref) {
  const caixa = el('div', { class: 'leitor', id: 'leitor' });
  if (!jogavelNoBrowser(jogo)) {
    caixa.append(el('div', { class: 'leitor-capa' }, capa(jogo, 'leitor-fundo'), selos(jogo)));
    return { caixa, barra: null, jogar: null };
  }
  const externo = jogo.tipo === 'ligacao';
  const jogar = async () => {
    if (caixa.querySelector('iframe')) return;
    if (jogo.tipo === 'pacote') {
      try {
        await prepararServiceWorker();
      } catch (erro) {
        preencher(caixa, el('div', { class: 'leitor-capa' }, el('p', { class: 'leitor-centro' }, erro.message)));
        return;
      }
    }
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
        caixa.requestFullscreen?.();
        jogar();
      },
    }, icone('ecra'), 'Ecrã inteiro'),
    el('a', { class: 'botao secundario pequeno', href: urlJogo(jogo), target: '_blank', rel: 'noopener' }, icone('externo'), 'Abrir numa nova janela'),
  );
  return { caixa, barra, jogar };
}

// ------------------------------------------------------------------- Gostos

function botaoGosto(jogo, ref) {
  let gostos = jogo.gostos || 0;
  let gosto = lerLista('gostos').includes(jogo.id);
  const contador = el('span', {}, formatarNumero(gostos));
  const botao = el('button', { type: 'button', class: 'botao secundario botao-gosto', 'aria-pressed': String(gosto) }, icone('coracao'), contador);
  const desenhar = () => {
    jogo.gostos = gostos;
    mostrarNumeros(jogo);
    botao.setAttribute('aria-pressed', String(gosto));
    botao.title = gosto ? 'Retirar gosto' : 'Gosto deste jogo';
    contador.textContent = formatarNumero(gostos);
  };
  botao.addEventListener('click', async () => {
    if (!jogo.publicado) {
      notificar('Só se pode dar gosto a jogos publicados.', 'aviso');
      return;
    }
    const novo = !gosto;
    gosto = novo;
    gostos = Math.max(0, gostos + (novo ? 1 : -1));
    desenhar();
    guardarLista('gostos', novo ? [jogo.id, ...lerLista('gostos')] : lerLista('gostos').filter((s) => s !== jogo.id));
    try {
      await updateDoc(ref, { gostos: increment(novo ? 1 : -1) });
      if (novo) notificar('Adicionado aos teus favoritos.');
    } catch {
      gosto = !novo;
      gostos = Math.max(0, gostos + (novo ? -1 : 1));
      desenhar();
    }
  });
  desenhar();
  return botao;
}

// ------------------------------------------------------------------ Galeria

function abrirImagem(imagens, indice) {
  let atual = indice;
  const imagem = el('img', { alt: '' });
  const mostrar = () => { imagem.src = imagens[atual]; };
  const janela = el('dialog', { class: 'janela-imagem', onclick: (e) => { if (e.target === janela) janela.close(); } },
    imagem,
    imagens.length > 1 ? el('button', { type: 'button', class: 'seta-galeria anterior', 'aria-label': 'Anterior', onclick: () => { atual = (atual - 1 + imagens.length) % imagens.length; mostrar(); } }, '‹') : null,
    imagens.length > 1 ? el('button', { type: 'button', class: 'seta-galeria seguinte', 'aria-label': 'Seguinte', onclick: () => { atual = (atual + 1) % imagens.length; mostrar(); } }, '›') : null,
    el('button', { type: 'button', class: 'fechar-galeria', 'aria-label': 'Fechar', onclick: () => janela.close() }, '×'),
  );
  janela.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' && imagens.length > 1) { atual = (atual - 1 + imagens.length) % imagens.length; mostrar(); }
    if (e.key === 'ArrowRight' && imagens.length > 1) { atual = (atual + 1) % imagens.length; mostrar(); }
  });
  janela.addEventListener('close', () => janela.remove());
  mostrar();
  document.body.append(janela);
  janela.showModal();
}

function galeria(imagens) {
  if (!imagens.length) return null;
  return el('section', { class: 'bloco-texto' },
    el('h2', {}, 'Imagens'),
    el('div', { class: 'galeria' }, imagens.map((src, i) =>
      el('button', { type: 'button', class: 'miniatura-galeria', 'aria-label': `Ver imagem ${i + 1}`, onclick: () => abrirImagem(imagens, i) },
        el('img', { src, alt: '', loading: 'lazy' })))),
  );
}

// -------------------------------------------------------------- Comentários

function comentarios(jogo, perfil, podeModerar) {
  const lista = el('div', { class: 'lista-comentarios' }, el('p', { class: 'ajuda' }, 'A carregar comentários…'));
  const titulo = el('h2', {}, 'Comentários');
  const colecao = collection(bd, 'jogos', jogo.id, 'comentarios');

  const desenharComentario = (c) => {
    const linha = el('article', { class: 'comentario' },
      el('span', { class: `avatar ${c.uid ? '' : 'convidado'}` }, iniciais(c.nome)),
      el('div', {},
        el('div', { class: 'comentario-topo' },
          el('strong', {}, c.nome),
          c.uid === jogo.autor_uid ? el('span', { class: 'estado dono' }, 'Autor') : null,
          el('small', { class: 'meta' }, formatarData(c.criado_em) || 'agora mesmo'),
          podeModerar
            ? el('button', {
                type: 'button',
                class: 'ligacao apagar-comentario',
                onclick: async () => {
                  if (!confirm('Apagar este comentário?')) return;
                  try {
                    await deleteDoc(doc(colecao, c.id));
                    notificar('Comentário apagado.');
                    await carregar();
                  } catch (erro) {
                    notificar(traduzirErro(erro), 'erro');
                  }
                },
              }, 'Apagar')
            : null,
        ),
        el('p', {}, c.texto),
      ),
    );
    return linha;
  };

  const carregar = async () => {
    try {
      const resultado = await getDocs(query(colecao, orderBy('criado_em', 'desc')));
      const todos = resultado.docs.map((d) => ({ id: d.id, ...d.data() }));
      titulo.textContent = todos.length ? `Comentários (${todos.length})` : 'Comentários';
      preencher(lista, todos.length ? todos.map(desenharComentario) : el('p', { class: 'ajuda' }, 'Ainda ninguém comentou. Sê o primeiro!'));
    } catch {
      preencher(lista, el('p', { class: 'ajuda' }, 'Não foi possível carregar os comentários.'));
    }
  };
  carregar();

  if (!jogo.publicado) return el('section', { class: 'bloco-texto' }, titulo, el('p', { class: 'ajuda' }, 'Os comentários ficam disponíveis quando o jogo for publicado.'));

  let nomeGuardado = '';
  try { nomeGuardado = localStorage.getItem('nome-comentario') || ''; } catch { /* sem armazenamento */ }
  const nome = el('input', { maxlength: '40', required: true, value: perfil?.nome || nomeGuardado, placeholder: 'O teu nome', 'aria-label': 'O teu nome' });
  const texto = el('textarea', { maxlength: '1000', required: true, rows: '3', placeholder: 'O que achaste do jogo?', 'aria-label': 'Comentário' });
  const enviar = el('button', { type: 'submit', class: 'botao' }, icone('mensagem'), 'Comentar');
  const formulario = el('form', {
    class: 'formulario-comentario',
    onsubmit: async (evento) => {
      evento.preventDefault();
      const dados = { nome: nome.value.trim(), texto: texto.value.trim(), criado_em: serverTimestamp() };
      if (!dados.nome || !dados.texto) return;
      if (perfil) dados.uid = perfil.uid;
      enviar.disabled = true;
      try {
        await addDoc(colecao, dados);
        try { localStorage.setItem('nome-comentario', dados.nome); } catch { /* sem armazenamento */ }
        texto.value = '';
        notificar('Comentário publicado. Obrigado!');
        await carregar();
      } catch (erro) {
        notificar(traduzirErro(erro), 'erro');
      }
      // Pequena pausa para evitar comentários repetidos.
      setTimeout(() => { enviar.disabled = false; }, 5000);
    },
  }, el('div', { class: 'linha-comentario' }, nome), texto, el('div', {}, enviar));

  return el('section', { class: 'bloco-texto' }, titulo, formulario, lista);
}

// ------------------------------------------------------------------- Página

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
      const [autores, publicados, perfil, documentoGaleria] = await Promise.all([
        carregarAutores(),
        getDocs(query(collection(bd, 'jogos'), where('publicado', '==', true))),
        obterPerfil().catch(() => null),
        getDoc(doc(bd, 'galerias', jogo.id)).catch(() => null),
      ]);
      const autor = autores.get(jogo.autor_uid);
      const eDono = perfil?.uid === jogo.autor_uid;
      const podeEditar = perfil && ((eDono && pode(perfil, 'publicar')) || pode(perfil, 'editar_todos'));
      const podeModerar = perfil && ((eDono && pode(perfil, 'publicar')) || pode(perfil, 'eliminar_todos'));
      const outros = ordenarPorData(publicados.docs.map((d) => ({ id: d.id, ...d.data() })).filter((j) => j.id !== jogo.id));
      const maisDoAutor = outros.filter((j) => j.autor_uid === jogo.autor_uid).slice(0, 4);
      const semelhantes = outros
        .filter((j) => j.autor_uid !== jogo.autor_uid && normalizar(j.categoria) === normalizar(jogo.categoria))
        .slice(0, 4);
      const imagens = documentoGaleria?.exists() ? documentoGaleria.data().imagens || [] : [];
      const { caixa, barra, jogar } = leitor(jogo, ref);
      const transferencias = jogo.transferencias || [];
      if (jogo.tipo === 'pacote') prepararServiceWorker().catch(() => {});

      definirTitulo(jogo.titulo);
      document.querySelector('meta[name="description"]')?.setAttribute('content', (jogo.descricao || jogo.titulo).slice(0, 160));

      preencher(conteudo,
        new URLSearchParams(location.search).has('novo')
          ? mensagem('sucesso', {
              publico: 'Jogo publicado! Já está visível para toda a gente.',
              rascunho: 'Rascunho guardado. Só os autores o conseguem ver.',
              privado: 'Jogo privado guardado. Só os administradores (e tu) o conseguem ver.',
            }[estadoJogo(jogo)])
          : estadoJogo(jogo) === 'rascunho' ? mensagem('aviso', 'Este jogo é um rascunho: só os autores o conseguem ver.')
            : estadoJogo(jogo) === 'privado' ? mensagem('aviso', 'Jogo privado: só os administradores e o autor o conseguem ver.') : null,
        el('div', { class: 'pagina-jogo' },
          el('div', { class: 'bloco-texto' },
            el('div', {}, caixa, barra),
            el('div', { class: 'titulo-jogo' },
              el('h1', {}, jogo.titulo),
              el('div', { class: 'acoes' },
                botaoGosto(jogo, ref),
                el('button', { type: 'button', class: 'botao secundario', onclick: () => partilhar(jogo.titulo) }, icone('partilhar'), 'Partilhar'),
              ),
            ),
            el('div', { class: 'meta' },
              el('a', { class: 'etiqueta', href: `/?categoria=${encodeURIComponent(jogo.categoria)}` }, jogo.categoria),
              el('span', {}, `Publicado a ${formatarData(jogo.criado_em)}`),
              jogo.atualizado_em && formatarData(jogo.atualizado_em) !== formatarData(jogo.criado_em)
                ? el('span', {}, `· atualizado a ${formatarData(jogo.atualizado_em)}`) : null,
            ),
            jogo.descricao ? el('div', { class: 'texto' }, paragrafos(jogo.descricao)) : null,
          ),
          el('aside', { class: 'painel-lateral' },
            el('div', { class: 'caixa' },
              jogar ? el('button', { type: 'button', class: 'botao grande', onclick: () => { jogar(); caixa.scrollIntoView({ behavior: 'smooth', block: 'center' }); } }, icone('jogar'), 'Jogar no browser') : null,
              transferencias.map((t) => el('a', {
                class: `botao ${jogar ? 'secundario' : 'verde grande'}`,
                href: t.url,
                target: t.url.startsWith('/') ? null : '_blank',
                rel: t.url.startsWith('/') ? null : 'noopener',
                onclick: async (evento) => {
                  contarJogada(jogo, ref);
                  if (!t.url.startsWith('/transferir/')) return;
                  evento.preventDefault();
                  const botao = evento.currentTarget;
                  const textoBotao = botao.lastChild.textContent;
                  botao.lastChild.textContent = 'A preparar a transferência…';
                  try {
                    await transferirFicheiro(t.url);
                  } catch (erro) {
                    notificar(traduzirErro(erro), 'erro');
                  }
                  botao.lastChild.textContent = textoBotao;
                },
              }, icone('transferir'), `Transferir · ${t.rotulo}`)),
              transferencias.length ? el('p', { class: 'ajuda' }, 'Ficheiros .exe podem mostrar um aviso do Windows; confirma que vem de um autor em quem confias.') : null,
              podeEditar ? el('a', { class: 'botao secundario', href: `/editar?id=${jogo.id}` }, icone('editar'), 'Editar jogo') : null,
            ),
            el('div', { class: 'caixa' },
              el('div', { class: 'estatisticas' },
                el('div', { class: 'estatistica' }, numeros.jogadas, numeros.rotuloJogadas),
                el('div', { class: 'estatistica' }, numeros.gostos, numeros.rotuloGostos),
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
        galeria(imagens),
        comentarios(jogo, perfil, podeModerar),
        maisDoAutor.length && autor
          ? el('section', {}, el('h2', {}, `Mais jogos de ${autor.nome}`), el('div', { class: 'grelha' }, maisDoAutor.map((j) => cartaoJogo(j, autores))))
          : null,
        semelhantes.length
          ? el('section', {}, el('h2', {}, `Mais jogos de ${jogo.categoria}`), el('div', { class: 'grelha' }, semelhantes.map((j) => cartaoJogo(j, autores))))
          : null,
      );
    }
  }
} catch (erro) {
  preencher(conteudo, mensagem('erro-form', traduzirErro(erro)), vazio('Tenta recarregar a página.'));
}
