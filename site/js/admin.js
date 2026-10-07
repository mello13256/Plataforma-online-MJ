import { bd, collection, criarConta, deleteDoc, doc, getDocs, setDoc, updateDoc } from './firebase.js';
import {
  PERMISSOES, UID_DONO, capa, estadoJogo, seloEstado, carregarAutores, criarSlug, definirTitulo, el, eliminarJogo, exigirPerfil, formatarNumero, formatarTamanho, icone,
  iniciais, mensagem, normalizar, paginaErro, transferirJogoCompleto, pode, preencher, traduzirErro, vazio,
} from './comum.js';

const conteudo = document.getElementById('conteudo');

function gerarPalavraPasse() {
  const letras = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const aleatorio = crypto.getRandomValues(new Uint32Array(12));
  return Array.from(aleatorio, (n) => letras[n % letras.length]).join('');
}

definirTitulo('Administração');

// Caixas de permissões; «Administrador» inclui todas as outras.
function caixasPermissoes(atuais = {}, { bloquearAdmin = false, aoMudar } = {}) {
  const caixas = new Map();
  const contentor = el('div', { class: 'permissoes-linha' });
  for (const p of PERMISSOES) {
    const caixa = el('input', { type: 'checkbox', checked: atuais[p.chave] === true });
    caixa.addEventListener('change', () => {
      sincronizar();
      aoMudar?.();
    });
    caixas.set(p.chave, caixa);
    contentor.append(el('label', { title: p.descricao }, caixa, p.nome));
  }
  function sincronizar() {
    const admin = caixas.get('admin').checked;
    for (const [chave, caixa] of caixas) {
      if (chave === 'admin') caixa.disabled = bloquearAdmin;
      else {
        caixa.disabled = admin;
        if (admin) caixa.checked = true;
      }
    }
  }
  if (bloquearAdmin) caixas.get('admin').checked = true;
  sincronizar();
  return {
    contentor,
    valor: () => Object.fromEntries([...caixas].map(([chave, caixa]) => [chave, caixa.checked])),
  };
}

function separadorJogos({ perfil, jogos, autores, aviso }) {
  const eliminar = async (jogo, linha) => {
    if (!confirm(`Eliminar «${jogo.titulo}» de ${autores.get(jogo.autor_uid)?.nome || 'outro autor'}? Esta ação não pode ser desfeita.`)) return;
    try {
      await eliminarJogo(jogo);
      linha.remove();
      preencher(aviso, mensagem('sucesso', `«${jogo.titulo}» foi eliminado.`));
    } catch (erro) {
      preencher(aviso, mensagem('erro-form', traduzirErro(erro)));
    }
  };
  const filtro = el('input', { type: 'search', placeholder: 'Filtrar por título, autor ou categoria…', 'aria-label': 'Filtrar jogos' });
  const filtroEstado = el('select', { 'aria-label': 'Filtrar por estado', style: 'width:auto' },
    el('option', { value: '' }, 'Todos os estados'),
    el('option', { value: 'publico' }, 'Públicos'),
    el('option', { value: 'privado' }, 'Privados'));
  const filtrar = () => {
    const termo = normalizar(filtro.value.trim());
    for (const linha of filtro.closest('.formulario').querySelectorAll('tbody tr')) {
      linha.hidden = (Boolean(termo) && !normalizar(linha.textContent).includes(termo))
        || (Boolean(filtroEstado.value) && linha.dataset.estado !== filtroEstado.value);
    }
  };
  filtro.addEventListener('input', filtrar);
  filtroEstado.addEventListener('change', filtrar);
  return el('div', { class: 'formulario' },
    el('div', { class: 'cabecalho-seccao' },
      el('div', { class: 'acoes', style: 'flex:1;max-width:600px;flex-wrap:nowrap' }, filtro, filtroEstado),
      pode(perfil, 'publicar') ? el('a', { class: 'botao', href: '/editar' }, icone('mais'), 'Adicionar jogo') : null,
    ),
    jogos.length
      ? el('div', { class: 'tabela-contentor' },
          el('table', { class: 'tabela' },
            el('thead', {}, el('tr', {},
              el('th', {}, 'Jogo'), el('th', {}, 'Autor'), el('th', {}, 'Estado'), el('th', {}, 'Jogadas'),
              el('th', {}, el('span', { class: 'oculto' }, 'Ações')))),
            el('tbody', {}, jogos.map((j) => {
              const linha = el('tr', { 'data-estado': estadoJogo(j) },
                el('td', {}, el('a', { class: 'celula-jogo', href: `/jogo/${j.id}` },
                  el('span', { class: 'miniatura' }, capa(j)),
                  el('span', {}, el('strong', {}, j.titulo), el('br'), el('small', { class: 'meta' }, j.categoria)))),
                el('td', {}, autores.get(j.autor_uid)?.nome || '—'),
                el('td', {}, seloEstado(j)),
                el('td', {}, formatarNumero(j.jogadas)),
                el('td', { class: 'acoes-linha' },
                  pode(perfil, 'editar_todos') ? el('a', { class: 'botao pequeno secundario', href: `/editar?id=${j.id}` }, icone('editar'), 'Editar') : null,
                  j.tipo !== 'nenhum'
                    ? el('button', {
                        type: 'button',
                        class: 'botao pequeno secundario',
                        title: 'Transferir o jogo completo',
                        'aria-label': `Transferir ${j.titulo}`,
                        onclick: async (evento) => {
                          const botao = evento.currentTarget;
                          botao.disabled = true;
                          try {
                            await transferirJogoCompleto(j);
                          } catch (erro) {
                            preencher(aviso, mensagem('erro-form', traduzirErro(erro)));
                          }
                          botao.disabled = false;
                        },
                      }, icone('transferir'))
                    : null,
                  pode(perfil, 'eliminar_todos') ? el('button', { class: 'botao pequeno perigo', type: 'button', onclick: () => eliminar(j, linha) }, icone('lixo'), 'Remover') : null,
                ),
              );
              return linha;
            }))))
      : vazio('Ainda não há jogos.'),
  );
}

