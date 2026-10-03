import { bd, collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc, updateDoc } from './firebase.js';
import {
  PERMISSOES, UID_DONO, capa, carregarAutores, criarSlug, definirTitulo, el, exigirPerfil, formatarNumero, icone,
  iniciais, mensagem, paginaErro, pode, preencher, traduzirErro, vazio,
} from './comum.js';

const conteudo = document.getElementById('conteudo');
const CONSOLA_UTILIZADORES = 'https://console.firebase.google.com/project/plataforma-web-mj/authentication/users';

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
      await deleteDoc(doc(bd, 'jogos', jogo.id));
      linha.remove();
      preencher(aviso, mensagem('sucesso', `«${jogo.titulo}» foi eliminado.`));
    } catch (erro) {
      preencher(aviso, mensagem('erro-form', traduzirErro(erro)));
    }
  };
  return el('div', { class: 'formulario' },
    el('div', { class: 'cabecalho-seccao' },
      el('p', {}, `${jogos.length} jogos no total, de todos os autores.`),
      pode(perfil, 'publicar') ? el('a', { class: 'botao', href: '/editar' }, icone('mais'), 'Adicionar jogo') : null,
    ),
    jogos.length
      ? el('div', { class: 'tabela-contentor' },
          el('table', { class: 'tabela' },
            el('thead', {}, el('tr', {},
              el('th', {}, 'Jogo'), el('th', {}, 'Autor'), el('th', {}, 'Estado'), el('th', {}, 'Jogadas'),
              el('th', {}, el('span', { class: 'oculto' }, 'Ações')))),
            el('tbody', {}, jogos.map((j) => {
              const linha = el('tr', {},
                el('td', {}, el('a', { class: 'celula-jogo', href: `/jogo/${j.id}` },
                  el('span', { class: 'miniatura' }, capa(j)),
                  el('span', {}, el('strong', {}, j.titulo), el('br'), el('small', { class: 'meta' }, j.categoria)))),
                el('td', {}, autores.get(j.autor_uid)?.nome || '—'),
                el('td', {}, j.publicado ? el('span', { class: 'estado publico' }, 'Público') : el('span', { class: 'estado rascunho' }, 'Rascunho')),
                el('td', {}, formatarNumero(j.jogadas)),
                el('td', { class: 'acoes-linha' },
                  pode(perfil, 'editar_todos') ? el('a', { class: 'botao pequeno secundario', href: `/editar?id=${j.id}` }, icone('editar'), 'Editar') : null,
                  pode(perfil, 'eliminar_todos') ? el('button', { class: 'botao pequeno perigo', type: 'button', onclick: () => eliminar(j, linha) }, icone('lixo'), 'Remover') : null,
                ),
              );
              return linha;
            }))))
      : vazio('Ainda não há jogos.'),
  );
}

