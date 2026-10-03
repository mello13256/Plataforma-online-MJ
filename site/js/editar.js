import {
  Bytes, bd, collection, deleteDoc, doc, getDoc, getDocs, runTransaction, serverTimestamp, setDoc, updateDoc,
} from './firebase.js';
import {
  CATEGORIAS, REPOSITORIO, apagarPacote, capa, criarSlug, definirTitulo, el, exigirPerfil, formatarTamanho, icone,
  mensagem, paginaErro, pacotesDoJogo, pode, preencher, prepararServiceWorker, selos, traduzirErro, urlCapa, urlJogo,
} from './comum.js';

/* global fflate */

const conteudo = document.getElementById('conteudo');
const id = new URLSearchParams(location.search).get('id');
const MAX_TRANSFERENCIAS = 5;
const LIMITE_CAPA = 550_000; // caracteres do data URL (cabe no documento do Firestore)
const LIMITE_FICHEIRO = 50 * 1024 * 1024;
const TAMANHO_PARTE = 900_000;
const EXTENSOES_JOGO = /\.(zip|html?)$/i;
const NOMES_CAPA = [/(^|\/)(capa|cover)\.(png|jpe?g|webp|gif)$/i, /(^|\/)(thumbnail|thumb|splash|banner)\.(png|jpe?g|webp)$/i, /(^|\/)index\.png$/i, /(^|\/)(icon|logo)\.(png|jpe?g|webp)$/i];

// ------------------------------------------------------------- Utilitários

