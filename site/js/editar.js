import { bd, collection, doc, getDoc, getDocs, runTransaction, serverTimestamp, updateDoc } from './firebase.js';
import {
  CATEGORIAS, REPOSITORIO, criarSlug, definirTitulo, el, exigirPerfil, icone, mensagem, paginaErro, pode,
  preencher, traduzirErro, urlCapa,
} from './comum.js';

const conteudo = document.getElementById('conteudo');
const id = new URLSearchParams(location.search).get('id');
const MAX_TRANSFERENCIAS = 5;
const LIMITE_CAPA = 550_000; // caracteres do data URL (cabe no documento do Firestore)

async function lerIndiceRepositorio() {
  try {
    const resposta = await fetch('/indice-repositorio.json', { cache: 'no-store' });
    if (resposta.ok) return await resposta.json();
  } catch {
    // sem índice: continua com listas vazias
  }
  return { jogos: [], capas: [], avisos: [] };
}

function validarUrl(texto) {
  try {
    const url = new URL(texto);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

// Reduz a imagem para no máximo 1280×720 e converte para WebP (ou JPEG), abaixo do limite.
async function prepararCapa(ficheiro) {
  if (!ficheiro.type.startsWith('image/')) throw new Error('Escolhe um ficheiro de imagem (PNG, JPG, WEBP ou GIF).');
  const imagem = await createImageBitmap(ficheiro);
  let largura = Math.min(1280, imagem.width);
  for (let tentativa = 0; tentativa < 6; tentativa++) {
    const escala = Math.min(largura / imagem.width, (largura * 9) / 16 / imagem.height, 1);
    const tela = document.createElement('canvas');
    tela.width = Math.round(imagem.width * escala);
    tela.height = Math.round(imagem.height * escala);
    tela.getContext('2d').drawImage(imagem, 0, 0, tela.width, tela.height);
    for (const qualidade of [0.85, 0.7, 0.55]) {
      let dados = tela.toDataURL('image/webp', qualidade);
      if (!dados.startsWith('data:image/webp')) dados = tela.toDataURL('image/jpeg', qualidade);
      if (dados.length <= LIMITE_CAPA) return dados;
    }
    largura = Math.round(largura * 0.75);
  }
  throw new Error('Não foi possível reduzir a imagem. Experimenta outra.');
}

async function criarJogo(perfil, dados) {
  const base = criarSlug(dados.titulo);
  for (let n = 1; n < 100; n++) {
    const slug = n === 1 ? base : `${base}-${n}`;
    const ref = doc(bd, 'jogos', slug);
    const criado = await runTransaction(bd, async (transacao) => {
      if ((await transacao.get(ref)).exists()) return false;
      transacao.set(ref, { ...dados, jogadas: 0, autor_uid: perfil.uid, criado_em: serverTimestamp() });
      return true;
    });
    if (criado) return slug;
  }
  throw new Error('Não foi possível criar um endereço único para o jogo.');
}

function escolha(nome, valor, marcado, nomeIcone, titulo, descricao) {
  return el('label', { class: 'escolha' },
    el('input', { type: 'radio', name: nome, value: valor, checked: marcado }),
    el('strong', {}, icone(nomeIcone), titulo),
    el('small', {}, descricao),
  );
}

function formulario({ perfil, jogo, indice, todosJogos, categoriasUsadas }) {
  const editar = Boolean(jogo);
  const aviso = el('div');

  // --- Informação base
  const titulo = el('input', { name: 'titulo', maxlength: '80', required: true, value: jogo?.titulo || '', placeholder: 'Ex.: Corrida em Lisboa' });
  const listaCategorias = el('datalist', { id: 'lista-categorias' },
    [...new Set([...CATEGORIAS, ...categoriasUsadas])].map((c) => el('option', { value: c })));
  const categoria = el('input', {
    name: 'categoria', list: 'lista-categorias', maxlength: '40', required: true,
    value: jogo?.categoria || '', placeholder: 'Escolhe da lista ou escreve outra',
  });
  const descricao = el('textarea', { name: 'descricao', rows: '5', maxlength: '5000', placeholder: 'Do que trata o jogo?' }, jogo?.descricao || '');
  const instrucoes = el('textarea', { name: 'instrucoes', rows: '3', maxlength: '2000', placeholder: 'Ex.: setas para mover, espaço para saltar.' }, jogo?.instrucoes || '');

  // --- Capa (arrastar e largar)
  let capaImagem = jogo?.capa_imagem || null;
  let capaRepositorio = jogo?.capa || null;
  const ficheiroCapa = el('input', { type: 'file', accept: 'image/*', class: 'oculto', tabindex: '-1' });
  const zonaCapa = el('div', { class: 'zona-capa', role: 'button', tabindex: '0', 'aria-label': 'Escolher imagem de capa' });
  const desenharCapa = (estado) => {
    const url = capaImagem || (capaRepositorio ? urlCapa({ capa: capaRepositorio }) : null);
    preencher(zonaCapa,
      url ? el('img', { src: url, alt: 'Capa do jogo' }) : null,
      url
        ? el('button', {
            type: 'button',
            class: 'botao pequeno secundario remover-capa',
            onclick: (e) => {
              e.stopPropagation();
              capaImagem = null;
              capaRepositorio = null;
              desenharCapa();
            },
          }, icone('lixo'), 'Remover')
        : [icone('imagem'), el('strong', {}, estado || 'Arrasta uma imagem para aqui'), el('span', {}, 'ou clica para escolher · 16:9 recomendado')],
    );
  };
  const usarFicheiroCapa = async (ficheiro) => {
    if (!ficheiro) return;
    desenharCapa('A preparar a imagem…');
    try {
      capaImagem = await prepararCapa(ficheiro);
    } catch (e) {
      preencher(aviso, mensagem('erro-form', e.message));
    }
    desenharCapa();
  };
  zonaCapa.addEventListener('click', () => ficheiroCapa.click());
  zonaCapa.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      ficheiroCapa.click();
    }
  });
  ficheiroCapa.addEventListener('change', () => usarFicheiroCapa(ficheiroCapa.files[0]));
  zonaCapa.addEventListener('dragover', (e) => {
    e.preventDefault();
    zonaCapa.classList.add('a-arrastar');
  });
  zonaCapa.addEventListener('dragleave', () => zonaCapa.classList.remove('a-arrastar'));
  zonaCapa.addEventListener('drop', (e) => {
    e.preventDefault();
    zonaCapa.classList.remove('a-arrastar');
    usarFicheiroCapa(e.dataTransfer.files[0]);
  });
  desenharCapa();

  // --- Como se joga
  const tipoAtual = jogo?.tipo || 'repositorio';
  const escolhasTipo = el('div', { class: 'escolhas' },
    escolha('tipo', 'repositorio', tipoAtual === 'repositorio', 'browser', 'No browser (repositório)', 'Jogo HTML5 na pasta jogos/ do GitHub.'),
    escolha('tipo', 'ligacao', tipoAtual === 'ligacao', 'externo', 'No browser (ligação)', 'Jogo alojado noutro site, ex.: itch.io.'),
    escolha('tipo', 'nenhum', tipoAtual === 'nenhum', 'transferir', 'Só transferência', 'Jogo para instalar (.exe, .zip…).'),
  );
  const tipoEscolhido = () => escolhasTipo.querySelector('input:checked').value;

  const usados = new Map(todosJogos.filter((j) => j.tipo === 'repositorio' && j.id !== jogo?.id).map((j) => [j.caminho, j.titulo]));
  const pasta = el('select', { name: 'caminho' },
    el('option', { value: '' }, indice.jogos.length ? '— Escolhe o jogo —' : '— Ainda não há jogos na pasta jogos/ —'),
    indice.jogos.map((j) => el('option', {
      value: j.caminho,
      selected: j.caminho === jogo?.caminho,
      disabled: usados.has(j.caminho),
    }, usados.has(j.caminho) ? `${j.origem} (já usado em «${usados.get(j.caminho)}»)` : j.origem)),
    jogo?.caminho && !indice.jogos.some((j) => j.caminho === jogo.caminho)
      ? el('option', { value: jogo.caminho, selected: true }, `${jogo.caminho} (não encontrado no repositório)`)
      : null,
  );
  pasta.addEventListener('change', () => {
    const escolhido = indice.jogos.find((j) => j.caminho === pasta.value);
    if (escolhido?.capa && !capaImagem && !capaRepositorio) {
      capaRepositorio = escolhido.capa;
      desenharCapa();
    }
  });
  const url = el('input', { type: 'url', name: 'url_externo', placeholder: 'https://…', value: jogo?.url_externo || '' });

  const campoRepositorio = el('div', { class: 'campo' },
    el('label', { class: 'campo' }, el('span', {}, 'Jogo no repositório'), pasta),
    el('p', { class: 'ajuda' },
      'Exporta o jogo para HTML5/Web e coloca a pasta (ou o .zip) em ',
      el('a', { href: `${REPOSITORIO}/tree/HEAD/jogos`, target: '_blank', rel: 'noopener' }, 'jogos/ no GitHub'),
      ' («Add file» → «Upload files» e arrasta). Em 1 a 2 minutos aparece nesta lista (recarrega a página).'),
    indice.avisos.length ? mensagem('aviso', el('div', {}, el('strong', {}, 'Avisos do repositório:'), el('ul', {}, indice.avisos.map((a) => el('li', {}, a))))) : null,
  );
  const campoLigacao = el('div', { class: 'campo' },
    el('label', { class: 'campo' }, el('span', {}, 'Endereço do jogo'), url),
    el('p', { class: 'ajuda' }, 'No itch.io, usa o endereço de incorporação («Embed game»). Alguns sites não deixam ser incorporados.'),
  );
  const atualizarTipo = () => {
    campoRepositorio.hidden = tipoEscolhido() !== 'repositorio';
    campoLigacao.hidden = tipoEscolhido() !== 'ligacao';
  };
  escolhasTipo.addEventListener('change', atualizarTipo);
  atualizarTipo();

  // --- Transferências (.exe, etc.)
  const listaTransferencias = el('div', { class: 'lista-transferencias' });
  const botaoAdicionar = el('button', { type: 'button', class: 'botao secundario pequeno', onclick: () => adicionarTransferencia() }, icone('mais'), 'Adicionar transferência');
  const atualizarBotaoAdicionar = () => {
    botaoAdicionar.hidden = listaTransferencias.children.length >= MAX_TRANSFERENCIAS;
  };
  function adicionarTransferencia(t = { rotulo: 'Windows (.exe)', url: '' }) {
    const linha = el('div', { class: 'linha-transferencia' },
      el('input', { class: 'rotulo', maxlength: '60', value: t.rotulo, placeholder: 'Ex.: Windows (.exe)', 'aria-label': 'Nome da transferência' }),
      el('input', { class: 'url', type: 'url', value: t.url, placeholder: 'https://… (ligação de transferência)', 'aria-label': 'Ligação de transferência' }),
      el('button', {
        type: 'button', class: 'botao pequeno perigo', 'aria-label': 'Remover transferência',
        onclick: () => {
          linha.remove();
          atualizarBotaoAdicionar();
        },
      }, icone('lixo')),
    );
    listaTransferencias.append(linha);
    atualizarBotaoAdicionar();
  }
  (jogo?.transferencias || []).forEach(adicionarTransferencia);

  const publicado = el('input', { type: 'checkbox', name: 'publicado', checked: jogo ? jogo.publicado : true });
  const botao = el('button', { class: 'botao grande', type: 'submit' }, editar ? 'Guardar alterações' : 'Publicar jogo');

  const guardar = async (evento) => {
    evento.preventDefault();
    preencher(aviso);
    const erro = (texto) => {
      preencher(aviso, mensagem('erro-form', texto));
      aviso.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
    const tipo = tipoEscolhido();
    const urlValido = tipo === 'ligacao' ? validarUrl(url.value.trim()) : null;
    const transferencias = [];
    for (const linha of listaTransferencias.children) {
      const rotulo = linha.querySelector('.rotulo').value.trim();
      const endereco = linha.querySelector('.url').value.trim();
      if (!rotulo && !endereco) continue;
      if (!validarUrl(endereco)) return erro(`A ligação de transferência «${rotulo || endereco}» não é válida (tem de começar por https://).`);
      transferencias.push({ rotulo: rotulo || 'Transferir', url: validarUrl(endereco) });
    }
    if (!titulo.value.trim()) return erro('O jogo precisa de um título.');
    if (!categoria.value.trim()) return erro('Escolhe ou escreve uma categoria.');
    if (tipo === 'repositorio' && !pasta.value) return erro('Escolhe o jogo do repositório.');
    if (tipo === 'ligacao' && !urlValido) return erro('Indica um endereço válido, começado por https://');
    if (tipo === 'nenhum' && !transferencias.length) return erro('Adiciona pelo menos uma ligação de transferência.');

    const dados = {
      titulo: titulo.value.trim(),
      categoria: categoria.value.trim().replace(/\s+/g, ' '),
      descricao: descricao.value.replace(/\r\n/g, '\n').trim(),
      instrucoes: instrucoes.value.replace(/\r\n/g, '\n').trim(),
      tipo,
      caminho: tipo === 'repositorio' ? pasta.value : null,
      url_externo: urlValido,
      capa: capaImagem ? null : capaRepositorio,
      capa_imagem: capaImagem,
      transferencias,
      publicado: publicado.checked,
      atualizado_em: serverTimestamp(),
    };
    botao.disabled = true;
    botao.textContent = 'A guardar…';
    try {
      if (editar) {
        await updateDoc(doc(bd, 'jogos', jogo.id), dados);
        location.href = `/jogo/${jogo.id}`;
      } else {
        const slug = await criarJogo(perfil, dados);
        location.href = `/jogo/${slug}`;
      }
    } catch (e) {
      erro(traduzirErro(e));
      botao.disabled = false;
      botao.textContent = editar ? 'Guardar alterações' : 'Publicar jogo';
    }
  };

  return el('section', { class: 'largo formulario' },
    el('a', { class: 'voltar', href: editar ? `/jogo/${jogo.id}` : '/painel' }, icone('seta'), 'Voltar'),
    el('h1', {}, editar ? `Editar «${jogo.titulo}»` : 'Publicar novo jogo'),
    el('form', { class: 'cartao-form formulario', onsubmit: guardar },
      aviso,
      el('label', {}, el('span', {}, 'Título'), titulo),
      el('label', {}, el('span', {}, 'Categoria'), categoria, listaCategorias,
        el('small', { class: 'ajuda' }, 'Escolhe uma sugestão ou escreve o estilo que quiseres (ex.: «Roguelike», «Visual novel»).')),
      el('div', { class: 'campo' }, el('span', {}, 'Imagem de capa ', el('span', { class: 'opcional' }, '(opcional)')), zonaCapa, ficheiroCapa),
      el('label', {}, el('span', {}, 'Descrição'), descricao),
      el('label', {}, el('span', {}, 'Como jogar ', el('span', { class: 'opcional' }, '(opcional)')), instrucoes),

      el('div', { class: 'seccao-form' },
        el('h2', {}, 'Como se joga?'),
        escolhasTipo,
        campoRepositorio,
        campoLigacao,
      ),

      el('div', { class: 'seccao-form' },
        el('h2', {}, 'Transferências ', el('span', { class: 'opcional' }, '(opcional — .exe, .zip, .apk…)')),
        el('p', { class: 'ajuda' },
          'Para carregar um .exe: abre os ',
          el('a', { href: `${REPOSITORIO}/releases/new`, target: '_blank', rel: 'noopener' }, 'Releases do GitHub'),
          ', arrasta o ficheiro, publica e cola aqui a ligação do ficheiro (botão direito → «Copiar endereço da ligação»). ',
          'Também podes usar ligações do Google Drive, itch.io, MEGA, etc.'),
        listaTransferencias,
        el('div', {}, botaoAdicionar),
      ),

      el('div', { class: 'seccao-form' },
        el('label', { class: 'opcao' }, publicado, el('span', {}, el('strong', {}, 'Visível para todos'), el('br'), el('small', { class: 'ajuda' }, 'Desmarca para guardar como rascunho.'))),
        botao,
      ),
    ),
  );
}