function separadorUtilizadores({ autores, convites, aviso, recarregar }) {
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

  // --- Convites pendentes
  const listaConvites = convites.length
    ? el('div', { class: 'tabela-contentor' },
        el('table', { class: 'tabela' },
          el('thead', {}, el('tr', {}, el('th', {}, 'Email'), el('th', {}, 'Nome'), el('th', {}, 'Permissões'), el('th', {}, el('span', { class: 'oculto' }, 'Ações')))),
          el('tbody', {}, convites.map((c) => el('tr', {},
            el('td', {}, c.email),
            el('td', {}, `${c.nome} (@${c.utilizador})`),
            el('td', {}, PERMISSOES.filter((p) => c.permissoes?.[p.chave]).map((p) => p.nome).join(', ') || 'Nenhuma'),
            el('td', { class: 'acoes-linha' }, el('button', {
              class: 'botao pequeno perigo',
              type: 'button',
              onclick: async () => {
                await deleteDoc(doc(bd, 'convites', c.email)).catch(() => {});
                recarregar();
              },
            }, 'Cancelar')),
          )))))
    : null;

  // --- Adicionar utilizador
  const email = el('input', { type: 'email', required: true, placeholder: 'email@exemplo.pt' });
  const nome = el('input', { required: true, maxlength: '40', placeholder: 'Ex.: Ana Silva' });
  const nomeUtilizador = el('input', { required: true, maxlength: '30', pattern: '[a-z0-9_.\\-]{2,30}', placeholder: 'ex.: ana' });
  nome.addEventListener('input', () => {
    if (!nomeUtilizador.dataset.editado) nomeUtilizador.value = criarSlug(nome.value.split(' ')[0] || '').replace(/-/g, '').slice(0, 30);
  });
  nomeUtilizador.addEventListener('input', () => { nomeUtilizador.dataset.editado = '1'; });
  const novasPermissoes = caixasPermissoes({ publicar: true });
  const adicionar = async (evento) => {
    evento.preventDefault();
    const chave = email.value.trim().toLowerCase();
    const utilizador = nomeUtilizador.value.trim().toLowerCase();
    if (!/^[a-z0-9_.-]{2,30}$/.test(utilizador)) {
      preencher(aviso, mensagem('erro-form', 'O nome de utilizador só pode ter letras minúsculas sem acentos, números, «.», «_» e «-».'));
      return;
    }
    if ([...autores.values()].some((a) => a.utilizador === utilizador)) {
      preencher(aviso, mensagem('erro-form', `Já existe um autor com o nome de utilizador «${utilizador}».`));
      return;
    }
    try {
      await setDoc(doc(bd, 'convites', chave), {
        email: chave, nome: nome.value.trim(), utilizador, permissoes: novasPermissoes.valor(), criado_em: serverTimestamp(),
      });
      recarregar(mensagem('sucesso', el('div', {},
        el('strong', {}, `${nome.value.trim()} foi adicionado. `),
        'Último passo: cria a conta com o email ', el('strong', {}, chave), ' na ',
        el('a', { href: CONSOLA_UTILIZADORES, target: '_blank', rel: 'noopener' }, 'consola do Firebase → Adicionar utilizador'),
        ' e envia-lhe a palavra-passe. Na primeira vez que entrar, fica com estas permissões.')));
    } catch (erro) {
      preencher(aviso, mensagem('erro-form', traduzirErro(erro)));
    }
  };

  return el('div', { class: 'formulario' },
    el('div', { class: 'tabela-contentor' },
      el('table', { class: 'tabela' },
        el('thead', {}, el('tr', {}, el('th', {}, 'Utilizador'), el('th', {}, 'O que pode fazer'), el('th', {}, el('span', { class: 'oculto' }, 'Ações')))),
        el('tbody', {}, linhas))),
    el('div', { class: 'grelha-permissoes ajuda' },
      PERMISSOES.map((p) => el('div', {}, el('strong', {}, `${p.nome}: `), p.descricao))),
    listaConvites ? el('section', { class: 'formulario' }, el('h2', {}, 'À espera da primeira entrada'), listaConvites) : null,
    el('form', { class: 'cartao-form formulario', onsubmit: adicionar },
      el('h2', {}, 'Adicionar utilizador'),
      el('div', { class: 'escolhas' },
        el('label', { class: 'campo' }, el('span', {}, 'Email'), email),
        el('label', { class: 'campo' }, el('span', {}, 'Nome'), nome),
        el('label', { class: 'campo' }, el('span', {}, 'Nome de utilizador'), nomeUtilizador),
      ),
      el('div', { class: 'campo' }, el('span', {}, 'Permissões'), novasPermissoes.contentor),
      el('div', {}, el('button', { class: 'botao', type: 'submit' }, icone('mais'), 'Adicionar utilizador')),
    ),
  );
}

async function mostrar(perfil, separador = 'jogos', avisoInicial = null) {
  const [resultado, autores, convites] = await Promise.all([
    getDocs(collection(bd, 'jogos')),
    carregarAutores(),
    getDocs(collection(bd, 'convites')).then((r) => r.docs.map((d) => d.data())).catch(() => []),
  ]);
  const jogos = resultado.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.atualizado_em?.toMillis() || 0) - (a.atualizado_em?.toMillis() || 0));
  const aviso = el('div', {}, avisoInicial);
  const recarregar = (msg) => mostrar(perfil, 'utilizadores', msg ?? null);

  const paineis = {
    jogos: separadorJogos({ perfil, jogos, autores, aviso }),
    utilizadores: separadorUtilizadores({ autores, convites, aviso, recarregar }),
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