function validarUrl(texto) {
  try {
    const url = new URL(texto);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function gerarId(prefixo = '') {
  const letras = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return prefixo + Array.from(crypto.getRandomValues(new Uint32Array(20)), (n) => letras[n % letras.length]).join('');
}

function tituloDoNome(nome) {
  const base = nome.replace(/\.[^.]+$/, '').replace(/[-_.]+/g, ' ').replace(/\s+/g, ' ').trim();
  return base ? base[0].toUpperCase() + base.slice(1) : '';
}

function nomeSeguro(nome) {
  return nome.replace(/[/\\?#%:*"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 120) || 'ficheiro';
}

function rotuloDoFicheiro(nome) {
  const extensao = nome.split('.').pop().toLowerCase();
  return {
    exe: 'Windows (.exe)', msi: 'Windows (.msi)', apk: 'Android (.apk)', dmg: 'macOS (.dmg)',
    appimage: 'Linux (.AppImage)', deb: 'Linux (.deb)', zip: 'Transferir (.zip)', rar: 'Transferir (.rar)', '7z': 'Transferir (.7z)',
  }[extensao] || `Transferir (.${extensao})`;
}

// Reduz a imagem para no máximo 1280×720 e converte para WebP (ou JPEG), abaixo do limite.
async function prepararCapa(ficheiro, limite = LIMITE_CAPA) {
  if (!ficheiro.type.startsWith('image/')) throw new Error('A capa tem de ser uma imagem (PNG, JPG, WEBP ou GIF).');
  const imagem = await createImageBitmap(ficheiro);
  let largura = Math.min(1280, imagem.width);
  for (let tentativa = 0; tentativa < 6; tentativa++) {
    const escala = Math.min(largura / imagem.width, (largura * 9) / 16 / imagem.height, 1);
    const tela = document.createElement('canvas');
    tela.width = Math.max(1, Math.round(imagem.width * escala));
    tela.height = Math.max(1, Math.round(imagem.height * escala));
    tela.getContext('2d').drawImage(imagem, 0, 0, tela.width, tela.height);
    for (const qualidade of [0.85, 0.7, 0.55]) {
      let dados = tela.toDataURL('image/webp', qualidade);
      if (!dados.startsWith('data:image/webp')) dados = tela.toDataURL('image/jpeg', qualidade);
      if (dados.length <= limite) return dados;
    }
    largura = Math.round(largura * 0.75);
  }
  throw new Error('Não foi possível reduzir a imagem. Experimenta outra.');
}

// Lê os ficheiros largados (incluindo pastas inteiras).
async function lerLargados(dataTransfer) {
  const entradas = [...dataTransfer.items].map((item) => item.webkitGetAsEntry?.()).filter(Boolean);
  if (!entradas.length) return [...dataTransfer.files].map((ficheiro) => ({ caminho: ficheiro.name, ficheiro }));
  const resultado = [];
  const lerPasta = (pasta) => new Promise((resolver, rejeitar) => {
    const leitor = pasta.createReader();
    const todas = [];
    const ler = () => leitor.readEntries((lote) => {
      if (!lote.length) resolver(todas);
      else {
        todas.push(...lote);
        ler();
      }
    }, rejeitar);
    ler();
  });
  const percorrer = async (entrada, prefixo) => {
    if (entrada.isFile) {
      const ficheiro = await new Promise((resolver, rejeitar) => entrada.file(resolver, rejeitar));
      resultado.push({ caminho: prefixo + entrada.name, ficheiro });
    } else if (entrada.isDirectory) {
      for (const filha of await lerPasta(entrada)) await percorrer(filha, `${prefixo}${entrada.name}/`);
    }
  };
  for (const entrada of entradas) await percorrer(entrada, '');
  return resultado;
}

function encontrarEntrada(caminhos) {
  const profundidade = (c) => c.split('/').length;
  const htmls = caminhos.filter((c) => /\.html?$/i.test(c) && !c.startsWith('__MACOSX/'));
  const indices = htmls.filter((c) => /(^|\/)index\.html?$/i.test(c)).sort((a, b) => profundidade(a) - profundidade(b));
  return indices[0] || (htmls.length === 1 ? htmls[0] : null);
}

function encontrarCapa(ficheiros) {
  for (const padrao of NOMES_CAPA) {
    const caminho = Object.keys(ficheiros).filter((c) => padrao.test(c)).sort((a, b) => a.length - b.length)[0];
    if (caminho) return new Blob([ficheiros[caminho]], { type: `image/${caminho.split('.').pop().toLowerCase().replace('jpg', 'jpeg')}` });
  }
  return null;
}

// Converte o que foi escolhido num jogo pronto a carregar: { nome, bytes (zip), ficheiros, entrada }.
async function prepararJogo(itens) {
  const total = itens.reduce((soma, i) => soma + i.ficheiro.size, 0);
  if (itens.length === 1 && /\.zip$/i.test(itens[0].caminho)) {
    const bytes = new Uint8Array(await itens[0].ficheiro.arrayBuffer());
    if (bytes.length > LIMITE_FICHEIRO) throw new Error(`O ficheiro tem ${formatarTamanho(bytes.length)}; o máximo é ${formatarTamanho(LIMITE_FICHEIRO)}.`);
    let ficheiros;
    try {
      ficheiros = fflate.unzipSync(bytes);
    } catch {
      throw new Error('O ficheiro .zip está danificado ou não é válido.');
    }
    const entrada = encontrarEntrada(Object.keys(ficheiros));
    if (!entrada) throw new Error('Não encontrei nenhum index.html dentro do .zip. Exporta o jogo para HTML5/Web.');
    return { nome: itens[0].ficheiro.name, bytes, ficheiros, entrada };
  }
  if (total > LIMITE_FICHEIRO * 2) throw new Error('O jogo é demasiado grande para carregar no site. Usa a pasta jogos/ do GitHub.');
  // Pasta ou .html solto: juntar num .zip.
  const raiz = itens.length > 1 && itens.every((i) => i.caminho.split('/')[0] === itens[0].caminho.split('/')[0] && i.caminho.includes('/'))
    ? `${itens[0].caminho.split('/')[0]}/` : '';
  const ficheiros = {};
  for (const item of itens) {
    const caminho = item.caminho.slice(raiz.length);
    if (caminho.split('/').some((p) => p === '__MACOSX' || p === '.DS_Store' || p === 'Thumbs.db')) continue;
    ficheiros[caminho] = new Uint8Array(await item.ficheiro.arrayBuffer());
  }
  if (itens.length === 1 && /\.html?$/i.test(itens[0].caminho) && itens[0].caminho !== 'index.html') {
    ficheiros['index.html'] = ficheiros[itens[0].caminho];
    delete ficheiros[itens[0].caminho];
  }
  const entrada = encontrarEntrada(Object.keys(ficheiros));
  if (!entrada) throw new Error('Não encontrei nenhum index.html. Arrasta a pasta exportada para HTML5/Web, um .zip ou um .html.');
  const bytes = fflate.zipSync(ficheiros, { level: 6 });
  if (bytes.length > LIMITE_FICHEIRO) throw new Error(`Depois de comprimido, o jogo tem ${formatarTamanho(bytes.length)}; o máximo é ${formatarTamanho(LIMITE_FICHEIRO)}.`);
  return { nome: raiz ? `${raiz.slice(0, -1)}.zip` : itens[0].ficheiro.name, bytes, ficheiros, entrada };
}

// Envia os bytes para o Firestore em partes de ~900 KB. Devolve o ID do pacote.
async function carregarPacote(uid, bytes, nome, aoProgresso) {
  const idPacote = gerarId('p');
  const partes = Math.max(1, Math.ceil(bytes.length / TAMANHO_PARTE));
  await setDoc(doc(bd, 'pacotes', idPacote), { dono: uid, partes, tamanho: bytes.length, nome: nomeSeguro(nome), criado_em: serverTimestamp() });
  let enviados = 0;
  const indices = [...Array(partes).keys()];
  const enviar = async () => {
    while (indices.length) {
      const i = indices.shift();
      const fatia = bytes.subarray(i * TAMANHO_PARTE, (i + 1) * TAMANHO_PARTE);
      await setDoc(doc(bd, 'pacotes', idPacote, 'partes', String(i).padStart(3, '0')), { dados: Bytes.fromUint8Array(fatia) });
      enviados += fatia.length;
      aoProgresso(fatia.length);
    }
  };
  try {
    await Promise.all([enviar(), enviar(), enviar()]);
  } catch (erro) {
    await apagarPacote(idPacote).catch(() => {});
    throw erro;
  }
  return idPacote;
}

async function criarDocumentoJogo(perfil, dados) {
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

// Janela para testar o jogo antes de publicar.
function abrirTeste(url, titulo) {
  const janela = el('dialog', { class: 'janela-teste' },
    el('div', { class: 'janela-topo' },
      el('strong', {}, `A testar: ${titulo || 'jogo'}`),
      el('div', { class: 'acoes' },
        el('button', { type: 'button', class: 'botao pequeno secundario', onclick: () => janela.querySelector('.leitor').requestFullscreen?.() }, icone('ecra'), 'Ecrã inteiro'),
        el('button', { type: 'button', class: 'botao pequeno', onclick: () => janela.close() }, 'Fechar'),
      ),
    ),
    el('div', { class: 'leitor' }, el('iframe', { src: url, title: 'Teste do jogo', allow: 'fullscreen; autoplay; gamepad', allowfullscreen: true })),
  );
  janela.addEventListener('close', () => janela.remove());
  document.body.append(janela);
  janela.showModal();
}

// ------------------------------------------------------------- Formulário

function formulario({ perfil, jogo, indice, todosJogos, categoriasUsadas, pacoteAtual, imagensAtuais }) {
  const editar = Boolean(jogo);
  const aviso = el('div');
  const erro = (texto) => {
    preencher(aviso, mensagem('erro-form', texto));
    aviso.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // Estado
  const estado = {
    modo: jogo ? (jogo.tipo === 'nenhum' ? 'transferir' : 'browser') : 'browser',
    origem: jogo ? (['ligacao', 'repositorio'].includes(jogo.tipo) ? jogo.tipo : 'pacote') : 'pacote',
    jogoLocal: null, // { nome, bytes, ficheiros, entrada }
    pacoteAtual: jogo?.tipo === 'pacote' ? { ...jogo.pacote, ...pacoteAtual } : null,
    capaImagem: jogo?.capa_imagem || null,
    capaRepositorio: jogo?.capa || null,
    capaAutomatica: false,
  };

  // --- Campos de texto
  const titulo = el('input', { name: 'titulo', maxlength: '80', required: true, value: jogo?.titulo || '', placeholder: 'Ex.: Corrida em Lisboa' });
  const listaCategorias = el('datalist', { id: 'lista-categorias' },
    [...new Set([...CATEGORIAS, ...categoriasUsadas])].map((c) => el('option', { value: c })));
  const categoria = el('input', { name: 'categoria', list: 'lista-categorias', maxlength: '40', required: true, value: jogo?.categoria || '', placeholder: 'Escolhe ou escreve' });
  const sugestoes = el('div', { class: 'categorias' },
    [...new Set([...CATEGORIAS.slice(0, 10), ...categoriasUsadas])].slice(0, 14).map((c) => el('button', {
      type: 'button',
      class: 'etiqueta',
      onclick: () => {
        categoria.value = c;
        atualizarPrevia();
      },
    }, c)));
  const descricao = el('textarea', { name: 'descricao', rows: '5', maxlength: '5000', placeholder: 'Do que trata o jogo? O que o torna divertido?' }, jogo?.descricao || '');
  const instrucoes = el('textarea', { name: 'instrucoes', rows: '3', maxlength: '2000', placeholder: 'Ex.: setas para mover, espaço para saltar.' }, jogo?.instrucoes || '');
  const publicado = el('input', { type: 'checkbox', name: 'publicado', checked: jogo ? jogo.publicado : true });

  // --- Pré-visualização (coluna da direita)
  const previa = el('div');
  const verificacao = el('ul', { class: 'lista-verificacao' });
  function atualizarPrevia() {
    const falso = {
      id: 'previa',
      titulo: titulo.value.trim() || 'Título do jogo',
      categoria: categoria.value.trim() || 'Categoria',
      capa_imagem: estado.capaImagem,
      capa: estado.capaImagem ? null : estado.capaRepositorio,
      tipo: estado.modo === 'transferir' ? 'nenhum' : estado.origem,
      transferencias: transferencias.length ? [{}] : [],
    };
    preencher(previa, el('article', { class: 'cartao' },
      el('div', { class: 'cartao-imagem' }, capa(falso), selos(falso)),
      el('div', { class: 'cartao-corpo' }, el('h3', {}, falso.titulo), el('p', { class: 'meta' }, `${falso.categoria} · ${perfil.nome}`)),
    ));
    const temJogo = estado.modo === 'transferir'
      ? transferencias.some((t) => t.ficheiro || validarUrl(t.url?.value || ''))
      : estado.origem === 'pacote' ? Boolean(estado.jogoLocal || estado.pacoteAtual)
        : estado.origem === 'ligacao' ? Boolean(validarUrl(url.value.trim())) : Boolean(pasta.value);
    const itens = [
      [temJogo, estado.modo === 'transferir' ? 'Ficheiro para transferir' : 'Jogo carregado'],
      [Boolean(titulo.value.trim()), 'Título'],
      [Boolean(categoria.value.trim()), 'Categoria'],
      [Boolean(estado.capaImagem || estado.capaRepositorio), 'Capa (opcional)'],
      [Boolean(descricao.value.trim()), 'Descrição (opcional)'],
    ];
    preencher(verificacao, itens.map(([feito, texto]) => el('li', { class: feito ? 'feito' : '' }, icone(feito ? 'certo' : 'alerta'), texto)));
  }
  [titulo, categoria, descricao].forEach((campo) => campo.addEventListener('input', atualizarPrevia));

  // --- Capa
  const ficheiroCapa = el('input', { type: 'file', accept: 'image/*', class: 'oculto', tabindex: '-1' });
  const zonaCapa = el('div', { class: 'zona-capa', role: 'button', tabindex: '0', 'aria-label': 'Escolher imagem de capa' });
  function desenharCapa(texto) {
    const urlImagem = estado.capaImagem || (estado.capaRepositorio ? urlCapa({ capa: estado.capaRepositorio }) : null);
    preencher(zonaCapa,
      urlImagem ? el('img', { src: urlImagem, alt: 'Capa do jogo' }) : null,
      urlImagem
        ? el('div', { class: 'capa-acoes' },
            estado.capaAutomatica ? el('span', { class: 'selo' }, 'Capa encontrada no jogo') : null,
            el('button', {
              type: 'button',
              class: 'botao pequeno secundario',
              onclick: (e) => {
                e.stopPropagation();
                estado.capaImagem = null;
                estado.capaRepositorio = null;
                estado.capaAutomatica = false;
                desenharCapa();
                atualizarPrevia();
              },
            }, icone('lixo'), 'Remover'))
        : [icone('imagem'), el('strong', {}, texto || 'Arrasta uma imagem para aqui'), el('span', {}, 'ou clica para escolher · 16:9 fica melhor')],
    );
  }
  async function usarImagemCapa(ficheiro, automatica = false) {
    if (!ficheiro) return;
    desenharCapa('A preparar a imagem…');
    try {
      estado.capaImagem = await prepararCapa(ficheiro);
      estado.capaAutomatica = automatica;
    } catch (e) {
      if (!automatica) erro(e.message);
    }
    desenharCapa();
    atualizarPrevia();
  }
  zonaCapa.addEventListener('click', () => ficheiroCapa.click());
  zonaCapa.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      ficheiroCapa.click();
    }
  });
  ficheiroCapa.addEventListener('change', () => usarImagemCapa(ficheiroCapa.files[0]));
  ativarArrastar(zonaCapa, async (dt) => usarImagemCapa(dt.files[0]));
  desenharCapa();

  // --- Galeria (até 4 imagens)
  const imagens = [...imagensAtuais];
  const grelhaImagens = el('div', { class: 'galeria editar' });
  const ficheiroImagens = el('input', { type: 'file', accept: 'image/*', multiple: true, class: 'oculto', tabindex: '-1' });
  function desenharGaleria() {
    preencher(grelhaImagens,
      imagens.map((src, i) => el('div', { class: 'miniatura-galeria' },
        el('img', { src, alt: `Imagem ${i + 1}` }),
        el('button', {
          type: 'button', class: 'botao pequeno secundario remover-imagem', 'aria-label': 'Remover imagem',
          onclick: () => { imagens.splice(i, 1); desenharGaleria(); },
        }, icone('lixo')))),
      imagens.length < 4
        ? el('button', { type: 'button', class: 'miniatura-galeria adicionar-imagem', onclick: () => ficheiroImagens.click() },
            icone('mais'), el('span', {}, 'Adicionar'))
        : null,
    );
  }
  async function adicionarImagens(lista) {
    for (const ficheiro of [...lista].filter((f) => f.type.startsWith('image/'))) {
      if (imagens.length >= 4) {
        erro('A galeria tem no máximo 4 imagens.');
        break;
      }
      try {
        imagens.push(await prepararCapa(ficheiro, 290_000));
      } catch (e) {
        erro(e.message);
      }
      desenharGaleria();
    }
  }
  ficheiroImagens.addEventListener('change', () => {
    adicionarImagens(ficheiroImagens.files);
    ficheiroImagens.value = '';
  });
  ativarArrastar(grelhaImagens, (dt) => adicionarImagens(dt.files));
  desenharGaleria();

  // --- Transferências
  const transferencias = []; // { rotulo: input, url?: input, ficheiro?: File, linha }
  const listaTransferencias = el('div', { class: 'lista-transferencias' });
  const zonaTransferencias = el('div', { class: 'zona-pequena', role: 'button', tabindex: '0' },
    icone('transferir'), el('span', {}, el('strong', {}, 'Arrasta ficheiros para transferir'), ' (.exe, .apk, .zip…) ou clica para escolher'));
  const ficheiroTransferencia = el('input', { type: 'file', multiple: true, class: 'oculto', tabindex: '-1' });
  zonaTransferencias.addEventListener('click', () => ficheiroTransferencia.click());
  ficheiroTransferencia.addEventListener('change', () => {
    [...ficheiroTransferencia.files].forEach((f) => adicionarTransferencia({ ficheiro: f }));
    ficheiroTransferencia.value = '';
  });
  ativarArrastar(zonaTransferencias, async (dt) => [...dt.files].forEach((f) => adicionarTransferencia({ ficheiro: f })));
  const botaoLigacao = el('button', { type: 'button', class: 'ligacao', onclick: () => adicionarTransferencia({ url: '' }) }, '+ Adicionar uma ligação externa (Google Drive, itch.io, MEGA…)');

  function adicionarTransferencia({ rotulo, url: endereco, ficheiro }) {
    if (transferencias.length >= MAX_TRANSFERENCIAS) {
      erro(`Só podes ter ${MAX_TRANSFERENCIAS} transferências por jogo.`);
      return;
    }
    if (ficheiro && ficheiro.size > LIMITE_FICHEIRO) {
      erro(`«${ficheiro.name}» tem ${formatarTamanho(ficheiro.size)}. O máximo é ${formatarTamanho(LIMITE_FICHEIRO)}; para ficheiros maiores usa os Releases do GitHub e adiciona a ligação.`);
      return;
    }
    const carregado = endereco?.startsWith('/transferir/');
    const item = {
      rotulo: el('input', { maxlength: '60', value: rotulo || (ficheiro ? rotuloDoFicheiro(ficheiro.name) : 'Windows (.exe)'), 'aria-label': 'Nome do botão de transferência', oninput: atualizarPrevia }),
      ficheiro,
      urlExistente: carregado ? endereco : null,
      url: ficheiro || carregado ? null : el('input', { type: 'url', value: endereco || '', placeholder: 'https://…', 'aria-label': 'Ligação de transferência', oninput: atualizarPrevia }),
    };
    item.linha = el('div', { class: 'linha-transferencia' },
      item.rotulo,
      item.url || el('span', { class: 'ficheiro-anexo' }, icone('transferir'),
        ficheiro ? `${ficheiro.name} · ${formatarTamanho(ficheiro.size)}` : decodeURIComponent(endereco.split('/').pop())),
      el('button', {
        type: 'button', class: 'botao pequeno perigo', 'aria-label': 'Remover transferência',
        onclick: () => {
          transferencias.splice(transferencias.indexOf(item), 1);
          item.linha.remove();
          atualizarPrevia();
        },
      }, icone('lixo')),
    );
    transferencias.push(item);
    listaTransferencias.append(item.linha);
    atualizarPrevia();
  }

  // --- O jogo (zona principal)
  const zonaJogo = el('div', { class: 'zona-jogo', role: 'button', tabindex: '0' });
  const ficheiroJogo = el('input', { type: 'file', accept: '.zip,.html,.htm', class: 'oculto', tabindex: '-1' });
  const pastaJogo = el('input', { type: 'file', class: 'oculto', tabindex: '-1', webkitdirectory: true });

  async function receberItens(itens) {
    if (!itens.length) return;
    preencher(aviso);
    // Ficheiros que não são jogos de browser (.exe, .apk…) vão para as transferências.
    const ejogo = itens.length > 1 || EXTENSOES_JOGO.test(itens[0].caminho);
    if (!ejogo) {
      itens.forEach((i) => adicionarTransferencia({ ficheiro: i.ficheiro }));
      if (estado.modo === 'browser' && estado.origem === 'pacote' && !estado.jogoLocal && !estado.pacoteAtual) mudarModo('transferir');
      if (!titulo.value.trim()) titulo.value = tituloDoNome(itens[0].ficheiro.name);
      atualizarPrevia();
      return;
    }
    preencher(zonaJogo, el('div', { class: 'carregando' }, 'A preparar o jogo…'));
    try {
      estado.jogoLocal = await prepararJogo(itens);
      mudarModo('browser');
      estado.origem = 'pacote';
      if (!titulo.value.trim()) titulo.value = tituloDoNome(estado.jogoLocal.nome);
      if (!estado.capaImagem && !estado.capaRepositorio) {
        const imagem = encontrarCapa(estado.jogoLocal.ficheiros);
        if (imagem) usarImagemCapa(imagem, true);
      }
    } catch (e) {
      erro(e.message);
    }
    desenharZonaJogo();
    atualizarPrevia();
  }

  async function testarLocal() {
    try {
      const registo = await prepararServiceWorker();
      const idPrevia = gerarId('previa-');
      await new Promise((resolver) => {
        const canal = new MessageChannel();
        canal.port1.onmessage = resolver;
        registo.active.postMessage({ tipo: 'previa', id: idPrevia, ficheiros: estado.jogoLocal.ficheiros }, [canal.port2]);
      });
      abrirTeste(`/jogar/${idPrevia}/${estado.jogoLocal.entrada.split('/').map(encodeURIComponent).join('/')}`, titulo.value.trim());
    } catch (e) {
      erro(traduzirErro(e));
    }
  }

  async function testarAtual() {
    try {
      await prepararServiceWorker();
      abrirTeste(urlJogo({ tipo: 'pacote', pacote: estado.pacoteAtual }), titulo.value.trim());
    } catch (e) {
      erro(traduzirErro(e));
    }
  }

  function desenharZonaJogo() {
    const local = estado.jogoLocal;
    const atual = estado.pacoteAtual;
    if (local || atual) {
      const numero = local ? Object.keys(local.ficheiros).length : null;
      preencher(zonaJogo, el('div', { class: 'ficheiro-escolhido' },
        el('span', { class: 'icone-grande' }, icone('comando')),
        el('div', {},
          el('strong', {}, local ? local.nome : atual.nome || 'Jogo carregado'),
          el('small', {}, local
            ? `${formatarTamanho(local.bytes.length)} · ${numero} ficheiro${numero === 1 ? '' : 's'} · abre em ${local.entrada}`
            : `${atual.tamanho ? `${formatarTamanho(atual.tamanho)} · ` : ''}já publicado`),
        ),
        el('div', { class: 'acoes' },
          el('button', { type: 'button', class: 'botao verde', onclick: (e) => { e.stopPropagation(); (local ? testarLocal : testarAtual)(); } }, icone('jogar'), 'Testar'),
          el('button', { type: 'button', class: 'botao secundario', onclick: (e) => { e.stopPropagation(); ficheiroJogo.click(); } }, 'Trocar'),
        ),
      ));
      zonaJogo.classList.add('com-ficheiro');
    } else {
      zonaJogo.classList.remove('com-ficheiro');
      preencher(zonaJogo,
        el('span', { class: 'icone-grande' }, icone('transferir')),
        el('strong', { class: 'titulo-zona' }, 'Arrasta o teu jogo para aqui'),
        el('span', {}, 'A pasta exportada para Web, um .zip ou um .html — até 50 MB.'),
        el('span', { class: 'ajuda' }, 'Também podes largar aqui um .exe ou .apk para ficar disponível para transferir.'),
        el('div', { class: 'acoes', style: 'justify-content:center' },
          el('button', { type: 'button', class: 'botao', onclick: (e) => { e.stopPropagation(); ficheiroJogo.click(); } }, 'Escolher ficheiro'),
          el('button', { type: 'button', class: 'botao secundario', onclick: (e) => { e.stopPropagation(); pastaJogo.click(); } }, 'Escolher pasta'),
        ),
      );
    }
  }
  zonaJogo.addEventListener('click', () => { if (!estado.jogoLocal && !estado.pacoteAtual) ficheiroJogo.click(); });
  ficheiroJogo.addEventListener('change', () => {
    receberItens([...ficheiroJogo.files].map((f) => ({ caminho: f.name, ficheiro: f })));
    ficheiroJogo.value = '';
  });
  pastaJogo.addEventListener('change', () => {
    receberItens([...pastaJogo.files].map((f) => ({ caminho: f.webkitRelativePath || f.name, ficheiro: f })));
    pastaJogo.value = '';
  });
  ativarArrastar(zonaJogo, async (dt) => receberItens(await lerLargados(dt)));
  desenharZonaJogo();

  // --- Alternativas: ligação externa e pasta do GitHub
  const url = el('input', { type: 'url', name: 'url_externo', placeholder: 'https://itch.io/embed-upload/…', value: jogo?.url_externo || '', oninput: atualizarPrevia });
  const usados = new Map(todosJogos.filter((j) => j.tipo === 'repositorio' && j.id !== jogo?.id).map((j) => [j.caminho, j.titulo]));
  const pasta = el('select', { name: 'caminho', onchange: () => {
    const escolhido = indice.jogos.find((j) => j.caminho === pasta.value);
    if (escolhido?.capa && !estado.capaImagem && !estado.capaRepositorio) {
      estado.capaRepositorio = escolhido.capa;
      desenharCapa();
    }
    atualizarPrevia();
  } },
    el('option', { value: '' }, indice.jogos.length ? '— Escolhe o jogo —' : '— Ainda não há jogos na pasta jogos/ —'),
    indice.jogos.map((j) => el('option', { value: j.caminho, selected: j.caminho === jogo?.caminho, disabled: usados.has(j.caminho) },
      usados.has(j.caminho) ? `${j.origem} (já usado em «${usados.get(j.caminho)}»)` : j.origem)),
  );

  const origens = el('div', { class: 'segmentado pequeno', role: 'tablist', 'aria-label': 'Origem do jogo' });
  const paineisOrigem = {
    pacote: zonaJogo,
    ligacao: el('div', { class: 'campo' }, url,
      el('p', { class: 'ajuda' }, 'No itch.io, usa o endereço de incorporação («Embed game»). Alguns sites não deixam ser incorporados.')),
    repositorio: el('div', { class: 'campo' }, pasta,
      el('p', { class: 'ajuda' }, 'Para jogos grandes (mais de 50 MB): coloca a pasta em ',
        el('a', { href: `${REPOSITORIO}/tree/HEAD/jogos`, target: '_blank', rel: 'noopener' }, 'jogos/ no GitHub'),
        ' e recarrega esta página 1 a 2 minutos depois.')),
  };
  const nomesOrigem = { pacote: 'Carregar ficheiros', ligacao: 'Ligação externa', repositorio: 'Pasta do GitHub' };
  const zonaOrigem = el('div');
  function mudarOrigem(origem) {
    estado.origem = origem;
    for (const botao of origens.children) botao.setAttribute('aria-selected', String(botao.dataset.origem === origem));
    preencher(zonaOrigem, paineisOrigem[origem]);
    atualizarPrevia();
  }
  for (const [chave, nome] of Object.entries(nomesOrigem)) {
    origens.append(el('button', { type: 'button', role: 'tab', 'data-origem': chave, onclick: () => mudarOrigem(chave) }, nome));
  }

  // --- Modo: jogar no browser ou só transferir
  const modos = el('div', { class: 'segmentado', role: 'tablist', 'aria-label': 'Como se joga' },
    el('button', { type: 'button', role: 'tab', 'data-modo': 'browser', onclick: () => mudarModo('browser') }, icone('browser'), 'Jogar no browser'),
    el('button', { type: 'button', role: 'tab', 'data-modo': 'transferir', onclick: () => mudarModo('transferir') }, icone('transferir'), 'Só para transferir'),
  );
  const blocoBrowser = el('div', { class: 'formulario', style: 'gap:.75rem' }, origens, zonaOrigem);
  const etiquetaOpcional = el('span', { class: 'opcional' });
  function mudarModo(modo) {
    estado.modo = modo;
    etiquetaOpcional.textContent = modo === 'transferir' ? '(pelo menos uma)' : '(opcional)';
    for (const botao of modos.children) botao.setAttribute('aria-selected', String(botao.dataset.modo === modo));
    blocoBrowser.hidden = modo !== 'browser';
    atualizarPrevia();
  }

  // Estado inicial das transferências existentes
  for (const t of jogo?.transferencias || []) adicionarTransferencia({ rotulo: t.rotulo, url: t.url });

  // --- Progresso
  const barra = el('div', { class: 'progresso', hidden: true }, el('div', { class: 'progresso-barra' }), el('span', { class: 'progresso-texto' }));
  function progresso(feito, total, texto) {
    barra.hidden = false;
    barra.firstChild.style.width = `${total ? Math.round((feito / total) * 100) : 100}%`;
    barra.lastChild.textContent = texto;
  }

  const botao = el('button', { class: 'botao grande', type: 'submit' }, icone(editar ? 'certo' : 'mais'), editar ? 'Guardar alterações' : 'Publicar jogo');

  async function guardar(evento) {
    evento.preventDefault();
    preencher(aviso);
    const tipo = estado.modo === 'transferir' ? 'nenhum' : estado.origem;
    const urlValido = tipo === 'ligacao' ? validarUrl(url.value.trim()) : null;

    for (const t of transferencias) {
      if (t.url && t.url.value.trim() && !validarUrl(t.url.value.trim())) return erro(`A ligação «${t.url.value.trim()}» não é válida (tem de começar por https://).`);
    }
    const transferenciasValidas = transferencias.filter((t) => t.ficheiro || t.urlExistente || (t.url && t.url.value.trim()));
    if (!titulo.value.trim()) return erro('Falta o título do jogo.');
    if (!categoria.value.trim()) return erro('Escolhe ou escreve uma categoria.');
    if (tipo === 'pacote' && !estado.jogoLocal && !estado.pacoteAtual) return erro('Arrasta o jogo (pasta, .zip ou .html) para a zona «O jogo».');
    if (tipo === 'repositorio' && !pasta.value) return erro('Escolhe o jogo da pasta do GitHub.');
    if (tipo === 'ligacao' && !urlValido) return erro('Indica um endereço válido, começado por https://');
    if (tipo === 'nenhum' && !transferenciasValidas.length) return erro('Adiciona pelo menos um ficheiro ou ligação para transferir.');

    botao.disabled = true;
    const criados = [];
    try {
      // 1. Carregar ficheiros novos
      const aCarregar = [
        ...(tipo === 'pacote' && estado.jogoLocal ? [{ bytes: estado.jogoLocal.bytes, nome: estado.jogoLocal.nome, jogo: true }] : []),
        ...transferenciasValidas.filter((t) => t.ficheiro).map((t) => ({ ficheiro: t.ficheiro, nome: t.ficheiro.name, t })),
      ];
      const total = aCarregar.reduce((soma, a) => soma + (a.bytes?.length || a.ficheiro.size), 0);
      let feito = 0;
      let pacote = tipo === 'pacote' ? (estado.pacoteAtual ? { id: estado.pacoteAtual.id, entrada: estado.pacoteAtual.entrada } : null) : null;
      for (const item of aCarregar) {
        const bytes = item.bytes || new Uint8Array(await item.ficheiro.arrayBuffer());
        const idPacote = await carregarPacote(perfil.uid, bytes, item.nome, (n) => {
          feito += n;
          progresso(feito, total, `A carregar ${item.nome}… ${formatarTamanho(feito)} de ${formatarTamanho(total)}`);
        });
        criados.push(idPacote);
        if (item.jogo) pacote = { id: idPacote, entrada: estado.jogoLocal.entrada };
        else item.t.urlExistente = `/transferir/${idPacote}/${encodeURIComponent(nomeSeguro(item.nome))}`;
      }
      progresso(1, 1, 'A guardar…');

      // 2. Guardar o jogo
      const dados = {
        titulo: titulo.value.trim(),
        categoria: categoria.value.trim().replace(/\s+/g, ' '),
        descricao: descricao.value.replace(/\r\n/g, '\n').trim(),
        instrucoes: instrucoes.value.replace(/\r\n/g, '\n').trim(),
        tipo,
        caminho: tipo === 'repositorio' ? pasta.value : null,
        url_externo: urlValido,
        pacote,
        capa: estado.capaImagem ? null : estado.capaRepositorio,
        capa_imagem: estado.capaImagem,
        transferencias: transferenciasValidas.map((t) => ({
          rotulo: t.rotulo.value.trim() || 'Transferir',
          url: t.urlExistente || validarUrl(t.url.value.trim()),
        })),
        publicado: publicado.checked,
        atualizado_em: serverTimestamp(),
      };
      let slug = jogo?.id;
      if (editar) await updateDoc(doc(bd, 'jogos', jogo.id), dados);
      else slug = await criarDocumentoJogo(perfil, dados);

      // Galeria
      const galeriaMudou = imagens.length !== imagensAtuais.length || imagens.some((src, i) => src !== imagensAtuais[i]);
      if (galeriaMudou) {
        progresso(1, 1, 'A guardar as imagens…');
        if (imagens.length) await setDoc(doc(bd, 'galerias', slug), { imagens });
        else await deleteDoc(doc(bd, 'galerias', slug)).catch(() => {});
      }

      // 3. Apagar ficheiros antigos que deixaram de ser usados
      if (editar) {
        const usadosAgora = new Set(pacotesDoJogo(dados));
        await Promise.all(pacotesDoJogo(jogo).filter((p) => !usadosAgora.has(p)).map((p) => apagarPacote(p).catch(() => {})));
      }
      location.href = `/jogo/${slug}${editar ? '' : '?novo=1'}`;
    } catch (e) {
      await Promise.all(criados.map((p) => apagarPacote(p).catch(() => {})));
      barra.hidden = true;
      botao.disabled = false;
      erro(traduzirErro(e));
    }
  }

  const passo = (numero, tituloPasso, ...filhos) => el('section', { class: 'cartao-form formulario passo' },
    el('h2', {}, el('span', { class: 'numero-passo' }, numero), tituloPasso), ...filhos);

  const pagina = el('div', { class: 'publicar' },
    el('form', { class: 'formulario', onsubmit: guardar, novalidate: true },
      aviso,
      passo('1', 'O jogo',
        modos,
        blocoBrowser,
        el('div', { class: 'campo' },
          el('span', {}, 'Transferências ', etiquetaOpcional),
          zonaTransferencias, ficheiroTransferencia, listaTransferencias, el('div', {}, botaoLigacao)),
        ficheiroJogo, pastaJogo,
      ),
      passo('2', 'Detalhes',
        el('label', {}, el('span', {}, 'Título'), titulo),
        el('div', { class: 'campo' }, el('label', { class: 'campo' }, el('span', {}, 'Categoria'), categoria), listaCategorias, sugestoes),
        el('div', { class: 'campo' }, el('span', {}, 'Capa ', el('span', { class: 'opcional' }, '(opcional)')), zonaCapa, ficheiroCapa),
        el('div', { class: 'campo' },
          el('span', {}, 'Imagens do jogo ', el('span', { class: 'opcional' }, '(opcional, até 4 — arrasta capturas de ecrã)')),
          grelhaImagens, ficheiroImagens),
        el('label', {}, el('span', {}, 'Descrição'), descricao),
        el('label', {}, el('span', {}, 'Como jogar ', el('span', { class: 'opcional' }, '(opcional)')), instrucoes),
      ),
      passo('3', editar ? 'Guardar' : 'Publicar',
        el('label', { class: 'opcao' }, publicado, el('span', {}, el('strong', {}, 'Visível para todos'), el('br'), el('small', { class: 'ajuda' }, 'Desmarca para guardar como rascunho (só os autores o veem).'))),
        barra,
        botao,
      ),
    ),
    el('aside', { class: 'publicar-lateral' },
      el('div', { class: 'caixa' }, el('h2', {}, 'Pré-visualização'), previa),
      el('div', { class: 'caixa' }, el('h2', {}, 'Checklist'), verificacao),
    ),
  );

  mudarModo(estado.modo);
  mudarOrigem(estado.origem);
  atualizarPrevia();

  return el('section', { class: 'formulario' },
    el('a', { class: 'voltar', href: editar ? `/jogo/${jogo.id}` : '/painel' }, icone('seta'), 'Voltar'),
    el('div', {}, el('h1', {}, editar ? `Editar «${jogo.titulo}»` : 'Publicar jogo'),
      el('p', { class: 'ajuda' }, 'Arrasta o jogo, dá-lhe um nome e publica. Demora menos de um minuto.')),
    pagina,
  );
}

function ativarArrastar(zona, aoLargar) {
  let profundidade = 0;
  zona.addEventListener('dragenter', (e) => {
    e.preventDefault();
    profundidade++;
    zona.classList.add('a-arrastar');
  });
  zona.addEventListener('dragover', (e) => e.preventDefault());
  zona.addEventListener('dragleave', () => {
    if (--profundidade <= 0) zona.classList.remove('a-arrastar');
  });
  zona.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    profundidade = 0;
    zona.classList.remove('a-arrastar');
    aoLargar(e.dataTransfer);
  });
}

// ------------------------------------------------------------------ Início

async function lerIndiceRepositorio() {
  try {
    const resposta = await fetch('/indice-repositorio.json', { cache: 'no-store' });
    if (resposta.ok) return await resposta.json();
  } catch {
    // sem índice: continua com listas vazias
  }
  return { jogos: [], capas: [], avisos: [] };
}

// Evita que largar um ficheiro fora das zonas abra o ficheiro no browser.
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => e.preventDefault());