try {
  const perfil = await exigirPerfil(conteudo);
  if (perfil) {
    const [indice, resultado] = await Promise.all([lerIndiceRepositorio(), getDocs(collection(bd, 'jogos'))]);
    const todosJogos = resultado.docs.map((d) => ({ id: d.id, ...d.data() }));
    const categoriasUsadas = [...new Set(todosJogos.map((j) => j.categoria))];
    let jogo = null;
    if (id) {
      const documento = await getDoc(doc(bd, 'jogos', id));
      const dados = documento.exists() ? documento.data() : null;
      const permitido = dados && ((dados.autor_uid === perfil.uid && pode(perfil, 'publicar')) || pode(perfil, 'editar_todos'));
      if (permitido) jogo = { id: documento.id, ...dados };
    }
    if (id && !jogo) {
      definirTitulo('Jogo não encontrado');
      preencher(conteudo, paginaErro(404, 'Este jogo não existe ou não tens permissão para o editar.'));
    } else if (!id && !pode(perfil, 'publicar')) {
      definirTitulo('Sem permissão');
      preencher(conteudo, paginaErro(403, 'A tua conta não tem permissão para publicar jogos.'));
    } else {
      definirTitulo(jogo ? `Editar ${jogo.titulo}` : 'Publicar novo jogo');
      preencher(conteudo, formulario({ perfil, jogo, indice, todosJogos, categoriasUsadas }));
    }
  }
} catch (erro) {
  preencher(conteudo, mensagem('erro-form', traduzirErro(erro)));
}
