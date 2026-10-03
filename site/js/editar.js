import { bd, collection, doc, getDoc, getDocs, runTransaction, serverTimestamp, updateDoc } from './firebase.js';
import {
  CATEGORIAS, REPOSITORIO, criarSlug, definirTitulo, el, exigirSessao, mensagem, obterAutor, paginaErro,
  traduzirErro, preencher,
} from './comum.js';

const conteudo = document.getElementById('conteudo');
const id = new URLSearchParams(location.search).get('id');

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

async function criarJogo(autor, dados) {
  const base = criarSlug(dados.titulo);
  for (let n = 1; n < 100; n++) {
    const slug = n === 1 ? base : `${base}-${n}`;
    const ref = doc(bd, 'jogos', slug);
    const criado = await runTransaction(bd, async (transacao) => {
      if ((await transacao.get(ref)).exists()) return false;
      transacao.set(ref, { ...dados, jogadas: 0, autor_uid: autor.uid, criado_em: serverTimestamp() });
      return true;
    });
    if (criado) return slug;
  }
  throw new Error('Não foi possível criar um endereço único para o jogo.');
}

function formulario({ autor, jogo, indice, todosJogos }) {
  const editar = Boolean(jogo);
  const aviso = el('div');

  const titulo = el('input', { name: 'titulo', maxlength: '80', required: true, value: jogo?.titulo || '' });
  const categoria = el('select', { name: 'categoria', required: true },
    CATEGORIAS.map((c) => el('option', { selected: c === jogo?.categoria }, c)));
  const descricao = el('textarea', { name: 'descricao', rows: '5', maxlength: '5000', placeholder: 'Do que trata o jogo?' }, jogo?.descricao || '');
  const instrucoes = el('textarea', { name: 'instrucoes', rows: '3', maxlength: '2000', placeholder: 'Ex.: setas para mover, espaço para saltar.' }, jogo?.instrucoes || '');

  const tipoAtual = jogo?.tipo || 'repositorio';
  const opcaoRepositorio = el('input', { type: 'radio', name: 'tipo', value: 'repositorio', checked: tipoAtual === 'repositorio' });
  const opcaoLigacao = el('input', { type: 'radio', name: 'tipo', value: 'ligacao', checked: tipoAtual === 'ligacao' });

  // Jogos disponíveis no repositório (pasta «jogos/»).
  const usados = new Map(todosJogos.filter((j) => j.tipo === 'repositorio' && j.id !== jogo?.id).map((j) => [j.caminho, j.titulo]));
  const pasta = el('select', { name: 'caminho' },
    el('option', { value: '' }, '— Escolhe o jogo —'),
    indice.jogos.map((j) => el('option', {
      value: j.caminho,
      selected: j.caminho === jogo?.caminho,
      disabled: usados.has(j.caminho),
    }, usados.has(j.caminho) ? `${j.origem} (já usado em «${usados.get(j.caminho)}»)` : j.origem)),
    jogo?.caminho && !indice.jogos.some((j) => j.caminho === jogo.caminho)
      ? el('option', { value: jogo.caminho, selected: true }, `${jogo.caminho} (não encontrado no repositório)`)
      : null,
  );
  const url = el('input', { type: 'url', name: 'url_externo', placeholder: 'https://…', value: jogo?.url_externo || '' });

  // Capas: as que vêm dentro dos jogos e as da pasta «capas/».
  const todasCapas = [...new Set([...indice.jogos.map((j) => j.capa).filter(Boolean), ...indice.capas, jogo?.capa].filter(Boolean))];
  const capa = el('select', { name: 'capa' },
    el('option', { value: '' }, 'Sem capa'),
    todasCapas.map((c) => el('option', { value: c, selected: c === jogo?.capa }, c)));
  const preVisualizacao = el('img', { class: 'capa-previa', alt: 'Pré-visualização da capa', hidden: true });
  const atualizarCapa = () => {
    preVisualizacao.hidden = !capa.value;
    if (capa.value) preVisualizacao.src = '/' + capa.value.split('/').map(encodeURIComponent).join('/');
  };
  capa.addEventListener('change', atualizarCapa);
  pasta.addEventListener('change', () => {
    const escolhido = indice.jogos.find((j) => j.caminho === pasta.value);
    if (escolhido?.capa && !capa.value) {
      capa.value = escolhido.capa;
      atualizarCapa();
    }
  });
  atualizarCapa();

  const publicado = el('input', { type: 'checkbox', name: 'publicado', checked: jogo ? jogo.publicado : true });
  const botao = el('button', { class: 'botao', type: 'submit' }, editar ? 'Guardar alterações' : 'Publicar jogo');

  const campoRepositorio = el('div', { class: 'campo' },
    el('label', {}, 'Jogo no repositório', pasta),
    el('p', { class: 'ajuda' },
      'Para adicionar um jogo, exporta-o para HTML5/Web e coloca a pasta (ou o ficheiro .zip) em ',
      el('a', { href: `${REPOSITORIO}/tree/HEAD/jogos`, target: '_blank', rel: 'noopener' }, 'jogos/ no GitHub'),
      ' («Add file» → «Upload files»). Depois de o site ser republicado (1 a 3 minutos), o jogo aparece nesta lista.'),
    indice.avisos.length ? el('div', { class: 'aviso' }, el('strong', {}, 'Avisos do repositório:'), el('ul', {}, indice.avisos.map((a) => el('li', {}, a)))) : null,
  );
  const campoLigacao = el('div', { class: 'campo' },
    el('label', {}, 'Endereço do jogo', url),
    el('p', { class: 'ajuda' }, 'Alguns sites não permitem ser incorporados. No itch.io, usa o endereço de incorporação («Embed game»).'),
  );
  const atualizarTipo = () => {
    campoRepositorio.hidden = !opcaoRepositorio.checked;
    campoLigacao.hidden = !opcaoLigacao.checked;
  };
  opcaoRepositorio.addEventListener('change', atualizarTipo);
  opcaoLigacao.addEventListener('change', atualizarTipo);
  atualizarTipo();

  const guardar = async (evento) => {
    evento.preventDefault();
    aviso.replaceChildren();
    const erro = (texto) => {
      aviso.replaceChildren(mensagem('erro-form', texto));
      aviso.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
    const tipo = opcaoLigacao.checked ? 'ligacao' : 'repositorio';
    const urlValido = tipo === 'ligacao' ? validarUrl(url.value.trim()) : null;
    if (!titulo.value.trim()) return erro('O jogo precisa de um título.');
    if (tipo === 'repositorio' && !pasta.value) return erro('Escolhe o jogo do repositório.');
    if (tipo === 'ligacao' && !urlValido) return erro('Indica um endereço válido, começado por https://');

    const dados = {
      titulo: titulo.value.trim(),
      categoria: categoria.value,
      descricao: descricao.value.replace(/\r\n/g, '\n').trim(),
      instrucoes: instrucoes.value.replace(/\r\n/g, '\n').trim(),
      tipo,
      caminho: tipo === 'repositorio' ? pasta.value : null,
      url_externo: urlValido,
      capa: capa.value || null,
      publicado: publicado.checked,
      atualizado_em: serverTimestamp(),
    };
    botao.disabled = true;
    botao.textContent = 'A guardar…';
    try {
      if (editar) {
        await updateDoc(doc(bd, 'jogos', jogo.id), dados);
        location.href = '/painel?ok=guardado';
      } else {
        const slug = await criarJogo(autor, dados);
        location.href = `/jogo/${slug}`;
      }
    } catch (e) {
      erro(traduzirErro(e));
      botao.disabled = false;
      botao.textContent = editar ? 'Guardar alterações' : 'Publicar jogo';
    }
  };

  return el('section', { class: 'formulario-largo' },
    el('p', {}, el('a', { href: '/painel' }, '← Voltar ao painel')),
    el('h1', {}, editar ? `Editar «${jogo.titulo}»` : 'Publicar novo jogo'),
    aviso,
    el('form', { class: 'formulario', onsubmit: guardar },
      el('label', {}, 'Título', titulo),
      el('label', {}, 'Categoria', categoria),
      el('label', {}, 'Descrição', descricao),
      el('label', {}, el('span', {}, 'Como jogar ', el('span', { class: 'opcional' }, '(opcional)')), instrucoes),
      el('fieldset', {},
        el('legend', {}, 'Onde está o jogo?'),
        el('label', { class: 'opcao' }, opcaoRepositorio, ' No repositório (pasta jogos/)'),
        el('label', { class: 'opcao' }, opcaoLigacao, ' Ligação externa (ex.: itch.io)'),
        campoRepositorio,
        campoLigacao,
      ),
      el('div', { class: 'campo' },
        el('label', {}, el('span', {}, 'Imagem de capa ', el('span', { class: 'opcional' }, '(opcional)')), capa),
        el('p', { class: 'ajuda' }, 'Põe um ficheiro capa.png dentro da pasta do jogo, ou coloca imagens na pasta capas/ do repositório. Recomendado: 16:9, por exemplo 1280×720.'),
        preVisualizacao,
      ),
      el('label', { class: 'opcao' }, publicado, ' Visível para todos (desmarca para guardar como rascunho)'),
      botao,
    ),
  );
}

try {
  const utilizador = await exigirSessao();
  const autor = await obterAutor(utilizador, conteudo);
  if (autor) {
    const [indice, resultado] = await Promise.all([lerIndiceRepositorio(), getDocs(collection(bd, 'jogos'))]);
    const todosJogos = resultado.docs.map((d) => ({ id: d.id, ...d.data() }));
    let jogo = null;
    if (id) {
      const documento = await getDoc(doc(bd, 'jogos', id));
      if (documento.exists() && documento.data().autor_uid === autor.uid) jogo = { id: documento.id, ...documento.data() };
    }
    if (id && !jogo) {
      definirTitulo('Jogo não encontrado');
      preencher(conteudo, paginaErro(404, 'Este jogo não existe ou não é teu.'));
    } else {
      definirTitulo(jogo ? `Editar ${jogo.titulo}` : 'Publicar novo jogo');
      preencher(conteudo, formulario({ autor, jogo, indice, todosJogos }));
    }
  }
} catch (erro) {
  preencher(conteudo, mensagem('erro-form', traduzirErro(erro)));
}