try {
  const perfil = await exigirPerfil(conteudo);
  if (perfil) {
    const [indice, resultado] = await Promise.all([lerIndiceRepositorio(), getDocs(collection(bd, 'jogos'))]);
    const todosJogos = resultado.docs.map((d) => ({ id: d.id, ...d.data() }));
    const categoriasUsadas = [...new Set(todosJogos.map((j) => j.categoria))];
    let jogo = null;
    let pacoteAtual = null;
    let imagensAtuais = [];
    if (id) {
      const documento = await getDoc(doc(bd, 'jogos', id));
      const dados = documento.exists() ? documento.data() : null;
      const permitido = dados && ((dados.autor_uid === perfil.uid && pode(perfil, 'publicar')) || pode(perfil, 'editar_todos'));
      if (permitido) jogo = { id: documento.id, ...dados };
      if (jogo) {
        const galeria = await getDoc(doc(bd, 'galerias', jogo.id)).catch(() => null);
        if (galeria?.exists()) imagensAtuais = galeria.data().imagens || [];
      }
      if (jogo?.tipo === 'pacote') {
        const info = await getDoc(doc(bd, 'pacotes', jogo.pacote.id)).catch(() => null);
        if (info?.exists()) pacoteAtual = { nome: info.data().nome, tamanho: info.data().tamanho };
      }
    }
    if (id && !jogo) {
      definirTitulo('Jogo não encontrado');
      preencher(conteudo, paginaErro(404, 'Este jogo não existe ou não tens permissão para o editar.'));
    } else if (!id && !pode(perfil, 'publicar')) {
      definirTitulo('Sem permissão');
      preencher(conteudo, paginaErro(403, 'A tua conta não tem permissão para publicar jogos.'));
    } else {
      definirTitulo(jogo ? `Editar ${jogo.titulo}` : 'Publicar jogo');
      preencher(conteudo, formulario({ perfil, jogo, indice, todosJogos, categoriasUsadas, pacoteAtual, imagensAtuais }));
    }
  }
} catch (erro) {
  preencher(conteudo, mensagem('erro-form', traduzirErro(erro)));
}