function separadorUtilizadores({ autores, aviso, recarregar }) {
  // --- Utilizadores existentes
  const linhas = [...autores.values()]
    .sort((a, b) => (a.uid === UID_DONO ? -1 : b.uid === UID_DONO ? 1 : a.nome.localeCompare(b.nome)))
    .map((autor) => {
      const eDono = autor.uid === UID_DONO;
      const guardar = el('button', { class: 'botao pequeno', type: 'button', disabled: true }, 'Guardar');
      const permissoes = caixasPermissoes(autor.permissoes || { publicar: true }, {
        bloquearAdmin: eDono,
        aoMudar: () => { guardar.disabled = false; },
      });
      guardar.addEventListener('click', async () => {
        guardar.disabled = true;
        try {
          await updateDoc(doc(bd, 'autores', autor.uid), { permissoes: permissoes.valor() });
          preencher(aviso, mensagem('sucesso', `Permissões de ${autor.nome} guardadas.`));
        } catch (erro) {
          guardar.disabled = false;
          preencher(aviso, mensagem('erro-form', traduzirErro(erro)));
        }
      });
      const remover = eDono ? null : el('button', {
        class: 'botao pequeno perigo',
        type: 'button',
        onclick: async () => {
          if (!confirm(`Remover o acesso de ${autor.nome}? Os jogos dele continuam publicados.`)) return;
          try {
            await deleteDoc(doc(bd, 'autores', autor.uid));
            preencher(aviso, mensagem('sucesso', `${autor.nome} deixou de ter acesso à área de autores.`));
            recarregar();
          } catch (erro) {
            preencher(aviso, mensagem('erro-form', traduzirErro(erro)));
          }
        },
      }, icone('lixo'), 'Remover');
      return el('tr', {},
        el('td', {}, el('div', { class: 'autor-linha' },
          el('span', { class: 'avatar' }, iniciais(autor.nome)),
          el('span', {}, el('strong', {}, autor.nome), el('small', {}, `@${autor.utilizador}`)),
          eDono ? el('span', { class: 'estado dono' }, 'Dono') : null)),
        el('td', {}, permissoes.contentor),
        el('td', { class: 'acoes-linha' }, guardar, remover),
      );
    });

  // --- Adicionar utilizador
  const email = el('input', { type: 'email', required: true, placeholder: 'email@exemplo.pt' });
  const nome = el('input', { required: true, maxlength: '40', placeholder: 'Ex.: Ana Silva' });
  const nomeUtilizador = el('input', { required: true, maxlength: '30', pattern: '[a-z0-9_.\\-]{2,30}', placeholder: 'ex.: ana' });
  nome.addEventListener('input', () => {
    if (!nomeUtilizador.dataset.editado) nomeUtilizador.value = criarSlug(nome.value.split(' ')[0] || '').replace(/-/g, '').slice(0, 30);
  });
  nomeUtilizador.addEventListener('input', () => { nomeUtilizador.dataset.editado = '1'; });
  const palavraPasse = el('input', { required: true, minlength: '8', maxlength: '64', autocomplete: 'off', value: gerarPalavraPasse() });
  const novasPermissoes = caixasPermissoes({ publicar: true });
  const botaoCriar = el('button', { class: 'botao', type: 'submit' }, icone('mais'), 'Criar conta');
  const adicionar = async (evento) => {
    evento.preventDefault();
    const endereco = email.value.trim().toLowerCase();
    const utilizador = nomeUtilizador.value.trim().toLowerCase();
    const nomeFinal = nome.value.trim();
    if (!/^[a-z0-9_.-]{2,30}$/.test(utilizador)) {
      preencher(aviso, mensagem('erro-form', 'O nome de utilizador só pode ter letras minúsculas sem acentos, números, «.», «_» e «-».'));
      return;
    }
    if ([...autores.values()].some((a) => a.utilizador === utilizador)) {
      preencher(aviso, mensagem('erro-form', `Já existe um autor com o nome de utilizador «${utilizador}».`));
      return;
    }
    if (palavraPasse.value.length < 8) {
      preencher(aviso, mensagem('erro-form', 'A palavra-passe tem de ter pelo menos 8 caracteres.'));
      return;
    }
    botaoCriar.disabled = true;
    try {
      const uid = await criarConta(endereco, palavraPasse.value);
      await setDoc(doc(bd, 'autores', uid), { nome: nomeFinal, utilizador, permissoes: novasPermissoes.valor() });
      const texto = `Olá ${nomeFinal.split(' ')[0]}! Já tens conta no Jogos MJ.\nEntra em ${location.origin}/entrar\nEmail: ${endereco}\nPalavra-passe: ${palavraPasse.value}\n(Muda-a em «A minha conta».)`;
      recarregar(mensagem('sucesso', el('div', { class: 'formulario', style: 'gap:.6rem' },
        el('strong', {}, `Conta de ${nomeFinal} criada.`),
        el('span', {}, 'Envia-lhe estes dados (a palavra-passe não volta a ser mostrada):'),
        el('pre', { class: 'copiavel', style: 'margin:0;white-space:pre-wrap;font:inherit' }, texto),
        el('div', {}, el('button', {
          type: 'button',
          class: 'botao pequeno secundario',
          onclick: (e) => navigator.clipboard?.writeText(texto).then(() => { e.target.textContent = 'Copiado ✓'; }),
        }, 'Copiar mensagem')),
      )));
    } catch (erro) {
      botaoCriar.disabled = false;
      preencher(aviso, mensagem('erro-form', traduzirErro(erro)));
      aviso.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return el('div', { class: 'formulario' },
    el('div', { class: 'tabela-contentor' },
      el('table', { class: 'tabela' },
        el('thead', {}, el('tr', {}, el('th', {}, 'Utilizador'), el('th', {}, 'O que pode fazer'), el('th', {}, el('span', { class: 'oculto' }, 'Ações')))),
        el('tbody', {}, linhas))),
    el('div', { class: 'grelha-permissoes ajuda' },
      PERMISSOES.map((p) => el('div', {}, el('strong', {}, `${p.nome}: `), p.descricao))),
    el('form', { class: 'cartao-form formulario', onsubmit: adicionar },
      el('div', {}, el('h2', {}, 'Criar conta'), el('p', { class: 'ajuda' }, 'A conta fica logo ativa. Depois envias o email e a palavra-passe à pessoa.')),
      el('div', { class: 'escolhas' },
        el('label', { class: 'campo' }, el('span', {}, 'Email'), email),
        el('label', { class: 'campo' }, el('span', {}, 'Nome'), nome),
        el('label', { class: 'campo' }, el('span', {}, 'Nome de utilizador'), nomeUtilizador),
        el('label', { class: 'campo' }, el('span', {}, 'Palavra-passe inicial'), palavraPasse,
          el('button', { type: 'button', class: 'ligacao', style: 'justify-self:start;font-size:.88rem', onclick: () => { palavraPasse.value = gerarPalavraPasse(); } }, 'Gerar outra')),
      ),
      el('div', { class: 'campo' }, el('span', {}, 'Permissões'), novasPermissoes.contentor),
      el('div', {}, botaoCriar),
    ),
  );
}

async function mostrar(perfil, separador = 'jogos', avisoInicial = null) {
  const [resultado, autores, pacotes] = await Promise.all([
    getDocs(collection(bd, 'jogos')),
    carregarAutores(),
    getDocs(collection(bd, 'pacotes')).catch(() => null),
  ]);
  const jogos = resultado.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.atualizado_em?.toMillis() || 0) - (a.atualizado_em?.toMillis() || 0));
  const aviso = el('div', {}, avisoInicial);
  const espacoUsado = (pacotes?.docs || []).reduce((soma, d) => soma + (d.data().tamanho || 0), 0)
    + jogos.reduce((soma, j) => soma + (j.capa_imagem?.length || 0), 0);
  const LIMITE_ESPACO = 1024 * 1024 * 1024;
  const percentagem = Math.min(100, (espacoUsado / LIMITE_ESPACO) * 100);
  const cartaoNumero = (nomeIcone, valor, rotulo) => el('div', { class: 'cartao-numero' },
    icone(nomeIcone), el('strong', {}, valor), el('span', {}, rotulo));
  const estatisticas = el('section', { class: 'painel-numeros' },
    cartaoNumero('comando', formatarNumero(jogos.filter((j) => j.publicado).length), ['jogos publicados',
      jogos.some((j) => estadoJogo(j) === 'privado') ? ` · ${jogos.filter((j) => estadoJogo(j) === 'privado').length} privados` : ''].join('')),
    cartaoNumero('jogar', formatarNumero(jogos.reduce((soma, j) => soma + (j.jogadas || 0), 0)), 'jogadas'),
    cartaoNumero('coracao', formatarNumero(jogos.reduce((soma, j) => soma + (j.gostos || 0), 0)), 'gostos'),
    cartaoNumero('utilizadores', formatarNumero(autores.size), 'autores'),
    el('div', { class: 'cartao-numero largo' },
      icone('grafico'),
      el('strong', {}, `${formatarTamanho(espacoUsado)} de 1 GB`),
      el('span', {}, 'espaço gratuito usado pelos ficheiros carregados'),
      el('div', { class: `barra-espaco ${percentagem > 80 ? 'cheia' : ''}` }, el('div', { style: `width:${Math.max(1, percentagem).toFixed(1)}%` })),
    ),
  );
  const recarregar = (msg) => mostrar(perfil, 'utilizadores', msg ?? null);

  const paineis = {
    jogos: separadorJogos({ perfil, jogos, autores, aviso }),
    utilizadores: separadorUtilizadores({ autores, aviso, recarregar }),
  };
  const zona = el('div');
  const botoes = {};
  const abrir = (nome) => {
    for (const [chave, botao] of Object.entries(botoes)) botao.setAttribute('aria-selected', String(chave === nome));
    preencher(zona, paineis[nome]);
  };
  botoes.jogos = el('button', { type: 'button', role: 'tab', onclick: () => abrir('jogos') }, `Jogos (${jogos.length})`);
  botoes.utilizadores = el('button', { type: 'button', role: 'tab', onclick: () => abrir('utilizadores') }, `Utilizadores (${autores.size})`);

  preencher(conteudo,
    el('div', { class: 'cabecalho-seccao' },
      el('div', {}, el('h1', {}, 'Administração'), el('p', {}, 'Gere todos os jogos, os utilizadores e o que cada um pode fazer.')),
    ),
    estatisticas,
    aviso,
    el('div', { class: 'formulario' }, el('div', { class: 'separadores', role: 'tablist' }, botoes.jogos, botoes.utilizadores), zona),
  );
  abrir(separador);
}

try {
  const perfil = await exigirPerfil(conteudo);
  if (perfil) {
    if (!pode(perfil, 'admin')) preencher(conteudo, paginaErro(403, 'Só os administradores podem ver esta página.'));
    else await mostrar(perfil);
  }
} catch (erro) {
  preencher(conteudo, mensagem('erro-form', traduzirErro(erro)));
}
