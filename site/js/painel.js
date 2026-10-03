import { bd, collection, deleteDoc, doc, getDocs, query, where } from './firebase.js';
import {
  definirTitulo, el, exigirSessao, formatarData, formatarNumero, mensagem, obterAutor, traduzirErro, preencher,
} from './comum.js';

const conteudo = document.getElementById('conteudo');
const MENSAGENS = {
  publicado: 'Jogo publicado com sucesso!',
  guardado: 'Alterações guardadas.',
  eliminado: 'Jogo eliminado do site.',
  conta: 'Dados da conta atualizados.',
};

definirTitulo('Painel');

try {
  const utilizador = await exigirSessao();
  const autor = await obterAutor(utilizador, conteudo);
  if (autor) {
    const resultado = await getDocs(query(collection(bd, 'jogos'), where('autor_uid', '==', autor.uid)));
    const jogos = resultado.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.atualizado_em?.toMillis() || 0) - (a.atualizado_em?.toMillis() || 0));
    const codigo = new URLSearchParams(location.search).get('ok');
    const aviso = el('div', {}, MENSAGENS[codigo] ? mensagem('sucesso', MENSAGENS[codigo]) : null);

    const eliminar = async (jogo, linha) => {
      if (!confirm(`Tens a certeza de que queres eliminar «${jogo.titulo}» do site? Os ficheiros continuam no repositório.`)) return;
      try {
        await deleteDoc(doc(bd, 'jogos', jogo.id));
        linha.remove();
        aviso.replaceChildren(mensagem('sucesso', MENSAGENS.eliminado));
      } catch (erro) {
        aviso.replaceChildren(mensagem('erro-form', traduzirErro(erro)));
      }
    };

    const linhas = jogos.map((j) => {
      const linha = el('tr', {},
        el('td', {}, el('a', { href: `/jogo/${j.id}` }, j.titulo), el('br'), el('small', { class: 'meta' }, j.categoria)),
        el('td', {}, j.publicado
          ? el('span', { class: 'estado publico' }, 'Público')
          : el('span', { class: 'estado rascunho' }, 'Rascunho')),
        el('td', {}, formatarNumero(j.jogadas)),
        el('td', {}, formatarData(j.atualizado_em)),
        el('td', { class: 'acoes-linha' },
          el('a', { class: 'botao pequeno secundario', href: `/editar?id=${j.id}` }, 'Editar'),
          el('button', { class: 'botao pequeno perigo', type: 'button', onclick: () => eliminar(j, linha) }, 'Eliminar'),
        ),
      );
      return linha;
    });

    preencher(conteudo, 
      el('div', { class: 'cabecalho-seccao' },
        el('h1', {}, `Olá, ${autor.nome}!`),
        el('div', { class: 'acoes' },
          el('a', { class: 'botao secundario', href: '/conta' }, 'A minha conta'),
          el('a', { class: 'botao', href: '/editar' }, '+ Publicar novo jogo'),
        ),
      ),
      aviso,
      el('h2', {}, 'Os meus jogos'),
      jogos.length
        ? el('div', { class: 'tabela-contentor' },
            el('table', { class: 'tabela' },
              el('thead', {}, el('tr', {},
                el('th', {}, 'Jogo'), el('th', {}, 'Estado'), el('th', {}, 'Jogadas'), el('th', {}, 'Atualizado'),
                el('th', {}, el('span', { class: 'oculto' }, 'Ações')))),
              el('tbody', {}, linhas)))
        : el('p', { class: 'vazio' }, 'Ainda não publicaste nenhum jogo. ', el('a', { href: '/editar' }, 'Publica o primeiro!')),
    );
  }
} catch (erro) {
  preencher(conteudo, mensagem('erro-form', traduzirErro(erro)));
}
