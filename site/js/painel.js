import { bd, collection, getDocs, query, where } from './firebase.js';
import {
  capa, definirTitulo, el, eliminarJogo, exigirPerfil, formatarData, formatarNumero, icone, mensagem, pode, preencher,
  traduzirErro, vazio,
} from './comum.js';

const conteudo = document.getElementById('conteudo');
const MENSAGENS = {
  publicado: 'Jogo publicado com sucesso!',
  guardado: 'Alterações guardadas.',
  conta: 'Dados da conta atualizados.',
};

definirTitulo('Painel');

try {
  const perfil = await exigirPerfil(conteudo);
  if (perfil) {
    const resultado = await getDocs(query(collection(bd, 'jogos'), where('autor_uid', '==', perfil.uid)));
    const jogos = resultado.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.atualizado_em?.toMillis() || 0) - (a.atualizado_em?.toMillis() || 0));
    const codigo = new URLSearchParams(location.search).get('ok');
    const aviso = el('div', {}, MENSAGENS[codigo] ? mensagem('sucesso', MENSAGENS[codigo]) : null);
    const podePublicar = pode(perfil, 'publicar');

    const eliminar = async (jogo, linha) => {
      if (!confirm(`Tens a certeza de que queres eliminar «${jogo.titulo}»? Esta ação não pode ser desfeita.`)) return;
      try {
        await eliminarJogo(jogo);
        linha.remove();
        preencher(aviso, mensagem('sucesso', 'Jogo eliminado.'));
      } catch (erro) {
        preencher(aviso, mensagem('erro-form', traduzirErro(erro)));
      }
    };

    const linhas = jogos.map((j) => {
      const linha = el('tr', {},
        el('td', {}, el('a', { class: 'celula-jogo', href: `/jogo/${j.id}` },
          el('span', { class: 'miniatura' }, capa(j)),
          el('span', {}, el('strong', {}, j.titulo), el('br'), el('small', { class: 'meta' }, j.categoria)))),
        el('td', {}, j.publicado ? el('span', { class: 'estado publico' }, 'Público') : el('span', { class: 'estado rascunho' }, 'Rascunho')),
        el('td', {}, formatarNumero(j.jogadas)),
        el('td', {}, formatarNumero(j.gostos || 0)),
        el('td', {}, formatarData(j.atualizado_em)),
        el('td', { class: 'acoes-linha' },
          podePublicar ? el('a', { class: 'botao pequeno secundario', href: `/editar?id=${j.id}` }, icone('editar'), 'Editar') : null,
          podePublicar ? el('button', { class: 'botao pequeno perigo', type: 'button', onclick: () => eliminar(j, linha) }, icone('lixo'), 'Eliminar') : null,
        ),
      );
      return linha;
    });

    preencher(conteudo,
      el('div', { class: 'cabecalho-seccao' },
        el('div', {}, el('h1', {}, `Olá, ${perfil.nome.split(' ')[0]}!`), el('p', {}, 'Aqui geres os teus jogos.')),
        el('div', { class: 'acoes' },
          pode(perfil, 'admin') ? el('a', { class: 'botao secundario', href: '/admin' }, icone('escudo'), 'Administração') : null,
          el('a', { class: 'botao secundario', href: '/conta' }, 'A minha conta'),
          podePublicar ? el('a', { class: 'botao', href: '/editar' }, icone('mais'), 'Publicar jogo') : null,
        ),
      ),
      aviso,
      podePublicar ? null : mensagem('aviso', 'A tua conta não tem permissão para publicar jogos. Fala com o administrador.'),
      el('section', {},
        el('h2', {}, 'Os meus jogos'),
        el('div', { style: 'margin-top:1rem' },
          jogos.length
            ? el('div', { class: 'tabela-contentor' },
                el('table', { class: 'tabela' },
                  el('thead', {}, el('tr', {},
                    el('th', {}, 'Jogo'), el('th', {}, 'Estado'), el('th', {}, 'Jogadas'), el('th', {}, 'Gostos'), el('th', {}, 'Atualizado'),
                    el('th', {}, el('span', { class: 'oculto' }, 'Ações')))),
                  el('tbody', {}, linhas)))
            : vazio('Ainda não publicaste nenhum jogo.',
                podePublicar ? el('a', { class: 'botao', href: '/editar' }, icone('mais'), 'Publicar o primeiro') : null),
        ),
      ),
    );
  }
} catch (erro) {
  preencher(conteudo, mensagem('erro-form', traduzirErro(erro)));
}
